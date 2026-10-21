import type { Server as HttpServer, IncomingMessage } from "http";
import crypto from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import { PC_DEFAULT_TIMEOUT_MS, PC_MAX_OUTPUT, type PcAgentInfo, type PcOp, type PcResponse } from "../shared/pcAgent";

export const PC_AGENT_PATH = "/api/pc-agent";

export const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
export const newToken = () => "pcagent_" + crypto.randomBytes(24).toString("hex");

type Conn = { ws: WebSocket; info: PcAgentInfo; connectedAt: Date };
type Pending = { resolve: (r: PcResponse) => void; timer: NodeJS.Timeout };

export class PcAgentHub {
  private conns = new Map<number, Conn>();
  private pending = new Map<string, Pending>();
  private failures = new Map<string, { n: number; until: number }>();

  /** verifyToken: 올바른 관리자 토큰이면 userId, 아니면 null */
  constructor(private verifyToken: (tokenHash: string) => Promise<number | null>) {}

  status(userId: number) {
    const c = this.conns.get(userId);
    return c ? { connected: true as const, info: c.info, connectedAt: c.connectedAt } : { connected: false as const };
  }

  attach(server: HttpServer) {
    const wss = new WebSocketServer({ noServer: true, maxPayload: 2 * 1024 * 1024 });
    server.on("upgrade", (req: IncomingMessage, socket, head) => {
      const url = (req.url ?? "").split("?")[0];
      if (url !== PC_AGENT_PATH) return; // 다른 경로(개발용 HMR 등)는 건드리지 않는다
      wss.handleUpgrade(req, socket, head, (ws) => this.onConnect(ws, req));
    });
    return wss;
  }

  private onConnect(ws: WebSocket, req: IncomingMessage) {
    const ip = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "").split(",")[0].trim();
    const f = this.failures.get(ip);
    if (f && f.n >= 5 && Date.now() < f.until) { ws.close(4029, "too many attempts"); return; }

    let userId: number | null = null;
    const helloTimer = setTimeout(() => { if (userId === null) ws.close(4000, "hello timeout"); }, 8000);

    ws.on("message", async (raw) => {
      let m: any;
      try { m = JSON.parse(String(raw)); } catch { return; }
      if (userId === null) {
        if (m?.type !== "hello" || typeof m.token !== "string") { ws.close(4001, "hello required"); return; }
        const uid = await this.verifyToken(hashToken(m.token)).catch(() => null);
        if (!uid) {
          const cur = this.failures.get(ip) ?? { n: 0, until: 0 };
          this.failures.set(ip, { n: cur.n + 1, until: Date.now() + 10 * 60_000 });
          ws.close(4003, "invalid token");
          return;
        }
        clearTimeout(helloTimer);
        userId = uid;
        const old = this.conns.get(uid);
        if (old) old.ws.close(4010, "replaced");
        const str = (v: unknown, n: number) => String(v ?? "").slice(0, n);
        this.conns.set(uid, { ws, connectedAt: new Date(), info: { hostname: str(m.hostname, 100), platform: str(m.platform, 30), root: str(m.root, 300), version: str(m.version, 20) } });
        ws.send(JSON.stringify({ type: "ready" }));
        return;
      }
      if (m?.type === "result" && typeof m.id === "string") {
        const p = this.pending.get(m.id);
        if (!p) return;
        clearTimeout(p.timer); this.pending.delete(m.id);
        p.resolve({ id: m.id, ok: !!m.ok, output: typeof m.output === "string" ? m.output.slice(0, PC_MAX_OUTPUT) : undefined, error: typeof m.error === "string" ? m.error.slice(0, 2000) : undefined });
      }
    });
    ws.on("close", () => {
      clearTimeout(helloTimer);
      if (userId !== null && this.conns.get(userId)?.ws === ws) this.conns.delete(userId);
    });
    ws.on("error", () => { /* close 이벤트에서 정리 */ });
  }

  /** 도우미에 작업을 보내고 결과를 기다린다. PC에서 사람이 승인해야 하므로 넉넉히 기다린다. */
  send(userId: number, op: PcOp, timeoutMs = PC_DEFAULT_TIMEOUT_MS + 70_000): Promise<PcResponse> {
    const c = this.conns.get(userId);
    if (!c || c.ws.readyState !== WebSocket.OPEN) return Promise.resolve({ id: "", ok: false, error: "PC 도우미가 연결되어 있지 않습니다." });
    if (this.pending.size > 50) return Promise.resolve({ id: "", ok: false, error: "대기 중인 작업이 너무 많습니다." });
    const id = crypto.randomUUID();
    return new Promise<PcResponse>((resolve) => {
      const timer = setTimeout(() => { this.pending.delete(id); resolve({ id, ok: false, error: "PC에서 응답이 없습니다(승인 대기 시간 초과)." }); }, timeoutMs);
      this.pending.set(id, { resolve, timer });
      c.ws.send(JSON.stringify({ type: "request", id, ...op }), (err) => {
        if (err) { clearTimeout(timer); this.pending.delete(id); resolve({ id, ok: false, error: "PC로 보내지 못했습니다." }); }
      });
    });
  }

  disconnect(userId: number) { this.conns.get(userId)?.ws.close(4011, "revoked"); }
}
