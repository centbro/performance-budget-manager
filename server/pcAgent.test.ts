import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "http";
import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { PcAgentHub, hashToken } from "./pcAgent";

let server: Server, port: number, hub: PcAgentHub, agent: ChildProcess, dir: string;
const TOKEN = "pcagent_testtoken";

const waitFor = async (fn: () => boolean, ms = 8000) => {
  const t = Date.now();
  while (!fn()) { if (Date.now() - t > ms) throw new Error("timeout"); await new Promise((r) => setTimeout(r, 50)); }
};

beforeAll(async () => {
  hub = new PcAgentHub(async (h) => (h === hashToken(TOKEN) ? 7 : null));
  server = createServer();
  hub.attach(server);
  await new Promise<void>((r) => server.listen(0, r));
  port = (server.address() as any).port;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "pcagent-"));
  fs.writeFileSync(path.join(dir, "a.txt"), "안녕하세요");
  agent = spawn("node", ["agent/pc-agent.mjs", "--server", `ws://127.0.0.1:${port}`, "--token", TOKEN, "--root", dir, "--yes-all"], { stdio: "ignore" });
  await waitFor(() => hub.status(7).connected);
});
afterAll(() => { agent?.kill(); server?.close(); });

describe("PC 도우미", () => {
  it("연결 정보가 보인다", () => {
    const s = hub.status(7);
    expect(s.connected && s.info.root).toBe(dir);
  });
  it("폴더 보기·읽기·쓰기", async () => {
    expect((await hub.send(7, { op: "ls", path: "." })).output).toContain("a.txt");
    expect((await hub.send(7, { op: "read", path: "a.txt" })).output).toBe("안녕하세요");
    expect((await hub.send(7, { op: "write", path: "sub/b.txt", content: "x" })).ok).toBe(true);
    expect(fs.readFileSync(path.join(dir, "sub/b.txt"), "utf8")).toBe("x");
  });
  it("작업 폴더 밖은 막는다", async () => {
    const r = await hub.send(7, { op: "read", path: "../../etc/passwd" });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("밖");
  });
  it("명령 실행", async () => {
    const r = await hub.send(7, { op: "shell", cmd: "echo hello" });
    expect(r.ok).toBe(true);
    expect(r.output).toContain("hello");
  });
  it("연결 없으면 오류", async () => {
    expect((await hub.send(99, { op: "ls", path: "." })).ok).toBe(false);
  });
  it("잘못된 코드는 거부된다", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/pc-agent`);
    const code = await new Promise<number>((res) => {
      ws.onopen = () => ws.send(JSON.stringify({ type: "hello", token: "bad" }));
      ws.onclose = (e) => res(e.code);
    });
    expect(code).toBe(4003);
  });
});
