import { COOKIE_NAME } from "@shared/const";
import {
  createBusinessPlan,
  listBusinessPlans,
  getBusinessPlanById,
  updateBusinessPlanChat,
  saveGeneratedContent,
  updateGeneratedSection,
  deleteBusinessPlan,
  saveQuickPlan,
  setInputDataKey,
  type ChatMessage,
  type InputData,
} from "./businessPlanDb";
import { PLAN_SECTIONS, CHAT_QUESTIONS, SCALE_CATALOG } from "../shared/businessPlanData";
import {
  normalizeQuickInput,
  buildGeneratePrompt,
  parseGeneratedSections,
  quickInputToInputData,
  buildSelfCheckPrompt,
  parseSelfCheck,
} from "./grantPlan";
import { searchCases, caseStats } from "./caseSearch";
import { getTemplate, listTemplates, deleteTemplate } from "./templateDb";
import { listReferenceDocs, deleteReferenceDoc } from "./referenceDb";
import { searchReferences, type RefChunk } from "./referenceLib";
import { lintOfficialStyle } from "./officialStyle";
import { buildFillPrompt, alignFilled, type TemplateAnalysis } from "./docTemplate";
import { buildPromoPrompt, parsePromo, buildRefinePrompt } from "./promo";
import { listPromoSamples, createPromoSample, deletePromoSample, getPromoSamples } from "./promoDb";
import { buildCasePrompt, parseCaseResult, computeCaseStats } from "./caseRecord";
import { createCaseRecord, listCaseRecords, updateCaseRecord, deleteCaseRecord } from "./caseRecordDb";
import { buildIdeasPrompt, parseIdeas, buildDocPrompt, cleanDocOutput } from "./workTools";
import type { QuickPlanInput } from "../shared/grantGuide";
import { getSessionCookieOptions } from "./_core/cookies";
import type { CookieOptions } from "express";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  registerUser,
  loginUser,
  logoutSession,
  validateSession,
  listAllUsers,
  approveUser,
  rejectUser,
  deleteUser,
  updateUserRole,
} from "./auth-local";
import { TRPCError } from "@trpc/server";
import {
  getProjects,
  getParentProjects,
  getSubProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  deleteSubProjectById,
  getParticipants,
  createParticipant,
  updateParticipant,
  deleteParticipant,
  getPerformanceRecords,
  getPerformanceRecordById,
  getParticipantsByIds,
  createPerformanceRecord,
  updatePerformanceRecord,
  deletePerformanceRecord,
  getRecordParticipants,
  getMonthlyStats,
  getDashboardOverview,
  getDashboardOverviewByQuarter,
  getDashboardBudget,
  getBudget,
  getBudgetById,
  upsertBudget,
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  createProjectPlan,
  getProjectPlans,
  deleteProjectPlan,
  getProjectEvalData,
  createEvaluation,
  listEvaluations,
  getEvaluation,
  updateEvaluation,
  deleteEvaluation,
  getSchedules,
  getScheduleById,
  getUpcomingSchedules,
  getAllSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from "./db";
import { storagePut, storageGetSignedUrl } from "./storage";
import { invokeLLM } from "./_core/llm";
import { isOwnedProject } from "./projectAccess";
import { resolveEvaluationPeriod } from "./evaluationPeriod";
import { extractPlanPdfTexts } from "./pdfExtract";

// ─── Projects Router ──────────────────────────────────────────────────────────

const projectsRouter = router({
  /** 전체 사업 목록 (큰 사업 + 세부 사업) - 사이드바용 */
  list: protectedProcedure
    .input(z.object({ year: z.number() }))
    .query(({ ctx, input }) => getProjects(ctx.user.id, input.year)),

  /** 큰 사업 목록만 (parentId = NULL) */
  listParents: protectedProcedure
    .input(z.object({ year: z.number() }))
    .query(({ ctx, input }) => getParentProjects(ctx.user.id, input.year)),

  /** 세부 사업 목록 (특정 큰 사업의 자식) */
  listSubs: protectedProcedure
    .input(z.object({ parentId: z.number() }))
    .query(({ ctx, input }) => getSubProjects(input.parentId, ctx.user.id)),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ ctx, input }) => getProjectById(input.id, ctx.user.id)),

  /** 큰 사업 등록 (parentId 없음) */
  create: protectedProcedure
    .input(
      z.object({
        projectName: z.string().min(1),
        year: z.number(),
      })
    )
    .mutation(({ ctx, input }) =>
      createProject({ ...input, userId: ctx.user.id, isAdHoc: false })
    ),

  /** 세부 사업 등록 (parentId 있음) */
  createSub: protectedProcedure
    .input(
      z.object({
        parentId: z.number(),
        projectName: z.string().min(1),
        subProjectName: z.string().optional(),
        plannedPeople: z.number().optional(),
        plannedExtended: z.number().optional(),
        plannedCount: z.number().optional(),
        isAdHoc: z.boolean().default(false),
        year: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const parent = await getProjectById(input.parentId, ctx.user.id);
      if (!isOwnedProject(parent, ctx.user.id, { parentOnly: true })) {
        throw new TRPCError({ code: "NOT_FOUND", message: "상위 사업을 찾을 수 없습니다." });
      }
      return createProject({ ...input, userId: ctx.user.id });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        projectName: z.string().min(1).optional(),
        subProjectName: z.string().optional(),
        plannedPeople: z.number().nullable().optional(),
        plannedExtended: z.number().nullable().optional(),
        plannedCount: z.number().nullable().optional(),
        isAdHoc: z.boolean().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return updateProject(id, ctx.user.id, data);
    }),

  /** 큰 사업 삭제 (세부 사업 + 대상자 + 예산 cascade) */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteProject(input.id, ctx.user.id)),

  /** 세부 사업만 삭제 (실적 기록 cascade) */
  deleteSub: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteSubProjectById(input.id, ctx.user.id)),
});

// ─── Participants Router (큰 사업에 귀속) ─────────────────────────────────────

const participantsRouter = router({
  /** 큰 사업 ID로 대상자 목록 조회 */
  list: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(({ ctx, input }) => getParticipants(input.projectId, ctx.user.id)),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        name: z.string().min(1),
        gender: z.enum(["male", "female"]),
        nationality: z.string().optional(),
        phone: z.string().optional(),
        visaType: z.string().optional(),
        region: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId, ctx.user.id);
      if (!isOwnedProject(project, ctx.user.id, { parentOnly: true })) {
        throw new TRPCError({ code: "NOT_FOUND", message: "사업을 찾을 수 없습니다." });
      }
      return createParticipant({ ...input, userId: ctx.user.id });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        gender: z.enum(["male", "female"]).optional(),
        nationality: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
        visaType: z.string().optional().nullable(),
        region: z.string().optional().nullable(),
      })
    )
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return updateParticipant(id, ctx.user.id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteParticipant(input.id, ctx.user.id)),

  /** 엑셀 대량 등록 */
  bulkCreate: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        participants: z.array(
          z.object({
            name: z.string().min(1),
            gender: z.enum(["male", "female"]),
            nationality: z.string().optional(),
            phone: z.string().optional(),
            visaType: z.string().optional(),
            region: z.string().optional(),
          })
        ).min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId, ctx.user.id);
      if (!isOwnedProject(project, ctx.user.id, { parentOnly: true })) {
        throw new TRPCError({ code: "NOT_FOUND", message: "사업을 찾을 수 없습니다." });
      }
      // 순차 삽입 (대량이지만 단순 반복 방식으로 안정성 확보)
      for (const p of input.participants) {
        await createParticipant({
          projectId: input.projectId,
          userId: ctx.user.id,
          name: p.name,
          gender: p.gender,
          nationality: p.nationality,
          phone: p.phone,
          visaType: p.visaType,
          region: p.region,
        });
      }
      return { inserted: input.participants.length };
    }),
});

