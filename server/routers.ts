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
import { extendAccess, endOfDayKst } from "../shared/access";
import { BOARD_CATEGORIES, BOARD_STATUSES, listBoardPosts, countRecentPosts, createBoardPost, getBoardPost, replyBoardPost, deleteBoardPost, countOpenPosts } from "./boardDb";
import { buildRubricPrompt, parseRubric, buildReviewPrompt, parseReview, MAX_GUIDELINE_CHARS, MAX_PLAN_CHARS } from "./grantReview";
import { buildSchedulePrompt, parseScheduleItems, withTime } from "./scheduleParse";
import { buildPromoPrompt, parsePromo, buildRefinePrompt } from "./promo";
import { listPromoSamples, createPromoSample, deletePromoSample, getPromoSamples } from "./promoDb";
import { buildCasePrompt, parseCaseResult, computeCaseStats } from "./caseRecord";
import { createCaseRecord, listCaseRecords, updateCaseRecord, deleteCaseRecord } from "./caseRecordDb";
import { buildIdeasPrompt, parseIdeas, buildDocPrompt, cleanDocOutput } from "./workTools";
import type { QuickPlanInput } from "../shared/grantGuide";
import { getSessionCookieOptions } from "./_core/cookies";
import type { CookieOptions } from "express";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { aiProcedure, AI_FEATURES } from "./aiGate";
import { buildIdeaEvalPrompt, parseIdeaEval } from "./ideaEval";
import { kstDateString } from "../shared/access";
import { addToClass, classMembersOf, deleteClass, findOrCreateClass, getClass, getRecords, listClasses, participantClassMap, renameClass, saveMarks, setClassMembers, setParticipantClasses } from "./attendanceDb";
import { ATTENDANCE_STATUSES, isDateStr, monthRange, summarize, type AttendanceStatus } from "../shared/attendance";
import { getMonthlyCounts, getUsageSummary } from "./aiUsageDb";
import { FAIR_USE_MONTHLY_CALLS, isPlanId, monthStartKst, type AiFeatureKey, type PlanId } from "../shared/plans";
import { z } from "zod";
import {
  registerUser,
  loginUser,
  logoutSession,
  validateSession,
  findUserById,
  setAccessUntil,
  setUserPlan,
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
import { invokeLLM, llmFailureMessage } from "./_core/llm";
import { isOwnedProject } from "./projectAccess";
import { resolveEvaluationPeriod } from "./evaluationPeriod";
import { simpleLLM } from "./simpleLlm";
import { createLinkCode, getLinkByUser, unlinkUser } from "./telegramDb";
import { getBotUsername, notifyNewSignup, telegramEnabled } from "./telegramBot";
import { buildStyleBlock } from "./orgStyle";
import { getOrgStyle, saveOrgStyle } from "./orgStyleDb";
import { deleteSavedIdea, listSavedIdeas, saveIdea } from "./savedIdeas";
import { NOTE_SYSTEM, buildNoteUser } from "./noteImage";
import { FOLDER_SYSTEM, buildFolderUser } from "./folderSummary";
import { PICK_SYSTEM, WRITE_SYSTEM, buildPickUser, buildWriteUser, buildDocx, MAX_SOURCE_EACH, MAX_SOURCE_TOTAL } from "./docChat";
import { EDIT_SYSTEM, buildEditUser, tidyEditText } from "./docEdit";
import { applyAll, autoPruneRows, isCleanupOnly, parseEdits, verifyEditedTables, type DocEdit, type DocParagraph, type RowOp } from "../shared/docEdit";
import { docToText, parseDoc, parsePick, verifyTotals, type GeneratedDoc } from "../shared/docChat";
import { parseFolderRows } from "../shared/folderSummary";
import { parseNoteContent } from "../shared/noteImage";
import { assertMaskedInput, createVaultRow, getVault, lockExisting, resetVault } from "./vault";
import { gatherReportFacts } from "./reportData";
import { deleteFeeSet, listFeeSets, saveFeeSet } from "./lecturerFeeDb";
import { addLog, deleteToken, hasToken, pcHub, recentLogs, setTokenHash } from "./pcAgentDb";
import { newToken, hashToken } from "./pcAgent";
import { summarizeOp, type PcOp } from "../shared/pcAgent";
import { buildReportPrompt, factsToText, parseReport } from "./resultReport";
import { buildTranslatePrompt, parseTranslations } from "./translateNotice";
import { MAX_NOTICE_LANGS, NOTICE_LANG_IDS } from "../shared/languages";
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

const participantFields = {
  name: z.string().min(1).max(100),
  gender: z.enum(["male", "female"]),
  kind: z.enum(["foreigner", "domestic"]).default("foreigner"),
  nationality: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  visaType: z.string().max(50).optional(),
  region: z.string().max(100).optional(),
  birthDate: z.string().regex(/^\d{4}-(\d{2}|\*\*)-(\d{2}|\*\*)$/).optional(),
  note: z.string().max(200).optional(),
  /** 브라우저에서 암호화한 이름·전화·생년월일(잠금 사용 시) */
  encPayload: z.string().max(1500).optional(),
};

/** 잠금이 켜져 있으면 가려진 값 + 암호문만 받는다. */
async function guardVault(userId: number, d: { name?: string | null; phone?: string | null; birthDate?: string | null; encPayload?: string | null }, partial = false) {
  if (!(await getVault(userId))) return;
  try { assertMaskedInput(d, partial); }
  catch (e: any) { throw new TRPCError({ code: "BAD_REQUEST", message: e.message }); }
}

const pcOpSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("shell"), cmd: z.string().min(1).max(4000), timeoutSec: z.number().int().min(1).max(300).optional() }),
  z.object({ op: z.literal("ls"), path: z.string().max(1000) }),
  z.object({ op: z.literal("read"), path: z.string().min(1).max(1000) }),
  z.object({ op: z.literal("write"), path: z.string().min(1).max(1000), content: z.string().max(500_000) }),
]);

