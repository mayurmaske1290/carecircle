import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { createTask, isMemberAvailable, proposePlan, timeToMinutes } from "./domain.js";
import { getStore, updateStore } from "./store.js";
import type { Request, Response } from "express";

function createMcpServer() {
  const server = new McpServer({ name: "carecircle", version: "1.0.0" });
  server.tool("get_household", "Return the demo household and saved availability. This is sample data.", {}, async () => {
    const store = getStore();
    return { content: [{ type: "text", text: JSON.stringify({ members: store.members }, null, 2) }], structuredContent: { members: store.members } };
  });
  server.tool("check_availability", "Check which demo household members have no saved busy block for a time. Day supports today or tomorrow.", {
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).describe("Local time in HH:MM 24-hour format"),
    durationMinutes: z.number().int().min(15).max(240).default(60),
    day: z.enum(["today", "tomorrow"]).default("tomorrow")
  }, async ({ time, durationMinutes, day }) => {
    timeToMinutes(time);
    const members = getStore().members;
    const result = members.map(m => ({ id: m.id, name: m.name, available: isMemberAvailable(m, time, durationMinutes, day) }));
    return { content: [{ type: "text", text: JSON.stringify({ day, time, durationMinutes, members: result }, null, 2) }], structuredContent: { day, time, durationMinutes, members: result } };
  });
  server.tool("propose_family_plan", "Create a proposed family coordination plan from the demo schedule. Does not save a task or contact anyone.", {
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).describe("Local time in HH:MM 24-hour format"),
    title: z.string().min(1).max(160).default("Family appointment"),
    day: z.enum(["today", "tomorrow"]).default("tomorrow")
  }, async ({ time, title, day }) => {
    const plan = proposePlan(getStore(), time, title, day);
    return { content: [{ type: "text", text: JSON.stringify(plan, null, 2) }], structuredContent: plan };
  });
  server.tool("create_task", "Create a task after the user has explicitly approved the proposed plan. This tool persists a task in the demo store.", {
    title: z.string().min(1).max(160),
    dueAt: z.string().datetime(),
    description: z.string().max(1000).default(""),
    assigneeId: z.string().nullable().optional()
  }, async ({ title, dueAt, description, assigneeId }) => {
    let created;
    await updateStore(store => { created = createTask(store, { title, dueAt, description, assigneeId }); store.tasks.unshift(created); return store; });
    return { content: [{ type: "text", text: JSON.stringify(created, null, 2) }], structuredContent: created! };
  });
  server.tool("list_tasks", "List saved demo household tasks, optionally filtered by status.", {
    status: z.enum(["pending", "completed", "all"]).default("all")
  }, async ({ status }) => {
    const tasks = getStore().tasks.filter(t => status === "all" || t.status === status);
    return { content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }], structuredContent: { tasks } };
  });
  server.tool("complete_task", "Mark a saved task as completed by its task ID.", {
    taskId: z.string().min(1)
  }, async ({ taskId }) => {
    let found = false;
    let updated;
    await updateStore(store => {
      const task = store.tasks.find(t => t.id === taskId);
      if (task) { task.status = "completed"; found = true; updated = task; }
      return store;
    });
    if (!found) return { isError: true, content: [{ type: "text", text: "Task not found." }] };
    return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }], structuredContent: updated! };
  });
  return server;
}

export async function handleMcp(req: Request, res: Response): Promise<void> {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createMcpServer();
  res.on("close", () => { void transport.close(); void server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP request failed", error);
    if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal MCP server error" }, id: null });
  }
}
