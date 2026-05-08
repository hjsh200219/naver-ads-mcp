export interface PivotCell {
  value: string | number | null;
  format?: "currency" | "integer" | "percent" | "decimal";
}

export interface PivotSheet {
  title: string;
  rows: PivotCell[][];
  hidden?: boolean;
}
