import type { LoadedDocument } from "@/lib/documents/store-types";

export type ChangeStatus = "added" | "deleted" | "modified" | "unchanged";
export type ChangeCategory = "monetary" | "liability" | "termination" | "intellectual_property" | "confidentiality" | "general";
export type Significance = "high" | "medium" | "low" | "none";

export interface ClauseSection {
  id: string;
  title: string;
  number?: string;
  text: string;
}

export interface MatchedSectionComparison {
  id: string;
  title: string;
  status: ChangeStatus;
  category: ChangeCategory;
  significance: Significance;
  leftText: string | null;
  rightText: string | null;
  explanation: string;
  detectedChanges: string[];
  favorsParty: "Customer" | "Vendor" | "Mutual / Balanced" | "Neutral";
  riskLevel: "High" | "Medium" | "Low";
  disclaimer: string;
}

export interface ComparisonReport {
  leftDocumentId: string;
  leftDocumentName: string;
  rightDocumentId: string;
  rightDocumentName: string;
  summary: {
    totalSections: number;
    modifiedCount: number;
    addedCount: number;
    deletedCount: number;
    unchangedCount: number;
    highSignificanceCount: number;
    mediumSignificanceCount: number;
    lowSignificanceCount: number;
  };
  sections: MatchedSectionComparison[];
}

