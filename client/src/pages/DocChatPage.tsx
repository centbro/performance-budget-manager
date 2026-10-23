import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, Download, FileText, FolderOpen, Pencil, RotateCcw, Save, Send, TriangleAlert, Undo2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import PlanNotice from "@/components/PlanNotice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { MAX_FILE_BYTES, folderAccessSupported, listFolderFiles, overwriteInFolder, pickFolder, saveToFolder, type FolderFile } from "@/lib/folderAccess";
import type { GeneratedDoc } from "@shared/docChat";
import { cellLabel, type DocEdit, type DocParagraph, type RowOp } from "@shared/docEdit";

type Msg = { role: "user" | "assistant"; text: string };
type Change = { id: number; where: string; before: string; after: string; added: boolean };
const EDITABLE = ["hwpx", "docx"];
const EACH = 8000;
const EXAMPLE = `2026년 사업보고회 계획(안)을 작성해야해. 날짜는 12월 6일 13:00~14:30. 순서는 오프닝 공연(마술 20분) / 센터장님 환영사 / 내빈 소개 / 표창 수여식 / 2026년 사업 동영상 시청 / 27년도 사업 설명 / 노래 공연. 직원 투입은 ○○○ 센터장, ○○○ 총괄팀장 ... 예산은 총 7,291,140원이고 업체 예산은 예산표 참고하고 나머지는 다과·도시락 1,900,000원, 꽃다발 및 감사패 400,000원, 기념품 1,026,140원. 직원들 역할은 작년·재작년 자료를 참고해서 비슷하게 해줘.`;

