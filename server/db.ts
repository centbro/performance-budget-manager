import { eq, and, inArray, isNull, sql, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  InsertUser,
  users,
  projects,
  participants,
  performanceRecords,
  recordParticipants,
  budgets,
  expenses,
  InsertProject,
  InsertParticipant,
  InsertPerformanceRecord,
  InsertBudget,
  InsertExpense,
  projectPlans,
  evaluations,
  Evaluation,
  InsertEvaluation,
  schedules,
  Schedule,
  InsertSchedule,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      const pool = mysql.createPool({
        host: url.hostname,
        port: Number(url.port) || 4000,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.replace(/^\//, "") || "test",
        ssl: {
          minVersion: "TLSv1.2",
          rejectUnauthorized: true,
        },
        waitForConnections: true,
        connectionLimit: 10,
      });
      _db = drizzle(pool) as unknown as typeof _db;
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Projects (큰 사업) ────────────────────────────────────────────────────────

/** 큰 사업 목록 (parentId = NULL) */
export async function getParentProjects(userId: number, year: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.year, year), isNull(projects.parentId)));
}

/** 세부 사업 목록 (특정 큰 사업의 자식) */
export async function getSubProjects(parentId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.parentId, parentId), eq(projects.userId, userId)));
}

/** 모든 사업 (큰 사업 + 세부 사업) - 사이드바 등에서 사용 */
export async function getProjects(userId: number, year: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.year, year)));
}

export async function getProjectById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .limit(1);
  return result[0];
}

export async function createProject(data: InsertProject) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(projects).values(data).$returningId();
  return result[0];
}

export async function updateProject(id: number, userId: number, data: Partial<InsertProject>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(projects).set(data).where(and(eq(projects.id, id), eq(projects.userId, userId)));
}

/** 세부 사업 삭제 (실적 기록 cascade) */
async function deleteSubProject(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, subId: number, userId: number) {
  const subRecords = await db
    .select({ id: performanceRecords.id })
    .from(performanceRecords)
    .where(and(eq(performanceRecords.projectId, subId), eq(performanceRecords.userId, userId)));

  for (const r of subRecords) {
    await db.delete(recordParticipants).where(eq(recordParticipants.recordId, r.id));
  }
  for (const r of subRecords) {
    await db.delete(performanceRecords).where(eq(performanceRecords.id, r.id));
  }
  await db.delete(projects).where(and(eq(projects.id, subId), eq(projects.userId, userId)));
}

/** 큰 사업 삭제 (세부 사업 + 대상자 + 예산 + 지출 cascade) */
export async function deleteProject(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  // 세부 사업들 cascade 삭제
  const subList = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.parentId, id), eq(projects.userId, userId)));

  for (const sub of subList) {
    await deleteSubProject(db, sub.id, userId);
  }

  // 큰 사업 자체의 실적 기록 cascade (혹시 있을 경우)
  const ownRecords = await db
    .select({ id: performanceRecords.id })
    .from(performanceRecords)
    .where(and(eq(performanceRecords.projectId, id), eq(performanceRecords.userId, userId)));

  for (const r of ownRecords) {
    await db.delete(recordParticipants).where(eq(recordParticipants.recordId, r.id));
  }
  for (const r of ownRecords) {
    await db.delete(performanceRecords).where(eq(performanceRecords.id, r.id));
  }

  // 예산 + 지출 cascade
  const projectBudgets = await db
    .select({ id: budgets.id })
    .from(budgets)
    .where(and(eq(budgets.projectId, id), eq(budgets.userId, userId)));

  for (const b of projectBudgets) {
    await db.delete(expenses).where(eq(expenses.budgetId, b.id));
  }
  for (const b of projectBudgets) {
    await db.delete(budgets).where(eq(budgets.id, b.id));
  }

  // 대상자 삭제
  await db.delete(participants).where(and(eq(participants.projectId, id), eq(participants.userId, userId)));

  return db.delete(projects).where(and(eq(projects.id, id), eq(projects.userId, userId)));
}

/** 세부 사업만 삭제 (외부 호출용) */
export async function deleteSubProjectById(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await deleteSubProject(db, id, userId);
}

// ─── Participants (대상자 - 큰 사업에 귀속) ──────────────────────────────────

export async function getParticipants(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(participants)
    .where(and(eq(participants.projectId, projectId), eq(participants.userId, userId)));
}

export async function createParticipant(data: InsertParticipant) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(participants).values(data);
}