// ─── Performance Router (세부 사업에 귀속) ────────────────────────────────────

const performanceRouter = router({
  /** 세부 사업 ID로 실적 기록 조회 */
  list: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const records = await getPerformanceRecords(input.projectId, ctx.user.id);
      if (records.length === 0) return [];
      const recordIds = records.map((r) => r.id);
      const rps = await getRecordParticipants(recordIds);
      return records.map((r) => ({
        ...r,
        participants: rps.filter((rp) => rp.recordId === r.id),
      }));
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        recordDate: z.string(),
        count: z.number().min(1).default(1),
        note: z.string().optional(),
        participantIds: z.array(z.number()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { participantIds, recordDate, ...rest } = input;
      const project = await getProjectById(input.projectId, ctx.user.id);
      if (!isOwnedProject(project, ctx.user.id)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "세부 사업을 찾을 수 없습니다." });
      }
      const participantOwnerProjectId = project?.parentId ?? project?.id;
      if (participantOwnerProjectId === undefined) {
        throw new TRPCError({ code: "NOT_FOUND", message: "사업을 찾을 수 없습니다." });
      }
      const ownedParticipants = await getParticipantsByIds(participantOwnerProjectId, ctx.user.id, participantIds);
      if (ownedParticipants.length !== participantIds.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "연결할 대상자를 찾을 수 없습니다." });
      }
      return createPerformanceRecord(
        { ...rest, recordDate: recordDate as unknown as Date, userId: ctx.user.id },
        participantIds
      );
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        recordDate: z.string().optional(),
        count: z.number().min(1).optional(),
        note: z.string().optional(),
        participantIds: z.array(z.number()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, participantIds, recordDate, ...rest } = input;
      const existing = await getPerformanceRecordById(id, ctx.user.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "실적 기록을 찾을 수 없습니다." });
      const project = await getProjectById(existing.projectId, ctx.user.id);
      const participantOwnerProjectId = project?.parentId ?? project?.id;
      if (participantOwnerProjectId === undefined) {
        throw new TRPCError({ code: "NOT_FOUND", message: "사업을 찾을 수 없습니다." });
      }
      const ownedParticipants = await getParticipantsByIds(participantOwnerProjectId, ctx.user.id, participantIds);
      if (ownedParticipants.length !== participantIds.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "연결할 대상자를 찾을 수 없습니다." });
      }
      const updateData: Parameters<typeof updatePerformanceRecord>[2] = { ...rest };
      if (recordDate !== undefined) updateData.recordDate = recordDate as unknown as Date;
      return updatePerformanceRecord(id, ctx.user.id, updateData, participantIds);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deletePerformanceRecord(input.id, ctx.user.id)),

  monthlyStats: protectedProcedure
    .input(z.object({ projectId: z.number(), year: z.number() }))
    .query(({ ctx, input }) =>
      getMonthlyStats(input.projectId, ctx.user.id, input.year)
    ),

  /** 대시보드 종합현황: 모든 큰 사업 > 세부 사업 계획/실적 집계 */
  dashboardOverview: protectedProcedure
    .input(z.object({ year: z.number() }))
    .query(({ ctx, input }) => getDashboardOverview(ctx.user.id, input.year)),

  /** 대시보드 종합현황 (분기 필터): quarter=1~4 또는 생략(연간 전체) */
  dashboardOverviewByQuarter: protectedProcedure
    .input(
      z.object({
        year: z.number(),
        quarter: z.number().min(1).max(4).optional(),
        customStartMonth: z.number().int().min(1).max(12).optional(),
        customEndMonth: z.number().int().min(1).max(12).optional(),
      }).superRefine((value, ctx) => {
        if ((value.customStartMonth === undefined) !== (value.customEndMonth === undefined)) {
          ctx.addIssue({ code: "custom", path: ["customEndMonth"], message: "시작월과 종료월을 모두 선택해주세요." });
        }
        if (value.customStartMonth !== undefined && value.customEndMonth !== undefined && value.customStartMonth > value.customEndMonth) {
          ctx.addIssue({ code: "custom", path: ["customEndMonth"], message: "종료월은 시작월 이후여야 합니다." });
        }
        if (value.quarter !== undefined && value.customStartMonth !== undefined) {
          ctx.addIssue({ code: "custom", path: ["quarter"], message: "분기와 사용자 지정 기간을 동시에 선택할 수 없습니다." });
        }
      }),
    )
    .query(({ ctx, input }) => getDashboardOverviewByQuarter(
      ctx.user.id,
      input.year,
      input.quarter,
      input.customStartMonth,
      input.customEndMonth,
    )),

  /** 대시보드 예산 현황: 큰 사업별 총예산·집행액·잔액·집행률 */
  dashboardBudget: protectedProcedure
    .input(z.object({ year: z.number() }))
    .query(({ ctx, input }) => getDashboardBudget(ctx.user.id, input.year)),
});

// ─── Budget Router (큰 사업에 귀속) ──────────────────────────────────────────

const budgetRouter = router({
  get: protectedProcedure
    .input(z.object({ projectId: z.number(), year: z.number() }))
    .query(({ ctx, input }) => getBudget(input.projectId, ctx.user.id, input.year)),

  upsert: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        year: z.number(),
        totalBudget: z.string(),
        q1Budget: z.string(),
        q2Budget: z.string(),
        q3Budget: z.string(),
        q4Budget: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId, ctx.user.id);
      if (!isOwnedProject(project, ctx.user.id, { parentOnly: true })) {
        throw new TRPCError({ code: "NOT_FOUND", message: "사업을 찾을 수 없습니다." });
      }
      return upsertBudget({ ...input, userId: ctx.user.id });
    }),

  expenses: router({
    list: protectedProcedure
      .input(z.object({ budgetId: z.number() }))
      .query(({ ctx, input }) => getExpenses(input.budgetId, ctx.user.id)),

    create: protectedProcedure
      .input(
        z.object({
          budgetId: z.number(),
          expenseDate: z.string(),
          amount: z.string(),
          category: z.enum(["labor", "operation", "project"]),
          description: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const budget = await getBudgetById(input.budgetId, ctx.user.id);
        if (!budget) throw new TRPCError({ code: "NOT_FOUND", message: "예산을 찾을 수 없습니다." });
        return createExpense({
          ...input,
          expenseDate: input.expenseDate as unknown as Date,
          userId: ctx.user.id,
        });
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          expenseDate: z.string().optional(),
          amount: z.string().optional(),
          category: z.enum(["labor", "operation", "project"]).optional(),
          description: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        const { id, expenseDate, ...rest } = input;
        const expData: Parameters<typeof updateExpense>[2] = { ...rest };
        if (expenseDate !== undefined) expData.expenseDate = expenseDate as unknown as Date;
        return updateExpense(id, ctx.user.id, expData);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) => deleteExpense(input.id, ctx.user.id)),
  }),
});