const pcAgentRouter = router({
  status: adminProcedure.query(async ({ ctx }) => ({ ...pcHub.status(ctx.user.id), hasToken: await hasToken(ctx.user.id) })),
  /** 연결 코드 새로 만들기: 화면에 한 번만 보여 주고 서버에는 해시만 남긴다. 기존 연결은 끊긴다. */
  createToken: adminProcedure.mutation(async ({ ctx }) => {
    const token = newToken();
    await setTokenHash(ctx.user.id, hashToken(token));
    pcHub.disconnect(ctx.user.id);
    return { token };
  }),
  revokeToken: adminProcedure.mutation(async ({ ctx }) => {
    await deleteToken(ctx.user.id);
    pcHub.disconnect(ctx.user.id);
    return { ok: true };
  }),
  run: adminProcedure.input(pcOpSchema).mutation(async ({ ctx, input }) => {
    const op = input as PcOp;
    const res = await pcHub.send(ctx.user.id, op);
    await addLog(ctx.user.id, summarizeOp(op), res.ok);
    return { ok: res.ok, output: res.output ?? "", error: res.error ?? "" };
  }),
  /** 하고 싶은 일을 말로 적으면 실행할 명령 한 개를 제안한다(실행은 하지 않음). */
  plan: adminProcedure.input(z.object({ goal: z.string().min(2).max(1000) })).mutation(async ({ ctx, input }) => {
    const st = pcHub.status(ctx.user.id);
    if (!st.connected) throw new TRPCError({ code: "BAD_REQUEST", message: "PC 도우미가 연결되어 있지 않습니다." });
    const system = `당신은 사용자의 PC(${st.info.platform}, 작업 폴더 ${st.info.root})에서 실행할 셸 명령 1개를 제안합니다. win32면 cmd/PowerShell, 그 외는 sh 문법. 삭제·포맷·시스템 설정 변경 등 위험한 명령은 제안하지 말고 안전한 대안이나 설명만 주세요. JSON만 출력: {"cmd":"명령","explain":"한국어로 한 줄 설명"}. 명령이 필요 없으면 cmd를 빈 문자열로.`;
    try {
      const out = JSON.parse(await simpleLLM(system, input.goal, true, 800));
      return { cmd: String(out.cmd ?? "").slice(0, 4000), explain: String(out.explain ?? "").slice(0, 500) };
    } catch (e) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: llmFailureMessage(e) });
    }
  }),
  log: adminProcedure.query(({ ctx }) => recentLogs(ctx.user.id)),
});

const lecturerFeeRouter = router({
  list: protectedProcedure.query(({ ctx }) => listFeeSets(ctx.user.id)),
  save: protectedProcedure
    .input(z.object({
      id: z.number().int().positive().optional(),
      title: z.string().trim().min(1, "저장 이름을 입력해 주세요.").max(100),
      rows: z.array(z.object({
        name: z.string().max(50),
        kind: z.enum(["business", "other"]),
        gross: z.number().int().min(0).max(1_000_000_000),
        memo: z.string().max(100).optional(),
      })).min(1).max(200),
    }))
    .mutation(async ({ ctx, input }) => {
      try { return { id: await saveFeeSet(ctx.user.id, input) }; }
      catch (e: any) { throw new TRPCError({ code: "BAD_REQUEST", message: e.message ?? "저장하지 못했습니다." }); }
    }),
  remove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await deleteFeeSet(ctx.user.id, input.id);
    return { ok: true };
  }),
});

const vaultRouter = router({
  /** 잠금 설정 여부와, 브라우저가 키를 만들 때 필요한 값(salt 등). 비밀번호·키는 서버에 없다. */
  status: protectedProcedure.query(async ({ ctx }) => {
    const v = await getVault(ctx.user.id);
    return v ? { enabled: true as const, ...v } : { enabled: false as const };
  }),
  setup: protectedProcedure
    .input(z.object({ salt: z.string().min(16).max(64), iterations: z.number().int().min(100000).max(5000000), verifier: z.string().min(10).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const ok = await createVaultRow(ctx.user.id, input);
      if (!ok) throw new TRPCError({ code: "CONFLICT", message: "이미 잠금이 설정되어 있습니다." });
      return { ok: true };
    }),
  /** 이미 등록된 대상자(가려지지 않은 값)를 암호화 값으로 바꾸고 원문을 가린 값으로 덮어쓴다. */
  lockExisting: protectedProcedure
    .input(z.object({
      items: z.array(z.object({
        id: z.number(), encPayload: z.string().min(10).max(1500), name: z.string().min(1).max(100),
        phone: z.string().max(30).nullish(), birthDate: z.string().max(10).nullish(),
      })).min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => ({ locked: await lockExisting(ctx.user.id, input.items) })),
  /** 비밀번호를 잊었을 때. 암호화된 이름·전화는 영구히 지워지고 가려진 값만 남는다. */
  reset: protectedProcedure
    .input(z.object({ confirm: z.literal("초기화") }))
    .mutation(async ({ ctx }) => ({ cleared: await resetVault(ctx.user.id) })),
});

const participantsRouter = router({
  /** 큰 사업 ID로 대상자 목록 조회 */
  list: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(({ ctx, input }) => getParticipants(input.projectId, ctx.user.id)),

  create: protectedProcedure
    .input(z.object({ projectId: z.number(), ...participantFields, classIds: z.array(z.number()).max(20).optional() }))
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId, ctx.user.id);
      if (!isOwnedProject(project, ctx.user.id, { parentOnly: true })) {
        throw new TRPCError({ code: "NOT_FOUND", message: "사업을 찾을 수 없습니다." });
      }
      const { classIds, ...data } = input;
      await guardVault(ctx.user.id, data);
      const r: any = await createParticipant({ ...data, userId: ctx.user.id });
      const id = Number((Array.isArray(r) ? r[0] : r).insertId);
      if (classIds?.length && id) await setParticipantClasses(id, ctx.user.id, classIds);
      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        gender: z.enum(["male", "female"]).optional(),
        kind: z.enum(["foreigner", "domestic"]).optional(),
        nationality: z.string().max(100).optional().nullable(),
        phone: z.string().max(30).optional().nullable(),
        visaType: z.string().max(50).optional().nullable(),
        region: z.string().max(100).optional().nullable(),
        birthDate: z.string().regex(/^\d{4}-(\d{2}|\*\*)-(\d{2}|\*\*)$/).optional().nullable(),
        note: z.string().max(200).optional().nullable(),
        encPayload: z.string().max(1500).optional().nullable(),
        classIds: z.array(z.number()).max(20).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, classIds, ...data } = input;
      await guardVault(ctx.user.id, data, !("name" in data && data.name));
      await updateParticipant(id, ctx.user.id, data);
      if (classIds) await setParticipantClasses(id, ctx.user.id, classIds);
      return { id };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteParticipant(input.id, ctx.user.id)),

  /** 엑셀 대량 등록 (반 이름이 있으면 반을 만들고 배정) */
  bulkCreate: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        participants: z.array(z.object({ ...participantFields, className: z.string().max(100).optional() })).min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId, ctx.user.id);
      if (!isOwnedProject(project, ctx.user.id, { parentOnly: true })) {
        throw new TRPCError({ code: "NOT_FOUND", message: "사업을 찾을 수 없습니다." });
      }
      for (const p of input.participants) await guardVault(ctx.user.id, p);
      const cache = new Map<string, number>();
      let assigned = 0;
      for (const p of input.participants) {
        const { className, ...data } = p;
        const r: any = await createParticipant({ ...data, projectId: input.projectId, userId: ctx.user.id });
        const pid = Number((Array.isArray(r) ? r[0] : r).insertId);
        if (className?.trim() && pid) {
          const cid = await findOrCreateClass(input.projectId, ctx.user.id, className.trim(), cache);
          await addToClass(cid, pid, ctx.user.id);
          assigned++;
        }
      }
      return { inserted: input.participants.length, assigned };
    }),
});

