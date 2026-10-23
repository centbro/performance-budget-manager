import { AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import type { DocBlock, GeneratedDoc } from "../shared/docChat";

export const MAX_SOURCE_EACH = 8000;
export const MAX_SOURCE_TOTAL = 45000;

export const PICK_SYSTEM = `당신은 복지기관 문서 작성 도우미입니다. 사용자의 지시를 보고, 폴더의 파일 이름 목록에서 문서를 쓸 때 참고하면 좋은 파일을 고릅니다.

규칙:
- 지시와 관련된 이전 연도 계획서·결과보고서·예산표·행사 자료·양식 등을 우선 고릅니다. 최대 8개.
- 이름만으로 관련이 없어 보이는 파일(사진, 이용자 명단 등)은 고르지 않습니다.
- 목록에 있는 이름을 한 글자도 바꾸지 말고 그대로 씁니다.

JSON만 출력: {"files":["파일 경로", ...]}`;

export const buildPickUser = (instruction: string, files: { path: string; size: number }[]) =>
  `[지시]\n${instruction}\n\n[폴더의 파일 목록]\n${files.map((f) => `${f.path} (${Math.max(1, Math.round(f.size / 1024))}KB)`).join("\n")}`;

export const WRITE_SYSTEM = `당신은 복지기관 행정 문서를 작성하는 도우미입니다. 사용자의 지시와 참고 파일을 바탕으로 문서를 씁니다.

핵심 규칙:
1. 지시에 적힌 사실(날짜·시간·순서·참여 인원·이름·금액)은 그대로 씁니다. 지시와 참고 파일이 다르면 지시를 따릅니다.
2. 참고 파일은 구성·항목·문체와, 지시가 "작년을 참고하라"고 한 부분(예: 역할 분담)을 가져오는 데 씁니다. 파일에 없는 사실은 지어내지 않습니다. 모르는 부분은 본문에 "[확인 필요: 내용]"으로 표시하고 notes에도 적습니다.
3. 금액은 정확히 계산합니다. 예산표는 항목별 금액을 숫자로 쓰고, 합계 행의 금액은 항목 합과 정확히 같아야 합니다. 지시에 총액과 일부 항목이 주어지면 나머지 항목은 총액에서 빼서 구합니다. 시간 순서 표(식순·일정)는 시작·종료 시각이 겹치지 않게 맞춥니다.
4. 행정 문서 문체(개조식: "~함", "~임", "~예정")로 간결하게 씁니다. 마크다운 기호(**, #)는 쓰지 않습니다. 한국어로 씁니다.
5. 사람 이름은 지시에 있는 것만 씁니다. 전화번호·주민번호 등 개인정보는 쓰지 않습니다.
6. 이전 초안이 주어지면 사용자의 새 요청만 반영해 고치고, 요청하지 않은 부분은 그대로 둡니다.

출력은 JSON만:
{"title":"문서 제목","blocks":[
 {"type":"heading","level":1,"text":"1. 추진 개요"},
 {"type":"paragraph","text":"..."},
 {"type":"bullets","items":["...","..."]},
 {"type":"table","caption":"표 이름","headers":["구분","내용"],"rows":[["일시","2026. 12. 6.(토) 13:00~14:30"]]}
],"notes":["확인이 필요한 점이나 가정한 내용(없으면 빈 배열)"]}
표의 금액 칸은 "3,965,000"처럼 숫자와 쉼표만 씁니다(단위는 머리글에).`;

export function buildWriteUser(p: {
  instruction: string;
  history: { role: "user" | "assistant"; text: string }[];
  sources: { name: string; text: string }[];
  prevDoc?: GeneratedDoc | null;
  fix?: string[];
}): string {
  const parts: string[] = [];
  if (p.sources.length) parts.push("[참고 파일]\n" + p.sources.map((s, i) => `### 파일 ${i + 1}: ${s.name}\n${s.text}`).join("\n\n"));
  if (p.history.length) parts.push("[이전 대화]\n" + p.history.slice(-6).map((h) => `${h.role === "user" ? "사용자" : "도우미"}: ${h.text.slice(0, 1500)}`).join("\n"));
  if (p.prevDoc) parts.push("[이전 초안(JSON)]\n" + JSON.stringify({ title: p.prevDoc.title, blocks: p.prevDoc.blocks }));
  if (p.fix?.length) parts.push("[바로잡을 점]\n" + p.fix.join("\n") + "\n위 계산 오류를 고쳐서 같은 형식의 JSON으로 다시 출력하세요.");
  parts.push(`[이번 지시]\n${p.instruction}`);
  return parts.join("\n\n");
}

const FONT = "맑은 고딕";
const cell = (text: string, header = false, w?: number) =>
  new TableCell({
    width: w ? { size: w, type: WidthType.PERCENTAGE } : undefined,
    shading: header ? { fill: "E8EDF3" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ alignment: header ? AlignmentType.CENTER : AlignmentType.LEFT, children: [new TextRun({ text, bold: header, font: FONT, size: 20 })] })],
  });

function blockToDocx(b: DocBlock): (Paragraph | Table)[] {
  if (b.type === "heading") {
    const size = b.level === 1 ? 28 : b.level === 2 ? 24 : 22;
    return [new Paragraph({ spacing: { before: 280, after: 120 }, heading: b.level === 1 ? HeadingLevel.HEADING_1 : b.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3, children: [new TextRun({ text: b.text, bold: true, font: FONT, size })] })];
  }
  if (b.type === "paragraph") {
    return [new Paragraph({ spacing: { after: 100, line: 340 }, children: [new TextRun({ text: b.text, font: FONT, size: 22 })] })];
  }
  if (b.type === "bullets") {
    return b.items.map((t) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 60, line: 320 }, children: [new TextRun({ text: t, font: FONT, size: 22 })] }));
  }
  const border = { style: BorderStyle.SINGLE, size: 4, color: "888888" };
  const colW = Math.floor(100 / b.headers.length);
  const out: (Paragraph | Table)[] = [];
  if (b.caption) out.push(new Paragraph({ spacing: { before: 160, after: 60 }, children: [new TextRun({ text: `<${b.caption}>`, bold: true, font: FONT, size: 21 })] }));
  out.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [
      new TableRow({ tableHeader: true, children: b.headers.map((h) => cell(h, true, colW)) }),
      ...b.rows.map((r) => new TableRow({ children: r.map((c) => cell(c, false, colW)) })),
    ],
  }));
  out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  return out;
}

export async function buildDocx(doc: GeneratedDoc): Promise<Buffer> {
  const d = new Document({
    creator: "복지실무톡",
    title: doc.title,
    sections: [{
      properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 280 }, children: [new TextRun({ text: doc.title, bold: true, font: FONT, size: 34 })] }),
        ...doc.blocks.flatMap(blockToDocx),
      ],
    }],
  });
  return Packer.toBuffer(d);
}