// ─── Project Plans Router ────────────────────────────────────────────────────

const projectPlansRouter = router({
  /** 사업 계획서 목록 조회 */
  list: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId, ctx.user.id);
      if (!isOwnedProject(project, ctx.user.id, { parentOnly: true })) throw new TRPCError({ code: "NOT_FOUND" });
      return getProjectPlans(input.projectId, ctx.user.id);
    }),

  /** 사업 계획서 PDF 업로드 (base64 인코딩된 파일 데이터) */
  upload: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        fileName: z.string(),
        fileData: z.string(), // base64
        fileSize: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId, ctx.user.id);
      if (!isOwnedProject(project, ctx.user.id, { parentOnly: true })) throw new TRPCError({ code: "NOT_FOUND" });
      const buffer = Buffer.from(input.fileData, "base64");
      const { key, url } = await storagePut(
        `project-plans/${ctx.user.id}/${input.projectId}/${input.fileName}`,
        buffer,
        "application/pdf"
      );
      await createProjectPlan({
        projectId: input.projectId,
        userId: ctx.user.id,
        fileName: input.fileName,
        fileKey: key,
        fileUrl: url,
        fileSize: input.fileSize,
      });
      return { key, url, fileName: input.fileName };
    }),

  /** 사업 계획서 삭제 */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await deleteProjectPlan(input.id, ctx.user.id);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),

  /** 사업 계획서 서명된 URL 조회 (PDF 열람용) */
  getSignedUrl: protectedProcedure
    .input(z.object({ fileKey: z.string() }))
    .query(async ({ input }) => {
      const url = await storageGetSignedUrl(input.fileKey);
      return { url };
    }),
});

// ─── Evaluation Router (AI 평가서 자동완성) ──────────────────────────────────

