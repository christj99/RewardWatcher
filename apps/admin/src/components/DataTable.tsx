import { EmptyState } from "./EmptyState";

export type Column<T> = {
  header: string;
  render: (row: T) => React.ReactNode;
};

export function DataTable<T>({
  rows,
  columns,
  emptyTitle = "No records found",
}: {
  rows: T[];
  columns: Array<Column<T>>;
  emptyTitle?: string | undefined;
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} />;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.header}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={getRowKey(row, index)}>
              {columns.map((column) => (
                <td key={column.header}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getRowKey(row: unknown, index: number) {
  if (row && typeof row === "object" && "id" in row) {
    return String((row as { id?: string }).id);
  }
  return String(index);
}