export async function updateParticipant(id: number, userId: number, data: Partial<InsertParticipant>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(participants).set(data).where(and(eq(participants.id, id), eq(participants.userId, userId)));
}

export async function deleteParticipant(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(participants).where(and(eq(participants.id, id), eq(participants.userId, userId)));
}

// ─── Performance Records (실적 - 세부 사업에 귀속) ───────────────────────────

export async function getPerformanceRecords(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(performanceRecords)
    .where(and(eq(performanceRecords.projectId, projectId), eq(performanceRecords.userId, userId)));
}

export async function getPerformanceRecordById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(performanceRecords)
    .where(and(eq(performanceRecords.id, id), eq(performanceRecords.userId, userId)))
    .limit(1);
  return result[0];
}

export async function getParticipantsByIds(projectId: number, userId: number, ids: number[]) {
  const db = await getDb();
  if (!db || ids.length === 0) return [];
  return db
    .select({ id: participants.id })
    .from(participants)
    .where(and(eq(participants.projectId, projectId), eq(participants.userId, userId), inArray(participants.id, ids)));
}

export async function createPerformanceRecord(
  data: InsertPerformanceRecord,
  participantIds: number[]
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(performanceRecords).values(data).$returningId();
  const recordId = result.id;
  if (participantIds.length > 0) {
    await db.insert(recordParticipants).values(
      participantIds.map((pid) => ({ recordId, participantId: pid }))
    );
  }
  return recordId;
}

export async function updatePerformanceRecord(
  id: number,
  userId: number,
  data: Partial<InsertPerformanceRecord>,
  participantIds: number[]
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const ownedRecord = await db
    .select({ id: performanceRecords.id })
    .from(performanceRecords)
    .where(and(eq(performanceRecords.id, id), eq(performanceRecords.userId, userId)))
    .limit(1);
  if (ownedRecord.length === 0) return;
  await db
    .update(performanceRecords)
    .set(data)
    .where(and(eq(performanceRecords.id, id), eq(performanceRecords.userId, userId)));
  await db.delete(recordParticipants).where(eq(recordParticipants.recordId, id));
  if (participantIds.length > 0) {
    await db.insert(recordParticipants).values(
      participantIds.map((pid) => ({ recordId: id, participantId: pid }))
    );
  }
}

export async function deletePerformanceRecord(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const ownedRecord = await db
    .select({ id: performanceRecords.id })
    .from(performanceRecords)
    .where(and(eq(performanceRecords.id, id), eq(performanceRecords.userId, userId)))
    .limit(1);
  if (ownedRecord.length === 0) return;
  await db.delete(recordParticipants).where(eq(recordParticipants.recordId, id));
  return db
    .delete(performanceRecords)
    .where(and(eq(performanceRecords.id, id), eq(performanceRecords.userId, userId)));
}

export async function getRecordParticipants(recordIds: number[]) {
  const db = await getDb();
  if (!db || recordIds.length === 0) return [];
  return db
    .select({
      recordId: recordParticipants.recordId,
      participantId: recordParticipants.participantId,
      name: participants.name,
      gender: participants.gender,
    })
    .from(recordParticipants)
    .innerJoin(participants, eq(recordParticipants.participantId, participants.id))
    .where(inArray(recordParticipants.recordId, recordIds));
}

// ─── Monthly Stats ─────────────────────────────────────────────────────────────