const evaluationRouter = router({
  /** AI 평가서 생성 전 선택 기간 실적 미리보기 */
  previewPeriod: protectedProcedure
    .input(
      z.object({
        parentId: z.number(),
        year: z.number(),
        period: z.enum(["q1", "q2", "q3", "q4", "h1", "h2", "annual", "custom"]),
        customStartMonth: z.number().int().min(1).max(12).optional(),
        customEndMonth: z.number().int().min(1).max(12).optional(),
      }).superRefine((value, ctx) => {
        if (value.period === "custom" && (value.customStartMonth === undefined || value.customEndMonth === undefined || value.customStartMonth > value.customEndMonth)) {
          ctx.addIssue({ code: "custom", path: ["customEndMonth"], message: "사용자 지정 월 범위가 올바르지 않습니다." });
        }
      }),
    )
    .query(async ({ ctx, input }) => {
      const evalData = await getProjectEvalData(input.parentId, ctx.user.id, input.year);
      if (!evalData) throw new TRPCError({ code: "NOT_FOUND", message: "사업 데이터를 찾을 수 없음" });

      const { months, label: periodLabel } = resolveEvaluationPeriod(
        input.period,
        input.customStartMonth,
        input.customEndMonth,
      );
      const filteredRecords = evalData.records.filter((record) => months.includes(parseInt(record.date.slice(5, 7), 10)));
      const monthMap = new Map<number, { records: number; count: number; participants: number }>();
      for (const record of filteredRecords) {
        const month = parseInt(record.date.slice(5, 7), 10);
        const current = monthMap.get(month) ?? { records: 0, count: 0, participants: 0 };
        current.records += 1;
        current.count += record.count;
        current.participants += record.participantCount * record.count;
        monthMap.set(month, current);
      }

      return {
        periodLabel,
        recordCount: filteredRecords.length,
        totalCount: filteredRecords.reduce((sum, record) => sum + record.count, 0),
        totalParticipants: filteredRecords.reduce((sum, record) => sum + record.participantCount * record.count, 0),
        months: months.map((month) => ({
          month,
          ...(monthMap.get(month) ?? { records: 0, count: 0, participants: 0 }),
        })),
      };
    }),

  /** AI 평가서 생성 */
  generate: protectedProcedure
    .input(
      z.object({
        parentId: z.number(),
        year: z.number(),
        period: z.enum(["q1", "q2", "q3", "q4", "h1", "h2", "annual", "custom"]), // 분기/상하반기/연간/사용자 지정
        customStartMonth: z.number().int().min(1).max(12).optional(),
        customEndMonth: z.number().int().min(1).max(12).optional(),
      }).superRefine((value, ctx) => {
        if (value.period === "custom") {
          if (value.customStartMonth === undefined) {
            ctx.addIssue({ code: "custom", path: ["customStartMonth"], message: "시작월을 선택해주세요." });
          }
          if (value.customEndMonth === undefined) {
            ctx.addIssue({ code: "custom", path: ["customEndMonth"], message: "종료월을 선택해주세요." });
          }
          if (value.customStartMonth !== undefined && value.customEndMonth !== undefined && value.customStartMonth > value.customEndMonth) {
            ctx.addIssue({ code: "custom", path: ["customEndMonth"], message: "종료월은 시작월 이후여야 합니다." });
          }
        }
      })
    )
    .mutation(async ({ ctx, input }) => {
      const evalData = await getProjectEvalData(input.parentId, ctx.user.id, input.year);
      if (!evalData) throw new TRPCError({ code: "NOT_FOUND", message: "사업 데이터를 찾을 수 없음" });

      // 기간 레이블 및 월 범위 결정
      const { months, label: periodLabel } = resolveEvaluationPeriod(
        input.period,
        input.customStartMonth,
        input.customEndMonth,
      );

      // 해당 기간 실적만 필터링
      const filteredRecords = evalData.records.filter((r) => {
        const month = parseInt(r.date.slice(5, 7), 10);
        return months.includes(month);
      });

      // 기간 내 세부 사업별 집계 (records 기준으로 재집계)
      const periodTotalCount = filteredRecords.reduce((sum, r) => sum + r.count, 0);
      // 연인원: 참여자 수 × record.count (횟수) 합산 - 대시보드/통계와 동일한 방식
      const periodTotalParticipants = filteredRecords.reduce((sum, r) => sum + r.participantCount * r.count, 0);

      // 분기/기간별 세부 사업 수치 재집계 (연간 누적 대신 해당 기간만)
      // projectId 기준으로 세부 사업 수치 재집계
      const periodSubStatsById: Record<number, {
        totalCount: number;
        extendedPeople: number;
        uniqueParticipants: Set<number>;
        malePeople: Set<number>;
        femalePeople: Set<number>;
      }> = {};
      for (const r of filteredRecords) {
        if (!periodSubStatsById[r.projectId]) {
          periodSubStatsById[r.projectId] = {
            totalCount: 0,
            extendedPeople: 0,
            uniqueParticipants: new Set(),
            malePeople: new Set(),
            femalePeople: new Set(),
          };
        }
        const stat = periodSubStatsById[r.projectId];
        stat.totalCount += r.count;
        for (const pid of r.allParticipantIds) {
          stat.extendedPeople += r.count;
          stat.uniqueParticipants.add(pid);
        }
        for (const pid of r.malePeople) stat.malePeople.add(pid);
        for (const pid of r.femalePeople) stat.femalePeople.add(pid);
      }

      // 사업 계획서 PDF URL (서명된 URL 생성) + 텍스트 추출
      const planUrls: string[] = [];
      for (const f of evalData.planFiles) {
        try {
          const signed = await storageGetSignedUrl(f.fileKey);
          planUrls.push(signed);
        } catch {
          // 서명 실패 시 스킵
        }
      }

      // PDF 내용을 텍스트로 추출하여 프롬프트에 포함
      const planPdfText = await extractPlanPdfTexts(planUrls);

      // 세부 사업별 진행 내역 포함 요약 구성 (월별 집계로 레코드 수 제한 없이 전체 기간 반영)
      const subDetailSummary = evalData.subList
        .map((s) => {
          const ps = periodSubStatsById[s.id];
          const periodActualPeople = ps ? ps.uniqueParticipants.size : 0;
          const periodActualExtended = ps ? ps.extendedPeople : 0;
          const periodActualCount = ps ? ps.totalCount : 0;
          const periodMale = ps ? ps.malePeople.size : 0;
          const periodFemale = ps ? ps.femalePeople.size : 0;

          // 해당 세부 사업의 기간 내 레코드를 월별로 집계
          const subRecords = filteredRecords.filter((r) => r.projectId === s.id);
          const subMonthMap: Record<number, { count: number; participants: number; notes: string[] }> = {};
          for (const r of subRecords) {
            const month = parseInt(r.date.slice(5, 7), 10);
            if (!subMonthMap[month]) subMonthMap[month] = { count: 0, participants: 0, notes: [] };
            subMonthMap[month].count += r.count;
            subMonthMap[month].participants += r.participantCount * r.count;
            if (r.note) subMonthMap[month].notes.push(r.note);
          }
          const monthDetail = Object.entries(subMonthMap)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([month, stat]) => {
              const noteStr = stat.notes.length > 0 ? ` (${stat.notes.slice(0, 2).join(", ")})` : "";
              return `      ${month}월: ${stat.count}회 진행, 연인원 ${stat.participants}명${noteStr}`;
            })
            .join("\n");

          const header = `  [${s.name}]`;
          const stats = `    계획 실인원 ${s.plannedPeople}명 → ${periodLabel} 실적: 실인원 ${periodActualPeople}명, 연인원 ${periodActualExtended}명, 횟수 ${periodActualCount}회 (남 ${periodMale}명, 여 ${periodFemale}명)`;
          const detail = monthDetail ? `    월별 진행:\n${monthDetail}` : `    해당 기간 실적 없음`;
          return `${header}\n${stats}\n${detail}`;
        })
        .join("\n\n");

      const budgetSummary = evalData.budget
        ? `총예산 ${evalData.budget.totalBudget.toLocaleString()}원, 집행액 ${evalData.budget.totalSpent.toLocaleString()}원, 잔액 ${evalData.budget.remaining.toLocaleString()}원 (집행률 ${evalData.budget.totalBudget > 0 ? Math.round((evalData.budget.totalSpent / evalData.budget.totalBudget) * 100) : 0}%)`
        : "예산 정보 없음";

      // LLM 메시지 구성
      const messages: Parameters<typeof invokeLLM>[0]["messages"] = [
        {
          role: "system",
          content: `당신은 사회복지 및 공공 사업 평가서를 작성하는 전문가입니다. 제공된 사업 데이터를 바탕으로 평가서를 음슴체(~함, ~임, ~었음, ~였음)로 작성하세요. 각 항목은 구체적인 수치와 사실을 포함하여 작성하세요.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text" as const,
              text: `다음 사업의 ${input.year}년 ${periodLabel} 평가서를 작성해주세요.

[사업명]
${evalData.parent.projectName}

[세부 사업별 실적 및 진행 내역 (${periodLabel} 기준)]
기간 내 총 진행 횟수: ${periodTotalCount}회 / 총 참여 인원(연인원): ${periodTotalParticipants}명

${subDetailSummary}

[예산 현황]
${budgetSummary}
${planPdfText}

위 데이터를 바탕으로 아래 4개 항목을 음슴체로 작성해주세요. 각 항목은 "[항목명]" 헤더로 구분하고, 2~4문단으로 구체적으로 작성하세요.

[추진 실적]
(추진한 주요 활동 및 실적 작성)

[사업 성과]
(사업을 통해 달성한 주요 성과 작성)

[사업 추진 성과]
정량평가: (수치 기반 성과)
정성평가: (질적 성과 및 변화)

[자체 평가]
(사업에 대한 자체 평가 및 개선 방안 작성)`,
            },
          ],
        },
      ];

      const result = await invokeLLM({ messages, max_tokens: 4096 });
      const content = result.choices[0]?.message?.content;
      const text = typeof content === "string" ? content : JSON.stringify(content);

      return {
        text,
        periodLabel,
        projectName: evalData.parent.projectName,
        year: input.year,
      };
    }),

  /** 평가서 저장 */
  save: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        year: z.number(),
        period: z.string(),
        periodLabel: z.string(),
        title: z.string().min(1),
        contentActivity: z.string().optional(),
        contentOutcome: z.string().optional(),
        contentPerformance: z.string().optional(),
        contentSelfEval: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId, ctx.user.id);
      if (!isOwnedProject(project, ctx.user.id, { parentOnly: true })) {
        throw new TRPCError({ code: "NOT_FOUND", message: "사업을 찾을 수 없습니다." });
      }
      const id = await createEvaluation({
        ...input,
        userId: ctx.user.id,
        contentActivity: input.contentActivity ?? null,
        contentOutcome: input.contentOutcome ?? null,
        contentPerformance: input.contentPerformance ?? null,
        contentSelfEval: input.contentSelfEval ?? null,
      });
      return { id };
    }),

  /** 평가서 목록 조회 */
  list: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => listEvaluations(input.projectId, ctx.user.id)),

  /** 평가서 상세 조회 */
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const ev = await getEvaluation(input.id);
      if (!ev) throw new TRPCError({ code: "NOT_FOUND" });
      if (ev.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      return ev;
    }),

  /** 평가서 수정 */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        contentActivity: z.string().optional(),
        contentOutcome: z.string().optional(),
        contentPerformance: z.string().optional(),
        contentSelfEval: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ev = await getEvaluation(input.id);
      if (!ev) throw new TRPCError({ code: "NOT_FOUND" });
      if (ev.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const { id, ...data } = input;
      await updateEvaluation(id, data);
      return { success: true };
    }),

  /** 평가서 삭제 */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const ev = await getEvaluation(input.id);
      if (!ev) throw new TRPCError({ code: "NOT_FOUND" });
      if (ev.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await deleteEvaluation(input.id);
      return { success: true };
    }),
});

// ─── Local Auth Router ───────────────────────────────────────────────────────

const LOCAL_SESSION_COOKIE = "local_session";

const localAuthRouter = router({
  /** 회원가입 요청 */
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(4),
        name: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const result = await registerUser(input.email, input.password, input.name);
      if (!result.success) throw new TRPCError({ code: "BAD_REQUEST", message: result.message });
      return { message: result.message };
    }),

  /** 로그인 */
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await loginUser(input.email, input.password);
      if (!result.success || !result.sessionId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: result.message });
      }
      // 세션 쿠키 설정 - getSessionCookieOptions으로 secure/sameSite 통일
      const cookieOpts = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(LOCAL_SESSION_COOKIE, result.sessionId, {
        ...cookieOpts,
        secure: true, // 배포 환경에서 항상 secure
        maxAge: 7 * 24 * 60 * 60 * 1000,
      } as CookieOptions);
      return { user: result.user, message: result.message };
    }),

  /** 로그아웃 */
  logout: publicProcedure.mutation(async ({ ctx }) => {
    const sessionId = ctx.req.cookies?.[LOCAL_SESSION_COOKIE];
    if (sessionId) await logoutSession(sessionId);
    ctx.res.clearCookie(LOCAL_SESSION_COOKIE, { path: "/" });
    return { success: true };
  }),

  /** 현재 로그인 사용자 조회 */
  me: publicProcedure.query(async ({ ctx }) => {
    const sessionId = ctx.req.cookies?.[LOCAL_SESSION_COOKIE];
    if (!sessionId) return null;
    const user = await validateSession(sessionId);
    if (!user) return null;
    const { passwordHash: _, ...safe } = user;
    return safe;
  }),

  /** 관리자: 미승인 요청 수 조회 */
  adminPendingCount: publicProcedure.query(async ({ ctx }) => {
    const sessionId = ctx.req.cookies?.[LOCAL_SESSION_COOKIE];
    if (!sessionId) return { count: 0 };
    const user = await validateSession(sessionId);
    if (!user || user.role !== "admin") return { count: 0 };
    const users = await listAllUsers();
    return { count: users.filter((u) => u.status === "pending").length };
  }),

  /** 관리자: 전체 사용자 목록 */
  adminListUsers: publicProcedure.query(async ({ ctx }) => {
    const sessionId = ctx.req.cookies?.[LOCAL_SESSION_COOKIE];
    if (!sessionId) throw new TRPCError({ code: "UNAUTHORIZED" });
    const user = await validateSession(sessionId);
    if (!user || user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    return listAllUsers();
  }),

  /** 관리자: 사용자 승인 */
  adminApprove: publicProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const sessionId = ctx.req.cookies?.[LOCAL_SESSION_COOKIE];
      if (!sessionId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const user = await validateSession(sessionId);
      if (!user || user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await approveUser(input.userId);
      return { success: true };
    }),

  /** 관리자: 사용자 거부 */
  adminReject: publicProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const sessionId = ctx.req.cookies?.[LOCAL_SESSION_COOKIE];
      if (!sessionId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const user = await validateSession(sessionId);
      if (!user || user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await rejectUser(input.userId);
      return { success: true };
    }),

  /** 관리자: 사용자 삭제 */
  adminDelete: publicProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const sessionId = ctx.req.cookies?.[LOCAL_SESSION_COOKIE];
      if (!sessionId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const user = await validateSession(sessionId);
      if (!user || user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await deleteUser(input.userId);
      return { success: true };
    }),

  /** 관리자: 역할 변경 */
  adminUpdateRole: publicProcedure
    .input(z.object({ userId: z.number(), role: z.enum(["admin", "user"]) }))
    .mutation(async ({ input, ctx }) => {
      const sessionId = ctx.req.cookies?.[LOCAL_SESSION_COOKIE];
      if (!sessionId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const user = await validateSession(sessionId);
      if (!user || user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await updateUserRole(input.userId, input.role);
      return { success: true };
    }),
});

// ─── Schedules Router ────────────────────────────────────────────────────────

const schedulesRouter = router({
  /** 사업별 일정 목록 조회 */
  list: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(({ ctx, input }) => getSchedules(input.projectId, ctx.user.id)),

  /** 일정 등록 */
  create: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        title: z.string().min(1),
        description: z.string().optional(),
        startDate: z.string(),
        endDate: z.string(),
        allDay: z.boolean().optional(),
        color: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId, ctx.user.id);
      if (!isOwnedProject(project, ctx.user.id)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "사업을 찾을 수 없습니다." });
      }
      return createSchedule({ ...input, userId: ctx.user.id });
    }),

  /** 일정 수정 */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        projectId: z.number(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        allDay: z.boolean().optional(),
        color: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, projectId, ...data } = input;
      const existing = await getScheduleById(id, ctx.user.id);
      if (!existing || existing.projectId !== projectId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "일정을 찾을 수 없습니다." });
      }
      return updateSchedule(id, ctx.user.id, data);
    }),

  /** 일정 삭제 */
  delete: protectedProcedure
    .input(z.object({ id: z.number(), projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await getScheduleById(input.id, ctx.user.id);
      if (!existing || existing.projectId !== input.projectId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "일정을 찾을 수 없습니다." });
      }
      return deleteSchedule(input.id, ctx.user.id);
    }),

  /** 대시보드용: 다가오는 일정 목록 */
  upcoming: protectedProcedure
    .input(z.object({ daysAhead: z.number().optional() }))
    .query(({ ctx, input }) => getUpcomingSchedules(ctx.user.id, input.daysAhead ?? 14)),

  /** 전체 사업 일정 통합 조회 (스케줄 관리 달력용) */
  listAll: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number().optional() }))
    .query(({ ctx, input }) => getAllSchedules(ctx.user.id, input.year, input.month)),
});

// ─── Business Plans Router ───────────────────────────────────────────────────

async function callQuickLLM(quick: QuickPlanInput, refs?: RefChunk[]): Promise<string> {
  const { system, user } = buildGeneratePrompt(quick, refs);
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 8000,
      response_format: { type: "json_object" },
    });
    const c = response.choices[0]?.message?.content;
    return typeof c === "string" ? c : "";
  } catch (e) {
    console.error("[quickGenerate] LLM failed", e);
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI 생성에 실패했습니다. 잠시 후 다시 시도해 주세요." });
  }
}

const businessPlansRouter = router({
  /** 사업계획서 목록 조회 */
  list: protectedProcedure.query(({ ctx }) => listBusinessPlans(ctx.user.id)),

  /** 사업계획서 단건 조회 */
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const plan = await getBusinessPlanById(input.id, ctx.user.id);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "사업계획서를 찾을 수 없습니다." });
      return {
        ...plan,
        chatHistory: JSON.parse(plan.chatHistory ?? "[]") as ChatMessage[],
        inputData: JSON.parse(plan.inputData ?? "{}") as InputData,
        generatedContent: JSON.parse(plan.generatedContent ?? "[]") as { sectionId: string; title: string; content: string }[],
      };
    }),

  /** 사업계획서 생성 */
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      year: z.number(),
      projectId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await createBusinessPlan({ ...input, userId: ctx.user.id });
      return { id };
    }),

  /** 대화형 입력 저장 + AI 응답 생성 */
  chat: protectedProcedure
    .input(z.object({
      planId: z.number(),
      userMessage: z.string(),
      sectionId: z.string(),
      chatHistory: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
        sectionId: z.string().optional(),
        timestamp: z.number(),
      })),
      inputData: z.record(z.string(), z.array(z.string())),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getBusinessPlanById(input.planId, ctx.user.id);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });

      const section = PLAN_SECTIONS.find((s) => s.id === input.sectionId);
      const questions = CHAT_QUESTIONS[input.sectionId] ?? [];
      const sectionAnswers = (input.inputData[input.sectionId] as string[] | undefined) ?? [];
      const answeredCount = sectionAnswers.length + 1;
      const nextQuestion = questions[answeredCount];
      const currentQuestion = questions[Math.max(0, answeredCount - 1)];
      const hasMoreQuestions = answeredCount < questions.length;

      // 새 메시지 추가
      const newHistory: ChatMessage[] = [
        ...input.chatHistory,
        { role: "user", content: input.userMessage, sectionId: input.sectionId, timestamp: Date.now() },
      ];

      // 현재 섹션의 답변 저장
      const newInputData: InputData = Object.fromEntries(
        Object.entries(input.inputData).map(([k, v]) => [k, v as string[]])
      );
      if (!newInputData[input.sectionId]) newInputData[input.sectionId] = [];
      newInputData[input.sectionId] = [...newInputData[input.sectionId], input.userMessage];

      let assistantMessage = "";

      if (hasMoreQuestions && nextQuestion) {
        // 다음 질문이 있으면 안내
        assistantMessage = `감사합니다. 다음 질문입니다.\n\n**${nextQuestion.question}**\n\n${nextQuestion.hint ? `💡 ${nextQuestion.hint}` : ""}`;
      } else {
        // 섹션 완료 → 다음 섹션 안내
        const currentIdx = PLAN_SECTIONS.findIndex((s) => s.id === input.sectionId);
        const nextSection = PLAN_SECTIONS[currentIdx + 1];
        if (nextSection) {
          assistantMessage = `**${section?.title ?? ""} 섹션 입력이 완료되었습니다!** ✅\n\n방금 답변으로 **${currentQuestion?.question ?? "현재 질문"}** 입력이 저장되었습니다.\n\n다음은 **${nextSection.title}** 섹션입니다. 왼쪽 목록에서 해당 섹션을 선택하면 첫 질문을 이어서 안내합니다.`;
        } else {
          assistantMessage = `모든 섹션 입력이 완료되었습니다! 🎉\n\n이제 **사업계획서 최종본 생성** 버튼을 클릭하면 AI가 입력하신 내용을 바탕으로 완성된 사업계획서를 작성해드립니다.`;
        }
      }

      newHistory.push({ role: "assistant", content: assistantMessage, sectionId: input.sectionId, timestamp: Date.now() });

      await updateBusinessPlanChat(input.planId, ctx.user.id, newHistory, newInputData);
      return { assistantMessage, chatHistory: newHistory, inputData: newInputData };
    }),

  /** AI 최종 사업계획서 생성 */
  generate: protectedProcedure
    .input(z.object({ planId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getBusinessPlanById(input.planId, ctx.user.id);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });

      const inputData: InputData = JSON.parse(plan.inputData ?? "{}");

      // 섹션별 입력 데이터를 텍스트로 변환
      const inputSummary = PLAN_SECTIONS.map((section) => {
        const answers = inputData[section.id] ?? [];
        const questions = CHAT_QUESTIONS[section.id] ?? [];
        if (answers.length === 0) return null;
        const qaPairs = questions
          .map((q, i) => answers[i] ? `Q: ${q.question}\nA: ${answers[i]}` : null)
          .filter(Boolean)
          .join("\n\n");
        return `## ${section.title}\n${qaPairs}`;
      }).filter(Boolean).join("\n\n---\n\n");

      const systemPrompt = `당신은 사회복지 분야의 전문 사업계획서 작성 전문가입니다.
아래 척도집 목차를 참고하여 성과목표의 측정도구를 적절히 선택하고,
2026년 사업계획서 표준 양식에 맞춰 전문적이고 구체적인 사업계획서를 작성하세요.

[척도집 목차]
${SCALE_CATALOG}

작성 지침:
- 각 섹션을 표준 양식(Ⅰ~Ⅹ)에 맞게 작성하세요
- 사회복지 전문 용어를 적절히 사용하세요
- 수치와 근거를 명확히 제시하세요
- 성과목표에는 척도집에서 적합한 측정도구를 반드시 제안하세요
- 각 섹션을 "## 섹션제목" 형식으로 구분하여 작성하세요`;

      const userPrompt = `다음은 사업계획서 작성을 위해 수집된 정보입니다. 이를 바탕으로 완성된 사업계획서를 작성해주세요.

사업명: ${plan.title}\n연도: ${plan.year}년\n\n${inputSummary}`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 6000,
      });

      const rawContent = response.choices[0]?.message?.content;
      const generatedText = typeof rawContent === "string" ? rawContent : "";

      // 섹션별로 분리
      const sections = PLAN_SECTIONS.map((section) => {
        const regex = new RegExp(`##\\s*${section.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([\\s\\S]*?)(?=##|$)`, "i");
        const match = generatedText.match(regex);
        return {
          sectionId: section.id,
          title: section.title,
          content: match ? match[1].trim() : "",
        };
      });

      // 섹션 분리가 안 된 경우 전체 텍스트를 첫 섹션에 저장
      const hasContent = sections.some((s) => s.content.length > 0);
      if (!hasContent) {
        sections[0].content = generatedText;
      }

      await saveGeneratedContent(input.planId, ctx.user.id, sections);
      return { sections, generatedText };
    }),

  /** 공동모금회 양식 빠른 생성: 대상·예산·효과 입력 → 사업계획서 전체 초안 */
  quickGenerate: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      year: z.number().int(),
      projectId: z.number().optional(),
      field: z.string().max(40).default(""),
      region: z.string().max(100).default(""),
      targetDescription: z.string().min(1).max(1000),
      targetCount: z.number().int().positive().max(1_000_000),
      budget: z.number().positive().max(100_000_000_000),
      period: z.string().max(100).default(""),
      desiredEffect: z.string().min(1).max(2000),
      extra: z.string().max(3000).optional(),
      useReferences: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      let quick;
      try {
        quick = normalizeQuickInput(input);
      } catch (e) {
        throw new TRPCError({ code: "BAD_REQUEST", message: (e as Error).message });
      }
      const refs = input.useReferences
        ? await searchReferences(ctx.user.id, `${quick.title} ${quick.targetDescription} ${quick.desiredEffect}`, 6)
        : [];
      const raw = await callQuickLLM(quick, refs);
      const sections = parseGeneratedSections(raw);
      const id = await createBusinessPlan({
        userId: ctx.user.id,
        projectId: input.projectId,
        year: quick.year,
        title: quick.title,
      });
      await saveQuickPlan(id, ctx.user.id, quickInputToInputData(quick), sections);
      return { id };
    }),

  /** 빠른 생성으로 만든 계획서를 같은 입력으로 다시 생성 */
  regenerateQuick: protectedProcedure
    .input(z.object({ planId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getBusinessPlanById(input.planId, ctx.user.id);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      const data = JSON.parse(plan.inputData ?? "{}") as InputData;
      const saved = data._quick?.[0];
      if (!saved) throw new TRPCError({ code: "BAD_REQUEST", message: "빠른 생성으로 만든 계획서가 아닙니다." });
      let quick: QuickPlanInput;
      try {
        quick = normalizeQuickInput(JSON.parse(saved));
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "저장된 입력을 읽을 수 없습니다." });
      }
      const refs = await searchReferences(ctx.user.id, `${quick.title} ${quick.targetDescription} ${quick.desiredEffect}`, 6);
      const sections = parseGeneratedSections(await callQuickLLM(quick, refs));
      await saveQuickPlan(input.planId, ctx.user.id, data, sections);
      return { sections };
    }),

  /** 공고 심사기준 자가진단 */
  selfCheck: protectedProcedure
    .input(z.object({ planId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getBusinessPlanById(input.planId, ctx.user.id);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      const sections = JSON.parse(plan.generatedContent ?? "[]") as { sectionId: string; title: string; content: string }[];
      if (!sections.some((s) => s.content?.trim())) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "먼저 사업계획서를 생성해 주세요." });
      }
      const { system, user } = buildSelfCheckPrompt(sections);
      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          max_tokens: 4000,
          response_format: { type: "json_object" },
        });
        const c = response.choices[0]?.message?.content;
        const result = parseSelfCheck(typeof c === "string" ? c : "");
        await setInputDataKey(input.planId, ctx.user.id, "_selfCheck", [JSON.stringify({ at: Date.now(), result })]);
        return result;
      } catch (e) {
        console.error("[selfCheck] failed", e);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "자가진단에 실패했습니다. 잠시 후 다시 시도해 주세요." });
      }
    }),

  /** 사업계획서 삭제 */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteBusinessPlan(input.id, ctx.user.id);
      return { success: true };
    }),

  /** 섹션 구조 조회 (프론트엔드 참고용) */
  getSections: publicProcedure.query(() => PLAN_SECTIONS),

  /** 섹션별 질문 조회 */
  getQuestions: publicProcedure
    .input(z.object({ sectionId: z.string() }))
    .query(({ input }) => CHAT_QUESTIONS[input.sectionId] ?? []),

  /** 최종본 특정 섹션 내용 수정 */
  updateSection: protectedProcedure
    .input(z.object({
      planId: z.number(),
      sectionId: z.string(),
      content: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = await getBusinessPlanById(input.planId, ctx.user.id);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "사업계획서를 찾을 수 없습니다." });
      await updateGeneratedSection(input.planId, ctx.user.id, input.sectionId, input.content);
      return { success: true };
    }),
});

