export type QuarterCarry = { budget: number; carryIn: number; available: number; expense: number; remain: number; rate: number };

/** 앞 분기에 남은 예산(또는 초과분)을 다음 분기로 이월해 분기별 가용액과 잔여를 계산한다. */
export function computeCarryOver(budgets: number[], expenses: number[]): QuarterCarry[] {
  let carry = 0;
  return budgets.map((budget, i) => {
    const expense = expenses[i] ?? 0;
    const carryIn = carry;
    const available = budget + carryIn;
    const remain = available - expense;
    carry = remain;
    const rate = available > 0 ? Math.round((expense / available) * 100) : expense > 0 ? 100 : 0;
    return { budget, carryIn, available, expense, remain, rate };
  });
}