// ─── Attendance Router (반·출석부) ───────────────────────────────────────────

const requireParentProject = async (projectId: number, userId: number) => {
  const project = await getProjectById(projectId, userId);
  if (!isOwnedProject(project, userId, { parentOnly: true })) throw new TRPCError({ code: "NOT_FOUND", message: "사업을 찾을 수 없습니다." });
  return project!;
};
const requireClass = async (classId: number, userId: number) => {
  const c = await getClass(classId, userId);
  if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "반을 찾을 수 없습니다." });
  return c;
};

const attendanceRouter = router({
  classes: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(({ ctx, input }) => listClasses(input.projectId, ctx.user.id)),

  createClass: protectedProcedure
    .input(z.object({ projectId: z.number(), name: z.string().trim().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      await requireParentProject(input.projectId, ctx.user.id);
      return { id: await findOrCreateClass(input.projectId, ctx.user.id, input.name) };
    }),

  renameClass: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().trim().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      await requireClass(input.id, ctx.user.id);
      await renameClass(input.id, ctx.user.id, input.name);
      return { ok: true };
    }),

  deleteClass: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireClass(input.id, ctx.user.id);
      await deleteClass(input.id, ctx.user.id);
      return { ok: true };
    }),

  /** 참여자별 소속 반 (참여자 화면 표시용) */
  classMap: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(({ ctx, input }) => participantClassMap(input.projectId, ctx.user.id)),

  /** 반 구성원 지정(전체 교체) */
  setMembers: protectedProcedure
    .input(z.object({ classId: z.number(), participantIds: z.array(z.number()).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      await requireClass(input.classId, ctx.user.id);
      await setClassMembers(input.classId, ctx.user.id, input.participantIds);
      return { ok: true };
    }),

  /** 사업의 실제 출석률(최근 12개월, 출석+지각 ÷ 출석+지각+결석) — 시뮬레이션 기본값용 */
  rateDefaults: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const classes = await listClasses(input.projectId, ctx.user.id);
      const from = kstDateString(new Date(Date.now() - 365 * 86400000));
      const to = kstDateString(new Date(Date.now() + 86400000));
      let present = 0, late = 0, absent = 0;
      const sessions = new Set<string>();
      for (const c of classes) {
        const recs = await getRecords(c.id, from, to);
        for (const r of recs) {
          sessions.add(`${c.id}:${r.date}`);
          if (r.status === "present") present++;
          else if (r.status === "late") late++;
          else if (r.status === "absent") absent++;
        }
      }
      const denom = present + late + absent;
      return { rate: denom > 0 ? Math.round(((present + late) / denom) * 1000) / 10 : null, records: denom, sessions: sessions.size, classes: classes.length };
    }),

  /** 사업의 모든 반 월간 한눈에 보기 */
  overview: protectedProcedure
    .input(z.object({ projectId: z.number(), month: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const classes = await listClasses(input.projectId, ctx.user.id);
      const { from, to } = monthRange(input.month);
      return Promise.all(classes.map(async (c) => {
        const [members, records] = await Promise.all([classMembersOf(c.id), getRecords(c.id, from, to)]);
        const sum = summarize(
          records.filter((r) => (ATTENDANCE_STATUSES as readonly string[]).includes(r.status)) as { participantId: number; date: string; status: AttendanceStatus }[],
          members.map((m) => m.id),
        );
        return { id: c.id, name: c.name, members: members.length, people: sum.people, extended: sum.extended, sessions: sum.dates.length, rate: sum.all.rate, absent: sum.all.absent, lastDate: sum.dates[sum.dates.length - 1] ?? null };
      }));
    }),

  /** 한 반의 월간 출석 현황 + 구성원 */
  sheet: protectedProcedure
    .input(z.object({ classId: z.number(), month: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const cls = await requireClass(input.classId, ctx.user.id);
      const { from, to } = monthRange(input.month);
      const [members, records] = await Promise.all([classMembersOf(cls.id), getRecords(cls.id, from, to)]);
      members.sort((a, b) => a.name.localeCompare(b.name, "ko"));
      return { cls, members, records: records.filter((r) => (ATTENDANCE_STATUSES as readonly string[]).includes(r.status)) as { participantId: number; date: string; status: AttendanceStatus }[] };
    }),

  /** 하루 출결 저장 (status null = 기록 지우기) */
  mark: protectedProcedure
    .input(z.object({
      classId: z.number(),
      date: z.string().refine(isDateStr, "날짜 형식이 올바르지 않습니다."),
      entries: z.array(z.object({ participantId: z.number(), status: z.enum(ATTENDANCE_STATUSES).nullable() })).max(1000),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireClass(input.classId, ctx.user.id);
      return saveMarks(input.classId, ctx.user.id, input.date, input.entries);
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
  generate: aiProcedure("evaluation")
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
      void notifyNewSignup(input.name, input.email); // 관리자 텔레그램 알림(실패해도 가입에는 영향 없음)
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

  /** 관리자: 이용 기간 설정(연장 / 날짜 지정 / 무제한) */
  adminSetAccess: publicProcedure
    .input(z.discriminatedUnion("mode", [
      z.object({ userId: z.number(), mode: z.literal("extend"), days: z.number().int().min(1).max(3650) }),
      z.object({ userId: z.number(), mode: z.literal("date"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
      z.object({ userId: z.number(), mode: z.literal("unlimited") }),
    ]))
    .mutation(async ({ input, ctx }) => {
      const sessionId = ctx.req.cookies?.[LOCAL_SESSION_COOKIE];
      if (!sessionId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const admin = await validateSession(sessionId);
      if (!admin || admin.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const target = await findUserById(input.userId);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "사용자를 찾을 수 없습니다." });
      let until: Date | null = null;
      if (input.mode === "extend") until = extendAccess(target.accessUntil ?? null, input.days);
      else if (input.mode === "date") until = endOfDayKst(input.date);
      await setAccessUntil(input.userId, until);
      return { accessUntil: until };
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
      // projectId 0 = 개인 업무(사업과 무관한 일정)
      if (input.projectId !== 0) {
        const project = await getProjectById(input.projectId, ctx.user.id);
        if (!isOwnedProject(project, ctx.user.id)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "사업을 찾을 수 없습니다." });
        }
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

  /** 대화체 문장 → 등록할 일정 목록(미리보기용, 저장하지 않음) */
  parseChat: aiProcedure("schedule")
    .input(z.object({ text: z.string().min(1).max(3000) }))
    .mutation(async ({ ctx, input }) => {
      const today = todayKst();
      const year = Number(today.slice(0, 4));
      const projects = [
        ...(await getParentProjects(ctx.user.id, year)),
        ...(await getParentProjects(ctx.user.id, year + 1)),
      ].map((p) => ({ id: p.id, name: p.projectName }));
      const { system, user } = buildSchedulePrompt(input.text, today, projects);
      const items = parseScheduleItems(await simpleLLM(system, user, true, 4000), projects.map((p) => p.id), today)
        .map(({ time, description, ...rest }) => ({ ...rest, description: withTime(description, time) }));
      if (items.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "날짜가 있는 일정을 찾지 못했습니다. 날짜(예: 11월 8일, 다음 주 화요일)를 함께 적어 주세요." });
      }
      return { items, projects };
    }),

  /** 확인한 일정 여러 건 등록 */
  createMany: protectedProcedure
    .input(z.object({
      items: z.array(z.object({
        projectId: z.number(),
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        color: z.string().max(20).optional(),
      })).min(1).max(30),
    }))
    .mutation(async ({ ctx, input }) => {
      const owned = new Map<number, boolean>();
      for (const it of input.items) {
        if (!owned.has(it.projectId)) owned.set(it.projectId, it.projectId === 0 || isOwnedProject(await getProjectById(it.projectId, ctx.user.id), ctx.user.id));
        if (!owned.get(it.projectId)) throw new TRPCError({ code: "NOT_FOUND", message: "사업을 찾을 수 없습니다." });
        if (it.endDate < it.startDate) throw new TRPCError({ code: "BAD_REQUEST", message: `'${it.title}'의 종료일이 시작일보다 빠릅니다.` });
      }
      for (const it of input.items) await createSchedule({ ...it, userId: ctx.user.id });
      return { count: input.items.length };
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

async function callQuickLLM(quick: QuickPlanInput, refs?: RefChunk[], styleBlock = ""): Promise<string> {
  const { system: baseSystem, user } = buildGeneratePrompt(quick, refs);
  const system = baseSystem + styleBlock;
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 8000,
      strong: true,
      response_format: { type: "json_object" },
    });
    const c = response.choices[0]?.message?.content;
    return typeof c === "string" ? c : "";
  } catch (e) {
    console.error("[quickGenerate] LLM failed", e);
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: llmFailureMessage(e) });
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
  chat: aiProcedure("plan_chat")
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
  generate: aiProcedure("plan_generate")
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
        strong: true,
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
  quickGenerate: aiProcedure("plan_generate")
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
      const raw = await callQuickLLM(quick, refs, buildStyleBlock(await getOrgStyle(ctx.user.id)));
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
  regenerateQuick: aiProcedure("plan_generate")
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
      const sections = parseGeneratedSections(await callQuickLLM(quick, refs, buildStyleBlock(await getOrgStyle(ctx.user.id))));
      await saveQuickPlan(input.planId, ctx.user.id, data, sections);
      return { sections };
    }),

  /** 공고 심사기준 자가진단 */
  selfCheck: aiProcedure("grant_review")
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
          strong: true,
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
  programIdeas: aiProcedure("ideas")
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

  /** 폴더에서 읽은 문서들의 글 → 파일별 요약 행(한 번에 최대 10개) */
  folderSummary: aiProcedure("folder_summary")
    .input(z.object({
      items: z.array(z.object({ name: z.string().min(1).max(200), text: z.string().max(5000) })).min(1).max(10),
    }))
    .mutation(async ({ input }) => {
      let raw = "";
      try { raw = await simpleLLM(FOLDER_SYSTEM, buildFolderUser(input.items), true, 4000); }
      catch (e) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: llmFailureMessage(e) }); }
      return { rows: parseFolderRows(raw, input.items.map((i) => i.name)) };
    }),

  /** 대화로 문서 작성 ① 폴더 파일 이름 중 참고할 파일 고르기 */
  docChatPick: aiProcedure("doc_chat_pick")
    .input(z.object({
      instruction: z.string().trim().min(5, "작성할 내용을 조금 더 적어 주세요.").max(4000),
      files: z.array(z.object({ path: z.string().max(300), size: z.number().int().min(0) })).min(1).max(300),
    }))
    .mutation(async ({ input }) => {
      let raw = "";
      try { raw = await simpleLLM(PICK_SYSTEM, buildPickUser(input.instruction, input.files), true, 800); }
      catch (e) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: llmFailureMessage(e) }); }
      return { files: parsePick(raw, input.files.map((f) => f.path)) };
    }),

  /** 대화로 문서 작성 ② 지시 + 참고 파일 내용 → 문서(처음 작성 또는 이전 초안 수정). 합계가 틀리면 한 번 다시 시킨다. */
  docChatWrite: aiProcedure("doc_chat")
    .input(z.object({
      instruction: z.string().trim().min(3, "지시를 입력해 주세요.").max(6000),
      history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(3000) })).max(12).default([]),
      sources: z.array(z.object({ name: z.string().max(300), text: z.string().max(MAX_SOURCE_EACH) })).max(10).default([]),
      prevDoc: z.object({
        title: z.string().max(200),
        blocks: z.array(z.any()).max(200),
        notes: z.array(z.string()).max(10).default([]),
      }).nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      let total = 0;
      const sources = input.sources.filter((s) => (total += s.text.length) <= MAX_SOURCE_TOTAL);
      const system = WRITE_SYSTEM + buildStyleBlock(await getOrgStyle(ctx.user.id));
      const prev: GeneratedDoc | null = input.prevDoc ? parseDoc(JSON.stringify(input.prevDoc)) : null;
      const call = async (fix?: string[], again?: GeneratedDoc | null) => {
        let raw = "";
        try { raw = await simpleLLM(system, buildWriteUser({ instruction: input.instruction, history: input.history, sources, prevDoc: again ?? prev, fix }), true, 8000, true); }
        catch (e) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: llmFailureMessage(e) }); }
        return parseDoc(raw);
      };
      let doc = await call();
      if (!doc) doc = await call();
      if (!doc) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "문서를 만들지 못했습니다. 지시를 조금 바꿔 다시 시도해 주세요." });
      let warnings = verifyTotals(doc);
      if (warnings.length) {
        const fixed = await call(warnings, doc).catch(() => null);
        if (fixed) { doc = fixed; warnings = verifyTotals(doc); }
      }
      return { doc, warnings };
    }),

  /** 기존 문서 고쳐 쓰기: 문단 목록 + 지시 + 참고 파일 → 고칠 문단 목록. 합계가 틀리면 한 번 다시 시킨다. */
  docEditPlan: aiProcedure("doc_chat")
    .input(z.object({
      instruction: z.string().trim().min(3, "지시를 입력해 주세요.").max(6000),
      history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(3000) })).max(12).default([]),
      sources: z.array(z.object({ name: z.string().max(300), text: z.string().max(MAX_SOURCE_EACH) })).max(10).default([]),
      paragraphs: z.array(z.object({
        id: z.number().int().min(0),
        text: z.string().max(3000),
        cell: z.object({ t: z.number().int(), r: z.number().int(), c: z.number().int() }).optional(),
      })).min(1).max(700),
    }))
    .mutation(async ({ ctx, input }) => {
      let total = 0;
      const sources = input.sources.filter((s) => (total += s.text.length) <= MAX_SOURCE_TOTAL);
      const paragraphs: DocParagraph[] = input.paragraphs;
      // '표·빈칸 정리' 같은 지시는 AI 없이 빈 행 삭제·열 너비 맞춤만 한다(사용량도 아낀다)
      if (isCleanupOnly(input.instruction)) {
        const tables = Array.from(new Set(paragraphs.flatMap((p) => (p.cell ? [p.cell.t] : []))));
        const rowOps: RowOp[] = [...autoPruneRows(paragraphs, [], [], true), ...tables.map((t) => ({ op: "fit" as const, t }))];
        // "- - 글"처럼 겹친 글머리 기호도 함께 바로잡는다
        const edits: DocEdit[] = paragraphs.flatMap((p) => { const t = tidyEditText(p.text, p.text); return t !== p.text.trim() && p.text.trim() ? [{ id: p.id, text: t }] : []; });
        return { edits, rowOps, notes: ["표 정리 지시라서 내용은 바꾸지 않고, 비어 있는 행 삭제·열 너비와 칸 높이 맞춤·겹친 글머리 기호 정리만 했습니다."], warnings: [] as string[] };
      }
      const system = EDIT_SYSTEM + buildStyleBlock(await getOrgStyle(ctx.user.id));
      const call = async (fix?: string[], prevEdits?: unknown) => {
        let raw = "";
        try { raw = await simpleLLM(system, buildEditUser({ instruction: input.instruction, history: input.history, sources, paragraphs, fix, prevEdits }), true, 8000, true); }
        catch (e) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: llmFailureMessage(e) }); }
        return parseEdits(raw, paragraphs);
      };
      let r = await call();
      if (!r) r = await call();
      if (!r) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "고칠 내용을 만들지 못했습니다. 지시를 조금 바꿔 다시 시도해 주세요." });
      const withPrune = (x: { edits: DocEdit[]; rowOps: RowOp[] }) => [...x.rowOps, ...autoPruneRows(paragraphs, x.edits, x.rowOps)];
      let rowOps = withPrune(r);
      let warnings = verifyEditedTables(applyAll(paragraphs, r.edits, rowOps));
      if (warnings.length) {
        const fixed = await call(warnings, { edits: r.edits, tableOps: r.rowOps }).catch(() => null);
        if (fixed) { r = fixed; rowOps = withPrune(r); warnings = verifyEditedTables(applyAll(paragraphs, r.edits, rowOps)); }
      }
      return { edits: r.edits, rowOps, notes: r.notes, warnings };
    }),

  /** 대화로 문서 작성 ③ 문서 → Word 파일(base64). AI는 쓰지 않는다. */
  docChatExport: protectedProcedure
    .input(z.object({ doc: z.object({ title: z.string().max(200), blocks: z.array(z.any()).max(200), notes: z.array(z.string()).max(10).default([]) }) }))
    .mutation(async ({ input }) => {
      const doc = parseDoc(JSON.stringify(input.doc));
      if (!doc) throw new TRPCError({ code: "BAD_REQUEST", message: "내보낼 문서가 올바르지 않습니다." });
      const buf = await buildDocx(doc);
      return { base64: buf.toString("base64"), text: docToText(doc) };
    }),

  /** 글 → 노트/마인드맵 이미지용 구조(제목·항목 6~8개·이모지). 이미지는 브라우저에서 그린다. */
  noteImage: aiProcedure("note_image")
    .input(z.object({
      text: z.string().min(30, "정리할 내용을 조금 더 적어 주세요(30자 이상).").max(6000),
      title: z.string().max(40).optional(),
      footer: z.string().max(40).optional(),
    }))
    .mutation(async ({ input }) => {
      let raw = "";
      try { raw = await simpleLLM(NOTE_SYSTEM, buildNoteUser(input.text, input.title, input.footer), true, 2500); }
      catch (e) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: llmFailureMessage(e) }); }
      const content = parseNoteContent(raw);
      if (!content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "노트 내용을 만들지 못했습니다. 다시 시도해 주세요." });
      if (input.title?.trim()) content.title = input.title.trim();
      if (input.footer?.trim()) content.footer = input.footer.trim();
      return content;
    }),

  /** 저장한 프로그램 아이디어 */
  savedIdeas: protectedProcedure.query(({ ctx }) => listSavedIdeas(ctx.user.id)),
  saveIdea: protectedProcedure
    .input(z.object({
      idea: z.object({
        name: z.string().min(1).max(200),
        summary: z.string().max(1000).default(""),
        activities: z.array(z.string().max(500)).max(10).default([]),
        outcome: z.string().max(1000).default(""),
        indicator: z.string().max(1000).default(""),
        budgetEstimate: z.string().max(1500).default(""),
      }),
      context: z.object({
        targetGroup: z.string().min(1).max(40),
        region: z.string().max(100).default(""),
        budget: z.number().positive().max(100_000_000_000),
        goal: z.string().min(1).max(2000),
        extra: z.string().max(2000).optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      try { return await saveIdea(ctx.user.id, input.idea, input.context); }
      catch (e: any) { throw new TRPCError({ code: "BAD_REQUEST", message: e?.message || "저장하지 못했습니다." }); }
    }),
  deleteSavedIdea: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => { await deleteSavedIdea(ctx.user.id, input.id); return { ok: true }; }),

  /** 아이디어 AI 심사(점수·장점·보완점·수정안) */
  evaluateIdea: aiProcedure("idea_eval")
    .input(z.object({
      idea: z.object({
        name: z.string().min(1).max(200),
        summary: z.string().max(1000).default(""),
        activities: z.array(z.string().max(500)).max(10).default([]),
        outcome: z.string().max(1000).default(""),
        indicator: z.string().max(1000).default(""),
        budgetEstimate: z.string().max(1500).default(""),
      }),
      context: z.object({
        targetGroup: z.string().min(1).max(40),
        region: z.string().max(100).default(""),
        budget: z.number().positive().max(100_000_000_000),
        goal: z.string().min(1).max(2000),
        extra: z.string().max(2000).optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      const { system, user } = buildIdeaEvalPrompt(input.idea, input.context);
      const result = parseIdeaEval(await simpleLLM(system, user, true, 4000));
      if (!result) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "평가 결과를 만들지 못했습니다. 다시 시도해 주세요." });
      return result;
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
  fillTemplate: aiProcedure("template_fill")
    .input(z.object({
      templateId: z.number(),
      title: z.string().min(1).max(200),
      facts: z.string().min(1).max(15000),
      extra: z.string().max(2000).optional(),
      useReferences: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const t = await getTemplate(input.templateId, ctx.user.id);
      if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "양식을 찾을 수 없습니다." });
      const analysis = JSON.parse(t.analysis) as TemplateAnalysis;
      const refs = input.useReferences ? await searchReferences(ctx.user.id, `${input.title} ${input.facts}`, 5) : [];
      const { system, user } = buildFillPrompt(analysis, input, t.sampleText, refs);
      const raw = await simpleLLM(system, user, true, 8000, true);
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
  draftDocument: aiProcedure("doc")
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
      const text = cleanDocOutput(await simpleLLM(system + buildStyleBlock(await getOrgStyle(ctx.user.id)), user, false, 4000));
      if (!text) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "문서를 만들지 못했습니다. 다시 시도해 주세요." });
      return {
        text,
        warnings: lintOfficialStyle(text, { requireEnd: input.type === "draft" || input.type === "official" }),
        sources: uniqueSources(refs),
      };
    }),

  /** 외국인 참여자용 다국어 안내문 */
  translateNotice: aiProcedure("translate")
    .input(z.object({
      text: z.string().min(5, "안내문을 입력해 주세요.").max(3000),
      langs: z.array(z.enum(NOTICE_LANG_IDS)).min(1).max(MAX_NOTICE_LANGS),
      easyKorean: z.boolean().default(false),
      org: z.string().max(100).default(""),
    }))
    .mutation(async ({ input }) => {
      const langs = Array.from(new Set(input.langs));
      const { system, user } = buildTranslatePrompt({ text: input.text, langs, easyKorean: input.easyKorean, org: input.org });
      const out = parseTranslations(await simpleLLM(system, user, true, 8000), langs);
      if (out.translations.length === 0) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "번역하지 못했습니다. 다시 시도해 주세요." });
      return out;
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
  extract: aiProcedure("case_record")
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

/** 텔레그램 연결: 웹에서 코드를 받아 봇에 입력하면 이 계정과 연결된다 */
const telegramRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const link = await getLinkByUser(ctx.user.id);
    return { enabled: telegramEnabled(), botUsername: getBotUsername(), linked: !!link, username: link?.username ?? null, linkedAt: link?.createdAt ?? null };
  }),
  createCode: protectedProcedure.mutation(async ({ ctx }) => {
    if (!telegramEnabled()) throw new TRPCError({ code: "BAD_REQUEST", message: "텔레그램 봇이 아직 설정되지 않았습니다. 관리자에게 문의해 주세요." });
    const { code, minutes } = await createLinkCode(ctx.user.id);
    return { code, minutes, botUsername: getBotUsername() };
  }),
  unlink: protectedProcedure.mutation(async ({ ctx }) => {
    await unlinkUser(ctx.user.id);
    return { success: true };
  }),
});