export const casesRouter = router({
  /** 공동모금회 배분사례집 발췌 검색 */
  search: protectedProcedure
    .input(z.object({
      query: z.string().min(1).max(200),
      year: z.number().int().optional(),
      limit: z.number().int().min(1).max(30).optional(),
    }))
    .query(({ input }) => searchCases(input)),
  stats: protectedProcedure.query(() => caseStats()),
});

async function simpleLLM(system: string, user: string, json: boolean, maxTokens: number): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: maxTokens,
      ...(json ? { response_format: { type: "json_object" as const } } : {}),
    });
    const c = response.choices[0]?.message?.content;
    return typeof c === "string" ? c : "";
  } catch (e) {
    console.error("[workTools] LLM failed", e);
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI 생성에 실패했습니다. 잠시 후 다시 시도해 주세요." });
  }
}

function uniqueSources(refs: RefChunk[]) {
  const seen = new Set<string>();
  return refs
    .map((r) => ({ docName: r.docName, page: r.page }))
    .filter((r) => {
      const k = `${r.docName}#${r.page}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

export const toolsRouter = router({
  /** 대상별 프로그램 아이디어 제안 (사례집 구조 참고) */
  programIdeas: protectedProcedure
    .input(z.object({
      targetGroup: z.string().min(1).max(40),
      region: z.string().max(100).default(""),
      budget: z.number().positive().max(100_000_000_000),
      goal: z.string().min(1).max(2000),
      count: z.number().int().min(1).max(5).default(3),
      extra: z.string().max(2000).optional(),
      useReferences: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const refs = searchCases({ query: `${input.targetGroup} ${input.goal}`, limit: 3 });
      const mine = input.useReferences ? await searchReferences(ctx.user.id, `${input.targetGroup} ${input.goal} ${input.extra ?? ""}`, 5) : [];
      const { system, user } = buildIdeasPrompt(
        input,
        refs.map((r) => `[${r.year}년 사례집] ${r.head.slice(0, 160)} / 성과목표: ${r.goals.slice(0, 140)}`),
        mine
      );
      const ideas = parseIdeas(await simpleLLM(system, user, true, 6000));
      if (ideas.length === 0) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "아이디어를 만들지 못했습니다. 다시 시도해 주세요." });
      }
      return {
        ideas,
        references: refs.map((r) => ({ id: r.id, year: r.year, page: r.page, head: r.head.slice(0, 120) })),
        sources: uniqueSources(mine),
      };
    }),

  /** 등록된 기관 양식 목록 */
  templates: protectedProcedure.query(({ ctx }) => listTemplates(ctx.user.id)),

  /** 양식 항목 구조 조회 */
  templateDetail: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const t = await getTemplate(input.id, ctx.user.id);
      if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "양식을 찾을 수 없습니다." });
      return { id: t.id, name: t.name, analysis: JSON.parse(t.analysis) as TemplateAnalysis };
    }),

  deleteTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteTemplate(input.id, ctx.user.id);
      return { success: true };
    }),

  /** 등록한 기관 양식의 항목 순서대로 내용 작성 */
  fillTemplate: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      title: z.string().min(1).max(200),
      facts: z.string().min(1).max(8000),
      extra: z.string().max(2000).optional(),
      useReferences: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const t = await getTemplate(input.templateId, ctx.user.id);
      if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "양식을 찾을 수 없습니다." });
      const analysis = JSON.parse(t.analysis) as TemplateAnalysis;
      const refs = input.useReferences ? await searchReferences(ctx.user.id, `${input.title} ${input.facts}`, 5) : [];
      const { system, user } = buildFillPrompt(analysis, input, t.sampleText, refs);
      const raw = await simpleLLM(system, user, true, 8000);
      const sections = alignFilled(analysis, raw);
      if (!sections.some((s) => s.content)) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "내용을 만들지 못했습니다. 다시 시도해 주세요." });
      }
      return {
        name: t.name,
        sections,
        warnings: lintOfficialStyle(sections.map((x) => x.content).join("\n")),
        sources: uniqueSources(refs),
      };
    }),

  /** 기안서·보고서·공문 초안 */
  draftDocument: protectedProcedure
    .input(z.object({
      type: z.enum(["draft", "report", "business", "official"]),
      title: z.string().min(1).max(200),
      org: z.string().max(100).default(""),
      facts: z.string().min(1).max(6000),
      budget: z.string().max(1000).optional(),
      extra: z.string().max(2000).optional(),
      useReferences: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const refs = input.useReferences ? await searchReferences(ctx.user.id, `${input.title} ${input.facts}`, 5) : [];
      const { system, user } = buildDocPrompt(input, refs);
      const text = cleanDocOutput(await simpleLLM(system, user, false, 4000));
      if (!text) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "문서를 만들지 못했습니다. 다시 시도해 주세요." });
      return {
        text,
        warnings: lintOfficialStyle(text, { requireEnd: input.type === "draft" || input.type === "official" }),
        sources: uniqueSources(refs),
      };
    }),

  /** 참고자료 보관함 */
  references: protectedProcedure.query(({ ctx }) => listReferenceDocs(ctx.user.id)),

  deleteReference: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteReferenceDoc(input.id, ctx.user.id);
      return { success: true };
    }),

  /** 올린 자료 안에서만 찾기(생성 없이 원문 발췌와 쪽수를 보여 준다) */
  searchReferences: protectedProcedure
    .input(z.object({ query: z.string().min(1).max(200) }))
    .query(({ ctx, input }) => searchReferences(ctx.user.id, input.query, 8)),
});

const todayKst = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const fieldsSchema = z.array(z.object({ heading: z.string().max(200), content: z.string().max(10000) })).max(40);

/** 사례관리 기록: 기관 양식 + 대화형 메모 → 항목별 자동 배치·저장·실적 */
const caseRecordsRouter = router({
  extract: protectedProcedure
    .input(z.object({ templateId: z.number(), text: z.string().min(1).max(8000) }))
    .mutation(async ({ ctx, input }) => {
      const t = await getTemplate(input.templateId, ctx.user.id);
      if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "양식을 찾을 수 없습니다." });
      const analysis = JSON.parse(t.analysis) as TemplateAnalysis;
      const today = todayKst();
      const { system, user } = buildCasePrompt(analysis, input.text, today);
      const raw = await simpleLLM(system, user, true, 8000);
      const r = parseCaseResult(analysis, raw, today);
      if (!r.sections.some((x) => x.content)) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "내용을 정리하지 못했습니다. 다시 시도해 주세요." });
      }
      return { templateName: t.name, ...r };
    }),

  save: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      recordDate: dateStr,
      subject: z.string().max(100).default(""),
      category: z.string().min(1).max(60),
      summary: z.string().max(300).default(""),
      fields: fieldsSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const t = await getTemplate(input.templateId, ctx.user.id);
      if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "양식을 찾을 수 없습니다." });
      const id = await createCaseRecord({ ...input, userId: ctx.user.id, templateName: t.name });
      return { id };
    }),

  list: protectedProcedure
    .input(z.object({ from: dateStr.optional(), to: dateStr.optional() }).default({}))
    .query(({ ctx, input }) => listCaseRecords(ctx.user.id, input)),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      recordDate: dateStr.optional(),
      subject: z.string().max(100).optional(),
      category: z.string().min(1).max(60).optional(),
      summary: z.string().max(300).optional(),
      fields: fieldsSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      await updateCaseRecord(id, ctx.user.id, rest);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteCaseRecord(input.id, ctx.user.id);
      return { success: true };
    }),

  stats: protectedProcedure
    .input(z.object({ from: dateStr.optional(), to: dateStr.optional() }).default({}))
    .query(async ({ ctx, input }) => computeCaseStats(await listCaseRecords(ctx.user.id, input))),
});

/** 홍보·소식글: 기관 샘플 문체 + 몇 가지 정보 → 채널별 초안 */
const promoRouter = router({
  samples: protectedProcedure.query(({ ctx }) => listPromoSamples(ctx.user.id)),

  saveSample: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(120),
      channel: z.string().max(30).default(""),
      body: z.string().min(30, "샘플 글이 너무 짧습니다.").max(8000),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return { id: await createPromoSample({ ...input, userId: ctx.user.id }) };
      } catch (e) {
        throw new TRPCError({ code: "BAD_REQUEST", message: (e as Error).message });
      }
    }),

  deleteSample: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deletePromoSample(input.id, ctx.user.id);
      return { success: true };
    }),

  generate: protectedProcedure
    .input(z.object({
      kind: z.enum(["recruit", "news"]),
      channel: z.enum(["blog", "instagram", "kakao", "press", "newsletter"]),
      org: z.string().max(100).default(""),
      facts: z.string().min(1).max(6000),
      extra: z.string().max(1000).optional(),
      sampleIds: z.array(z.number()).max(3).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      const samples = await getPromoSamples(ctx.user.id, input.sampleIds);
      const { system, user } = buildPromoPrompt(input, samples);
      const variants = parsePromo(await simpleLLM(system, user, true, 6000));
      if (variants.length === 0) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "글을 만들지 못했습니다. 다시 시도해 주세요." });
      return { variants };
    }),

  refine: protectedProcedure
    .input(z.object({
      channel: z.enum(["blog", "instagram", "kakao", "press", "newsletter"]),
      title: z.string().max(300).default(""),
      body: z.string().min(1).max(8000),
      instruction: z.string().min(1).max(500),
      sampleIds: z.array(z.number()).max(3).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      const samples = await getPromoSamples(ctx.user.id, input.sampleIds);
      const { system, user } = buildRefinePrompt(input, samples);
      const variants = parsePromo(await simpleLLM(system, user, true, 4000));
      if (variants.length === 0) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "수정하지 못했습니다. 다시 시도해 주세요." });
      return variants[0];
    }),
});

export const appRouter = router({
  promo: promoRouter,
  caseRecords: caseRecordsRouter,
  tools: toolsRouter,
  cases: casesRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  localAuth: localAuthRouter,
  projects: projectsRouter,
  participants: participantsRouter,
  performance: performanceRouter,
  budget: budgetRouter,
  projectPlans: projectPlansRouter,
  evaluation: evaluationRouter,
    schedules: schedulesRouter,
  businessPlans: businessPlansRouter,
});
export type AppRouter = typeof appRouter;
