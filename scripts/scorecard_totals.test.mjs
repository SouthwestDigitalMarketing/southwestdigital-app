import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { countReportFiles, countTeamMonths, mergeMonths, monthList, readConfig } from "./scorecard_totals.mjs";

const COLUMNS = { Column: ["Date", "Create Date", "Created By", "Last Modified", "Last Modified By"].map((ColTitle) => ({ ColTitle })) };
const row = (created, createdBy, changed, changedBy) => ({
  type: "Data",
  ColData: [{ value: "2020-01-01" }, { value: created }, { value: createdBy }, { value: changed }, { value: changedBy }],
});

describe("countTeamMonths", () => {
  it("counts our entries by create month and our changes by change month, once each", () => {
    const report = {
      Columns: COLUMNS,
      Rows: {
        Row: [
          row("2026-06-03T10:00:00-07:00", "Thomas MacDonald", "2026-07-01T09:00:00-07:00", "Thomas MacDonald"),
          row("2019-02-01T10:00:00-08:00", "Online Banking Administration", "2026-07-15T09:00:00-07:00", "thomas macdonald "),
          row("2026-07-02T10:00:00-07:00", "Client Staff", "2026-07-02T10:00:00-07:00", "Client Staff"),
          // A sectioned report nests rows.
          { type: "Section", Rows: { Row: [row("2026-06-30T23:00:00-07:00", "Thomas MacDonald", "", "")] } },
        ],
      },
    };
    const { rows, months } = countTeamMonths(report, ["Thomas MacDonald"]);
    expect(rows).toBe(4);
    expect(Object.fromEntries(months)).toEqual({ "2026-06": 2, "2026-07": 1 });
  });

  it("fails loudly when QuickBooks leaves out a column", () => {
    expect(() => countTeamMonths({ Columns: { Column: [{ ColTitle: "Date" }] }, Rows: {} }, ["x"])).toThrow(/missing a column/);
  });

  it("handles an empty report", () => {
    expect(countTeamMonths({ Columns: COLUMNS, Rows: {} }, ["x"]).rows).toBe(0);
  });
});

describe("countReportFiles", () => {
  let root;
  afterEach(() => root && fs.rmSync(root, { recursive: true, force: true }));

  it("counts only <client>/reports/<year>/<YYYY-MM>.pdf, by covered month", () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "totals-"));
    const put = (rel) => {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), "x");
    };
    put("a/reports/2026/2026-10.pdf");
    put("b/reports/2026/2026-10.pdf");
    put("b/reports/2025/2025-12.pdf");
    put("b/reports/2026/2025-11.pdf"); // year folder does not match
    put("b/reports/2026/2026-13.pdf"); // no such month
    put("b/reports/2026/notes.pdf");
    put("c/statements/2026/2026-10.pdf");
    expect(Object.fromEntries(countReportFiles(root))).toEqual({ "2026-10": 2, "2025-12": 1 });
  });

  it("is empty for a missing root", () => {
    expect(countReportFiles("/nonexistent/scorecard-totals").size).toBe(0);
  });
});

describe("monthList and mergeMonths", () => {
  it("adds, sorts, and drops months after the current one", () => {
    const merged = mergeMonths(new Map([["2026-10", 2]]), new Map([["2026-10", 3], ["2026-09", 1], ["2027-01", 9]]));
    expect(monthList(merged, "2026-11")).toEqual([
      { month: "2026-09", value: 1 },
      { month: "2026-10", value: 5 },
    ]);
  });
});

describe("readConfig", () => {
  it("falls back to defaults for a missing file or bad lists", () => {
    expect(readConfig("/nonexistent/totals.json").team).toEqual(["Thomas MacDonald"]);
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "totals-")), "t.json");
    fs.writeFileSync(file, JSON.stringify({ team: ["A", "B"], skipCompanies: "nope" }));
    expect(readConfig(file)).toEqual({ team: ["A", "B"], skipCompanies: ["Bookkeeping Conroe", "Thomas Grant MacDonald"] });
  });
});
