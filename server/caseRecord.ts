import { extractJson, maskPersonalInfo, type TemplateAnalysis } from "./docTemplate";

export type CaseSection = { heading: string; content: string };
export type CaseMeta = { recordDate: string; subject: string; category: string; summary: string };

const clip = (s: string, n: number) => s.trim().slice(0, n);

/** 대화·메모 형태의 원문을 기관 양식 항목에 배치하는 프롬프트. 개인정보(전화·주민번호 등)는 미리 가린다. */
export function buildCasePrompt(analysis: TemplateAnalysis, rawText: string, today: string) {
  const spec = analysis.sections.map((s, i) => `${i + 1}. ${s.heading} — ${s.guide} (${s.format})`).join("\n");
  const system = `당신은 사회복지 현장의 사례관리 기록 정리 담당자입니다. 담당자가 편하게 적은 메모·대화 내용을 아래 '기관 기록 양식'의 항목에 맞게 나누어 배치합니다.

[원칙]
- 항목명(heading)과 순서는 양식 그대로 유지하고, 항목을 추가하거나 빼지 않습니다.
- 담당자가 말한 사실만 사용합니다. 말하지 않은 내용·수치·날짜는 지어내지 말고 해당 항목 content를 "[확인 필요]"로 둡니다.
- 문체는 "${analysis.tone || "개조식"}"에 맞춰 간결하게 정리하되 사실은 바꾸지 않습니다. 표 형식 항목은 마크다운 표로 씁니다.
- 한 문장이 여러 항목에 걸치면 알맞은 항목에 나누어 넣습니다. 원문에 없는 평가·진단을 덧붙이지 않습니다.
- meta.recordDate는 상담·서비스 제공일(YYYY-MM-DD). 원문에 없으면 빈 문자열(오늘은 ${today}이며 '오늘/어제' 같은 표현만 이 기준으로 계산).
- meta.subject는 대상자 표기(원문에 나온 그대로, 없으면 빈 문자열), meta.category는 서비스·상담 유형을 짧은 명사구로(예: 법률상담, 통역지원, 의료연계), meta.summary는 한 줄 요약(100자 이내).

[기관 기록 양식: ${analysis.docKind || "기록지"}]
${spec}

JSON 객체 하나만 출력(코드블록 금지): {"meta":{"recordDate":"","subject":"","category":"","summary":""},"sections":[{"heading":"","content":""}]}`;
  return { system, user: `담당자 메모:\n${maskPersonalInfo(rawText)}` };
}

export function normalizeDate(v: unknown, fallback = ""): string {
  const m = typeof v === "string" ? v.trim().match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/) : null;
  if (!m) return fallback;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return fallback;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** 모델 응답 → 양식 항목 순서에 맞춘 섹션 + 메타. 항목명이 어긋나면 순서로 대응. */
export function parseCaseResult(analysis: TemplateAnalysis, raw: string, today: string): { meta: CaseMeta; sections: CaseSection[] } {
  const o = extractJson(raw);
  const arr: any[] = Array.isArray(o?.sections) ? o.sections : [];
  const norm = (s: string) => s.replace(/\s+/g, "");
  const used = new Set<number>();
  const sections = analysis.sections.map((sec, i) => {
    let idx = arr.findIndex((a, j) => !used.has(j) && typeof a?.heading === "string" && norm(a.heading) === norm(sec.heading));
    if (idx === -1 && arr[i] && !used.has(i)) idx = i;
    if (idx !== -1) used.add(idx);
    const c = idx !== -1 ? arr[idx]?.content : "";
    return { heading: sec.heading, content: typeof c === "string" ? c.trim() : "" };
  });
  const m = o?.meta ?? {};
  const str = (v: unknown, n: number) => (typeof v === "string" ? clip(v, n) : "");
  return {
    sections,
    meta: {
      recordDate: normalizeDate(m.recordDate, today),
      subject: str(m.subject, 100),
      category: str(m.category, 60) || "미분류",
      summary: str(m.summary, 300),
    },
  };
}

export type StatRecord = { recordDate: string; subject: string; category: string; templateName: string };

/** 실적 집계: 월별·유형별·양식별 건수와 실인원(대상자 표기 기준). */
export function computeCaseStats(records: StatRecord[]) {
  const count = (keyOf: (r: StatRecord) => string) => {
    const m = new Map<string, number>();
    for (const r of records) m.set(keyOf(r), (m.get(keyOf(r)) ?? 0) + 1);
    return Array.from(m, ([key, count]) => ({ key, count }));
  };
  const subjects = new Set(records.map((r) => r.subject.trim()).filter(Boolean));
  return {
    total: records.length,
    uniqueSubjects: subjects.size,
    byMonth: count((r) => r.recordDate.slice(0, 7)).sort((a, b) => a.key.localeCompare(b.key)),
    byCategory: count((r) => r.category).sort((a, b) => b.count - a.count),
    byTemplate: count((r) => r.templateName).sort((a, b) => b.count - a.count),
  };
}