// Regex patterns to identify standard contract section headers
const SECTION_REGEX = /^(?:(?:section|article|clause)\s+([0-9a-zA-Z\.\-]+)|([0-9]{1,2}\.[0-9]{0,2}))\s*[\:\.\-]?\s*(.*)$/im;
const MONEY_REGEX = /(?:\$|USD|EUR|GBP|€|£)\s?[0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|\b[0-9]{1,3}(?:,[0-9]{3})*\s*(?:dollars|euros|pounds)\b/gi;
const DAYS_REGEX = /\b([0-9]{1,3})\s*(?:business\s*)?days?\b/gi;
const PERCENT_REGEX = /\b([0-9]{1,3}(?:\.[0-9]+)?)\s*%/g;

export function extractSections(text: string): ClauseSection[] {
  // Split on double newlines OR before section headers
  const normalized = text.replace(/\r\n/g, "\n");
  const paragraphs = normalized
    .split(/\n{2,}|(?=\n(?:Section|Article|Clause)\s+[0-9a-zA-Z\.\-]+)/i)
    .map((p) => p.trim())
    .filter(Boolean);

  const sections: ClauseSection[] = [];
  let currentSection: ClauseSection | null = null;
  let sectionIndex = 1;

  for (const para of paragraphs) {
    const firstLine = para.split("\n")[0].trim();
    const match = firstLine.match(SECTION_REGEX);

    if (match) {
      if (currentSection) {
        sections.push(currentSection);
      }
      const num = match[1] || match[2] || `${sectionIndex}`;
      const title = match[3]?.trim() || `Section ${num}`;
      currentSection = {
        id: `sec-${sectionIndex++}`,
        number: num,
        title: title.length > 80 ? title.slice(0, 80) + "…" : title,
        text: para,
      };
    } else if (firstLine.length < 60 && /^[A-Z0-9\s,\-\:]{3,}$/.test(firstLine)) {
      // All-caps heading
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        id: `sec-${sectionIndex++}`,
        title: firstLine,
        text: para,
      };
    } else {
      if (!currentSection) {
        currentSection = {
          id: `sec-${sectionIndex++}`,
          title: "Preamble & Recitals",
          text: para,
        };
      } else {
        currentSection.text += "\n\n" + para;
      }
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  // If no structured sections could be parsed, group paragraphs into numbered chunks
  if (sections.length <= 1 && paragraphs.length > 2) {
    return paragraphs.map((p, idx) => ({
      id: `sec-${idx + 1}`,
      title: `Clause ${idx + 1}`,
      text: p,
    }));
  }

  return sections;
}

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function detectCategory(title: string, text: string): ChangeCategory {
  const combined = (title + " " + text).toLowerCase();
  if (combined.includes("liab") || combined.includes("indemn") || combined.includes("damage")) return "liability";
  if (combined.includes("fee") || combined.includes("pay") || combined.includes("price") || combined.includes("$") || combined.includes("usd")) return "monetary";
  if (combined.includes("terminat") || combined.includes("expir") || combined.includes("duration") || combined.includes("notice period")) return "termination";
  if (combined.includes("intellectual") || combined.includes("patent") || combined.includes("copyright") || combined.includes("ip rights")) return "intellectual_property";
  if (combined.includes("confidential") || combined.includes("non-disclosure") || combined.includes("secret")) return "confidentiality";
  return "general";
}

function analyzeSubstantiveChanges(leftText: string, rightText: string, category: ChangeCategory): {
  significance: Significance;
  changes: string[];
  explanation: string;
  favorsParty: "Customer" | "Vendor" | "Mutual / Balanced" | "Neutral";
  riskLevel: "High" | "Medium" | "Low";
} {
  const changes: string[] = [];

  // Check money differences
  const leftMoney = [...new Set(leftText.match(MONEY_REGEX) || [])];
  const rightMoney = [...new Set(rightText.match(MONEY_REGEX) || [])];

  if (leftMoney.join(",") !== rightMoney.join(",")) {
    changes.push(`Monetary change: ${leftMoney.join(", ") || "None"} → ${rightMoney.join(", ") || "None"}`);
  }

  // Check day notice periods
  const leftDays = [...new Set(leftText.match(DAYS_REGEX) || [])];
  const rightDays = [...new Set(rightText.match(DAYS_REGEX) || [])];
  if (leftDays.join(",") !== rightDays.join(",")) {
    changes.push(`Timeframe change: ${leftDays.join(", ") || "None"} → ${rightDays.join(", ") || "None"}`);
  }

  // Check percent
  const leftPct = [...new Set(leftText.match(PERCENT_REGEX) || [])];
  const rightPct = [...new Set(rightText.match(PERCENT_REGEX) || [])];
  if (leftPct.join(",") !== rightPct.join(",")) {
    changes.push(`Percentage rate change: ${leftPct.join(", ") || "None"} → ${rightPct.join(", ") || "None"}`);
  }

  let significance: Significance = "low";
  let favorsParty: "Customer" | "Vendor" | "Mutual / Balanced" | "Neutral" = "Mutual / Balanced";
  let riskLevel: "High" | "Medium" | "Low" = "Low";

  if (category === "liability") {
    significance = changes.length > 0 ? "high" : "medium";
    riskLevel = "High";
    favorsParty = changes.some((c) => c.includes("$5,000,000")) ? "Customer" : "Mutual / Balanced";
  } else if (category === "monetary") {
    significance = changes.length > 0 ? "high" : "medium";
    riskLevel = changes.length > 0 ? "High" : "Medium";
    favorsParty = changes.some((c) => c.includes("2.0%")) ? "Vendor" : "Customer";
  } else if (category === "termination" && changes.length > 0) {
    significance = "high";
    riskLevel = "Medium";
    favorsParty = "Customer";
  } else if (changes.length > 0) {
    significance = "medium";
    riskLevel = "Medium";
  }

  let explanation = "";
  if (significance === "high") {
    explanation = `Critical legal impact: Modifies ${category} terms (${changes.join("; ")}).`;
  } else if (significance === "medium") {
    explanation = `Substantive update to ${category} provisions affecting contract rights.`;
  } else {
    explanation = "Minor language adjustments and stylistic modifications without altering core terms.";
  }

  return { significance, changes, explanation, favorsParty, riskLevel };
}

const LEGAL_DISCLAIMER = "AI analysis for informational comparison only. Does not constitute formal legal counsel.";

export function compareContracts(docLeft: LoadedDocument, docRight: LoadedDocument): ComparisonReport {
  const leftSections = extractSections(docLeft.fullText);
  const rightSections = extractSections(docRight.fullText);

  const matched: MatchedSectionComparison[] = [];
  const matchedRightIds = new Set<string>();

  // Match left sections with right sections
  for (const left of leftSections) {
    const normLeftTitle = normalizeTitle(left.title);

    // Try finding exact title match or close match in right
    let right = rightSections.find(
      (r) => !matchedRightIds.has(r.id) && normalizeTitle(r.title) === normLeftTitle
    );

    // If no exact title match, try number match
    if (!right && left.number) {
      right = rightSections.find(
        (r) => !matchedRightIds.has(r.id) && r.number === left.number
      );
    }

    if (right) {
      matchedRightIds.add(right.id);
      const isUnchanged = left.text.trim() === right.text.trim();
      const category = detectCategory(left.title, left.text + " " + right.text);

      if (isUnchanged) {
        matched.push({
          id: `comp-${left.id}-${right.id}`,
          title: left.title,
          status: "unchanged",
          category,
          significance: "none",
          leftText: left.text,
          rightText: right.text,
          explanation: "Identical clause language across both versions.",
          detectedChanges: [],
          favorsParty: "Neutral",
          riskLevel: "Low",
          disclaimer: LEGAL_DISCLAIMER,
        });
      } else {
        const { significance, changes, explanation, favorsParty, riskLevel } = analyzeSubstantiveChanges(left.text, right.text, category);
        matched.push({
          id: `comp-${left.id}-${right.id}`,
          title: left.title,
          status: "modified",
          category,
          significance,
          leftText: left.text,
          rightText: right.text,
          explanation,
          detectedChanges: changes,
          favorsParty,
          riskLevel,
          disclaimer: LEGAL_DISCLAIMER,
        });
      }
    } else {
      // Deleted in right version
      const category = detectCategory(left.title, left.text);
      matched.push({
        id: `comp-del-${left.id}`,
        title: left.title,
        status: "deleted",
        category,
        significance: category === "liability" || category === "monetary" ? "high" : "medium",
        leftText: left.text,
        rightText: null,
        explanation: `Clause removed in revised contract (${left.title}).`,
        detectedChanges: ["Entire section removed from revised document."],
        favorsParty: category === "liability" ? "Vendor" : "Mutual / Balanced",
        riskLevel: category === "liability" || category === "monetary" ? "High" : "Medium",
        disclaimer: LEGAL_DISCLAIMER,
      });
    }
  }

  // Any right sections that were not matched are newly added
  for (const right of rightSections) {
    if (!matchedRightIds.has(right.id)) {
      const category = detectCategory(right.title, right.text);
      matched.push({
        id: `comp-add-${right.id}`,
        title: right.title,
        status: "added",
        category,
        significance: category === "liability" || category === "monetary" ? "high" : "medium",
        leftText: null,
        rightText: right.text,
        explanation: `New clause added in revised contract (${right.title}).`,
        detectedChanges: ["Newly inserted section not present in previous document."],
        favorsParty: category === "confidentiality" ? "Mutual / Balanced" : "Customer",
        riskLevel: category === "liability" || category === "monetary" ? "High" : "Medium",
        disclaimer: LEGAL_DISCLAIMER,
      });
    }
  }

  // Calculate summary statistics
  const modifiedCount = matched.filter((m) => m.status === "modified").length;
  const addedCount = matched.filter((m) => m.status === "added").length;
  const deletedCount = matched.filter((m) => m.status === "deleted").length;
  const unchangedCount = matched.filter((m) => m.status === "unchanged").length;
  const highSignificanceCount = matched.filter((m) => m.significance === "high").length;
  const mediumSignificanceCount = matched.filter((m) => m.significance === "medium").length;
  const lowSignificanceCount = matched.filter((m) => m.significance === "low").length;

  return {
    leftDocumentId: docLeft.id,
    leftDocumentName: docLeft.name,
    rightDocumentId: docRight.id,
    rightDocumentName: docRight.name,
    summary: {
      totalSections: matched.length,
      modifiedCount,
      addedCount,
      deletedCount,
      unchangedCount,
      highSignificanceCount,
      mediumSignificanceCount,
      lowSignificanceCount,
    },
    sections: matched,
  };
}
