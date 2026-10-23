export type FamilyMember = {
  id: string;
  name: string;
  role: string;
  color: string;
  availability: { day: string; start: string; end: string; available: boolean }[];
};
export type Task = {
  id: string;
  title: string;
  description: string;
  assigneeId: string | null;
  assigneeName: string;
  dueAt: string;
  status: "pending" | "completed";
  createdAt: string;
};
export type Plan = {
  title: string;
  description: string;
  dueAt: string;
  recommendedMemberId: string | null;
  recommendedMemberName: string;
  reasoning: string[];
  alternatives: string[];
  conflict: boolean;
};
