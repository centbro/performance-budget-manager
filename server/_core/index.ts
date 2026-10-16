import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import net from "net";
import multer from "multer";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { autoCreateTables } from "../autoMigrate";
import { ensureAdminAccount } from "../auth-local";
import { storagePut } from "../storage";
import { createProjectPlan, getProjectById } from "../db";
import { validateSession } from "../auth-local";
import { isOwnedProject } from "../projectAccess";
import { extractPdfTextFromBuffer } from "../pdfExtract";
import { registerTemplateFromPdf, TemplateError } from "../docTemplate";
import { registerReferencePdf, ReferenceError } from "../referenceLib";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Trust reverse proxy (Railway 등) so req.protocol = 'https'
  app.set("trust proxy", 1);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(cookieParser());

  // Serve uploaded files (local storage)
  const uploadDir = path.resolve(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  app.use("/uploads", express.static(uploadDir));


  // ─── 계획서 PDF 업로드 (multipart/form-data) ─────────────────────────────────
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
  app.post("/api/upload/plan", upload.single("file"), async (req, res) => {
    try {
      // 인증 확인
      const sessionId = req.cookies?.["local_session"];
      if (!sessionId) { res.status(401).json({ error: "Unauthorized" }); return; }
      const user = await validateSession(sessionId);
      if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

      const file = req.file;
      const projectId = parseInt(req.body.projectId);
      if (!file || !projectId) { res.status(400).json({ error: "file and projectId required" }); return; }
      if (file.mimetype !== "application/pdf") { res.status(400).json({ error: "PDF only" }); return; }
      const project = await getProjectById(projectId, user.id);
      if (!isOwnedProject(project, user.id, { parentOnly: true })) { res.status(404).json({ error: "Project not found" }); return; }

      // 파일 키는 ASCII 안전한 형태로 생성 (한글 파일명 등 non-ASCII 문자 방지)
      const safeKey = `project-plans/${user.id}/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
      const { key, url } = await storagePut(
        safeKey,
        file.buffer,
        "application/pdf"
      );
      await createProjectPlan({ projectId, userId: user.id, fileName: file.originalname, fileKey: key, fileUrl: url, fileSize: file.size });
      res.json({ key, url, fileName: file.originalname });
    } catch (err: any) {
      console.error("[plan-upload] error:", err);
      res.status(500).json({ error: err?.message ?? "Upload failed" });
    }
  });

  // ─── 기관 서식 PDF 등록 (샘플 → 항목 구조 분석) ──────────────────────────────
  const templateUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
  app.post("/api/upload/template", templateUpload.single("file"), async (req, res) => {
    try {
      const sessionId = req.cookies?.["local_session"];
      if (!sessionId) { res.status(401).json({ error: "로그인이 필요합니다." }); return; }
      const user = await validateSession(sessionId);
      if (!user || user.status !== "approved") { res.status(401).json({ error: "로그인이 필요합니다." }); return; }
      const file = req.file;
      const name = String(req.body?.name ?? "").trim().slice(0, 120);
      if (!file || !name) { res.status(400).json({ error: "양식 이름과 PDF 파일이 필요합니다." }); return; }
      if (file.mimetype !== "application/pdf") { res.status(400).json({ error: "PDF 파일만 올릴 수 있습니다." }); return; }
      const id = await registerTemplateFromPdf(user.id, name, file.buffer);
      res.json({ id });
    } catch (err: any) {
      if (err instanceof TemplateError) { res.status(422).json({ error: err.message }); return; }
      console.error("[template-upload] error:", err);
      res.status(500).json({ error: "양식 등록에 실패했습니다." });
    }
  });

  // ─── PDF → 텍스트 추출(저장하지 않음; 공모사업 평가용 모집요강·계획서)
  const extractUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
  app.post("/api/upload/extract-text", extractUpload.single("file"), async (req, res) => {
    try {
      const sessionId = req.cookies?.["local_session"];
      if (!sessionId) { res.status(401).json({ error: "로그인이 필요합니다." }); return; }
      const user = await validateSession(sessionId);
      if (!user || user.status !== "approved") { res.status(401).json({ error: "로그인이 필요합니다." }); return; }
      const file = req.file;
      if (!file) { res.status(400).json({ error: "PDF 파일이 필요합니다." }); return; }
      if (file.mimetype !== "application/pdf") { res.status(400).json({ error: "PDF 파일만 올릴 수 있습니다." }); return; }
      const text = (await extractPdfTextFromBuffer(file.buffer)).trim();
      if (text.replace(/\s/g, "").length < 100) {
        res.status(422).json({ error: "PDF에서 글자를 읽지 못했습니다. 스캔 이미지 PDF는 지원하지 않으니, 글자를 직접 붙여 넣거나 문서에서 PDF로 다시 저장해 주세요." });
        return;
      }
      res.json({ text: text.slice(0, 150000), chars: text.length });
    } catch (err) {
      console.error("[extract-text] error:", err);
      res.status(500).json({ error: "PDF를 읽지 못했습니다." });
    }
  });

  // ─── 참고자료(지침·사업 자료) PDF 등록 ────────────────────────────────────────
  const referenceUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
  app.post("/api/upload/reference", referenceUpload.single("file"), async (req, res) => {
    try {
      const sessionId = req.cookies?.["local_session"];
      if (!sessionId) { res.status(401).json({ error: "로그인이 필요합니다." }); return; }
      const user = await validateSession(sessionId);
      if (!user || user.status !== "approved") { res.status(401).json({ error: "로그인이 필요합니다." }); return; }
      const file = req.file;
      const name = String(req.body?.name ?? "").trim().slice(0, 200);
      if (!file || !name) { res.status(400).json({ error: "자료 이름과 PDF 파일이 필요합니다." }); return; }
      if (file.mimetype !== "application/pdf") { res.status(400).json({ error: "PDF 파일만 올릴 수 있습니다." }); return; }
      res.json(await registerReferencePdf(user.id, name, file.buffer));
    } catch (err: any) {
      if (err instanceof ReferenceError) { res.status(422).json({ error: err.message }); return; }
      console.error("[reference-upload] error:", err);
      res.status(500).json({ error: "자료 등록에 실패했습니다." });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // Always use Vite in local development (Windows NODE_ENV setting is unreliable)
  if (process.env.NODE_ENV !== "production") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer()
  .then(() => autoCreateTables())
  .then(() => ensureAdminAccount())
  .catch(console.error);