export async function getMonthlyStats(projectId: number, userId: number, year: number) {
  const db = await getDb();
  if (!db) return [];

  const records = await db
    .select()
    .from(performanceRecords)
    .where(
      and(
        eq(performanceRecords.projectId, projectId),
        eq(performanceRecords.userId, userId),
        sql`YEAR(${performanceRecords.recordDate}) = ${year}`
      )
    );

  if (records.length === 0) return [];

  const recordIds = records.map((r) => r.id);
  const rps = await getRecordParticipants(recordIds);

  // 월별 집계 맵 (월별 고유 참여자)
  const monthMap: Record<
    number,
    {
      month: number;
      totalCount: number;
      extendedPeople: number;
      uniqueParticipants: Set<number>;
      maleParticipants: Set<number>;
      femaleParticipants: Set<number>;
    }
  > = {};

  // 참여자별 성별 맵 (participantId → gender)
  const genderMap: Record<number, string> = {};
  for (const rp of rps) {
    genderMap[rp.participantId] = rp.gender ?? "";
  }

  for (const record of records) {
    const dateStr =
      typeof record.recordDate === "string"
        ? record.recordDate
        : (record.recordDate as Date).toISOString().slice(0, 10);
    const month = parseInt(dateStr.slice(5, 7), 10);
    if (!monthMap[month]) {
      monthMap[month] = {
        month,
        totalCount: 0,
        extendedPeople: 0,
        uniqueParticipants: new Set(),
        maleParticipants: new Set(),
        femaleParticipants: new Set(),
      };
    }
    // 횟수: 실적 레코드 1건 = 1회 (참여자 수와 무관하게 record.count만큼 누적)
    monthMap[month].totalCount += record.count;
    const recordRps = rps.filter((rp) => rp.recordId === record.id);
    for (const rp of recordRps) {
      // 연인원: 참여자 1명당 record.count만큼 누적
      monthMap[month].extendedPeople += record.count;
      // 실인원(월별): 해당 월에 참여한 고유 인원 (중복 제거)
      monthMap[month].uniqueParticipants.add(rp.participantId);
      if (rp.gender === "male") monthMap[month].maleParticipants.add(rp.participantId);
      else monthMap[month].femaleParticipants.add(rp.participantId);
    }
  }

  // 월 순서대로 정렬 후 누적 실인원 계산
  const sortedMonths = Object.values(monthMap).sort((a, b) => a.month - b.month);

  // 누적 고유 참여자 Set (전체 기간 기준)
  const cumulativeUnique = new Set<number>();
  const cumulativeMale = new Set<number>();
  const cumulativeFemale = new Set<number>();

  return sortedMonths.map((m) => {
    // 이번 달 참여자를 누적 Set에 추가
    m.uniqueParticipants.forEach((pid) => {
      cumulativeUnique.add(pid);
      const gender = genderMap[pid] ?? "";
      if (gender === "male") cumulativeMale.add(pid);
      else cumulativeFemale.add(pid);
    });

    return {
      month: m.month,
      count: m.totalCount,
      extendedPeople: m.extendedPeople,
      // 월별 실인원: 해당 월에 참여한 고유 인원
      uniquePeople: m.uniqueParticipants.size,
      malePeople: m.maleParticipants.size,
      femalePeople: m.femaleParticipants.size,
      // 누적 실인원: 해당 월까지 한 번이라도 참여한 전체 고유 인원
      cumulativeUniquePeople: cumulativeUnique.size,
      cumulativeMalePeople: cumulativeMale.size,
      cumulativeFemalePeople: cumulativeFemale.size,
    };
  });
}

// ─── Budgets ──────────────────────────────────────────────────────────────────

export async function getBudget(projectId: number, userId: number, year: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.projectId, projectId), eq(budgets.userId, userId), eq(budgets.year, year)))
    .limit(1);
  return result[0];
}

export async function getBudgetById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
    .limit(1);
  return result[0];
}

export async function upsertBudget(data: InsertBudget) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await getBudget(data.projectId, data.userId, data.year);
  if (existing) {
    return db
      .update(budgets)
      .set(data)
      .where(
        and(
          eq(budgets.projectId, data.projectId),
          eq(budgets.userId, data.userId),
          eq(budgets.year, data.year)
        )
      );
  }
  return db.insert(budgets).values(data);
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export async function getExpenses(budgetId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(expenses)
    .where(and(eq(expenses.budgetId, budgetId), eq(expenses.userId, userId)));
}

export async function createExpense(data: InsertExpense) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(expenses).values(data);
}

export async function updateExpense(id: number, userId: number, data: Partial<InsertExpense>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(expenses).set(data).where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
}

export async function deleteExpense(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
}

// ─── Dashboard Overview ────────────────────────────────────────────────────────

/**
 * 대시보드 종합현황: 모든 큰 사업 > 세부 사업의 계획/실적/남녀 집계를 한 번에 반환
 */
