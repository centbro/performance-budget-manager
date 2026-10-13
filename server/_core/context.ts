import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { validateSession } from "../auth-local";

const LOCAL_SESSION_COOKIE = "local_session";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  localUser: {
    id: number;
    email: string | null;
    name: string | null;
    role: "admin" | "user";
    status: "pending" | "approved" | "rejected";
  } | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let localUser: TrpcContext["localUser"] = null;

  // 1. 자체 세션 쿠키 기반 인증 시도
  const cookies = opts.req.cookies as Record<string, string> | undefined;
  const localSessionId = cookies?.[LOCAL_SESSION_COOKIE];

  if (localSessionId) {
    try {
      const lu = await validateSession(localSessionId);
      if (lu && lu.status === "approved") {
        localUser = {
          id: lu.id,
          email: lu.email,
          name: lu.name,
          role: lu.role,
          status: lu.status,
        };

        // protectedProcedure / adminProcedure 호환을 위해 User 형태로도 매핑
        user = {
          id: lu.id,
          openId: `local:${lu.id}`,
          name: lu.name,
          email: lu.email,
          loginMethod: "local",
          role: lu.role,
          createdAt: lu.createdAt,
          updatedAt: lu.updatedAt,
          lastSignedIn: lu.updatedAt,
        } as User;
      }
    } catch {
      // 세션 검증 실패 시 무시
    }
  }

  // 2. OAuth 세션 기반 인증 시도 (자체 인증이 없을 때만)
  if (!user) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch {
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    localUser,
  };
}
