import type { NoteContent } from "@shared/noteImage";

export type NoteStyle = "note" | "mindmap";
export type NoteRatio = "feed" | "reel";
export const NOTE_SIZE: Record<NoteRatio, { w: number; h: number; label: string }> = {
  feed: { w: 1080, h: 1350, label: "피드 4:5 (1080×1350)" },
  reel: { w: 1080, h: 1920, label: "릴스·스토리 9:16 (1080×1920)" },
};

const FONT = '"Gaegu","Nanum Pen Script","Noto Sans KR",sans-serif';
const INK = "#3b2f2f";
const FILL = ["#ffe9a8", "#ffc9c9", "#c9ecd0", "#cfe3ff", "#e5d4ff", "#ffd9b8", "#c8f0ef", "#f6d1e8"];
const ACCENT = ["#d9a400", "#e0566a", "#3c9a55", "#3a78d1", "#8656d6", "#d9772b", "#1d9a98", "#c94a97"];

export async function ensureNoteFonts(text = "가나다") {
  // 구글 폰트는 한글을 조각으로 나눠 보내므로, 실제로 쓸 글자로 불러와야 모두 손글씨로 나온다.
  const sample = Array.from(new Set(Array.from(text + "0123456789"))).join("");
  try {
    await Promise.all([document.fonts.load("700 40px Gaegu", sample), document.fonts.load("400 40px Gaegu", sample)]);
  } catch { /* 폰트를 못 불러오면 기본 글꼴로 그린다 */ }
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 글자 단위로 줄바꿈(띄어쓰기를 우선) */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const ch of Array.from(text)) {
    const test = cur + ch;
    if (ctx.measureText(test).width > maxW && cur) {
      const sp = cur.lastIndexOf(" ");
      if (ch !== " " && sp > cur.length * 0.4) { lines.push(cur.slice(0, sp)); cur = cur.slice(sp + 1) + ch; }
      else { lines.push(cur); cur = ch === " " ? "" : ch; }
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** 칸에 맞도록 글자 크기를 줄이며 맞춘다. 그래도 넘치면 마지막 줄을 …로 줄인다. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxH: number, size: number, minSize: number, weight = 700, lh = 1.25) {
  for (let s = size; s >= minSize; s -= 2) {
    ctx.font = `${weight} ${s}px ${FONT}`;
    const lines = wrap(ctx, text, maxW);
    if (lines.length * s * lh <= maxH) return { size: s, lines, lh };
  }
  ctx.font = `${weight} ${minSize}px ${FONT}`;
  let lines = wrap(ctx, text, maxW);
  const maxLines = Math.max(1, Math.floor(maxH / (minSize * lh)));
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(last + "…").width > maxW) last = last.slice(0, -1);
    lines[maxLines - 1] = last + "…";
  }
  return { size: minSize, lines, lh };
}

function drawLines(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, size: number, lh: number, align: CanvasTextAlign = "left") {
  ctx.textAlign = align; ctx.textBaseline = "top";
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * size * lh));
}

function paper(ctx: CanvasRenderingContext2D, W: number, H: number, style: NoteStyle) {
  const r = rng(7);
  ctx.fillStyle = "#fbf3df"; ctx.fillRect(0, 0, W, H);
  if (style === "note") {
    ctx.strokeStyle = "rgba(110,150,200,0.28)"; ctx.lineWidth = 2;
    for (let y = 120; y < H; y += 56) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.strokeStyle = "rgba(225,100,100,0.35)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(52, 0); ctx.lineTo(52, H); ctx.stroke();
  } else {
    ctx.fillStyle = "rgba(150,120,80,0.28)";
    for (let y = 40; y < H; y += 48) for (let x = 40; x < W; x += 48) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 7); ctx.fill(); }
  }
  ctx.fillStyle = "rgba(120,90,50,0.05)";
  for (let i = 0; i < 1400; i++) ctx.fillRect(r() * W, r() * H, 2 + r() * 2, 1 + r() * 2);
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.8);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(120,80,30,0.16)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

function tape(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, rot: number, color = "rgba(255,214,102,0.75)") {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.fillStyle = color; ctx.fillRect(-w / 2, -20, w, 40);
  ctx.strokeStyle = "rgba(0,0,0,0.08)"; ctx.lineWidth = 1; ctx.strokeRect(-w / 2, -20, w, 40);
  ctx.restore();
}

function handBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, line: string, r: () => number, rot = 0) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot); ctx.translate(-w / 2, -h / 2);
  ctx.shadowColor = "rgba(80,50,20,0.22)"; ctx.shadowBlur = 10; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 6;
  ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(0, 0, w, h, 22); ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = line; ctx.lineWidth = 4; ctx.lineCap = "round";
  for (let i = 0; i < 2; i++) {
    ctx.globalAlpha = i ? 0.55 : 1;
    ctx.beginPath(); ctx.roundRect((r() - 0.5) * 3 * i, (r() - 0.5) * 3 * i, w + (r() - 0.5) * 4 * i, h + (r() - 0.5) * 4 * i, 22); ctx.stroke();
  }
  ctx.restore();
}

function cardContent(ctx: CanvasRenderingContext2D, item: NoteContent["items"][0], idx: number, w: number, h: number, small: boolean) {
  const pad = small ? 18 : 22;
  const accent = ACCENT[idx % 8];
  // 번호 + 이모지 + 소제목
  const bR = small ? 19 : 22;
  ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(pad + bR, pad + bR + 2, bR, 0, 7); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = `700 ${bR * 1.3}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(String(idx + 1), pad + bR, pad + bR + 5);
  const emSize = small ? 44 : 54;
  ctx.font = `${emSize}px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif`;
  ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = INK;
  const ex = pad + bR * 2 + 10;
  ctx.fillText(item.emoji, ex, pad + bR + 4);
  const hx = ex + emSize + 18;
  const head = fit(ctx, item.heading, w - hx - pad, bR * 2 + 8, small ? 40 : 46, 26, 700, 1.1);
  ctx.fillStyle = INK; ctx.font = `700 ${head.size}px ${FONT}`;
  drawLines(ctx, head.lines.slice(0, 1), hx, pad + 2 + (bR * 2 - head.size) / 2 + 2, head.size, head.lh);
  // 설명
  const dy = pad + bR * 2 + 16;
  const d = fit(ctx, item.desc, w - pad * 2, h - dy - pad + 4, small ? 30 : 34, 22, 400, 1.22);
  ctx.fillStyle = "#4d4038"; ctx.font = `400 ${d.size}px ${FONT}`;
  drawLines(ctx, d.lines, pad, dy, d.size, d.lh);
}

function footer(ctx: CanvasRenderingContext2D, text: string, W: number, H: number) {
  if (!text) return;
  ctx.save();
  ctx.strokeStyle = "rgba(120,90,60,0.45)"; ctx.lineWidth = 3; ctx.setLineDash([4, 12]); ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(120, H - 112); ctx.lineTo(W - 120, H - 112); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "#8a7560"; ctx.font = `700 36px ${FONT}`;
  drawLines(ctx, [text], W / 2, H - 92, 36, 1, "center");
}

function drawNoteLayout(ctx: CanvasRenderingContext2D, c: NoteContent, W: number, H: number) {
  const r = rng(11);
  paper(ctx, W, H, "note");
  tape(ctx, W / 2, 46, 190, -0.04);
  // 제목 + 형광펜
  const t = fit(ctx, c.title, W - 200, H > 1500 ? 230 : 190, 104, 56, 700, 1.15);
  ctx.font = `700 ${t.size}px ${FONT}`;
  const ty = 92;
  t.lines.forEach((l, i) => {
    const lw = ctx.measureText(l).width;
    ctx.fillStyle = "rgba(255,206,70,0.62)";
    ctx.save(); ctx.translate(W / 2, ty + i * t.size * t.lh + t.size * 0.72); ctx.rotate(-0.012);
    ctx.fillRect(-lw / 2 - 14, -t.size * 0.22, lw + 28, t.size * 0.42); ctx.restore();
  });
  ctx.fillStyle = INK; drawLines(ctx, t.lines, W / 2, ty, t.size, t.lh, "center");
  let y = ty + t.lines.length * t.size * t.lh + 8;
  if (c.subtitle) {
    const s = fit(ctx, c.subtitle, W - 220, 100, 44, 28, 400, 1.2);
    ctx.fillStyle = "#7a6552"; ctx.font = `400 ${s.size}px ${FONT}`;
    drawLines(ctx, s.lines, W / 2, y, s.size, s.lh, "center");
    y += s.lines.length * s.size * s.lh + 6;
  }
  // 카드
  const n = c.items.length, rows = Math.ceil(n / 2), mx = 78, gx = 26;
  const cw = (W - mx - 48 - gx) / 2;
  const top = y + 26, bottom = H - 140;
  const avail = bottom - top;
  const ch = Math.min(H > 1500 ? 340 : 270, (avail - 22 * (rows - 1)) / rows);
  const gy = rows > 1 ? Math.min(60, (avail - ch * rows) / (rows - 1)) : 0;
  const used = ch * rows + gy * (rows - 1);
  const oy = top + Math.max(0, (avail - used) / 2);
  c.items.forEach((it, i) => {
    const row = Math.floor(i / 2), col = i % 2;
    const alone = i === n - 1 && n % 2 === 1;
    const x = alone ? (W + mx - 48) / 2 - cw / 2 : mx + col * (cw + gx);
    const yy = oy + row * (ch + gy);
    handBox(ctx, x, yy, cw, ch, FILL[i % 8], ACCENT[i % 8], r, (r() - 0.5) * 0.03);
    ctx.save(); ctx.translate(x + cw / 2, yy + ch / 2); ctx.rotate(0); ctx.translate(-cw / 2, -ch / 2);
    cardContent(ctx, it, i, cw, ch, false); ctx.restore();
    if (i % 3 === 0) tape(ctx, x + cw - 50, yy + 4, 80, 0.5, "rgba(255,180,200,0.7)");
  });
  footer(ctx, c.footer, W, H);
}

function branch(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, r: () => number) {
  const mx = (x1 + x2) / 2 + (r() - 0.5) * 24, my = (y1 + y2) / 2 + (r() - 0.5) * 30;
  ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
}

function drawMindmapLayout(ctx: CanvasRenderingContext2D, c: NoteContent, W: number, H: number) {
  const r = rng(23);
  paper(ctx, W, H, "mindmap");
  if (c.subtitle) {
    const s = fit(ctx, c.subtitle, W - 160, 60, 46, 28, 700, 1.15);
    ctx.fillStyle = "#7a6552"; ctx.font = `700 ${s.size}px ${FONT}`;
    drawLines(ctx, s.lines.slice(0, 1), W / 2, 56, s.size, s.lh, "center");
  }
  const n = c.items.length;
  const left = Math.ceil(n / 2), right = n - left;
  const cw = 372, mxEdge = 24;
  const top = 150, bottom = H - 150, avail = bottom - top;
  const maxRows = Math.max(left, right);
  const ch = Math.min(H > 1500 ? 290 : 215, (avail - 20 * (maxRows - 1)) / maxRows);
  const cy0 = H / 2 - 10;
  const colPos = (count: number, k: number) => {
    const total = count * ch + (count - 1) * Math.min(46, (avail - count * ch) / Math.max(1, count - 1));
    const g = count > 1 ? Math.min(46, (avail - count * ch) / (count - 1)) : 0;
    const start = H / 2 - 10 - total / 2;
    return start + k * (ch + g);
  };
  const pos = c.items.map((_, i) => {
    const isLeft = i < left;
    const k = isLeft ? i : i - left;
    const count = isLeft ? left : right;
    return { x: isLeft ? mxEdge : W - mxEdge - cw, y: colPos(count, k), left: isLeft };
  });
  // 가지
  pos.forEach((p, i) => {
    const ex = p.left ? p.x + cw : p.x;
    branch(ctx, W / 2, cy0, ex, p.y + ch / 2, ACCENT[i % 8], r);
  });
  // 카드
  pos.forEach((p, i) => {
    handBox(ctx, p.x, p.y, cw, ch, FILL[i % 8], ACCENT[i % 8], r, (r() - 0.5) * 0.025);
    ctx.save(); ctx.translate(p.x, p.y); cardContent(ctx, c.items[i], i, cw, ch, H < 1500); ctx.restore();
  });
  // 가운데 제목 말풍선
  const bw = 292, bh = Math.min(330, ch * 1.25);
  ctx.save();
  ctx.shadowColor = "rgba(80,50,20,0.25)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 6;
  ctx.fillStyle = "#fff0a8"; ctx.beginPath(); ctx.ellipse(W / 2, cy0, bw / 2, bh / 2, -0.03, 0, 7); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "#d9a400"; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.ellipse(W / 2, cy0, bw / 2, bh / 2, -0.03, 0, 7); ctx.stroke();
  ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.ellipse(W / 2 + 2, cy0 + 2, bw / 2 + 3, bh / 2 + 3, 0.02, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
  const t = fit(ctx, c.title, bw - 80, bh - 80, 60, 30, 700, 1.15);
  ctx.fillStyle = INK; ctx.font = `700 ${t.size}px ${FONT}`;
  drawLines(ctx, t.lines, W / 2, cy0 - (t.lines.length * t.size * t.lh) / 2 + 2, t.size, t.lh, "center");
  footer(ctx, c.footer, W, H);
}

export function renderNote(canvas: HTMLCanvasElement, content: NoteContent, style: NoteStyle, ratio: NoteRatio) {
  const { w, h } = NOTE_SIZE[ratio];
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  if (style === "mindmap") drawMindmapLayout(ctx, content, w, h);
  else drawNoteLayout(ctx, content, w, h);
}

export function downloadCanvas(canvas: HTMLCanvasElement, name: string) {
  canvas.toBlob((b) => {
    if (!b) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = name.replace(/[\\/:*?"<>|]/g, "_") + ".png";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, "image/png");
}