export async function getDashboardOverview(userId: number, year: number) {
  const db = await getDb();
  if (!db) return [];

  // 모든 사업 (큰 사업 + 세부 사업)
  const allProjects = await db
    .select()
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.year, year)));

  const parentList = allProjects.filter((p) => p.parentId === null);
  const subList = allProjects.filter((p) => p.parentId !== null);

  // 모든 세부 사업의 실적 기록 한 번에 조회
  const subIds = subList.map((s) => s.id);
  type RecordRow = typeof performanceRecords.$inferSelect;
  let allRecords: RecordRow[] = [];
  if (subIds.length > 0) {
    allRecords = await db
      .select()
      .from(performanceRecords)
      .where(
        and(
          eq(performanceRecords.userId, userId),
          inArray(performanceRecords.projectId, subIds),
          sql`YEAR(${performanceRecords.recordDate}) = ${year}`
        )
      );
  }

  const allRecordIds = allRecords.map((r) => r.id);
  const allRps = allRecordIds.length > 0 ? await getRecordParticipants(allRecordIds) : [];

  // 세부 사업별 실적 집계
  const subStats: Record<
    number,
    {
      totalCount: number;
      extendedPeople: number;
      uniqueParticipants: Set<number>;
      malePeople: Set<number>;
      femalePeople: Set<number>;
    }
  > = {};

  for (const sub of subList) {
    subStats[sub.id] = {
      totalCount: 0,
      extendedPeople: 0,
      uniqueParticipants: new Set(),
      malePeople: new Set(),
      femalePeople: new Set(),
    };
  }

  for (const record of allRecords) {
    const stat = subStats[record.projectId];
    if (!stat) continue;
    // 횟수: 실적 레코드 1건 = 1회 (참여자 수와 무관하게 record.count만큼 누적)
    stat.totalCount += record.count;
    const rps = allRps.filter((rp) => rp.recordId === record.id);
    for (const rp of rps) {
      // 연인원: 참여자 1명당 record.count만큼 누적
      stat.extendedPeople += record.count;
      stat.uniqueParticipants.add(rp.participantId);
      if (rp.gender === "male") stat.malePeople.add(rp.participantId);
      else stat.femalePeople.add(rp.participantId);
    }
  }

  // 큰 사업별로 그룹화
  return parentList.map((parent) => {
    const subs = subList.filter((s) => s.parentId === parent.id);

    const subRows = subs.map((sub) => {
      const s = subStats[sub.id] ?? {
        totalCount: 0,
        extendedPeople: 0,
        uniqueParticipants: new Set<number>(),
        malePeople: new Set<number>(),
        femalePeople: new Set<number>(),
      };
      return {
        id: sub.id,
        name: sub.subProjectName ?? sub.projectName,
        plannedPeople: sub.plannedPeople ?? 0,
        plannedExtended: sub.plannedExtended ?? 0,
        plannedCount: sub.plannedCount ?? 0,
        isAdHoc: sub.isAdHoc,
        actualPeople: s.uniqueParticipants.size,
        actualExtended: s.extendedPeople,
        actualCount: s.totalCount,
        malePeople: s.malePeople.size,
        femalePeople: s.femalePeople.size,
      };
    });

    // 소계: 큰 사업 전체 고유 참여자 (세부 사업 합산)
    const allUnique = new Set<number>();
    const allMale = new Set<number>();
    const allFemale = new Set<number>();
    let subtotalExtended = 0;
    let subtotalCount = 0;
    let subtotalPlannedPeople = 0;
    let subtotalPlannedExtended = 0;
    let subtotalPlannedCount = 0;

    for (const sub of subs) {
      const s = subStats[sub.id];
      if (!s) continue;
      s.uniqueParticipants.forEach((pid) => allUnique.add(pid));
      s.malePeople.forEach((pid) => allMale.add(pid));
      s.femalePeople.forEach((pid) => allFemale.add(pid));
      subtotalExtended += s.extendedPeople;
      subtotalCount += s.totalCount;
      subtotalPlannedPeople += sub.plannedPeople ?? 0;
      subtotalPlannedExtended += sub.plannedExtended ?? 0;
      if (!sub.isAdHoc) subtotalPlannedCount += sub.plannedCount ?? 0;
    }

    return {
      parentId: parent.id,
      parentName: parent.projectName,
      subs: subRows,
      subtotal: {
        plannedPeople: subtotalPlannedPeople,
        plannedExtended: subtotalPlannedExtended,
        plannedCount: subtotalPlannedCount,
        actualPeople: allUnique.size,
        actualExtended: subtotalExtended,
        actualCount: subtotalCount,
        malePeople: allMale.size,
        femalePeople: allFemale.size,
      },
    };
  });
}

// ─── Dashboard Budget Overview ─────────────────────────────────────────────────

/**
 * 대시보드 예산 현황: 큰 사업별 총예산·집행액·잔액·집행률 집계
 */
