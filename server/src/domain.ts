import { randomUUID } from "node:crypto";

export type Availability = { day: string; start: string; end: string; available: boolean };
export type FamilyMember = { id: string; name: string; role: string; color: string; availability: Availability[] };
export type Task = { id: string; title: string; description: string; assigneeId: string | null; assigneeName: string; dueAt: string; status: "pending" | "completed"; createdAt: string };
export type Plan = { title: string; description: string; dueAt: string; recommendedMemberId: string | null; recommendedMemberName: string; reasoning: string[]; alternatives: string[]; conflict: boolean };
export type Store = { members: FamilyMember[]; tasks: Task[] };

export const seedMembers = (): FamilyMember[] => [
  { id: "mayur", name: "Mayur", role: "You", color: "#5b8fe6", availability: [{ day: "tomorrow", start: "16:00", end: "18:00", available: false }] },
  { id: "sister", name: "Sister", role: "Family member", color: "#b18be5", availability: [{ day: "tomorrow", start: "16:00", end: "20:00", available: true }] },
  { id: "mother", name: "Mother", role: "Family member", color: "#e5a66e", availability: [{ day: "tomorrow", start: "15:00", end: "19:00", available: false }] }
];
export const emptyStore = (): Store => ({ members: seedMembers(), tasks: [] });
export function timeToMinutes(value: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) throw new Error(`Invalid time: ${value}`);
  const h = Number(m[1]), minute = Number(m[2]);
  if (h < 0 || h > 23 || minute < 0 || minute > 59) throw new Error(`Invalid time: ${value}`);
  return h * 60 + minute;
}
export function overlaps(startA: string, endA: string, startB: string, endB: string): boolean {
  return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(startB) < timeToMinutes(endA);
}
export function isMemberAvailable(member: FamilyMember, time: string, durationMinutes = 60, day = "tomorrow"): boolean {
  const minute = timeToMinutes(time);
  const end = minute + durationMinutes;
  if (end > 24 * 60) return false;
  const blocks = member.availability.filter(a => a.day === day && !a.available);
  return !blocks.some(a => minute < timeToMinutes(a.end) && timeToMinutes(a.start) < end);
}
export function proposePlan(store: Store, requestedTime: string, requestTitle = "Family appointment", day = "tomorrow"): Plan {
  const time = requestedTime;
  const startMin = timeToMinutes(time);
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + (day === "today" ? 0 : 1));
  dueAt.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
  const dueIso = dueAt.toISOString();
  const candidates = store.members.map(m => ({ member: m, available: isMemberAvailable(m, time, 60, day) }));
  const chosen = candidates.find(c => c.available)?.member;
  const blocked = candidates.filter(c => !c.available).map(c => c.member.name);
  const availableNames = candidates.filter(c => c.available).map(c => c.member.name);
  const hour = Math.floor(startMin / 60), minute = startMin % 60;
  const end = startMin + 60;
  const endLabel = `${String(Math.floor(end / 60) % 24).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
  const reasoning = chosen ? [
    `${chosen.name} has no conflicting busy block at ${time}.`,
    ...(blocked.length ? [`${blocked.join(" and ")} ${blocked.length === 1 ? "is" : "are"} unavailable during the requested hour.`] : []),
    "This is a recommendation based on the saved demo schedule; confirm directly with the person."
  ] : [
    `No household member is available for the full hour starting at ${time}.`,
    "No assignment has been made. Choose another time or update availability."
  ];
  const alternatives: string[] = [];
  if (!chosen) {
    const candidates = Array.from({ length: 25 }, (_, i) => 8 * 60 + i * 30)
      .filter(t => t >= 8 * 60 && t + 60 <= 21 * 60 && t !== startMin)
      .sort((a, b) => Math.abs(a - startMin) - Math.abs(b - startMin));
    for (const t of candidates) {
      const label = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
      const free = store.members.find(m => isMemberAvailable(m, label, 60, day));
      if (free) alternatives.push(`${label} — ${free.name} appears available`);
      if (alternatives.length >= 3) break;
    }
  } else if (availableNames.length > 1) {
    alternatives.push(...availableNames.filter(n => n !== chosen.name).map(n => `${n} is also available`));
  }
  return {
    title: requestTitle,
    description: `Proposed for ${day} at ${time}–${endLabel}. Review the recommendation before saving.`,
    dueAt: dueIso,
    recommendedMemberId: chosen?.id ?? null,
    recommendedMemberName: chosen?.name ?? "No available member",
    reasoning,
    alternatives,
    conflict: blocked.length > 0
  };
}
export function createTask(store: Store, input: { title: string; description?: string; dueAt: string; assigneeId?: string | null }): Task {
  const title = input.title.trim();
  if (!title || title.length > 160) throw new Error("Task title must be between 1 and 160 characters.");
  const date = new Date(input.dueAt);
  if (!input.dueAt || Number.isNaN(date.getTime())) throw new Error("Please provide a valid due date and time.");
  if (date.getTime() < Date.now() - 60_000) throw new Error("Task due time cannot be in the past.");
  const member = input.assigneeId ? store.members.find(m => m.id === input.assigneeId) : undefined;
  if (input.assigneeId && !member) throw new Error("Selected assignee was not found.");
  return { id: randomUUID(), title, description: (input.description ?? "").slice(0, 1000), assigneeId: member?.id ?? null, assigneeName: member?.name ?? "Unassigned", dueAt: date.toISOString(), status: "pending", createdAt: new Date().toISOString() };
}
export function parseRequest(message: string): { title: string; time: string; day: "today" | "tomorrow" } {
  const lower = message.toLowerCase();
  const day: "today" | "tomorrow" = /\btoday\b/.test(lower) ? "today" : "tomorrow";
  const match = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) || lower.match(/\b(\d{1,2}):(\d{2})\b/);
  let time = "17:00";
  if (match) {
    let hour = Number(match[1]);
    const mins = Number(match[2] ?? "0");
    const meridiem = match[3];
    if (mins > 59 || hour > 23 || hour < 0 || (meridiem && (hour < 1 || hour > 12))) throw new Error("Please specify a valid time, such as 5 PM or 17:00.");
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    time = `${String(hour).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  }
  const title = /\b(grocer|shopping|shop)\b/.test(lower) ? "Pick up groceries" : /\b(dinner|meal)\b/.test(lower) ? "Prepare for family dinner" : /\b(transport|take|drive|appointment|doctor|dad|father)\b/.test(lower) ? "Help with appointment transportation" : "Family coordination task";
  return { title, time, day };
}
