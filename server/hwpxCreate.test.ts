import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import { buildHwpx } from "./hwpxCreate";
import { listParagraphs } from "./docEdit";
import type { GeneratedDoc } from "../shared/docChat";

const DOC: GeneratedDoc = {
  title: "2026년 사업보고회 계획(안)",
  notes: [],
  blocks: [
    { type: "heading", level: 1, text: "1. 추진 개요" },
    { type: "paragraph", text: "일시: 2026. 12. 6.(일) 13:00~14:30 & <장소> 센터" },
    { type: "bullets", items: ["오프닝 공연", "환영사"] },
    { type: "table", caption: "예산", headers: ["항목", "금액(원)"], rows: [["다과", "1,900,000"], ["합계", "1,900,000"]] },
  ],
};

describe("hwpx 새 문서 만들기", () => {
  it("mimetype이 맨 앞·무압축이고 모든 XML이 올바르다", async () => {
    const buf = await buildHwpx(DOC);
    expect(buf.subarray(0, 4).toString("hex")).toBe("504b0304");
    // 첫 파일 이름이 mimetype
    expect(buf.subarray(30, 38).toString()).toBe("mimetype");
    const z = await JSZip.loadAsync(buf);
    for (const f of ["Contents/header.xml", "Contents/section0.xml", "Contents/content.hpf", "version.xml", "META-INF/container.xml"]) {
      const xml = await z.file(f)!.async("string");
      const errs: string[] = [];
      new DOMParser({ onError: (_l, m) => errs.push(m) } as any).parseFromString(xml, "text/xml");
      expect(errs, f).toEqual([]);
    }
  });

  it("개수 속성이 실제 항목 수와 맞다", async () => {
    const z = await JSZip.loadAsync(await buildHwpx(DOC));
    const h = await z.file("Contents/header.xml")!.async("string");
    const cnt = (tag: string, item: string) => [+h.match(new RegExp(`<hh:${tag} itemCnt="(\\d+)"`))![1], (h.match(new RegExp(`<hh:${item} id=`, "g")) || []).length];
    for (const [t, i] of [["charProperties", "charPr"], ["paraProperties", "paraPr"], ["borderFills", "borderFill"]]) {
      const [a, b] = cnt(t, i);
      expect(a, t).toBe(b);
    }
  });

  it("본문 글자·표가 들어가고 특수문자는 이스케이프된다, 고쳐 쓰기 코드로도 읽힌다", async () => {
    const buf = await buildHwpx(DOC);
    const r = await listParagraphs(buf);
    const texts = r.paragraphs.map((p) => p.text);
    expect(texts).toContain("2026년 사업보고회 계획(안)");
    expect(texts).toContain("1. 추진 개요");
    expect(texts).toContain("일시: 2026. 12. 6.(일) 13:00~14:30 & <장소> 센터");
    expect(texts).toContain("○ 환영사");
    expect(r.paragraphs.find((p) => p.text === "1,900,000" && p.cell)!.cell).toMatchObject({ r: 1, c: 1 });
    const sec = await (await JSZip.loadAsync(buf)).file("Contents/section0.xml")!.async("string");
    expect(sec).toContain("&amp; &lt;장소&gt;");
    expect(sec.match(/<hp:tbl /g)!.length).toBe(1);
  });
});