export async function getDashboardBudget(userId: number, year: number) {
  const db = await getDb();
  if (!db) return [];

  // 큰 사업 목록
  const parentList = await db
    .select()
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.year, year), isNull(projects.parentId)));

  if (parentList.length === 0) return [];

  const parentIds = parentList.map((p) => p.id);

  // 큰 사업별 예산 조회
  const budgetRows = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.year, year), inArray(budgets.projectId, parentIds)));

  // 예산 ID 목록으로 지출 내역 조회
  const budgetIds = budgetRows.map((b) => b.id);
  let expenseRows: (typeof expenses.$inferSelect)[] = [];
  if (budgetIds.length > 0) {
    expenseRows = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.userId, userId), inArray(expenses.budgetId, budgetIds)));
  }

  // 예산 ID → projectId 맵
  const budgetByProjectId: Record<number, typeof budgetRows[0]> = {};
  for (const b of budgetRows) {
    budgetByProjectId[b.projectId] = b;
  }

  // 예산 ID → 집행액 합계 맵
  const spentByBudgetId: Record<number, number> = {};
  for (const exp of expenseRows) {
    spentByBudgetId[exp.budgetId] = (spentByBudgetId[exp.budgetId] ?? 0) + Number(exp.amount);
  }

  return parentList.map((parent) => {
    const budget = budgetByProjectId[parent.id];
    const totalBudget = budget ? Number(budget.totalBudget) : 0;
    const q1Budget = budget ? Number(budget.q1Budget) : 0;
    const q2Budget = budget ? Number(budget.q2Budget) : 0;
    const q3Budget = budget ? Number(budget.q3Budget) : 0;
    const q4Budget = budget ? Number(budget.q4Budget) : 0;
    const spent = budget ? (spentByBudgetId[budget.id] ?? 0) : 0;
    const remaining = totalBudget - spent;
    const usageRate = totalBudget > 0 ? Math.round((spent / totalBudget) * 100) : 0;

    return {
      parentId: parent.id,
      parentName: parent.projectName,
      totalBudget,
      q1Budget,
      q2Budget,
      q3Budget,
      q4Budget,
      spent,
      remaining,
      usageRate,
    };
  });
}

// ─── Project Plans (사업 계획서 PDF) ─────────────────────────────────────────

