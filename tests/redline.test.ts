import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { applyTrackedChangesToDocx, createDocxWithTrackedChanges } from "@/lib/redline/docxXml";
import { proposeRedline } from "@/lib/redline/propose";
import { makeDoc } from "./helpers";

describe("Tracked-Change Redlining (Part C Option 1)", () => {
  const originalText = `1. Term and Scope
This Agreement lasts for twelve months.

2. Limitation of Liability
The aggregate liability of Customer shall not exceed $1,000,000.`;

  it("creates a valid OpenXML DOCX archive with w:del and w:ins tracked changes", async () => {
    const edits = [
      {
        targetText: "The aggregate liability of Customer shall not exceed $1,000,000.",
        revisedText: "The aggregate liability of either party shall be mutual and not exceed $1,000,000.",
        author: "ContractAI",
      },
    ];

    const docxBuffer = await createDocxWithTrackedChanges(originalText, edits);
    expect(docxBuffer.length).toBeGreaterThan(500);

    // Unpack with JSZip to verify OpenXML WordprocessingML structure
    const zip = await JSZip.loadAsync(docxBuffer);
    expect(zip.file("[Content_Types].xml")).toBeDefined();
    expect(zip.file("word/document.xml")).toBeDefined();

    const documentXml = await zip.file("word/document.xml")!.async("string");
    expect(documentXml).toContain("<w:del");
    expect(documentXml).toContain('w:author="ContractAI"');
    expect(documentXml).toContain("<w:delText");
    expect(documentXml).toContain("The aggregate liability of Customer shall not exceed $1,000,000.");
    expect(documentXml).toContain("<w:ins");
    expect(documentXml).toContain("The aggregate liability of either party shall be mutual and not exceed $1,000,000.");
  });

  it("applies tracked changes to an existing DOCX without destroying other sections", async () => {
    // Generate initial base docx
    const baseBuffer = await createDocxWithTrackedChanges(originalText, []);

    const edits = [
      {
        targetText: "twelve months",
        revisedText: "twenty-four (24) months",
        author: "ContractAI",
      },
    ];

    const updatedBuffer = await applyTrackedChangesToDocx(baseBuffer, edits);
    const zip = await JSZip.loadAsync(updatedBuffer);
    const xml = await zip.file("word/document.xml")!.async("string");

    expect(xml).toContain("<w:del");
    expect(xml).toContain("twelve months");
    expect(xml).toContain("<w:ins");
    expect(xml).toContain("twenty-four (24) months");
    // Ensure section 2 is still intact
    expect(xml).toContain("Limitation of Liability");
  });

  it("proposes a surgical redline for a plain-language request", async () => {
    const doc = makeDoc("d-test", [
      "Section 1. Term\nThis agreement is valid for one year.",
      "Section 2. Limitation of Liability\nThe aggregate liability of Customer shall not exceed $1,000,000.",
    ]);

    const proposal = await proposeRedline(doc, "make the liability cap mutual");
    expect(proposal.targetText).toContain("liability");
    expect(doc.fullText).toContain(proposal.targetText);
    expect(proposal.revisedText).toContain("either party");
    expect(proposal.explanation).toBeDefined();
  });
});
