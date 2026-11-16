import { escapeCsvField } from "./escape-csv-field";

export type CsvCell = string | number | boolean | null | undefined;

/** Serializes a rectangular CSV document with formula-safe cells and a UTF-8 BOM. */
export function serializeCsvDocument(
  headers: readonly string[],
  rows: readonly (readonly CsvCell[])[]
): string {
  if (headers.length === 0) throw new Error("CSVには少なくとも1つの列が必要です。");

  const invalidRowIndex = rows.findIndex((row) => row.length !== headers.length);
  if (invalidRowIndex >= 0) {
    throw new Error(
      "CSVの列数が一致しません（" + (invalidRowIndex + 1) + "行目: " +
      rows[invalidRowIndex]!.length + "列／header: " + headers.length + "列）。"
    );
  }

  return "\ufeff" + [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsvField(typeof cell === "boolean" ? String(cell) : cell)).join(","))
    .join("\r\n");
}
