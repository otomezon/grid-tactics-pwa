/**
 * Escape a CSV field and neutralize spreadsheet formula prefixes.
 *
 * Spreadsheet applications may evaluate cells beginning with formula markers,
 * including when they are preceded by whitespace/control characters.
 */
export function escapeCsvField(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  const hasFormulaPrefix = /^[\u0000-\u0020]*[=+\-@]/.test(text);
  const startsWithControl = /^[\t\r]/.test(text);
  const safe = hasFormulaPrefix || startsWithControl ? "'" + text : text;

  return '"' + safe.replace(/"/g, '""') + '"';
}
