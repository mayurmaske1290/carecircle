import "dotenv/config";
import express from "express";
import cors from "cors";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { answerAssistant } from "./assistant.js";
import { createTask, proposePlan, type FamilyMember, type Task } from "./domain.js";
import { handleMcp } from "./mcp.js";
import { getStore, loadStore, resetStore, updateStore } from "./store.js";

const app = express();
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "127.0.0.1";
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173").split(",").map(s => s.trim()).filter(Boolean);
app.disable("x-powered-by");
app.use(cors({ origin(origin, callback) {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error("Origin is not allowed by CareCircle CORS policy."));
}, methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], allowedHeaders: ["Content-Type", "Mcp-Session-Id", "Mcp-Protocol-Version", "Last-Event-ID"] }));
app.use(express.json({ limit: "64kb" }));
app.use((req, res, next) => {
  const origin = req.get("origin");
  if (origin && !allowedOrigins.includes(origin)) return res.status(403).json({ error: "Origin is not allowed." });
  next();
});
app.get("/api/health", (_req, res) => res.json({ ok: true, status: "healthy", product: "CareCircle", awsBedrockConfigured: Boolean(process.env.AWS_REGION && process.env.BEDROCK_MODEL_ID) }));
app.get("/api/household", (_req, res) => res.json({ members: getStore().members }));
app.put("/api/household", async (req, res, next) => {
  try {
    const members = req.body?.members;
    if (!Array.isArray(members) || members.length < 1 || members.length > 12) return res.status(400).json({ error: "Provide between 1 and 12 household members." });
    const ids = new Set<string>();
    for (const m of members as FamilyMember[]) {
      if (!m || typeof m.id !== "string" || typeof m.name !== "string" || !m.name.trim() || m.name.length > 60 || ids.has(m.id) || !Array.isArray(m.availability)) return res.status(400).json({ error: "Invalid household member data." });
      ids.add(m.id);
      for (const a of m.availability) {
        if (!a || !["today", "tomorrow"].includes(a.day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(a.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(a.end) || a.start >= a.end || typeof a.available !== "boolean") return res.status(400).json({ error: `Invalid availability for ${m.name}.` });
      }
    }
    const store = await updateStore(s => ({ ...s, members: members as FamilyMember[] }));
    res.json({ members: store.members });
  } catch (e) { next(e); }
});
app.get("/api/tasks", (_req, res) => res.json({ tasks: getStore().tasks }));
app.post("/api/tasks", async (req, res, next) => {
  try {
    const { title, description, dueAt, assigneeId } = req.body ?? {};
    const store = getStore();
    const task = createTask(store, { title, description, dueAt, assigneeId });
    const updated = await updateStore(s => { s.tasks.unshift(task); return s; });
    res.status(201).json({ task: updated.tasks.find(t => t.id === task.id) });
  } catch (e) { next(e); }
});
app.patch("/api/tasks/:id", async (req, res, next) => {
  try {
    const status = req.body?.status;
    if (status !== "pending" && status !== "completed") return res.status(400).json({ error: "Status must be pending or completed." });
    let taskFound = false;
    let task: Task | undefined;
    const updated = await updateStore(s => { const t = s.tasks.find(x => x.id === req.params.id); if (t) { t.status = status; task = t; taskFound = true; } return s; });
    if (!taskFound) return res.status(404).json({ error: "Task not found." });
    res.json({ task: updated.tasks.find(t => t.id === req.params.id) ?? task });
  } catch (e) { next(e); }
});
app.delete("/api/tasks/:id", async (req, res, next) => {
  try {
    let removed = false;
    await updateStore(s => { const before = s.tasks.length; s.tasks = s.tasks.filter(t => t.id !== req.params.id); removed = s.tasks.length !== before; return s; });
    if (!removed) return res.status(404).json({ error: "Task not found." });
    res.status(204).end();
  } catch (e) { next(e); }
});
app.post("/api/plan", (req, res, next) => {
  try {
    const { time, title, day } = req.body ?? {};
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time || "")) return res.status(400).json({ error: "Time must use HH:MM 24-hour format." });
    res.json({ plan: proposePlan(getStore(), time, title || "Family coordination task", day || "tomorrow") });
  } catch (e) { next(e); }
});
app.post("/api/assistant", async (req, res, next) => {
  try {
    const message = req.body?.message;
    if (typeof message !== "string" || !message.trim()) return res.status(400).json({ error: "Please enter a message." });
    const result = await answerAssistant(message.trim(), getStore());
    res.json(result);
  } catch (e) { next(e); }
});
app.post("/api/demo/reset", async (_req, res, next) => {
  try { res.json(await resetStore()); } catch (e) { next(e); }
});
app.all("/mcp", (req, res, next) => {
  if (!["GET", "POST", "DELETE"].includes(req.method)) return res.status(405).end();
  void handleMcp(req, res).catch(next);
});
const clientDist = resolve(process.cwd(), "../client/dist");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(resolve(clientDist, "index.html")));
}
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  const status = /Invalid|must be|cannot be|Please|between|provide/i.test(message) ? 400 : 500;
  if (status === 500) console.error(error);
  res.status(status).json({ error: status === 400 ? message : "Something went wrong. Please retry." });
});
await loadStore();
app.listen(port, host, () => console.log(`CareCircle server listening at http://${host}:${port}`));
