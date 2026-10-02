import { describe, expect, it } from "vitest";
import { compareContracts, extractSections } from "@/lib/comparison/compare";
import { makeDoc } from "./helpers";

describe("compareContracts", () => {
  it("extracts sections and detects modifications with monetary differences", () => {
    const v1 = makeDoc("doc-v1", [
      "1. Term and Termination\nThis Agreement shall remain in effect for 12 months.",
      "2. Limitation of Liability\nThe aggregate liability of the parties shall not exceed $1,000,000.",
      "3. Governing Law\nThis Agreement is governed by the laws of California.",
    ]);

    const v2 = makeDoc("doc-v2", [
      "1. Term and Termination\nThis Agreement shall remain in effect for 24 months.",
      "2. Limitation of Liability\nThe aggregate liability of the parties shall not exceed $5,000,000.",
      "4. Confidentiality\nEach party shall keep confidential information strictly private.",
    ]);

    const report = compareContracts(v1, v2);

    expect(report.summary.totalSections).toBeGreaterThanOrEqual(3);

    // Section 2 should be modified with high significance due to liability & monetary change
    const liabilityComp = report.sections.find((s) => s.title.toLowerCase().includes("liability"));
    expect(liabilityComp).toBeDefined();
    expect(liabilityComp?.status).toBe("modified");
    expect(liabilityComp?.significance).toBe("high");
    expect(liabilityComp?.detectedChanges.some((c) => c.includes("$1,000,000") && c.includes("$5,000,000"))).toBe(true);

    // Section 3 (Governing Law) was deleted in v2
    const deletedSection = report.sections.find((s) => s.status === "deleted");
    expect(deletedSection).toBeDefined();

    // Section 4 (Confidentiality) was added in v2
    const addedSection = report.sections.find((s) => s.status === "added");
    expect(addedSection).toBeDefined();
  });

  it("handles identical contract clauses cleanly as unchanged", () => {
    const v1 = makeDoc("doc-v1", ["Section 1. Preamble\nParties agree to the terms."]);
    const v2 = makeDoc("doc-v2", ["Section 1. Preamble\nParties agree to the terms."]);

    const report = compareContracts(v1, v2);
    expect(report.summary.unchangedCount).toBe(1);
    expect(report.summary.modifiedCount).toBe(0);
  });

  it("computes word-level diffs highlighting only the exact changed words", async () => {
    const { diffWords } = await import("@/lib/comparison/diff");
    const left = "giving CONSULTANT thirty-day (30-day) written notice thereof.";
    const right = "giving CONSULTANT sixty-day (60-day) written notice thereof.";

    const result = diffWords(left, right);
    expect(result.hasDifferences).toBe(true);

    // Left should have unchanged prefix, deleted target, unchanged suffix
    const deleted = result.leftTokens.find((t) => t.op === "deleted");
    expect(deleted?.text).toContain("thirty-day (30-day)");
    const leftSame = result.leftTokens.filter((t) => t.op === "same").map((t) => t.text).join("");
    expect(leftSame).toContain("giving CONSULTANT");
    expect(leftSame).toContain("written notice thereof.");

    // Right should have unchanged prefix, inserted target, unchanged suffix
    const inserted = result.rightTokens.find((t) => t.op === "inserted");
    expect(inserted?.text).toContain("sixty-day (60-day)");
    const rightSame = result.rightTokens.filter((t) => t.op === "same").map((t) => t.text).join("");
    expect(rightSame).toContain("giving CONSULTANT");
    expect(rightSame).toContain("written notice thereof.");
  });
});
