import { Link } from "react-router-dom";

import { DataTable } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";

export type AnyRecord = Record<string, any>;

export function asArray<T = AnyRecord>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (value && typeof value === "object") {
    const record = value as { items?: T[]; data?: T[]; results?: T[] };
    return record.items ?? record.data ?? record.results ?? [];
  }
  return [];
}

export function objectName(value: any, fallback = "n/a"): string {
  if (!value) {
    return fallback;
  }
  if (typeof value === "string") {
    return value;
  }
  return (
    value.name ??
    value.title ??
    value.displayName ??
    value.email ??
    value.slug ??
    value.id ??
    fallback
  );
}

export function cardName(row: any): string {
  return objectName(
    row.card ?? row.userCard?.card ?? row.recommendedCard ?? row.bestCard,
  );
}

export function merchantName(row: any): string {
  return objectName(
    row.merchant ?? row.transaction?.merchant,
    row.rawMerchantName ?? "n/a",
  );
}

export function queryDateTimeLocal(value?: string | null): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 16);
}

export function toIsoOrUndefined(
  value: FormDataEntryValue | null,
): string | undefined {
  if (!value || typeof value !== "string") {
    return undefined;
  }
  return value ? new Date(value).toISOString() : undefined;
}

export function nullableString(
  value: FormDataEntryValue | null,
): string | null | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return value.trim() ? value.trim() : null;
}

export function optionalNumber(
  value: FormDataEntryValue | null,
): number | null | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return value.trim() ? Number(value) : null;
}

export function optionalString(
  value: FormDataEntryValue | null,
): string | null | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return value.trim() ? value.trim() : null;
}

export function AsyncBlock<T>({
  state,
  children,
}: {
  state: {
    isLoading: boolean;
    error: Error | null;
    data: T | null;
    reload: () => void;
  };
  children: (data: T) => React.ReactNode;
}) {
  if (state.isLoading) {
    return <LoadingState />;
  }
  if (state.error) {
    return <ErrorState error={state.error} onRetry={state.reload} />;
  }
  if (state.data === null) {
    return <EmptyState title="No data returned" />;
  }
  return <>{children(state.data)}</>;
}

export function SimpleListPage<T>({
  rows,
  columns,
  emptyTitle,
}: {
  rows: T[];
  columns: Array<{ header: string; render: (row: T) => React.ReactNode }>;
  emptyTitle?: string | undefined;
}) {
  return <DataTable rows={rows} columns={columns} emptyTitle={emptyTitle} />;
}

export function RelatedLink({
  to,
  children,
}: {
  to?: string;
  children: React.ReactNode;
}) {
  return to ? <Link to={to}>{children}</Link> : <>{children}</>;
}