/** 기관 문체 프로필: 한 번 저장해 두면 문서·홍보글·결과보고서가 이 기관 말투를 참고한다 */
const styleRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => (await getOrgStyle(ctx.user.id)) ?? { orgName: "", tone: "", sampleText: "" }),
  save: protectedProcedure
    .input(z.object({ orgName: z.string().max(100).default(""), tone: z.string().max(300).default(""), sampleText: z.string().max(12000).default("") }))
    .mutation(({ ctx, input }) => saveOrgStyle(ctx.user.id, input)),
});

const periodInput = z.object({
  parentId: z.number(),
  year: z.number().int().min(2000).max(2100),
  period: z.enum(["q1", "q2", "q3", "q4", "h1", "h2", "annual", "custom"]),
  customStartMonth: z.number().int().min(1).max(12).optional(),
  customEndMonth: z.number().int().min(1).max(12).optional(),
  includeAttendance: z.boolean().default(true),
  includeCases: z.boolean().default(false),
}).superRefine((v, ctx) => {
  if (v.period === "custom" && (v.customStartMonth === undefined || v.customEndMonth === undefined || v.customStartMonth > v.customEndMonth)) {
    ctx.addIssue({ code: "custom", path: ["customEndMonth"], message: "사용자 지정 월 범위가 올바르지 않습니다." });
  }
});

