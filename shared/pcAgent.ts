/** 관리자 PC 도우미 ↔ 서버 메시지 규약 */
export type PcOp =
  | { op: "shell"; cmd: string; timeoutSec?: number }
  | { op: "ls"; path: string }
  | { op: "read"; path: string }
  | { op: "write"; path: string; content: string };

export type PcRequest = PcOp & { id: string };
export type PcResponse = { id: string; ok: boolean; output?: string; error?: string };

export type PcAgentInfo = { hostname: string; platform: string; root: string; version: string };

export const PC_MAX_OUTPUT = 200_000;
export const PC_DEFAULT_TIMEOUT_MS = 90_000;

export function summarizeOp(o: PcOp): string {
  switch (o.op) {
    case "shell": return `명령: ${o.cmd}`.slice(0, 300);
    case "ls": return `폴더 보기: ${o.path}`.slice(0, 300);
    case "read": return `파일 읽기: ${o.path}`.slice(0, 300);
    case "write": return `파일 쓰기: ${o.path} (${o.content.length}자)`.slice(0, 300);
  }
}