export async function createProjectPlan(data: {
  projectId: number;
  userId: number;
  fileName: string;
  fileKey: string;
  fileUrl: string;
  fileSize?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(projectPlans).values(data);
  return result;
}

export async function getProjectPlans(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(projectPlans)
    .where(and(eq(projectPlans.projectId, projectId), eq(projectPlans.userId, userId)));
}

export async function deleteProjectPlan(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // 삭제 전 파일키 조회
  const rows = await db
    .select()
    .from(projectPlans)
    .where(and(eq(projectPlans.id, id), eq(projectPlans.userId, userId)))
    .limit(1);
  if (rows.length === 0) return null;
  await db.delete(projectPlans).where(and(eq(projectPlans.id, id), eq(projectPlans.userId, userId)));
  return rows[0];
}

/**
 * 평가서 생성에 필요한 큰 사업의 종합 실적 데이터 조회
 */
export async function getProjectEvalData(parentId: number, userId: number, year: number) {
  const db = await getDb();
  if (!db) return null;

  // 큰 사업 정보
  const parentRows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, parentId), eq(projects.userId, userId)))
    .limit(1);
  if (parentRows.length === 0) return null;
  const parent = parentRows[0];

  // 세부 사업 목록
  const subList = await db
    .select()
    .from(projects)
    .where(and(eq(projects.parentId, parentId), eq(projects.userId, userId)));

  // 세부 사업별 실적 기록
  const subIds = subList.map((s) => s.id);
  type RecordRow = typeof performanceRecords.$inferSelect;
  let allRecords: RecordRow[] = [];
  if (subIds.length > 0) {
    allRecords = await db
      .select()
      .from(performanceRecords)
      .where(
        and(
          eq(performanceRecords.userId, userId),
          inArray(performanceRecords.projectId, subIds),
          sql`YEAR(${performanceRecords.recordDate}) = ${year}`
        )
      )
      .orderBy(performanceRecords.recordDate);
  }

  const allRecordIds = allRecords.map((r) => r.id);
  const allRps = allRecordIds.length > 0 ? await getRecordParticipants(allRecordIds) : [];

  // 세부 사업별 집계
  const subStats: Record<number, { totalCount: number; extendedPeople: number; uniqueParticipants: Set<number>; malePeople: Set<number>; femalePeople: Set<number> }> = {};
  for (const sub of subList) {
    subStats[sub.id] = { totalCount: 0, extendedPeople: 0, uniqueParticipants: new Set(), malePeople: new Set(), femalePeople: new Set() };
  }
  for (const record of allRecords) {
    const stat = subStats[record.projectId];
    if (!stat) continue;
    stat.totalCount += record.count;
    const rps = allRps.filter((rp) => rp.recordId === record.id);
    for (const rp of rps) {
      stat.extendedPeople += record.count;
      stat.uniqueParticipants.add(rp.participantId);
      if (rp.gender === "male") stat.malePeople.add(rp.participantId);
      else stat.femalePeople.add(rp.participantId);
    }
  }

  // 예산 정보
  const budgetRows = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.projectId, parentId), eq(budgets.userId, userId), eq(budgets.year, year)))
    .limit(1);
  const budget = budgetRows[0] ?? null;

  let totalSpent = 0;
  if (budget) {
    const expenseRows = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.budgetId, budget.id), eq(expenses.userId, userId)));
    totalSpent = expenseRows.reduce((sum, e) => sum + Number(e.amount), 0);
  }

  // 사업 계획서 파일 (사업 단위 공유 - userId 필터 없음)
  const planFiles = await db
    .select()
    .from(projectPlans)
    .where(and(eq(projectPlans.projectId, parentId), eq(projectPlans.userId, userId)));

  return {
    parent,
    year,
    subList: subList.map((sub) => {
      const s = subStats[sub.id] ?? { totalCount: 0, extendedPeople: 0, uniqueParticipants: new Set<number>(), malePeople: new Set<number>(), femalePeople: new Set<number>() };
      return {
        id: sub.id,
        name: sub.subProjectName ?? sub.projectName,
        plannedPeople: sub.plannedPeople ?? 0,
        plannedExtended: sub.plannedExtended ?? 0,
        plannedCount: sub.plannedCount ?? 0,
        isAdHoc: sub.isAdHoc,
        actualPeople: s.uniqueParticipants.size,
        actualExtended: s.extendedPeople,
        actualCount: s.totalCount,
        malePeople: s.malePeople.size,
        femalePeople: s.femalePeople.size,
      };
    }),
    records: allRecords.map((r) => {
      const rps = allRps.filter((rp) => rp.recordId === r.id);
      return {
        projectId: r.projectId,
        date: typeof r.recordDate === "string" ? r.recordDate : (r.recordDate as Date).toISOString().slice(0, 10),
        count: r.count,
        note: r.note ?? "",
        participantCount: rps.length,
        malePeople: rps.filter((rp) => rp.gender === "male").map((rp) => rp.participantId),
        femalePeople: rps.filter((rp) => rp.gender !== "male").map((rp) => rp.participantId),
        allParticipantIds: rps.map((rp) => rp.participantId),
      };
    }),
    budget: budget
      ? {
          totalBudget: Number(budget.totalBudget),
          q1Budget: Number(budget.q1Budget),
          q2Budget: Number(budget.q2Budget),
          q3Budget: Number(budget.q3Budget),
          q4Budget: Number(budget.q4Budget),
          totalSpent,
          remaining: Number(budget.totalBudget) - totalSpent,
        }
      : null,
    planFiles: planFiles.map((f) => ({ id: f.id, fileName: f.fileName, fileUrl: f.fileUrl, fileKey: f.fileKey })),
  };
}

// ── AI 평가서 CRUD ─────────────────────────────────────────────────────────────

export async function createEvaluation(data: InsertEvaluation): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(evaluations).values(data);
  return (result as any).insertId as number;
}

export async function listEvaluations(projectId: number, userId: number): Promise<Evaluation[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(evaluations)
    .where(and(eq(evaluations.projectId, projectId), eq(evaluations.userId, userId)))
    .orderBy(desc(evaluations.updatedAt));
}