/** 결과보고서: 실적·출석부·사례·예산을 모아 7개 항목 보고서 생성 */
const reportsRouter = router({
  /** 생성 전 미리보기(AI 호출 없음) — 어떤 데이터가 들어가는지 확인 */
  facts: protectedProcedure.input(periodInput).query(async ({ ctx, input }) => {
    const facts = await gatherReportFacts({ ...input, userId: ctx.user.id });
    if (!facts) throw new TRPCError({ code: "NOT_FOUND", message: "사업 데이터를 찾을 수 없습니다." });
    return { facts, text: factsToText(facts) };
  }),

  generate: aiProcedure("result_report")
    .input(periodInput.and(z.object({ tone: z.enum(["eumseum", "hamnida"]).default("eumseum"), extra: z.string().max(2000).optional() })))
    .mutation(async ({ ctx, input }) => {
      const facts = await gatherReportFacts({ ...input, userId: ctx.user.id });
      if (!facts) throw new TRPCError({ code: "NOT_FOUND", message: "사업 데이터를 찾을 수 없습니다." });
      if (facts.subs.every((s) => s.actualCount === 0) && !facts.attendance) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "선택한 기간에 입력된 실적이나 출석 기록이 없습니다. 기간을 바꾸거나 실적을 먼저 입력해 주세요." });
      }
      const { system, user } = buildReportPrompt(facts, { tone: input.tone, extra: input.extra, styleBlock: buildStyleBlock(await getOrgStyle(ctx.user.id)) });
      const sections = parseReport(await simpleLLM(system, user, true, 8000, true));
      return { projectName: facts.projectName, year: facts.year, periodLabel: facts.periodLabel, sections };
    }),
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

  generate: aiProcedure("promo")
    .input(z.object({
      kind: z.enum(["recruit", "news"]),
      channel: z.enum(["blog", "instagram", "facebook", "kakao", "press", "newsletter"]),
      org: z.string().max(100).default(""),
      facts: z.string().min(1).max(6000),
      extra: z.string().max(1000).optional(),
      sampleIds: z.array(z.number()).max(3).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      const samples = await getPromoSamples(ctx.user.id, input.sampleIds);
      const { system, user } = buildPromoPrompt(input, samples);
      const styleBlock = samples.length ? "" : buildStyleBlock(await getOrgStyle(ctx.user.id));
      const variants = parsePromo(await simpleLLM(system + styleBlock, user, true, 6000));
      if (variants.length === 0) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "글을 만들지 못했습니다. 다시 시도해 주세요." });
      return { variants };
    }),

  refine: aiProcedure("promo")
    .input(z.object({
      channel: z.enum(["blog", "instagram", "facebook", "kakao", "press", "newsletter"]),
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

/** 공모사업 점수 평가: 모집요강 → 심사기준 추출 → 계획서 채점·보완점 */
const rubricSchema = z.object({
  programName: z.string().max(150),
  basis: z.enum(["stated", "estimated"]),
  criteria: z.array(z.object({ id: z.string().max(10), name: z.string().max(100), maxScore: z.number().min(0).max(1000), description: z.string().max(600) })).min(1).max(15),
  requirements: z.array(z.object({ id: z.string().max(10), kind: z.string().max(10), text: z.string().max(300) })).max(25),
});

const grantReviewRouter = router({
  analyze: aiProcedure("grant_review")
    .input(z.object({ text: z.string().min(200, "모집요강 내용이 너무 짧습니다.").max(150000) }))
    .mutation(async ({ input }) => {
      const { system, user } = buildRubricPrompt(input.text);
      const rubric = parseRubric(await simpleLLM(system, user, true, 6000, true));
      if (!rubric) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "모집요강에서 심사기준을 찾지 못했습니다. 심사기준 부분이 포함된 자료인지 확인해 주세요." });
      return { rubric, truncated: input.text.length > MAX_GUIDELINE_CHARS };
    }),

  evaluate: aiProcedure("grant_review")
    .input(z.object({
      rubric: rubricSchema,
      planText: z.string().min(200, "사업계획서 내용이 너무 짧습니다.").max(120000),
      guidelineText: z.string().max(150000).optional(),
    }))
    .mutation(async ({ input }) => {
      const { system, user } = buildReviewPrompt(input.rubric, input.planText, input.guidelineText);
      const review = parseReview(await simpleLLM(system, user, true, 8000, true), input.rubric);
      if (!review) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "평가 결과를 만들지 못했습니다. 다시 시도해 주세요." });
      return { review, planTruncated: input.planText.length > MAX_PLAN_CHARS };
    }),
});

