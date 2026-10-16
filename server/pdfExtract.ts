import pdf from "pdf-parse";

/**
 * Download a PDF from a URL and extract its text.
 * Returns empty string on failure.
 */
export async function extractPdfTextFromUrl(url: string, maxChars = 12000): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[pdf] Failed to fetch ${url}: ${res.status}`);
      return "";
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const data = await pdf(buffer);
    const text = (data.text || "").trim();
    if (text.length > maxChars) {
      return text.slice(0, maxChars) + "\n\n[... 이하 생략 ...]";
    }
    return text;
  } catch (err) {
    console.warn("[pdf] extract failed:", err);
    return "";
  }
}

/**
 * Extract text from multiple PDF URLs and format them for an LLM prompt.
 */
export async function extractPlanPdfTexts(urls: string[]): Promise<string> {
  if (urls.length === 0) return "";

  const results: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    const text = await extractPdfTextFromUrl(urls[i]);
    if (text) {
      results.push(`--- 사업계획서 PDF ${i + 1} ---\n${text}`);
    }
  }

  if (results.length === 0) return "";
  return `\n\n[첨부된 사업계획서 PDF 내용]\n${results.join("\n\n")}`;
}

/** 업로드된 PDF 버퍼에서 텍스트를 추출한다. 실패하면 빈 문자열. */
export async function extractPdfTextFromBuffer(buffer: Buffer): Promise<string> {
  try {
    const data = await pdf(buffer);
    return (data.text || "").trim();
  } catch (err) {
    console.warn("[pdf] buffer extract failed:", err);
    return "";
  }
}