export async function getEvaluation(id: number): Promise<Evaluation | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(evaluations).where(eq(evaluations.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateEvaluation(
  id: number,
  data: Partial<Pick<Evaluation, "title" | "contentActivity" | "contentOutcome" | "contentPerformance" | "contentSelfEval">>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(evaluations).set(data).where(eq(evaluations.id, id));
}

export async function deleteEvaluation(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(evaluations).where(eq(evaluations.id, id));
}

// ─── Schedules CRUD ──────────────────────────────────────────────────────────

export async function getSchedules(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(schedules)
    .where(and(eq(schedules.projectId, projectId), eq(schedules.userId, userId)))
    .orderBy(schedules.startDate);
}

export async function createSchedule(data: {
  projectId: number;
  userId: number;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  allDay?: boolean;
  color?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(schedules).values({
    projectId: data.projectId,
    userId: data.userId,
    title: data.title,
    description: data.description ?? null,
    startDate: new Date(data.startDate) as any,
    endDate: new Date(data.endDate) as any,
    allDay: data.allDay ?? true,
    color: data.color ?? "blue",
  });
  return result;
}

export async function updateSchedule(
  id: number,
  userId: number,
  data: {
    title?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    allDay?: boolean;
    color?: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
  if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
  if (data.allDay !== undefined) updateData.allDay = data.allDay;
  if (data.color !== undefined) updateData.color = data.color;
  await db.update(schedules).set(updateData as any).where(and(eq(schedules.id, id), eq(schedules.userId, userId)));
  return { success: true };
}

export async function deleteSchedule(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(schedules).where(and(eq(schedules.id, id), eq(schedules.userId, userId)));
  return { success: true };
}

export async function getScheduleById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(schedules).where(and(eq(schedules.id, id), eq(schedules.userId, userId))).limit(1);
  return rows[0] ?? null;
}

/** 대시보드용: 전체 사업의 다가오는 일정 조회 (오늘~N일 이내) */
export async function getUpcomingSchedules(userId: number, daysAhead: number = 14) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  // 오늘 이후 시작하거나 아직 끝나지 않은 일정 조회
  const rows = await db
    .select({
      id: schedules.id,
      projectId: schedules.projectId,
      title: schedules.title,
      description: schedules.description,
      startDate: schedules.startDate,
      endDate: schedules.endDate,
      allDay: schedules.allDay,
      color: schedules.color,
      projectName: projects.projectName,
    })
    .from(schedules)
    .innerJoin(projects, eq(schedules.projectId, projects.id))
    .where(
      and(
        eq(schedules.userId, userId),
        sql`${schedules.endDate} >= ${now}`,
        sql`${schedules.startDate} <= ${future}`
      )
    )
    .orderBy(schedules.startDate)
    .limit(20);

  return rows;
}

/** 스케줄 관리 달력용: 전체 사업 일정 통합 조회 (연도/월 기준) */
export async function getAllSchedules(userId: number, year: number, month?: number) {
  const db = await getDb();
  if (!db) return [];

  // 조회 범위 설정
  let startRange: Date;
  let endRange: Date;
  if (month !== undefined) {
    // 특정 월: 해당 월 전체 (달력 표시를 위해 앞뒤 1주 여유)
    startRange = new Date(year, month - 1, 1);
    startRange.setDate(startRange.getDate() - 7);
    endRange = new Date(year, month, 0); // 해당 월 마지막 날
    endRange.setDate(endRange.getDate() + 7);
  } else {
    // 연도 전체
    startRange = new Date(year, 0, 1);
    endRange = new Date(year, 11, 31);
  }

  const rows = await db
    .select({
      id: schedules.id,
      projectId: schedules.projectId,
      title: schedules.title,
      description: schedules.description,
      startDate: schedules.startDate,
      endDate: schedules.endDate,
      allDay: schedules.allDay,
      color: schedules.color,
      projectName: projects.projectName,
    })
    .from(schedules)
    .innerJoin(projects, eq(schedules.projectId, projects.id))
    .where(
      and(
        eq(schedules.userId, userId),
        sql`${schedules.endDate} >= ${startRange}`,
        sql`${schedules.startDate} <= ${endRange}`
      )
    )
    .orderBy(schedules.startDate);

  return rows;
}

// ─── Dashboard Overview by Quarter ────────────────────────────────────────────

/**
 * 대시보드 종합현황 (분기 또는 사용자 지정 월 범위 필터 지원)
 * quarter: 1~4 → 해당 분기만 집계, customStartMonth/customEndMonth → 지정 월 범위, 모두 생략 → 연간 전체
 */
export async function getDashboardOverviewByQuarter(
  userId: number,
  year: number,
  quarter?: number,
  customStartMonth?: number,
  customEndMonth?: number,
) {
  const db = await getDb();
  if (!db) return [];

  // 분기 → 월 범위 계산
  const monthRange: [number, number] | null = customStartMonth !== undefined && customEndMonth !== undefined
    ? [customStartMonth, customEndMonth]
    : quarter
    ? ([quarter * 3 - 2, quarter * 3] as [number, number])
    : null;

  const allProjects = await db
    .select()
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.year, year)));

  const parentList = allProjects.filter((p) => p.parentId === null);
  const subList = allProjects.filter((p) => p.parentId !== null);

  const subIds = subList.map((s) => s.id);
  type RecordRow = typeof performanceRecords.$inferSelect;
  let allRecords: RecordRow[] = [];
  if (subIds.length > 0) {
    const conditions = [
      eq(performanceRecords.userId, userId),
      inArray(performanceRecords.projectId, subIds),
      sql`YEAR(${performanceRecords.recordDate}) = ${year}`,
    ];
    // 분기 필터: 해당 분기 월 범위만 포함
    if (monthRange) {
      conditions.push(
        sql`MONTH(${performanceRecords.recordDate}) BETWEEN ${monthRange[0]} AND ${monthRange[1]}`
      );
    }
    allRecords = await db
      .select()
      .from(performanceRecords)
      .where(and(...conditions));
  }

  const allRecordIds = allRecords.map((r) => r.id);
  const allRps = allRecordIds.length > 0 ? await getRecordParticipants(allRecordIds) : [];

  const subStats: Record<
    number,
    {
      totalCount: number;
      extendedPeople: number;
      uniqueParticipants: Set<number>;
      malePeople: Set<number>;
      femalePeople: Set<number>;
    }
  > = {};

  for (const sub of subList) {
    subStats[sub.id] = {
      totalCount: 0,
      extendedPeople: 0,
      uniqueParticipants: new Set(),
      malePeople: new Set(),
      femalePeople: new Set(),
    };
  }

  for (const record of allRecords) {
    const stat = subStats[record.projectId];
    if (!stat) continue;
    stat.totalCount += record.count;
    const rps = allRps.filter((rp) => rp.recordId === record.id);
    for (const rp of rps) {
      stat.extendedPeople += record.count;
      stat.uniqueParticipants.add(rp.participantId);
      if (rp.gender === "male") stat.malePeople.add(rp.participantId);
      else stat.femalePeople.add(rp.participantId);
    }
  }

  return parentList.map((parent) => {
    const subs = subList.filter((s) => s.parentId === parent.id);

    const subRows = subs.map((sub) => {
      const s = subStats[sub.id] ?? {
        totalCount: 0,
        extendedPeople: 0,
        uniqueParticipants: new Set<number>(),
        malePeople: new Set<number>(),
        femalePeople: new Set<number>(),
      };
      return {
        id: sub.id,
        name: sub.subProjectName ?? sub.projectName,
        plannedPeople: sub.plannedPeople ?? 0,
        plannedExtended: sub.plannedExtended ?? 0,
        plannedCount: sub.plannedCount ?? 0,
        isAdHoc: sub.isAdHoc,
        actualPeople: s.uniqueParticipants.size,
        actualExtended: s.extendedPeople,
        actualCount: s.totalCount,
        malePeople: s.malePeople.size,
        femalePeople: s.femalePeople.size,
      };
    });

    const allUnique = new Set<number>();
    const allMale = new Set<number>();
    const allFemale = new Set<number>();
    let subtotalExtended = 0;
    let subtotalCount = 0;
    let subtotalPlannedPeople = 0;
    let subtotalPlannedExtended = 0;
    let subtotalPlannedCount = 0;

    for (const sub of subs) {
      const s = subStats[sub.id];
      if (!s) continue;
      s.uniqueParticipants.forEach((pid) => allUnique.add(pid));
      s.malePeople.forEach((pid) => allMale.add(pid));
      s.femalePeople.forEach((pid) => allFemale.add(pid));
      subtotalExtended += s.extendedPeople;
      subtotalCount += s.totalCount;
      subtotalPlannedPeople += sub.plannedPeople ?? 0;
      subtotalPlannedExtended += sub.plannedExtended ?? 0;
      if (!sub.isAdHoc) subtotalPlannedCount += sub.plannedCount ?? 0;
    }

    return {
      parentId: parent.id,
      parentName: parent.projectName,
      subs: subRows,
      subtotal: {
        plannedPeople: subtotalPlannedPeople,
        plannedExtended: subtotalPlannedExtended,
        plannedCount: subtotalPlannedCount,
        actualPeople: allUnique.size,
        actualExtended: subtotalExtended,
        actualCount: subtotalCount,
        malePeople: allMale.size,
        femalePeople: allFemale.size,
      },
    };
  });
}