/** 의견 게시판: 작성자 본인과 관리자만 열람 */
const boardRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    listBoardPosts({ id: ctx.user.id, isAdmin: ctx.user.role === "admin" })
  ),

  create: protectedProcedure
    .input(z.object({
      category: z.enum(BOARD_CATEGORIES),
      title: z.string().trim().min(1, "제목을 입력해 주세요.").max(200),
      content: z.string().trim().min(5, "내용을 5자 이상 입력해 주세요.").max(5000),
    }))
    .mutation(async ({ ctx, input }) => {
      if ((await countRecentPosts(ctx.user.id)) >= 10) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "하루에 작성할 수 있는 글(10개)을 넘었습니다. 내일 다시 이용해 주세요." });
      }
      const id = await createBoardPost({
        userId: ctx.user.id,
        authorName: ctx.user.name ?? "",
        authorEmail: ctx.user.email ?? "",
        ...input,
      });
      return { id };
    }),

  /** 관리자: 답변·상태 변경 */
  reply: adminProcedure
    .input(z.object({ id: z.number(), reply: z.string().trim().max(5000), status: z.enum(BOARD_STATUSES) }))
    .mutation(async ({ input }) => {
      const post = await getBoardPost(input.id);
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "글을 찾을 수 없습니다." });
      await replyBoardPost(input.id, input.reply, input.status);
      return { success: true };
    }),

  /** 작성자 본인 또는 관리자만 삭제 */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const post = await getBoardPost(input.id);
      if (!post || (post.userId !== ctx.user.id && ctx.user.role !== "admin")) {
        throw new TRPCError({ code: "NOT_FOUND", message: "글을 찾을 수 없습니다." });
      }
      await deleteBoardPost(input.id);
      return { success: true };
    }),

  /** 관리자: 아직 답하지 않은(접수) 글 수 */
  openCount: protectedProcedure.query(async ({ ctx }) => (ctx.user.role === "admin" ? { count: await countOpenPosts() } : { count: 0 })),
});

