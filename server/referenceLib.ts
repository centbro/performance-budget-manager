import { extractPdfPages } from "./pdfExtract";
import { maskPersonalInfo } from "./docTemplate";
import { tokenize, scoreText } from "./caseSearch";
import { createReferenceDoc, getUserChunks, countUserDocs } from "./referenceDb";

export class ReferenceError extends Error {}

export type RefChunk = { docId: number; docName: string; page: number; text: string };

const MAX_DOCS_PER_USER = 30;
const MAX_PAGES = 400;
const CHUNK_CHARS = 1100;

/** 한 쪽의 글을 문단 경계에서 CHUNK_CHARS 이하로 나눈다. */
export function chunkPage(text: string): string[] {
  const clean = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length < 30) return [];
  if (clean.length <= CHUNK_CHARS) return [clean];
  const out: string[] = [];
  let cur = "";
  for (const line of clean.split("\n")) {
    if ((cur + "\n" + line).length > CHUNK_CHARS && cur) {
      out.push(cur.trim());
      cur = "";
    }
    cur += (cur ? "\n" : "") + line;
    while (cur.length > CHUNK_CHARS * 1.5) {
      out.push(cur.slice(0, CHUNK_CHARS));
      cur = cur.slice(CHUNK_CHARS);
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export async function registerReferencePdf(userId: number, name: string, buffer: Buffer): Promise<{ id: number; pages: number; chunks: number }> {
  if ((await countUserDocs(userId)) >= MAX_DOCS_PER_USER) {
    throw new ReferenceError(`참고자료는 최대 ${MAX_DOCS_PER_USER}개까지 올릴 수 있습니다. 쓰지 않는 자료를 삭제해 주세요.`);
  }
  const pages = await extractPdfPages(buffer);
  if (pages.length === 0 || pages.join("").replace(/\s/g, "").length < 200) {
    throw new ReferenceError("PDF에서 글자를 읽지 못했습니다. 스캔한 이미지 PDF는 지원하지 않으니, 글자가 선택되는 PDF를 올려 주세요.");
  }
  if (pages.length > MAX_PAGES) {
    throw new ReferenceError(`${MAX_PAGES}쪽을 넘는 자료는 올릴 수 없습니다. 필요한 부분만 나누어 올려 주세요.`);
  }
  const chunks: { page: number; text: string }[] = [];
  pages.forEach((p, i) => {
    for (const c of chunkPage(maskPersonalInfo(p))) chunks.push({ page: i + 1, text: c });
  });
  if (chunks.length === 0) throw new ReferenceError("읽을 수 있는 글이 거의 없습니다. 다른 파일로 시도해 주세요.");
  const id = await createReferenceDoc({ userId, name, pageCount: pages.length, chunks });
  return { id, pages: pages.length, chunks: chunks.length };
}

/** 사용자 자료에서 질문과 관련 있는 부분을 찾는다. 자료가 없거나 관련 없으면 빈 배열. */
export async function searchReferences(userId: number, query: string, topK = 5, docIds?: number[]): Promise<RefChunk[]> {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const rows = await getUserChunks(userId, docIds);
  return rows
    .map((r) => ({ r, s: scoreText(r.text, tokens) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, topK)
    .map(({ r }) => ({ docId: r.docId, docName: r.docName, page: r.page, text: r.text }));
}

/** 프롬프트에 붙일 참고자료 블록. 없으면 빈 문자열. */
export function formatReferences(refs: RefChunk[] | undefined): string {
  if (!refs || refs.length === 0) return "";
  const body = refs
    .map((r, i) => `(${i + 1}) 「${r.docName}」 p.${r.page}\n${r.text.slice(0, 900)}`)
    .join("\n\n");
  return `\n\n[사용자가 올린 참고자료 — 지침·근거는 여기서만 찾는다]
- 아래 자료에 있는 내용만 지침·근거로 인용하고, 인용할 때 (「자료명」 p.쪽수)를 붙인다.
- 자료에 없는 규정·수치·법령은 지어내지 말고 "[확인 필요]"로 둔다. 자료와 사용자 입력이 다르면 사용자 입력을 우선하고 차이를 알린다.
${body}`;
}
