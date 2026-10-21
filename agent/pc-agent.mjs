#!/usr/bin/env node
/**
 * 복지실무톡 PC 도우미 (관리자 전용)
 * - 이 프로그램을 '내 PC'에서 직접 실행했을 때만 사이트와 연결됩니다. 종료하면 연결도 끝납니다.
 * - 사이트가 보낸 작업(명령 실행·폴더 보기·파일 읽기·파일 쓰기)은 PC 화면에서 y를 눌러 승인해야 실행됩니다.
 * - Node.js 22 이상 필요(추가 설치 패키지 없음).
 *
 * 사용: node pc-agent.mjs --server wss://사이트주소 --token 연결코드 [--root 작업폴더] [--auto-read]
 *   --root       파일 작업(폴더 보기·읽기·쓰기)을 이 폴더 안으로 제한(기본: 현재 폴더). 명령 실행의 시작 위치이기도 함.
 *   --auto-read  --root 안의 '폴더 보기·파일 읽기'는 묻지 않고 처리
 *   --yes-all    모든 작업을 묻지 않고 실행(위험! 시험용)
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { exec } from "node:child_process";

const VERSION = "1.0";
const MAX_OUT = 200_000;
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const flag = (n) => args.includes(`--${n}`);

const server = opt("server");
const token = opt("token") || process.env.PC_AGENT_TOKEN;
const root = path.resolve(opt("root") || process.cwd());
const autoRead = flag("auto-read");
const yesAll = flag("yes-all");

if (!server || !token) {
  console.log("사용법: node pc-agent.mjs --server wss://사이트주소 --token 연결코드 [--root 작업폴더] [--auto-read]");
  process.exit(1);
}
if (!/^wss:\/\//.test(server) && !/^ws:\/\/(localhost|127\.0\.0\.1)/.test(server)) {
  console.log("보안을 위해 wss:// 주소만 사용할 수 있습니다.");
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));
let chain = Promise.resolve(); // 승인 질문을 한 번에 하나씩

function decode(buf) {
  const u8 = new TextDecoder("utf-8").decode(buf);
  if (!u8.includes("�")) return u8;
  try { return new TextDecoder("euc-kr").decode(buf); } catch { return u8; }
}
const clip = (s) => (s.length > MAX_OUT ? s.slice(0, MAX_OUT) + "\n…(길어서 잘림)" : s);

function inRoot(p) {
  const abs = path.resolve(root, p);
  const rel = path.relative(root, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`작업 폴더(${root}) 밖입니다.`);
  return abs;
}

function describe(r) {
  if (r.op === "shell") return `명령 실행: ${r.cmd}`;
  if (r.op === "ls") return `폴더 보기: ${r.path}`;
  if (r.op === "read") return `파일 읽기: ${r.path}`;
  if (r.op === "write") return `파일 쓰기: ${r.path} (${String(r.content ?? "").length}자)`;
  return String(r.op);
}

async function approve(r) {
  if (yesAll) return true;
  if (autoRead && (r.op === "ls" || r.op === "read")) {
    try { inRoot(r.path); return true; } catch { /* 폴더 밖이면 직접 묻는다 */ }
  }
  return new Promise((resolve) => {
    chain = chain.then(async () => {
      console.log(`\n[사이트 요청] ${describe(r)}`);
      const timeout = setTimeout(() => { console.log("(60초 동안 승인이 없어 거절했습니다)"); resolve(false); rl.write(null, { ctrl: true, name: "u" }); }, 60_000);
      const a = (await ask("실행할까요? [y/N] ")).trim().toLowerCase();
      clearTimeout(timeout);
      resolve(a === "y" || a === "yes" || a === "ㅛ");
    });
  });
}

