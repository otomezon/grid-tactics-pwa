import { describe, expect, it } from "vitest";
import { escapeCsvField } from "./escape-csv-field";

describe("escapeCsvField", () => {
  it.each(["=1+1", "+SUM(A1:A2)", "-1+2", "@SUM(A1:A2)", " =1+1", "\t=1+1", "\r=1+1"])(
    "neutralizes spreadsheet formula prefixes in %j",
    (value) => {
      expect(escapeCsvField(value)).toBe('"' + "'" + value + '"');
    }
  );

  it.each(["\tplain text", "\rplain text"])(
    "neutralizes leading control characters in %j",
    (value) => {
      expect(escapeCsvField(value)).toBe('"' + "'" + value + '"');
    }
  );

  it("quotes fields and doubles embedded quotes", () => {
    expect(escapeCsvField('a,"b"')).toBe('"a,""b"""');
  });

  it("handles nullish and numeric values", () => {
    expect(escapeCsvField(null)).toBe('""');
    expect(escapeCsvField(undefined)).toBe('""');
    expect(escapeCsvField(42)).toBe('"42"');
  });
});