function DocView({ doc }: { doc: GeneratedDoc }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <h2 className="text-center text-lg font-bold">{doc.title}</h2>
      {doc.blocks.map((b, i) => {
        if (b.type === "heading") return <h3 key={i} className={`font-bold ${b.level === 1 ? "pt-2 text-base" : "text-sm"}`}>{b.text}</h3>;
        if (b.type === "paragraph") return <p key={i}>{b.text}</p>;
        if (b.type === "bullets") return <ul key={i} className="list-disc space-y-0.5 pl-5">{b.items.map((t, j) => <li key={j}>{t}</li>)}</ul>;
        return (
          <div key={i} className="overflow-x-auto">
            {b.caption && <p className="mb-1 text-xs font-semibold">&lt;{b.caption}&gt;</p>}
            <table className="w-full border-collapse text-xs">
              <thead><tr>{b.headers.map((h, j) => <th key={j} className="border bg-muted/60 px-2 py-1">{h}</th>)}</tr></thead>
              <tbody>{b.rows.map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j} className="border px-2 py-1">{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

export default function DocChatPage() {
  const supported = folderAccessSupported();
  const dirRef = useRef<any>(null);
  const textCache = useRef<Map<string, string>>(new Map());
  const [folderName, setFolderName] = useState("");
  const [files, setFiles] = useState<FolderFile[]>([]);
  const [hwp, setHwp] = useState<string[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState(false); // AI가 참고 파일을 이미 골랐는지
  const [showFiles, setShowFiles] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [doc, setDoc] = useState<GeneratedDoc | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  // 기존 문서를 고쳐 쓰는 방식: 고칠 파일을 고르면 그 파일을 복사한 새 파일에 바로 쓴다
  const [targetPath, setTargetPath] = useState("");
  const currentBytes = useRef<ArrayBuffer | null>(null);
  const undoBytes = useRef<ArrayBuffer[]>([]);
  const undoDocs = useRef<(GeneratedDoc | null)[]>([]);
  const [fixInput, setFixInput] = useState("");
  const outName = useRef<string | null>(null);
  const [savedName, setSavedName] = useState("");
  const [changes, setChanges] = useState<Change[]>([]);
  const [round, setRound] = useState(0);

  const pick = trpc.tools.docChatPick.useMutation();
  const write = trpc.tools.docChatWrite.useMutation();
  const plan = trpc.tools.docEditPlan.useMutation();
  const exp = trpc.tools.docChatExport.useMutation();

  const openFolder = async () => {
    try {
      const dir = await pickFolder();
      const skipped: string[] = [];
      const list = await listFolderFiles(dir, 2, "", skipped);
      dirRef.current = dir; textCache.current = new Map();
      setFolderName(dir.name); setFiles(list); setHwp(skipped); setChosen(new Set()); setPicked(false); resetEdit(""); setMsgs([]); setDoc(null);
      if (!list.length) toast.message("이 폴더에는 읽을 수 있는 파일(PDF·hwpx·docx·xlsx·txt)이 없습니다.");
    } catch (e: any) { if (e?.name !== "AbortError") toast.error("폴더를 열지 못했습니다."); }
  };

  /** 폴더를 다시 고르지 않고 목록만 새로 읽는다(한글에서 다시 저장한 뒤) */
  const refreshFiles = async () => {
    if (!dirRef.current || busy) return;
    try {
      const skipped: string[] = [];
      const list = await listFolderFiles(dirRef.current, 2, "", skipped);
      textCache.current = new Map();
      setFiles(list); setHwp(skipped);
      if (targetPath && !list.some((f) => f.path === targetPath && !f.fakeLegacy)) resetEdit("");
      const bad = list.filter((f) => f.fakeLegacy).length;
      toast.success(bad ? `목록을 다시 읽었습니다. 아직 옛 형식인 파일이 ${bad}개 있습니다.` : "목록을 다시 읽었습니다.");
    } catch { toast.error("목록을 다시 읽지 못했습니다. 폴더를 다시 선택해 주세요."); }
  };

  const readFile = async (f: FolderFile): Promise<string> => {
    const hit = textCache.current.get(f.path);
    if (hit != null) return hit;
    if (f.size > MAX_FILE_BYTES) return "(10MB를 넘어 읽지 못함)";
    const fd = new FormData();
    fd.append("file", await f.handle.getFile());
    const res = await fetch("/api/upload/source-text", { method: "POST", body: fd, credentials: "include" });
    const j = await res.json().catch(() => ({}));
    const text = res.ok ? String(j.text ?? "").slice(0, EACH) : `(읽지 못함: ${j.error || res.status})`;
    textCache.current.set(f.path, text);
    return text;
  };

  const resetEdit = (path: string) => { setTargetPath(path); currentBytes.current = null; undoBytes.current = []; outName.current = null; setSavedName(""); setChanges([]); setRound(0); };
  const editable = useMemo(() => files.filter((f) => EDITABLE.includes(f.ext)), [files]);
  const target = files.find((f) => f.path === targetPath) ?? null;

  const postFile = async (url: string, bytes: ArrayBuffer, name: string, extra?: Record<string, string>) => {
    const fd = new FormData();
    fd.append("file", new Blob([bytes]), name);
    for (const [k, v] of Object.entries(extra ?? {})) fd.append(k, v);
    const res = await fetch(url, { method: "POST", body: fd, credentials: "include" });
    if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `요청 실패(${res.status})`); }
    return res;
  };

  /** 고칠 파일이 정해진 경우: 문단 목록 → AI → 고친 파일을 폴더에 저장 */
  const sendEdit = async (instruction: string, history: Msg[]) => {
    if (!target || !dirRef.current) return;
    let use = chosen;
    if (!picked) {
      setBusy("참고할 파일을 고르는 중…");
      const others = files.filter((f) => f.path !== target.path);
      if (others.length) {
        const r = await pick.mutateAsync({ instruction, files: others.map((f) => ({ path: f.path, size: f.size })) });
        use = new Set(r.files);
        setChosen(use);
      } else use = new Set();
      setPicked(true);
    }
    const sources: { name: string; text: string }[] = [];
    const refs = files.filter((f) => use.has(f.path) && f.path !== target.path);
    for (let i = 0; i < refs.length; i++) {
      setBusy(`참고 파일 읽는 중 ${i + 1}/${refs.length} · ${refs[i].name}`);
      sources.push({ name: refs[i].path, text: await readFile(refs[i]) });
    }
    setBusy("고칠 문서를 읽는 중…");
    const bytes = currentBytes.current ?? (await (await target.handle.getFile()).arrayBuffer());
    const pr = await postFile("/api/doc-edit/paragraphs", bytes, target.name);
    const { paragraphs, truncated } = (await pr.json()) as { paragraphs: DocParagraph[]; truncated: boolean };
    if (!paragraphs.length) throw new Error("문서에서 글을 찾지 못했습니다.");
    setBusy("AI가 올해 내용으로 고치는 중… (1~2분 걸릴 수 있습니다)");
    const r = await plan.mutateAsync({ instruction, history, sources, paragraphs });
    const rowOps = (r.rowOps ?? []) as RowOp[];
    if (!r.edits.length && !rowOps.length) {
      setMsgs((m) => [...m, { role: "assistant", text: "고칠 곳을 찾지 못했습니다. 무엇을 어떻게 바꿀지 더 구체적으로 말해 주세요." }]);
      return;
    }
    setBusy("문서에 반영하는 중…");
    const ar = await postFile("/api/doc-edit/apply", bytes, target.name, { edits: JSON.stringify(r.edits), rowOps: JSON.stringify(rowOps) });
    let skipped: string[] = [];
    try { skipped = JSON.parse(decodeURIComponent(ar.headers.get("X-Skipped") || "[]")); } catch { /* 없음 */ }
    const out = await ar.arrayBuffer();
    const blob = new Blob([out], { type: "application/octet-stream" });
    if (outName.current) await overwriteInFolder(dirRef.current, outName.current, blob);
    else {
      const base = target.name.replace(/\.[^.]+$/, "");
      outName.current = await saveToFolder(dirRef.current, `${base}_수정본.${target.ext}`, blob);
    }
    undoBytes.current.push(bytes);
    currentBytes.current = out;
    setSavedName(outName.current);
    setRound((n) => n + 1);
    const byId = new Map(paragraphs.map((p) => [p.id, p]));
    const textChanges = (r.edits as DocEdit[]).map((e) => {
      const p = byId.get(e.id)!;
      return { id: e.id, where: cellLabel(p.cell), before: p.text, after: e.after && e.text === undefined ? e.after : e.text ?? "", added: e.text === undefined };
    });
    const rowChanges = rowOps.filter((o): o is Exclude<RowOp, { op: "fit" }> => o.op !== "fit").flatMap((o, i) => o.op === "newTable"
      ? [{ id: -50 - i, where: `새 표 · 표${o.from + 1} 모양으로 ${o.rows.length}행`, before: "", after: o.rows.map((r) => r.filter(Boolean).join(" | ")).join("\n"), added: true }]
      : o.op === "delete"
      ? [{ id: -1 - i, where: `표${o.t + 1} ${o.row + 1}행`, before: "이 행", after: "(행 삭제)", added: false }]
      : o.rows.map((cells, k) => ({ id: -100 - i * 100 - k, where: `표${o.t + 1} ${o.after + 2 + k}행 · 행 추가`, before: "", after: cells.filter(Boolean).join(" | "), added: true })));
    setChanges([...textChanges, ...rowChanges]);
    setWarnings([...r.warnings, ...skipped]);
    const note = r.notes.length ? `\n확인할 점:\n${r.notes.map((n) => `· ${n}`).join("\n")}` : "";
    setMsgs((m) => [...m, { role: "assistant", text: `'${outName.current}' 파일에 ${r.edits.length ? `${r.edits.length}곳을 고쳐` : "표를 정리해"}${rowOps.length ? `(표 행·새 표 ${rowOps.length}건)` : ""} 저장했습니다. 원본은 그대로입니다. 한글에서 열어 확인해 주세요.${truncated ? "\n(문서가 길어 앞부분만 고쳤습니다.)" : ""}${note}` }]);
  };

  const send = async (override?: string) => {
    const instruction = (override ?? input).trim();
    if (instruction.length < 3 || busy) return;
    const history = msgs.slice(-6);
    setMsgs((m) => [...m, { role: "user", text: instruction }]);
    setInput(""); setFixInput("");
    try {
      if (target) { await sendEdit(instruction, history); return; }
      let use = chosen;
      if (files.length && !picked) {
        setBusy("참고할 파일을 고르는 중…");
        const r = await pick.mutateAsync({ instruction, files: files.map((f) => ({ path: f.path, size: f.size })) });
        use = new Set(r.files);
        setChosen(use); setPicked(true);
      }
      const sources: { name: string; text: string }[] = [];
      const list = files.filter((f) => use.has(f.path));
      for (let i = 0; i < list.length; i++) {
        setBusy(`파일 읽는 중 ${i + 1}/${list.length} · ${list[i].name}`);
        sources.push({ name: list[i].path, text: await readFile(list[i]) });
      }
      setBusy(doc ? "고치는 중…" : "문서를 작성하는 중… (1~2분 걸릴 수 있습니다)");
      const r = await write.mutateAsync({ instruction, history, sources, prevDoc: doc });
      undoDocs.current.push(doc);
      setDoc(r.doc); setWarnings(r.warnings);
      const note = r.doc.notes.length ? `\n확인할 점:\n${r.doc.notes.map((n) => `· ${n}`).join("\n")}` : "";
      setMsgs((m) => [...m, { role: "assistant", text: `${sources.length ? `참고 파일 ${sources.length}개를 읽고 ` : ""}${doc ? "수정했습니다." : "초안을 작성했습니다."}${note}` }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { role: "assistant", text: `⚠ ${e?.message || "작성하지 못했습니다."}` }]);
    } finally { setBusy(""); }
  };

  const canUndo = target ? undoBytes.current.length > 0 && round > 0 : undoDocs.current.length > 0 && !!doc;
  const undo = async () => {
    if (busy) return;
    try {
      if (target) {
        const prev = undoBytes.current.pop();
        if (!prev || !dirRef.current || !outName.current) return;
        await overwriteInFolder(dirRef.current, outName.current, new Blob([prev]));
        currentBytes.current = prev; setRound((n) => Math.max(0, n - 1)); setChanges([]); setWarnings([]);
      } else {
        const prev = undoDocs.current.pop();
        setDoc(prev ?? null); setWarnings([]);
      }
      setMsgs((m) => [...m, { role: "assistant", text: "직전 수정을 취소하고 그 전 상태로 되돌렸습니다." }]);
    } catch { toast.error("되돌리지 못했습니다."); }
  };

  const FIX_EXAMPLES = ["빈칸 없이 표를 정리해줘", "금액과 합계를 다시 확인해줘", "기존 문장의 말투에 맞춰 다듬어줘"];

  const fileName = () => `${(doc?.title || "문서").replace(/[\\/:*?"<>|]/g, " ").trim().slice(0, 60)}.docx`;
  const makeBlob = async () => {
    const r = await exp.mutateAsync({ doc: doc! });
    const bin = atob(r.base64); const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return { blob: new Blob([u8], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), text: r.text };
  };
  const saveWord = async () => {
    if (!doc) return;
    try {
      const { blob } = await makeBlob();
      if (dirRef.current) { const n = await saveToFolder(dirRef.current, fileName(), blob); toast.success(`폴더에 저장했습니다: ${n}`); }
      else download(blob);
    } catch { toast.error("저장하지 못했습니다. '내려받기'를 이용해 주세요."); }
  };
  const download = (blob: Blob) => {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = fileName();
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const reset = () => { undoDocs.current = []; setFixInput(""); setMsgs([]); setDoc(null); setWarnings([]); setPicked(false); setChosen(new Set()); resetEdit(targetPath); };
  const chosenCount = useMemo(() => files.filter((f) => chosen.has(f.path)).length, [files, chosen]);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-5 w-5" />
          <h1 className="text-xl font-bold">대화로 문서 작성</h1>
          <span className="text-sm text-muted-foreground">폴더를 지정하고 시키면, 파일을 읽고 문서를 써 줍니다</span>
        </div>
        <PlanNotice feature="doc_chat" />

        <div className="grid gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
          <Card className="min-w-0">
            <CardContent className="space-y-3 pt-6">
              {supported ? (
                <>
                  <Button className="w-full" variant="outline" onClick={openFolder}><FolderOpen className="mr-2 h-4 w-4" />{folderName ? "다른 폴더 선택" : "참고할 폴더 선택 (선택 사항)"}</Button>
                  {folderName && (
                    <div className="space-y-1 text-sm">
                      <p className="flex items-center gap-2 font-medium"><span className="truncate">📁 {folderName} <span className="font-normal text-muted-foreground">· 읽을 수 있는 파일 {files.length}개</span></span><button type="button" className="ml-auto shrink-0 rounded border px-2 py-0.5 text-xs font-normal hover:bg-muted" onClick={refreshFiles} disabled={!!busy}>목록 다시 읽기</button></p>
                      {picked && <p className="text-xs text-muted-foreground">AI가 고른 참고 파일 {chosenCount}개 <button className="underline" onClick={() => setShowFiles((v) => !v)}>{showFiles ? "접기" : "보기·바꾸기"}</button></p>}
                      {showFiles && (
                        <div className="max-h-40 space-y-0.5 overflow-y-auto rounded border p-2 text-xs">
                          {files.map((f) => (
                            <label key={f.path} className="flex items-center gap-2"><Checkbox checked={chosen.has(f.path)} onCheckedChange={() => setChosen((s) => { const n = new Set(s); n.has(f.path) ? n.delete(f.path) : n.add(f.path); return n; })} /><span className="truncate">{f.path}</span></label>
                          ))}
                        </div>
                      )}
                      {hwp.length > 0 && <p className="flex gap-1 text-xs text-amber-700"><TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />한글(.hwp) 파일 {hwp.length}개는 읽을 수 없습니다. 한글에서 hwpx나 PDF로 저장해 두면 읽습니다.</p>}
                    </div>
                  )}
                  {folderName && (
                    <div className="space-y-1 rounded-md border bg-muted/30 p-2">
                      <p className="text-xs font-semibold">고칠 파일 (작년 문서 등)</p>
                      <select className="w-full rounded border bg-background px-2 py-1.5 text-sm" value={targetPath} disabled={!!busy} onChange={(e) => { resetEdit(e.target.value); setDoc(null); setWarnings([]); }}>
                        <option value="">선택 안 함 — 새 문서를 만들어 줘</option>
                        {editable.map((f) => <option key={f.path} value={f.path} disabled={f.fakeLegacy}>{f.path}{f.fakeLegacy ? " (옛 .hwp 형식 — 고칠 수 없음)" : ""}</option>)}
                      </select>
                      {editable.some((f) => f.fakeLegacy) && (
                        <p className="flex gap-1 text-xs text-amber-700"><TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />{editable.filter((f) => f.fakeLegacy).map((f) => f.name).join(", ")}: 이름은 hwpx지만 실제로는 옛 .hwp 파일입니다(확장자만 바꾼 파일). 한글에서 연 뒤 「다른 이름으로 저장」의 파일 형식을 <b>한글 문서(*.hwpx)</b>로 골라 저장해 주세요. 방금 다시 저장했다면 위의 <b>목록 다시 읽기</b>를 눌러 주세요.
                          <span className="block text-[10px] text-amber-800/80">{editable.filter((f) => f.fakeLegacy).map((f) => `${f.name} · 파일 앞부분 ${f.head} · ${new Date(f.modified ?? 0).toLocaleString("ko-KR")} 저장`).join(" / ")} (정상 hwpx는 50 4B 03 04로 시작)</span></p>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        {targetPath ? "이 파일의 서식·표는 그대로 두고 글자만 바꿔, 같은 폴더에 새 파일(…_수정본)로 저장합니다. 원본은 건드리지 않습니다." : editable.length ? "파일을 고르면 그 문서에 직접 써 줍니다(hwpx·docx)." : "폴더에 hwpx·docx 파일이 없습니다. 한글 문서는 hwpx로 저장해 두세요."}
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">폴더(하위 2단계까지)의 PDF·hwpx·docx·xlsx·txt를 읽고, 완성한 문서는 같은 폴더에 저장할 수 있습니다. 허락은 이 창을 닫으면 끝납니다. 파일의 글자가 AI로 전달되니 이용자 명단 같은 개인정보 문서는 빼 주세요(전화번호·이메일은 자동으로 가림).</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">폴더를 읽으려면 컴퓨터의 <b>크롬·엣지</b>가 필요합니다. 이 브라우저에서는 폴더 없이 지시만으로 작성할 수 있습니다.</p>
              )}

              <div className="max-h-72 space-y-2 overflow-y-auto">
                {msgs.map((m, i) => (
                  <div key={i} className={`whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-primary/10" : "bg-muted"}`}>{m.text}</div>
                ))}
                {busy && <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm"><Spinner className="h-4 w-4" />{busy}</div>}
              </div>

              <Textarea rows={6} value={input} onChange={(e) => setInput(e.target.value)} placeholder={savedName ? "더 고칠 점을 말해 주세요. 예) 순서에서 표창 수여식을 환영사 앞으로 옮겨줘" : target ? "올해 내용으로 어떻게 고칠지 말해 주세요. 날짜·순서·사람·예산을 적을수록 정확합니다." : doc ? "고칠 점을 말해 주세요. 예) 예산표를 개요 바로 뒤로 옮기고, 직원 역할에 사진 촬영 담당을 추가해줘" : "무슨 문서를 어떻게 쓸지 말해 주세요. 날짜·순서·사람·예산을 적을수록 정확합니다."}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(); }} />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => send()} disabled={!!busy || input.trim().length < 3}><Send className="mr-1 h-4 w-4" />{doc || savedName ? "수정 요청" : target ? "고쳐 쓰기" : "작성하기"}</Button>
                {!doc && !savedName && <Button variant="ghost" size="sm" onClick={() => setInput(EXAMPLE)}>예시 넣기</Button>}
                {(doc || savedName || msgs.length > 0) && <Button variant="outline" size="sm" onClick={reset}><RotateCcw className="mr-1 h-4 w-4" />새 문서</Button>}
                {picked && <Button variant="ghost" size="sm" onClick={() => setPicked(false)}>참고 파일 다시 고르기</Button>}
              </div>
              <p className="text-[11px] text-muted-foreground">Ctrl+Enter로도 보낼 수 있습니다.</p>
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader className="flex-row flex-wrap items-center gap-2 space-y-0 pb-2">
              <CardTitle className="text-base">{target ? "고친 내용" : "작성한 문서"}</CardTitle>
              {target && savedName && <span className="text-xs text-muted-foreground">📄 {folderName}/{savedName} · {round}번째 반영</span>}
              {!target && doc && (
                <div className="ml-auto flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={async () => { try { const { text } = await makeBlob(); await navigator.clipboard.writeText(text); toast.success("복사했습니다."); } catch { toast.error("복사하지 못했습니다."); } }}><Copy className="mr-1 h-4 w-4" />복사</Button>
                  <Button size="sm" variant="outline" onClick={async () => { try { download((await makeBlob()).blob); } catch { toast.error("내려받지 못했습니다."); } }}><Download className="mr-1 h-4 w-4" />내려받기</Button>
                  <Button size="sm" onClick={saveWord} disabled={exp.isPending}><Save className="mr-1 h-4 w-4" />{folderName ? "Word로 폴더에 저장" : "Word로 저장"}</Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {warnings.length > 0 && (
                <div className="mb-3 space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="flex items-center gap-1 font-semibold"><TriangleAlert className="h-3.5 w-3.5" />금액을 확인해 주세요</p>
                  {warnings.map((w, i) => <p key={i}>· {w}</p>)}
                </div>
              )}
              {target ? (
                changes.length ? (
                  <div className="space-y-2 text-xs">
                    <p className="text-muted-foreground">파일에는 이미 저장되었습니다. 아래는 이번에 바뀐 곳입니다.</p>
                    {changes.map((c) => (
                      <div key={c.id + (c.added ? "a" : "")} className="rounded border p-2">
                        <p className="mb-1 font-semibold text-muted-foreground">{c.where}{c.added ? " · 줄 추가" : ""}</p>
                        {!c.added && <p className="text-rose-700 line-through decoration-rose-300">{c.before || "(빈칸)"}</p>}
                        <p className="text-emerald-800">{c.after || "(비움)"}</p>
                      </div>
                    ))}
                  </div>
                ) : <p className="py-16 text-center text-sm text-muted-foreground">왼쪽에서 시키면 고른 파일에 바로 써 주고, 바뀐 곳을 여기에 보여 줍니다.</p>
              ) : doc ? <DocView doc={doc} /> : <p className="py-16 text-center text-sm text-muted-foreground">왼쪽에서 시키면 여기에 문서가 나타납니다.</p>}

              {(target ? !!savedName : !!doc) && (
                <div className="mt-4 space-y-2 rounded-md border bg-muted/30 p-3">
                  <p className="text-sm font-semibold">✏️ 이 결과를 다시 고치기</p>
                  <p className="text-xs text-muted-foreground">고칠 점을 짧게 적고 「수정하기」를 누르세요. {target ? `방금 저장한 '${savedName}' 파일에 이어서 반영합니다.` : "지금 문서에 이어서 반영합니다."}</p>
                  <Textarea rows={2} value={fixInput} disabled={!!busy} onChange={(e) => setFixInput(e.target.value)} placeholder="예) 2번 순서를 3번 뒤로 옮겨줘 / 다과비를 100만원으로 바꾸고 합계도 맞춰줘"
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(fixInput); }} />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={() => send(fixInput)} disabled={!!busy || fixInput.trim().length < 3}><Pencil className="mr-1 h-4 w-4" />수정하기</Button>
                    {canUndo && <Button size="sm" variant="outline" onClick={undo} disabled={!!busy}><Undo2 className="mr-1 h-4 w-4" />직전 수정 취소</Button>}
                    {busy && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Spinner className="h-3 w-3" />{busy}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {FIX_EXAMPLES.map((x) => <button key={x} type="button" className="rounded-full border bg-background px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted" onClick={() => setFixInput((v) => (v ? `${v} ${x}` : x))}>{x}</button>)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