// ─── 요금제·AI 사용 현황 ─────────────────────────────────────────────────────
const planRouter = router({
  /** 내 요금제·이용기간·이번 달 AI 사용량 */
  status: protectedProcedure.query(async ({ ctx }) => {
    const u = await findUserById(ctx.user.id);
    if (!u) throw new TRPCError({ code: "UNAUTHORIZED" });
    const counts = await getMonthlyCounts(u.id, monthStartKst());
    const plan: PlanId = isPlanId(u.plan) ? u.plan : "pro";
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const features = (Object.keys(AI_FEATURES) as AiFeatureKey[]).map((k) => {
      const pol = AI_FEATURES[k];
      return {
        key: k,
        label: pol.label,
        used: counts[k] ?? 0,
        limit: pol.monthly[plan] ?? null,
        locked: pol.premiumOnly && plan !== "premium" && u.role !== "admin",
      };
    });
    return { plan, isAdmin: u.role === "admin", accessUntil: u.accessUntil ?? null, total, fairUse: FAIR_USE_MONTHLY_CALLS, features };
  }),

  /** 관리자: 사용자 요금제 변경 */
  adminSetPlan: adminProcedure
    .input(z.object({ userId: z.number(), plan: z.enum(["pro", "premium"]) }))
    .mutation(async ({ input }) => {
      const target = await findUserById(input.userId);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "사용자를 찾을 수 없습니다." });
      await setUserPlan(input.userId, input.plan);
      return { plan: input.plan };
    }),

  /** 관리자: 이번 달 AI 사용량(기능별·사용자별 토큰) */
  adminUsage: adminProcedure.query(async () => {
    const since = monthStartKst();
    const sum = await getUsageSummary(since);
    const users = await listAllUsers();
    const nameOf = new Map(users.map((u) => [u.id, u.name || u.email || `#${u.id}`]));
    return {
      since,
      byFeature: sum.byFeature.map((r) => ({ ...r, label: AI_FEATURES[r.feature as AiFeatureKey]?.label ?? r.feature })),
      byUser: sum.byUser.map((r) => ({ ...r, name: nameOf.get(r.userId) ?? `#${r.userId}` })),
    };
  }),
});

export const appRouter = router({
  plan: planRouter,
  board: boardRouter,
  grantReview: grantReviewRouter,
  promo: promoRouter,
  style: styleRouter,
  telegram: telegramRouter,
  reports: reportsRouter,
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
  vault: vaultRouter,
  lecturerFee: lecturerFeeRouter,
  pcAgent: pcAgentRouter,
  attendance: attendanceRouter,
  performance: performanceRouter,
  budget: budgetRouter,
  projectPlans: projectPlansRouter,
  evaluation: evaluationRouter,
    schedules: schedulesRouter,
  businessPlans: businessPlansRouter,
});
export type AppRouter = typeof appRouter;
