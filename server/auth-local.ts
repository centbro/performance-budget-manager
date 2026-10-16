import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { eq, and, gt } from "drizzle-orm";
import { getDb } from "./db";
import { localUsers, localSessions } from "../drizzle/schema";
import type { LocalUser } from "../drizzle/schema";

const SALT_ROUNDS = 10;
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7일

// ── 비밀번호 해싱 ─────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── 관리자 계정 초기화 ────────────────────────────────────────────────────────

export async function ensureAdminAccount() {
  const db = await getDb();
  if (!db) return;

  // 비밀번호를 코드에 두지 않고 환경변수로만 받는다.
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "link4wish@gmail.com";
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const ADMIN_NAME = "관리자";

  try {
    const existing = await db
      .select()
      .from(localUsers)
      .where(eq(localUsers.email, ADMIN_EMAIL))
      .limit(1);

    if (existing.length === 0) {
      if (!ADMIN_PASSWORD) {
        console.warn("[Auth] ADMIN_PASSWORD 미설정 - 관리자 계정을 자동 생성하지 않습니다.");
        return;
      }
      const hash = await hashPassword(ADMIN_PASSWORD);
      await db.insert(localUsers).values({
        email: ADMIN_EMAIL,
        passwordHash: hash,
        name: ADMIN_NAME,
        role: "admin",
        status: "approved",
        approvedAt: new Date(),
      });
      console.log("[Auth] Admin account created:", ADMIN_EMAIL);
    } else if (existing[0].role !== "admin" || existing[0].status !== "approved") {
      await db
        .update(localUsers)
        .set({ role: "admin", status: "approved", approvedAt: new Date() })
        .where(eq(localUsers.email, ADMIN_EMAIL));
      console.log("[Auth] Admin account updated:", ADMIN_EMAIL);
    }
  } catch (err) {
    console.error("[Auth] Failed to ensure admin account:", err);
  }
}

// ── 사용자 조회 ───────────────────────────────────────────────────────────────

export async function findUserByEmail(email: string): Promise<LocalUser | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(localUsers)
    .where(eq(localUsers.email, email))
    .limit(1);
  return result[0];
}

export async function findUserById(id: number): Promise<LocalUser | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(localUsers)
    .where(eq(localUsers.id, id))
    .limit(1);
  return result[0];
}

// ── 회원가입 ──────────────────────────────────────────────────────────────────

export async function registerUser(
  email: string,
  password: string,
  name: string
): Promise<{ success: boolean; message: string }> {
  const db = await getDb();
  if (!db) return { success: false, message: "데이터베이스 연결 오류" };

  const existing = await findUserByEmail(email);
  if (existing) {
    return { success: false, message: "이미 사용 중인 이메일입니다." };
  }

  const hash = await hashPassword(password);
  await db.insert(localUsers).values({
    email,
    passwordHash: hash,
    name,
    role: "user",
    status: "pending",
  });

  return { success: true, message: "가입 요청이 완료되었습니다. 관리자 승인 후 이용 가능합니다." };
}

// ── 로그인 ────────────────────────────────────────────────────────────────────

export async function loginUser(
  email: string,
  password: string
): Promise<{ success: boolean; sessionId?: string; message: string; user?: Omit<LocalUser, "passwordHash"> }> {
  const db = await getDb();
  if (!db) return { success: false, message: "데이터베이스 연결 오류" };

  const user = await findUserByEmail(email);
  if (!user) {
    return { success: false, message: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { success: false, message: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  if (user.status === "pending") {
    return { success: false, message: "관리자 승인 대기 중입니다. 승인 후 로그인할 수 있습니다." };
  }

  if (user.status === "rejected") {
    return { success: false, message: "가입이 거부되었습니다. 관리자에게 문의하세요." };
  }

  // 세션 생성
  const sessionId = nanoid(48);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.insert(localSessions).values({
    id: sessionId,
    userId: user.id,
    expiresAt,
  });

  const { passwordHash: _, ...safeUser } = user;
  return { success: true, sessionId, message: "로그인 성공", user: safeUser };
}

// ── 세션 검증 ─────────────────────────────────────────────────────────────────

export async function validateSession(
  sessionId: string
): Promise<LocalUser | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const now = new Date();
  const sessions = await db
    .select()
    .from(localSessions)
    .where(and(eq(localSessions.id, sessionId), gt(localSessions.expiresAt, now)))
    .limit(1);

  if (sessions.length === 0) return undefined;

  return findUserById(sessions[0].userId);
}

// ── 로그아웃 ──────────────────────────────────────────────────────────────────

export async function logoutSession(sessionId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(localSessions).where(eq(localSessions.id, sessionId));
}

// ── 관리자 기능 ───────────────────────────────────────────────────────────────

export async function listAllUsers(): Promise<Omit<LocalUser, "passwordHash">[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      id: localUsers.id,
      email: localUsers.email,
      name: localUsers.name,
      role: localUsers.role,
      status: localUsers.status,
      createdAt: localUsers.createdAt,
      updatedAt: localUsers.updatedAt,
      approvedAt: localUsers.approvedAt,
    })
    .from(localUsers)
    .orderBy(localUsers.createdAt);
  return result;
}

export async function approveUser(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(localUsers)
    .set({ status: "approved", approvedAt: new Date() })
    .where(eq(localUsers.id, userId));
}

export async function rejectUser(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(localUsers)
    .set({ status: "rejected" })
    .where(eq(localUsers.id, userId));
}

export async function deleteUser(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // 세션도 함께 삭제
  await db.delete(localSessions).where(eq(localSessions.userId, userId));
  await db.delete(localUsers).where(eq(localUsers.id, userId));
}

export async function updateUserRole(userId: number, role: "admin" | "user"): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(localUsers).set({ role }).where(eq(localUsers.id, userId));
}
