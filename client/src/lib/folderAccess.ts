/** 브라우저 '폴더 열기' 기능(크롬·엣지). 사용자가 고른 폴더만, 창을 닫으면 허락도 끝난다. */
export const FOLDER_EXTS = ["pdf", "hwpx", "docx", "xlsx", "txt", "md", "csv"];
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES = 40;

export type FolderFile = { path: string; name: string; ext: string; size: number; handle: any; fakeLegacy?: boolean };

export const folderAccessSupported = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

export async function pickFolder(): Promise<any> {
  return (window as any).showDirectoryPicker({ mode: "readwrite" });
}

/** 폴더 안(하위 2단계까지) 지원 형식 파일 목록 */
export async function listFolderFiles(dir: any, depth = 2, prefix = "", skippedHwp?: string[]): Promise<FolderFile[]> {
  const out: FolderFile[] = [];
  for await (const [name, handle] of dir.entries()) {
    if (name.startsWith(".") || name.startsWith("~$")) continue;
    if (handle.kind === "directory") {
      if (depth > 0) out.push(...(await listFolderFiles(handle, depth - 1, `${prefix}${name}/`, skippedHwp)));
    } else {
      const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
      if (ext === "hwp") skippedHwp?.push(prefix + name);
      if (!FOLDER_EXTS.includes(ext)) continue;
      const f: File = await handle.getFile();
      // 이름은 .hwpx/.docx/.xlsx인데 실제로는 옛 형식(OLE)인 파일: 확장자만 바꿔 저장한 경우
      let fakeLegacy = false;
      if (["hwpx", "docx", "xlsx"].includes(ext) && f.size >= 8) {
        try {
          const head = new Uint8Array(await f.slice(0, 8).arrayBuffer());
          fakeLegacy = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((b, i) => head[i] === b);
        } catch { /* 읽기 실패는 무시 */ }
      }
      out.push({ path: prefix + name, name, ext, size: f.size, handle, fakeLegacy });
    }
    if (out.length >= 300) break;
  }
  return out.sort((a, b) => a.path.localeCompare(b.path, "ko"));
}

/** 폴더에 파일 저장(같은 이름이 있으면 덮어쓰지 않고 번호를 붙인다). 저장한 이름을 돌려준다. */
export async function saveToFolder(dir: any, name: string, blob: Blob): Promise<string> {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let final = name;
  for (let i = 2; i < 100; i++) {
    try { await dir.getFileHandle(final); final = `${base} (${i})${ext}`; } catch { break; }
  }
  const fh = await dir.getFileHandle(final, { create: true });
  const w = await fh.createWritable();
  await w.write(blob);
  await w.close();
  return final;
}

/** 이미 이 작업에서 만든 파일을 같은 이름으로 다시 쓴다(없으면 새로 만든다). */
export async function overwriteInFolder(dir: any, name: string, blob: Blob): Promise<void> {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(blob);
  await w.close();
}
