import { useState } from "react";

import type {
  AdminJobsStatus,
  ScheduledJobName,
  ScheduledJobRun,
} from "../api/types";
import { DataTable } from "../components/DataTable";
import { DateTime } from "../components/DateTime";
import { JsonDetails } from "../components/JsonDetails";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminApi } from "../hooks/useAdminApi";
import { useAsync } from "../hooks/useAsync";
import { asArray, AsyncBlock } from "./pageUtils";

const jobNames: ScheduledJobName[] = [
  "WEEKLY_AUDIT_EMAIL",
  "REMINDER_DIGEST",
  "ADMIN_ALERT",
  "PLAID_SYNC_ALL",
  "STATEMENT_CREDIT_USAGE_GENERATION",
  "EVAL_KILL_TEST_SNAPSHOT",
];

export function JobsPage() {
  const api = useAdminApi();
  const status = useAsync<AdminJobsStatus>(
    () => api.getJobStatus() as Promise<AdminJobsStatus>,
    [api],
  );
  const runs = useAsync(() => api.getJobRuns(), [api]);
  const [jobName, setJobName] = useState<ScheduledJobName>("REMINDER_DIGEST");
  const [dryRun, setDryRun] = useState(true);
  const [jsonInput, setJsonInput] = useState("{}");
  const [formError, setFormError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<ScheduledJobRun | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    let parsedInput: Record<string, unknown>;
    try {
      parsedInput = JSON.parse(jsonInput) as Record<string, unknown>;
      if (!parsedInput || Array.isArray(parsedInput)) {
        throw new Error("Input must be a JSON object.");
      }
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Input must be valid JSON.",
      );
      return;
    }
    const run = (await api.runJob({
      jobName,
      dryRun,
      input: parsedInput,
    })) as ScheduledJobRun;
    setLastRun(run as ScheduledJobRun);
    runs.reload();
    status.reload();
  }

  return (
    <>
      <PageHeader
        title="Jobs"
        description="Scheduled job status, run history, and manual dry-run controls."
      />
      <AsyncBlock state={status}>
        {(data) => (
          <section className="panel">
            <h2>Scheduler</h2>
            <div className="grid">
              <div className="metric">
                <span>Scheduler</span>
                <strong>
                  {data.schedulerEnabled ? "Enabled" : "Disabled"}
                </strong>
              </div>
              <div className="metric">
                <span>Registered jobs</span>
                <strong>{data.registeredJobs.length}</strong>
              </div>
              <div className="metric">
                <span>Running jobs</span>
                <strong>{data.runningJobs.length}</strong>
              </div>
              <div className="metric">
                <span>Recent failures</span>
                <strong>{data.recentFailures.length}</strong>
              </div>
            </div>
            <JsonDetails
              title="Configured schedules"
              value={data.configuredSchedules}
            />
          </section>
        )}
      </AsyncBlock>

      <section className="panel">
        <h2>Manual Trigger</h2>
        <form className="form-grid" onSubmit={(event) => void submit(event)}>
          <label>
            Job
            <select
              value={jobName}
              onChange={(event) =>
                setJobName(event.target.value as ScheduledJobName)
              }
            >
              {jobNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(event) => setDryRun(event.target.checked)}
            />
            Dry run
          </label>
          <label className="full-span">
            Input JSON
            <textarea
              value={jsonInput}
              onChange={(event) => setJsonInput(event.target.value)}
              rows={6}
            />
          </label>
          {formError ? <p className="form-error">{formError}</p> : null}
          <button type="submit">Run job</button>
        </form>
        {lastRun ? (
          <JsonDetails title="Last run result" value={lastRun.result} />
        ) : null}
      </section>

      <AsyncBlock state={runs}>
        {(data) => (
          <DataTable
            rows={asArray<ScheduledJobRun>(data)}
            columns={[
              {
                header: "Started",
                render: (row) => <DateTime value={row.startedAt} />,
              },
              { header: "Job", render: (row) => row.jobName },
              {
                header: "Status",
                render: (row) => <StatusBadge value={row.status} />,
              },
              { header: "Trigger", render: (row) => row.triggeredBy },
              {
                header: "Duration",
                render: (row) =>
                  row.durationMs === null || row.durationMs === undefined
                    ? "Running"
                    : `${row.durationMs}ms`,
              },
              {
                header: "Details",
                render: (row) => (
                  <>
                    {row.errorMessage ? (
                      <p className="form-error">{row.errorMessage}</p>
                    ) : null}
                    <JsonDetails title="Result" value={row.result} />
                    <JsonDetails title="Metadata" value={row.metadata} />
                  </>
                ),
              },
            ]}
          />
        )}
      </AsyncBlock>
    </>
  );
}
