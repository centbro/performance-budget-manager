// 프로그램 아이디어 제안 · 행정 서식 초안 공용 타입/상수

export const TARGET_GROUPS = ["노인", "아동·청소년", "장애인", "다문화·이주민", "여성·가족", "저소득·위기가구", "지역주민 일반"] as const;

export const DOC_TYPES = [
  { id: "draft", label: "기안서(내부결재)", hint: "행사·사업 추진을 위한 내부 결재 문서" },
  { id: "report", label: "결과보고서", hint: "행사·프로그램 종료 후 결과 보고" },
  { id: "business", label: "업무보고서", hint: "정기(주간·월간) 업무 현황 보고" },
  { id: "official", label: "공문(시행문)", hint: "외부 기관에 보내는 협조·요청 문서" },
] as const;
export type DocTypeId = (typeof DOC_TYPES)[number]["id"];

export type IdeaInput = {
  targetGroup: string;
  region: string;
  budget: number;
  goal: string;
  count: number;
  extra?: string;
};

export type ProgramIdea = {
  name: string;
  summary: string;
  activities: string[];
  outcome: string;
  indicator: string;
  budgetEstimate: string;
};

export type DocInput = {
  type: DocTypeId;
  title: string;
  org: string;
  facts: string; // 일시·장소·대상·내용·수치 등 사용자가 아는 사실
  budget?: string;
  extra?: string;
};
