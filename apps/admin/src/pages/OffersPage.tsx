import { Link } from "react-router-dom";

import { ConfirmButton } from "../components/ConfirmButton";
import { DataTable } from "../components/DataTable";
import { DateTime } from "../components/DateTime";
import { MoneyValue } from "../components/MoneyValue";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminApi } from "../hooks/useAdminApi";
import { useAsync } from "../hooks/useAsync";
import { asArray, AsyncBlock, objectName } from "./pageUtils";

export function OffersPage() {
  const api = useAdminApi();
  const state = useAsync(() => api.listOffers(), [api]);

  async function expire(id: string) {
    await api.expireOffer(id, { notes: "Expired from admin UI." });
    await state.reload();
  }

  return (
    <>
      <PageHeader
        title="Offers"
        description="Manually curated issuer and card offers with activation-aware recommendation impact."
        actions={
          <Link className="button" to="/offers/new">
            Create offer
          </Link>
        }
      />
      <AsyncBlock state={state}>
        {(data) => (
          <DataTable
            rows={asArray<any>(data)}
            columns={[
              {
                header: "Title",
                render: (row) => (
                  <Link to={`/offers/${row.id}/edit`}>{row.title}</Link>
                ),
              },
              {
                header: "Issuer/Card",
                render: (row) =>
                  `${objectName(row.issuer, "Any issuer")} / ${objectName(row.card, "Any card")}`,
              },
              {
                header: "Merchant/Category",
                render: (row) =>
                  `${objectName(row.merchant, "Any merchant")} / ${row.category ?? "Any category"}`,
              },
              {
                header: "Type",
                render: (row) => <StatusBadge value={row.offerType} />,
              },
              {
                header: "Value",
                render: (row) =>
                  row.valueCents ? (
                    <MoneyValue cents={row.valueCents} />
                  ) : (
                    (row.bonusPoints ?? row.bonusMultiplier ?? "n/a")
                  ),
              },
              {
                header: "Min spend",
                render: (row) => <MoneyValue cents={row.minSpendCents} />,
              },
              {
                header: "Ends",
                render: (row) => <DateTime value={row.endsAt} />,
              },
              {
                header: "Confidence",
                render: (row) => <StatusBadge value={row.confidence} />,
              },
              {
                header: "Actions",
                render: (row) => (
                  <ConfirmButton onConfirm={() => void expire(row.id)}>
                    Expire
                  </ConfirmButton>
                ),
              },
            ]}
          />
        )}
      </AsyncBlock>
    </>
  );
}
