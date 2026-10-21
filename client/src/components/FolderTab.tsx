import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Download, FolderOpen, Sparkles, Save } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { FolderRow } from "@shared/folderSummary";
import { FOLDER_EXTS, MAX_FILES, MAX_FILE_BYTES, folderAccessSupported, listFolderFiles, pickFolder, saveToFolder, type FolderFile } from "@/lib/folderAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";

const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

export default function FolderTab() {
  const supported = folderAccessSupported();
  const dirRef = useRef<any>(null);
  const [folderName, setFolderName] = useState("");
  const [files, setFiles] = useState<FolderFile[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<FolderRow[]>([]);
  const [busy, setBusy] = useState<string>("");
  const summarize = trpc.tools.folderSummary.useMutation();

  const open = async () => {
    try {
      const dir = await pickFolder();
      dirRef.current = dir;
      setFolderName(dir.name);
      const list = await listFolderFiles(dir);
      setFiles(list);
      setPicked(new Set(list.filter((f) => f.size <= MAX_FILE_BYTES).slice(0, MAX_FILES).map((f) => f.path)));
      setRows([]);
      if (list.length === 0) toast.message("이 폴더에는 읽을 수 있는 파일(PDF·hwpx·docx·xlsx·txt)이 없습니다.");
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error("폴더를 열지 못했습니다.");
    }
  };

  const toggle = (p: string) => setPicked((s) => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n; });
  const chosen = useMemo(() => files.filter((f) => picked.has(f.path)), [files, picked]);

  const run = async () => {
    if (chosen.length === 0) return toast.error("정리할 파일을 선택해 주세요.");
    if (chosen.length > MAX_FILES) return toast.error(`한 번에 ${MAX_FILES}개까지 정리할 수 있습니다.`);
    setRows([]);
    const items: { name: string; text: string }[] = [];
    try {
      for (let i = 0; i < chosen.length; i++) {
        const f = chosen[i];
        setBusy(`파일 읽는 중 ${i + 1}/${chosen.length} · ${f.name}`);
        if (f.size > MAX_FILE_BYTES) { items.push({ name: f.path, text: "(10MB를 넘어 읽지 못함)" }); continue; }
        const file: File = await f.handle.getFile();
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload/source-text", { method: "POST", body: fd, credentials: "include" });
        const j = await res.json().catch(() => ({}));
        items.push({ name: f.path, text: res.ok ? String(j.text ?? "").slice(0, 5000) : `(읽지 못함: ${j.error || res.status})` });
      }
      const all: FolderRow[] = [];
      for (let i = 0; i < items.length; i += 10) {
        setBusy(`AI가 정리하는 중 ${Math.min(i + 10, items.length)}/${items.length}`);
        const r = await summarize.mutateAsync({ items: items.slice(i, i + 10) });
        all.push(...r.rows);
        setRows([...all]);
      }
      toast.success(`${all.length}개 파일을 정리했습니다.`);
    } catch (e: any) {
      toast.error(e?.message || "정리하지 못했습니다.");
    } finally { setBusy(""); }
  };

  const makeXlsx = (): Blob => {
    const data = [["파일", "문서 종류", "날짜", "한 줄 요약", "핵심 사항"], ...rows.map((r) => [r.name, r.kind, r.date, r.summary, r.facts])];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 60 }, { wch: 60 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "정리");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  };
  const stamp = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; };
  const saveInFolder = async () => {
    try {
      const name = await saveToFolder(dirRef.current, `문서정리_${stamp()}.xlsx`, makeXlsx());
      toast.success(`폴더에 저장했습니다: ${name}`);
    } catch { toast.error("폴더에 저장하지 못했습니다. '내려받기'를 이용해 주세요."); }
  };
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(makeXlsx());
    a.download = `문서정리_${stamp()}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  if (!supported) {
    return <p className="text-sm text-muted-foreground pt-2">이 기능은 컴퓨터의 <b>크롬·엣지</b> 브라우저에서 쓸 수 있습니다(휴대폰·사파리·파이어폭스는 지원하지 않습니다). 다른 브라우저에서는 '파일에서 불러오기'로 문서를 하나씩 올려 주세요.</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      <Card className="min-w-0">
        <CardContent className="space-y-3 pt-6">
          <Button className="w-full" variant="outline" onClick={open}><FolderOpen className="w-4 h-4 mr-2" />{folderName ? "다른 폴더 선택" : "폴더 선택"}</Button>
          <p className="text-xs text-muted-foreground">고른 폴더(하위 2단계까지)의 {FOLDER_EXTS.join("·")} 파일만 읽습니다. 허락은 이 창을 닫으면 끝나고, 폴더 밖 파일은 볼 수 없습니다. 파일의 글자가 AI로 전달되니 이름 등 개인정보가 많은 문서는 빼 주세요(전화번호·이메일은 자동으로 가립니다).</p>
          {folderName && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium truncate">📁 {folderName}</span>
                <span className="text-xs text-muted-foreground">{chosen.length}/{files.length}개 선택</span>
              </div>
              <div className="flex gap-2 text-xs">
                <button className="underline text-muted-foreground" onClick={() => setPicked(new Set(files.filter((f) => f.size <= MAX_FILE_BYTES).slice(0, MAX_FILES).map((f) => f.path)))}>전체 선택</button>
                <button className="underline text-muted-foreground" onClick={() => setPicked(new Set())}>선택 해제</button>
              </div>
              <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
                {files.map((f) => (
                  <label key={f.path} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
                    <Checkbox checked={picked.has(f.path)} onCheckedChange={() => toggle(f.path)} disabled={f.size > MAX_FILE_BYTES} />
                    <span className="flex-1 min-w-0 truncate" title={f.path}>{f.path}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{fmtSize(f.size)}</span>
                  </label>
                ))}
              </div>
              <Button className="w-full" onClick={run} disabled={!!busy || chosen.length === 0}>
                {busy ? <Spinner className="w-4 h-4 mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                {busy ? "처리 중…" : `선택한 ${chosen.length}개 읽고 정리`}
              </Button>
              {busy && <p className="text-xs text-muted-foreground">{busy}</p>}
            </>
          )}
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-3">
        {rows.length === 0 && !busy && <p className="text-sm text-muted-foreground pt-2">폴더를 고르고 파일을 선택하면, 파일마다 문서 종류·날짜·한 줄 요약·핵심 사항을 표로 정리해 드립니다. 결과는 엑셀로 같은 폴더에 바로 저장할 수 있습니다.</p>}
        {rows.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button size="sm" onClick={saveInFolder}><Save className="w-4 h-4 mr-1.5" />엑셀을 폴더에 저장</Button>
              <Button size="sm" variant="outline" onClick={download}><Download className="w-4 h-4 mr-1.5" />엑셀 내려받기</Button>
            </div>
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr><th className="text-left px-3 py-2">파일</th><th className="text-left px-3 py-2">종류</th><th className="text-left px-3 py-2">날짜</th><th className="text-left px-3 py-2">요약 · 핵심 사항</th></tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r, i) => (
                    <tr key={i} className="align-top">
                      <td className="px-3 py-2 max-w-[200px] break-words">{r.name}</td>
                      <td className="px-3 py-2">{r.kind || "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.date || "-"}</td>
                      <td className="px-3 py-2"><p>{r.summary || "-"}</p>{r.facts && <p className="text-xs text-muted-foreground mt-1">{r.facts}</p>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">AI가 정리한 내용은 원문과 다를 수 있습니다. 중요한 숫자·날짜는 원본에서 확인하세요.</p>
          </>
        )}
      </div>
    </div>
  );
}