function runShell(cmd, timeoutSec) {
  const t = Math.min(Math.max(Number(timeoutSec) || 60, 1), 300) * 1000;
  return new Promise((resolve) => {
    exec(cmd, { cwd: root, timeout: t, maxBuffer: 2 * 1024 * 1024, encoding: "buffer", windowsHide: true }, (err, stdout, stderr) => {
      const out = decode(stdout) + (stderr?.length ? `\n[오류 출력]\n${decode(stderr)}` : "");
      if (err && err.killed) resolve({ ok: false, error: `시간 초과(${t / 1000}초)`, output: clip(out) });
      else resolve({ ok: !err || typeof err.code === "number", output: clip(out) + (err && typeof err.code === "number" ? `\n[종료 코드 ${err.code}]` : "") });
    });
  });
}

async function execute(r) {
  switch (r.op) {
    case "shell": return runShell(String(r.cmd ?? ""), r.timeoutSec);
    case "ls": {
      const abs = inRoot(String(r.path || "."));
      const ents = await fs.readdir(abs, { withFileTypes: true });
      const lines = await Promise.all(ents.slice(0, 500).map(async (e) => {
        let size = "";
        if (e.isFile()) { try { size = ` ${(await fs.stat(path.join(abs, e.name))).size}B`; } catch {} }
        return `${e.isDirectory() ? "[폴더]" : "[파일]"} ${e.name}${size}`;
      }));
      return { ok: true, output: lines.join("\n") || "(비어 있음)" };
    }
    case "read": {
      const abs = inRoot(String(r.path));
      const st = await fs.stat(abs);
      if (st.size > 2 * 1024 * 1024) throw new Error("2MB가 넘는 파일은 읽지 않습니다.");
      return { ok: true, output: clip(decode(await fs.readFile(abs))) };
    }
    case "write": {
      const abs = inRoot(String(r.path));
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, String(r.content ?? ""), "utf8");
      return { ok: true, output: `저장했습니다: ${abs}` };
    }
    default: throw new Error("알 수 없는 작업입니다.");
  }
}

async function handle(ws, r) {
  const reply = (o) => ws.send(JSON.stringify({ type: "result", id: r.id, ...o }));
  try {
    if (!(await approve(r))) { reply({ ok: false, error: "PC에서 거절했습니다." }); console.log("→ 거절"); return; }
    const res = await execute(r);
    reply(res);
    console.log("→ 완료");
  } catch (e) {
    reply({ ok: false, error: String(e?.message ?? e).slice(0, 500) });
    console.log("→ 실패:", e?.message ?? e);
  }
}

let backoff = 2000;
function connect() {
  const ws = new WebSocket(server.replace(/\/$/, "") + "/api/pc-agent");
  let ping;
  ws.addEventListener("open", () => {
    ws.send(JSON.stringify({ type: "hello", token, hostname: os.hostname(), platform: process.platform, root, version: VERSION }));
    ping = setInterval(() => { try { ws.send(JSON.stringify({ type: "ping" })); } catch {} }, 25_000);
  });
  ws.addEventListener("message", (ev) => {
    let m; try { m = JSON.parse(String(ev.data)); } catch { return; }
    if (m.type === "ready") { backoff = 2000; console.log(`연결되었습니다. 작업 폴더: ${root}\n사이트의 요청은 여기서 승인해야 실행됩니다. (종료: Ctrl+C)`); }
    else if (m.type === "request") handle(ws, m);
  });
  ws.addEventListener("close", (ev) => {
    clearInterval(ping);
    if (ev.code === 4003) { console.log("연결 코드가 올바르지 않거나 취소되었습니다. 사이트에서 새 코드를 만들어 다시 실행하세요."); process.exit(1); }
    if (ev.code === 4010) { console.log("다른 곳에서 같은 계정으로 연결해 종료합니다."); process.exit(0); }
    console.log(`연결이 끊겼습니다. ${backoff / 1000}초 뒤 다시 연결합니다…`);
    setTimeout(connect, backoff); backoff = Math.min(backoff * 2, 60_000);
  });
  ws.addEventListener("error", () => { /* close에서 처리 */ });
}

console.log(`복지실무톡 PC 도우미 v${VERSION}`);
if (yesAll) console.log("⚠ --yes-all: 모든 요청을 묻지 않고 실행합니다. 시험용으로만 쓰세요.");
connect();
