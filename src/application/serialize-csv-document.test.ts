import { describe, expect, it } from "vitest";
import { serializeCsvDocument } from "./serialize-csv-document";

describe("serializeCsvDocument", () => {
  it("writes a BOM, escapes delimiters and quotes, and neutralizes spreadsheet formulas", () => {
    const csv = serializeCsvDocument(
      ["name", "value"],
      [[`Ally, "One"`, `=HYPERLINK("https://example.invalid")`]]
    );

    expect(csv.startsWith("\ufeff")).toBe(true);
    expect(csv).toContain(`"Ally, ""One"""`);
    expect(csv).toContain(`"'=HYPERLINK(""https://example.invalid"")"`);
  });

  it("rejects rows with a different number of columns", () => {
    expect(() => serializeCsvDocument(["a", "b"], [[1]])).toThrow("CSVの列数が一致しません");
  });

  it("allows an empty result set while retaining the header", () => {
    expect(serializeCsvDocument(["candidate"], [])).toBe("\ufeff\"candidate\"");
  });
});
