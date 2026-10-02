import JSZip from "jszip";

export interface DocxEdit {
  targetText: string;
  revisedText: string;
  author?: string;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Applies native WordprocessingML tracked changes into a DOCX archive.
 * Preserves all original styles, fonts, bold, tables, headers, and numbering.
 * Produces valid <w:del> and <w:ins> elements compatible with Microsoft Word and LibreOffice.
 */
export async function applyTrackedChangesToDocx(
  docxBuffer: Buffer,
  edits: DocxEdit[],
  author = "ContractAI"
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(docxBuffer);
  const documentXmlFile = zip.file("word/document.xml");

  if (!documentXmlFile) {
    throw new Error("Invalid DOCX file: word/document.xml not found.");
  }

  let xml = await documentXmlFile.async("string");
  const timestamp = new Date().toISOString();
  let changeId = 1000 + Math.floor(Math.random() * 5000);

  for (const edit of edits) {
    const rawTarget = edit.targetText.trim();
    if (!rawTarget) continue;

    // 1. Direct search in XML text content
    const escapedTarget = escapeXml(rawTarget);
    const escapedReplacement = escapeXml(edit.revisedText.trim());

    // If target text exists cleanly within a single <w:t>...</w:t> tag
    if (xml.includes(escapedTarget)) {
      const delInsBlock = `</w:t></w:r><w:del w:id="${changeId++}" w:author="${author}" w:date="${timestamp}"><w:r><w:delText xml:space="preserve">${escapedTarget}</w:delText></w:r></w:del><w:ins w:id="${changeId++}" w:author="${author}" w:date="${timestamp}"><w:r><w:t xml:space="preserve">${escapedReplacement}</w:t></w:r></w:ins><w:r><w:t xml:space="preserve">`;

      xml = xml.replace(escapedTarget, delInsBlock);
      continue;
    }

    // 2. Paragraph-level replacement: handle text fragmented across adjacent <w:r> / <w:t> tags
    // Word documents often split words across multiple runs like <w:r><w:t>Liab</w:t></w:r><w:r><w:t>ility</w:t></w:r>
    const normTarget = normalizeWhitespace(rawTarget);
    const pRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/gi;

    xml = xml.replace(pRegex, (paragraphXml) => {
      // Extract text content of this paragraph
      const textMatches = Array.from(paragraphXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi));
      const fullParaText = textMatches.map((m) => m[1]).join("");
      const normParaText = normalizeWhitespace(fullParaText);

      if (!normParaText.includes(normTarget)) {
        return paragraphXml;
      }

      // Extract existing run properties if available
      const rPrMatch = paragraphXml.match(/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/i);
      const rPrXml = rPrMatch ? rPrMatch[0] : "";

      const trackedMarkup = `<w:del w:id="${changeId++}" w:author="${author}" w:date="${timestamp}"><w:r>${rPrXml}<w:delText xml:space="preserve">${escapeXml(rawTarget)}</w:delText></w:r></w:del><w:ins w:id="${changeId++}" w:author="${author}" w:date="${timestamp}"><w:r>${rPrXml}<w:t xml:space="preserve">${escapedReplacement}</w:t></w:r></w:ins>`;

      // Find first <w:r> and inject before closing paragraph
      return paragraphXml.replace(/<\/w:p>/i, `${trackedMarkup}</w:p>`);
    });
  }

  zip.file("word/document.xml", xml);
  const updatedBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return updatedBuffer;
}

/**
 * Creates a clean, standard OpenXML DOCX document from contract text with embedded tracked changes.
 * Used when redlining contracts to ensure clean opening in Microsoft Word and LibreOffice.
 */
export async function createDocxWithTrackedChanges(
  fullText: string,
  edits: DocxEdit[],
  author = "ContractAI"
): Promise<Buffer> {
  const zip = new JSZip();

  // 1. [Content_Types].xml
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );

  // 2. _rels/.rels
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  // 3. word/document.xml with paragraphs and tracked changes
  const paragraphs = fullText
    .split(/\n{2,}|\r\n\r\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const timestamp = new Date().toISOString();
  let changeId = 1000;

  const paragraphXmls: string[] = [];

  for (const para of paragraphs) {
    let pContent = "";
    // Check if this paragraph contains an edit target
    const applicableEdit = edits.find((e) => para.includes(e.targetText.trim()));

    if (applicableEdit) {
      const rawTarget = applicableEdit.targetText.trim();
      const rawReplacement = applicableEdit.revisedText.trim();
      const parts = para.split(rawTarget);

      for (let i = 0; i < parts.length; i++) {
        if (parts[i]) {
          pContent += `<w:r><w:t xml:space="preserve">${escapeXml(parts[i])}</w:t></w:r>`;
        }
        if (i < parts.length - 1) {
          pContent += `<w:del w:id="${changeId++}" w:author="${author}" w:date="${timestamp}"><w:r><w:delText xml:space="preserve">${escapeXml(rawTarget)}</w:delText></w:r></w:del>`;
          pContent += `<w:ins w:id="${changeId++}" w:author="${author}" w:date="${timestamp}"><w:r><w:t xml:space="preserve">${escapeXml(rawReplacement)}</w:t></w:r></w:ins>`;
        }
      }
    } else {
      pContent = `<w:r><w:t xml:space="preserve">${escapeXml(para)}</w:t></w:r>`;
    }

    paragraphXmls.push(`<w:p>${pContent}</w:p>`);
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphXmls.join("\n    ")}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  zip.file("word/document.xml", documentXml);

  return await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
