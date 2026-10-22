/** 직원 급여 계산 — 2026년 요율 */
export const RATES = {
  pension: 0.0475, // 국민연금(근로자)
  health: 0.03595, // 건강보험(근로자)
  ltc: 0.1314, // 장기요양: 근로자 건강보험료 × 13.14%
  employment: 0.009, // 고용보험(근로자)
  localTax: 0.1, // 주민세(지방소득세): 소득세의 10%
  holidayBonus: 0.6, // 명절휴가비: 기본급 × 60%
  overtime: 1.5,
  monthlyHours: 209,
  // 기관(사업주) 부담분 — 산재보험 제외
  erPension: 0.0475,
  erHealth: 0.03595,
  erEmployment: 0.0115, // 고용보험 0.9% + 고용안정·직능개발 0.25%(150인 미만)
} as const;

const f10 = (n: number) => Math.floor(Math.max(n, 0) / 10) * 10;
const int = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

export type PayInput = {
  baseSalary: number;
  overtimeHours: number;
  hourlyWage: number; // 통상시급
  leaveDays: number; // 연차수당 대상 잔여일
  holidayBonus: boolean; // 이번 달 명절휴가비 지급
  familyAllowance: number;
  seniorityAllowance: number; // 장기근속수당
  mealAllowance: number; // 정액급식비
  positionAllowance: number; // 직급·직책수당
  otherPay: number;
  pensionBase: number; // 국민연금 기준소득월액(신고액)
  healthBase: number; // 건강·고용보험 보수월액(신고액)
  incomeTax: number; // 소득세(간이세액표에서 조회한 값)
  otherDeduct: number;
};

export const defaultHourly = (baseSalary: number) => Math.floor(int(baseSalary) / RATES.monthlyHours);

export function calcPay(i: PayInput) {
  const base = int(i.baseSalary);
  const overtime = Math.floor(int(i.overtimeHours) * int(i.hourlyWage) * RATES.overtime);
  const leave = Math.floor(8 * int(i.hourlyWage) * int(i.leaveDays));
  const holiday = i.holidayBonus ? Math.floor(base * RATES.holidayBonus) : 0;
  const pays = {
    base, overtime, family: int(i.familyAllowance), holiday, position: int(i.positionAllowance),
    leave, seniority: int(i.seniorityAllowance), meal: int(i.mealAllowance), other: int(i.otherPay),
  };
  const gross = Object.values(pays).reduce((a, b) => a + b, 0);

  const pension = f10(int(i.pensionBase) * RATES.pension);
  const health = f10(int(i.healthBase) * RATES.health);
  const ltc = f10(health * RATES.ltc);
  const employment = f10(int(i.healthBase) * RATES.employment);
  const incomeTax = int(i.incomeTax);
  const localTax = f10(incomeTax * RATES.localTax);
  const other = int(i.otherDeduct);
  const deductions = { pension, health, ltc, employment, incomeTax, localTax, other };
  const totalDeduct = Object.values(deductions).reduce((a, b) => a + b, 0);

  const employer = {
    pension: f10(int(i.pensionBase) * RATES.erPension),
    health: f10(int(i.healthBase) * RATES.erHealth),
    ltc: ltc, // 사업주도 같은 금액
    employment: f10(int(i.healthBase) * RATES.erEmployment),
  };
  const employerTotal = employer.pension + employer.health + employer.ltc + employer.employment;

  return { pays, gross, deductions, totalDeduct, net: gross - totalDeduct, employer, employerTotal };
}

export type PayResult = ReturnType<typeof calcPay>;
