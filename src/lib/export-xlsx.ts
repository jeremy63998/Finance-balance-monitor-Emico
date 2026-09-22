import * as XLSX from "xlsx";

export type ExportColumn<T> = {
  header: string;
  /** Field key or accessor function. Return primitive values (string/number/Date/boolean/null). */
  value: keyof T | ((row: T) => unknown);
  /** Optional Excel number format string, e.g. "#,##0.00", "yyyy-mm-dd". */
  numFmt?: string;
  /** Optional column width (in Excel character units). */
  width?: number;
};

export type SheetSpec<T> = {
  name: string;
  columns: ExportColumn<T>[];
  rows: T[];
};

function getCell<T>(row: T, col: ExportColumn<T>): unknown {
  if (typeof col.value === "function") return (col.value as (r: T) => unknown)(row);
  return (row as any)[col.value];
}

function sanitizeSheetName(name: string): string {
  // Excel: max 31 chars, cannot contain: : \ / ? * [ ]
  return name.replace(/[:\\/?*[\]]/g, " ").slice(0, 31) || "Sheet";
}

/** Build a worksheet from typed rows + column defs. */
export function buildSheet<T>(spec: SheetSpec<T>): XLSX.WorkSheet {
  const header = spec.columns.map((c) => c.header);
  const data = spec.rows.map((r) =>
    spec.columns.map((c) => {
      const v = getCell(r, c);
      if (v === undefined || v === null || v === "") return null;
      return v;
    }),
  );
  const aoa: any[][] = [header, ...data];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Apply number formats
  spec.columns.forEach((col, cIdx) => {
    if (!col.numFmt) return;
    for (let r = 1; r <= spec.rows.length; r++) {
      const ref = XLSX.utils.encode_cell({ c: cIdx, r });
      const cell = ws[ref];
      if (cell && (typeof cell.v === "number" || cell.v instanceof Date)) {
        cell.z = col.numFmt;
      }
    }
  });

  // Column widths
  ws["!cols"] = spec.columns.map((c) => ({
    wch: c.width ?? Math.max(10, Math.min(40, c.header.length + 4)),
  }));

  // Freeze header row
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  return ws;
}

/** Download an .xlsx file built from one or more sheet specs. */
export function exportToXlsx(
  fileName: string,
  sheets: SheetSpec<any>[],
): void {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = buildSheet(s);
    XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(s.name));
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const finalName = fileName.endsWith(".xlsx") ? fileName : `${fileName}_${stamp}.xlsx`;
  XLSX.writeFile(wb, finalName);
}
