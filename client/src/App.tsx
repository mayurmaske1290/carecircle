import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity, ArrowDownRight, ArrowRight, Bell, CalendarDays, Check, CheckCheck,
  CheckCircle2, ChevronDown, CircleHelp, Clock3, HeartHandshake, Home, ListChecks,
  LoaderCircle, MessageCircle, MoreHorizontal, Plus, Send, Settings2, ShieldCheck,
  Sparkles, Users, X, Zap, Trash2, RotateCcw, CalendarCheck, AlertTriangle, UserRound
} from "lucide-react";
import type { FamilyMember, Plan, Task } from "./types";

type ChatMessage = { role: "assistant" | "user"; text: string; plan?: Plan; taskId?: string };
const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload as T;
};
const localDate = (offsetDays = 1, time = "17:00") => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const localDateTimeValue = (offsetDays = 1, time = "17:00") => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const initialMessages: ChatMessage[] = [
  { role: "assistant", text: "Hi Mayur! I'm CareCircle, your family coordination assistant. I can check availability, resolve scheduling conflicts, and prepare a plan for your approval. What can I help coordinate?" }
];

function App() {
  const [household, setHousehold] = useState<FamilyMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeNav, setActiveNav] = useState("Overview");
  const [toast, setToast] = useState("");
  const [showFamily, setShowFamily] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState(() => localDateTimeValue(1));
  const [taskAssignee, setTaskAssignee] = useState("");
  const [backendOnline, setBackendOnline] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    try {
      const [h, t] = await Promise.all([
        api<{ members: FamilyMember[] }>("/api/household"),
        api<{ tasks: Task[] }>("/api/tasks")
      ]);
      setHousehold(h.members);
      setTasks(t.tasks);
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
      setToast("Backend not connected. Start the app with npm run dev.");
    }
  };
  useEffect(() => { void refresh(); }, []);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const pending = tasks.filter(t => t.status === "pending");
  const completed = tasks.filter(t => t.status === "completed");
  const upcoming = [...pending].sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt)).slice(0, 4);
  const todayLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date());

  const addMessage = (m: ChatMessage) => setMessages(old => [...old, m]);
  const runPrompt = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;
    setInput("");
    addMessage({ role: "user", text: trimmed });
    setLoading(true);
    try {
      const result = await api<{ reply: string; plan?: Plan }>("/api/assistant", {
        method: "POST", body: JSON.stringify({ message: trimmed })
      });
      addMessage({ role: "assistant", text: result.reply, plan: result.plan });
    } catch (e) {
      addMessage({ role: "assistant", text: e instanceof Error ? e.message : "I couldn't process that request. Please try again." });
    } finally {
      setLoading(false);
    }
  };
  const approvePlan = async (plan: Plan) => {
    try {
      const result = await api<{ task: Task }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: plan.title,
          description: plan.description,
          dueAt: plan.dueAt,
          assigneeId: plan.recommendedMemberId
        })
      });
      setTasks(old => [result.task, ...old.filter(t => t.id !== result.task.id)]);
      addMessage({ role: "assistant", text: `Plan approved and saved. ${result.task.title} is assigned to ${result.task.assigneeName}. You can find it in your task list.`, taskId: result.task.id });
      setToast("Plan approved and saved");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Couldn't save plan");
    }
  };
  const completeTask = async (task: Task) => {
    try {
      const result = await api<{ task: Task }>(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status: task.status === "completed" ? "pending" : "completed" }) });
      setTasks(old => old.map(t => t.id === task.id ? result.task : t));
    } catch (e) { setToast(e instanceof Error ? e.message : "Couldn't update task"); }
  };
  const deleteTask = async (id: string) => {
    try {
      await api(`/api/tasks/${id}`, { method: "DELETE" });
      setTasks(old => old.filter(t => t.id !== id));
      setToast("Task deleted");
    } catch (e) { setToast(e instanceof Error ? e.message : "Couldn't delete task"); }
  };
  const addTask = async () => {
    if (!taskTitle.trim()) return;
    try {
      const result = await api<{ task: Task }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ title: taskTitle.trim(), description: "Added from the household dashboard.", dueAt: new Date(taskDue).toISOString(), assigneeId: taskAssignee || null })
      });
      setTasks(old => [result.task, ...old]);
      setShowAddTask(false); setTaskTitle(""); setToast("Task created");
    } catch (e) { setToast(e instanceof Error ? e.message : "Couldn't create task"); }
  };
  const resetDemo = async () => {
    if (!window.confirm("Reset household availability and delete all demo tasks?")) return;
    try {
      await api("/api/demo/reset", { method: "POST" });
      setMessages(initialMessages);
      await refresh();
      setToast("Demo data reset");
    } catch (e) { setToast(e instanceof Error ? e.message : "Reset failed"); }
  };
  const updateAvailability = async (member: FamilyMember, available: boolean) => {
    const updated = household.map(m => m.id === member.id ? { ...m, availability: m.availability.map(a => a.day === "tomorrow" ? { ...a, available } : a) } : m);
    try {
      const result = await api<{ members: FamilyMember[] }>("/api/household", { method: "PUT", body: JSON.stringify({ members: updated }) });
      setHousehold(result.members);
      setToast(`${member.name}'s availability updated`);
    } catch (e) { setToast(e instanceof Error ? e.message : "Couldn't update availability"); }
  };

  const displayTasks = activeNav === "Completed" ? completed : activeNav === "Tasks" ? tasks : upcoming;
  const navItems = [
    { label: "Overview", icon: Home },
    { label: "Assistant", icon: MessageCircle },
    { label: "Tasks", icon: ListChecks },
    { label: "Family", icon: Users }
  ];
  const suggestions = [
    "Dad has an appointment tomorrow at 5 PM. Who can take him?",
    "Help us coordinate a family dinner tomorrow at 7 PM.",
    "I changed the schedule so everyone is busy tomorrow at 5 PM. Suggest another time."
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><HeartHandshake size={22}/></div><div><strong>CareCircle</strong><small>Family, in sync</small></div></div>
        <div className="workspace"><div className="workspace-avatar">M</div><div><strong>Maske Household</strong><small>Demo family</small></div><ChevronDown size={15}/></div>
        <div className="nav-label">WORKSPACE</div>
        <nav>{navItems.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activeNav === label ? "active" : ""}`} onClick={() => { setActiveNav(label); if (label === "Family") setShowFamily(true); }}><Icon size={18}/><span>{label}</span>{label === "Tasks" && pending.length > 0 && <b className="nav-count">{pending.length}</b>}</button>)}</nav>
        <div className="sidebar-bottom">
          <div className="tip-card"><div className="tip-icon"><Sparkles size={17}/></div><strong>Small steps, together.</strong><p>Let CareCircle handle the coordination so your family can focus on each other.</p></div>
          <button className="nav-item" onClick={resetDemo}><RotateCcw size={17}/><span>Reset demo data</span></button>
          <div className="profile"><div className="profile-avatar">MM</div><div><strong>Mayur Maske</strong><small>Household admin</small></div><MoreHorizontal size={18}/></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><HeartHandshake size={21}/> CareCircle</div>
          <div className="breadcrumb">Workspace <span>/</span> <strong>{activeNav}</strong></div>
          <div className="top-actions"><span className={`status-dot ${backendOnline ? "online" : ""}`}></span><span className="connection-label">{backendOnline ? "Connected" : "Offline"}</span><button className="icon-button" title="Notifications" onClick={() => setToast("You're all caught up")}><Bell size={18}/></button><button className="user-chip" onClick={() => setShowFamily(true)}><span>MM</span><ChevronDown size={14}/></button></div>
        </header>

        {activeNav === "Assistant" ? (
          <section className="assistant-page">
            <div className="page-heading"><div><div className="eyebrow"><Sparkles size={14}/> YOUR FAMILY COPILOT</div><h1>Let's figure it out <span>together.</span></h1><p>Tell me what your family needs. I'll find the conflicts and suggest a plan.</p></div><div className="assistant-orb"><HeartHandshake size={30}/></div></div>
            <div className="chat-layout">
              <div className="chat-panel">
                <div className="chat-header"><div className="assistant-avatar"><Sparkles size={18}/></div><div><strong>CareCircle Assistant</strong><small><span className="live-dot"></span> Ready to coordinate</small></div><span className="sim-badge">SIMULATED ALEXA+ EXPERIENCE</span></div>
                <div className="chat-messages">
                  {messages.map((m, i) => <div className={`message-row ${m.role}`} key={i}><div className={`message-avatar ${m.role}`}>{m.role === "assistant" ? <HeartHandshake size={17}/> : "M"}</div><div className="message-content"><div className="message-bubble">{m.text}</div>{m.plan && <PlanCard plan={m.plan} onApprove={() => approvePlan(m.plan!)} onReject={() => addMessage({ role: "assistant", text: "No changes made. Your plan was not saved. You can adjust the request and try again." })}/>}</div></div>)}
                  {loading && <div className="message-row assistant"><div className="message-avatar assistant"><HeartHandshake size={17}/></div><div className="typing"><LoaderCircle size={16} className="spin"/> Checking availability and conflicts…</div></div>}
                  <div ref={chatEnd}/>
                </div>
                <div className="suggestions"><span>TRY ASKING</span>{suggestions.map(s => <button key={s} onClick={() => void runPrompt(s)}>{s}</button>)}</div>
                <form className="chat-composer" onSubmit={e => { e.preventDefault(); void runPrompt(input); }}><button type="button" className="composer-plus" onClick={() => setShowAddTask(true)} title="Add a task"><Plus size={19}/></button><input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask CareCircle to coordinate something…" aria-label="Message CareCircle"/><button className="send-button" disabled={!input.trim() || loading} aria-label="Send message"><Send size={17}/></button></form>
                <div className="chat-disclaimer"><ShieldCheck size={13}/> You approve every plan before it is saved. Demo data only.</div>
              </div>
              <aside className="context-panel"><div className="context-heading"><Users size={17}/><strong>Household context</strong><button onClick={() => setShowFamily(true)}>Edit</button></div>{household.map(m => <div className="member-row" key={m.id}><div className="member-avatar" style={{ background: m.color }}>{m.name.slice(0,1)}</div><div className="member-info"><strong>{m.name}</strong><small>{m.role}</small></div><span className={`availability ${m.availability.some(a => a.day === "tomorrow" && a.available) ? "available" : "busy"}`}>{m.availability.some(a => a.day === "tomorrow" && a.available) ? "Available" : "Busy tomorrow"}</span></div>)}<div className="context-note"><CircleHelp size={16}/><span>Suggestions use your saved demo availability. Always confirm plans with family members.</span></div><div className="context-divider"/><div className="context-heading"><CalendarDays size={17}/><strong>Pending tasks</strong></div>{pending.slice(0, 3).map(t => <div className="mini-task" key={t.id}><span className="mini-task-dot"/><div><strong>{t.title}</strong><small>{t.assigneeName} · {formatDate(t.dueAt)}</small></div></div>)}{pending.length === 0 && <p className="muted-small">No pending tasks yet.</p>}</aside>
            </div>
          </section>
        ) : activeNav === "Family" ? (
          <section className="page-content"><div className="page-heading"><div><div className="eyebrow"><Users size={14}/> YOUR PEOPLE</div><h1>One circle. <span>Many hands.</span></h1><p>Manage the demo availability used to recommend family assignments.</p></div><button className="primary-button" onClick={() => setShowFamily(true)}><Settings2 size={16}/> Edit availability</button></div><div className="family-grid">{household.map(m => <div className="family-card" key={m.id}><div className="family-card-top"><div className="member-avatar large" style={{ background: m.color }}>{m.name[0]}</div><span className="pill neutral">{m.role}</span></div><h3>{m.name}</h3><p>Tomorrow's schedule</p><div className="availability-line"><Clock3 size={15}/>{m.availability.find(a => a.day === "tomorrow")?.start || "—"} – {m.availability.find(a => a.day === "tomorrow")?.end || "—"}</div><span className={`availability ${m.availability.some(a => a.day === "tomorrow" && a.available) ? "available" : "busy"}`}>{m.availability.some(a => a.day === "tomorrow" && a.available) ? "Available" : "Unavailable"}</span><button className="text-button" onClick={() => updateAvailability(m, !m.availability.some(a => a.day === "tomorrow" && a.available))}>Toggle availability <ArrowRight size={14}/></button></div>)}</div></section>
        ) : (
          <section className="page-content">
            <div className="welcome-row"><div><div className="eyebrow"><span className="live-dot"></span> YOUR FAMILY, IN SYNC</div><h1>{activeNav === "Tasks" ? "Everything on the list." : "Good evening, Mayur"} <span>{activeNav === "Tasks" ? "" : "👋"}</span></h1><p>{activeNav === "Tasks" ? "Keep the little things moving." : `${todayLabel} · One less thing to coordinate alone.`}</p></div><button className="primary-button" onClick={() => setShowAddTask(true)}><Plus size={17}/> Add a task</button></div>
            <div className="hero-card"><div className="hero-copy"><div className="hero-pill"><Sparkles size={13}/> YOUR FAMILY COPILOT</div><h2>Better days start<br/>with <span>a little teamwork.</span></h2><p>Let CareCircle help you coordinate the details, spot conflicts, and make time for what matters.</p><button className="hero-button" onClick={() => setActiveNav("Assistant")}>Talk to CareCircle <ArrowRight size={16}/></button><div className="hero-trust"><ShieldCheck size={14}/> You stay in control of every decision</div></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit-center"><HeartHandshake size={42}/></div><div className="float-card float-card-one"><div className="float-icon mint"><CalendarCheck size={17}/></div><div><strong>Appointment</strong><small>Tomorrow · 5:00 PM</small></div><CheckCircle2 size={17} className="float-check"/></div><div className="float-card float-card-two"><div className="float-icon lavender"><Users size={17}/></div><div><strong>Family plan ready</strong><small>Waiting for approval</small></div></div><div className="art-sparkle sparkle-one">✦</div><div className="art-sparkle sparkle-two">✧</div></div></div>
            <div className="section-title-row"><div><h2>At a glance</h2><p>Your household's coordination snapshot</p></div><button className="subtle-button" onClick={() => void refresh()}>Refresh <RotateCcw size={14}/></button></div>
            <div className="stats-grid"><Stat icon={<ListChecks size={19}/>} label="Pending tasks" value={pending.length} foot="Ready to be handled" color="blue"/><Stat icon={<CheckCheck size={19}/>} label="Completed" value={completed.length} foot="Little wins add up" color="green"/><Stat icon={<Users size={19}/>} label="Family members" value={household.length} foot="In your household" color="purple"/><Stat icon={<Activity size={19}/>} label="Coordination score" value={pending.length + completed.length ? `${Math.round(completed.length / (pending.length + completed.length) * 100)}%` : "—"} foot="Based on demo tasks" color="orange"/></div>
            <div className="dashboard-grid"><div className="panel task-panel"><div className="panel-heading"><div><h2>{activeNav === "Tasks" ? "All tasks" : "Coming up"}</h2><p>Your next shared responsibilities</p></div><button className="link-button" onClick={() => setActiveNav("Tasks")}>View all <ArrowRight size={14}/></button></div>{displayTasks.length ? displayTasks.map(t => <TaskRow key={t.id} task={t} onToggle={() => void completeTask(t)} onDelete={() => void deleteTask(t.id)}/>) : <div className="empty-state"><div className="empty-icon"><CalendarDays size={23}/></div><strong>Nothing on the list yet</strong><p>Ask CareCircle to coordinate a family task, or add one yourself.</p><button className="text-button" onClick={() => setActiveNav("Assistant")}>Start a conversation <ArrowRight size={14}/></button></div>}</div>
              <div className="panel family-panel"><div className="panel-heading"><div><h2>Your people</h2><p>Demo household availability</p></div><button className="icon-button small" onClick={() => setShowFamily(true)}><MoreHorizontal size={17}/></button></div>{household.map(m => <div className="member-row" key={m.id}><div className="member-avatar" style={{ background: m.color }}>{m.name.slice(0,1)}</div><div className="member-info"><strong>{m.name}</strong><small>{m.role}</small></div><span className={`availability ${m.availability.some(a => a.day === "tomorrow" && a.available) ? "available" : "busy"}`}>{m.availability.some(a => a.day === "tomorrow" && a.available) ? "Available" : "Busy"}</span></div>)}<button className="outline-button full" onClick={() => setShowFamily(true)}><Users size={15}/> Manage availability</button></div></div>
            <div className="bottom-note"><div className="note-icon"><ShieldCheck size={18}/></div><div><strong>Your circle, your call.</strong><p>CareCircle suggests. You decide. Plans are only saved after you approve them.</p></div><button onClick={() => setActiveNav("Assistant")}>Learn how it works <ArrowRight size={14}/></button></div>
          </section>
        )}
      </main>

      {showFamily && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowFamily(false); }}><div className="modal"><div className="modal-head"><div><h2>Household availability</h2><p>Toggle availability for tomorrow's demo schedule.</p></div><button className="icon-button" onClick={() => setShowFamily(false)}><X size={18}/></button></div><div className="modal-body">{household.map(m => <div className="availability-editor" key={m.id}><div className="member-avatar" style={{ background: m.color }}>{m.name[0]}</div><div className="member-info"><strong>{m.name}</strong><small>{m.role} · {m.availability.find(a => a.day === "tomorrow")?.start}–{m.availability.find(a => a.day === "tomorrow")?.end}</small></div><button className={`toggle ${m.availability.some(a => a.day === "tomorrow" && a.available) ? "on" : ""}`} onClick={() => void updateAvailability(m, !m.availability.some(a => a.day === "tomorrow" && a.available))} aria-label={`Toggle ${m.name} availability`}><span/></button></div>)}</div><div className="modal-footer"><button className="outline-button" onClick={() => setShowFamily(false)}>Close</button></div></div></div>}
      {showAddTask && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowAddTask(false); }}><form className="modal" onSubmit={e => { e.preventDefault(); void addTask(); }}><div className="modal-head"><div><h2>Add a family task</h2><p>Create a task directly in your shared list.</p></div><button type="button" className="icon-button" onClick={() => setShowAddTask(false)}><X size={18}/></button></div><div className="modal-body form-fields"><label>Task name<input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="e.g. Pick up groceries" required/></label><label>Due date and time<input type="datetime-local" value={taskDue} onChange={e => setTaskDue(e.target.value)} required/></label><label>Assign to<select value={taskAssignee} onChange={e => setTaskAssignee(e.target.value)}><option value="">Unassigned</option>{household.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label></div><div className="modal-footer"><button type="button" className="outline-button" onClick={() => setShowAddTask(false)}>Cancel</button><button className="primary-button" type="submit"><Plus size={15}/> Create task</button></div></form></div>}
      {toast && <div className="toast"><CheckCircle2 size={17}/>{toast}<button onClick={() => setToast("")}><X size={15}/></button></div>}
    </div>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(date));
}
function Stat({ icon, label, value, foot, color }: { icon: ReactNode; label: string; value: string | number; foot: string; color: string }) {
  return <div className="stat-card"><div className={`stat-icon ${color}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-foot">{foot}</div></div>;
}
function TaskRow({ task, onToggle, onDelete }: { task: Task; onToggle: () => void; onDelete: () => void }) {
  return <div className={`task-row ${task.status === "completed" ? "done" : ""}`}><button className={`task-check ${task.status === "completed" ? "checked" : ""}`} onClick={onToggle} aria-label="Toggle task completion">{task.status === "completed" && <Check size={14}/>}</button><div className="task-main"><strong>{task.title}</strong><small>{task.assigneeName || "Unassigned"} <span>·</span> {formatDate(task.dueAt)}</small></div><span className={`pill ${task.status === "completed" ? "success" : "neutral"}`}>{task.status === "completed" ? "Completed" : "Pending"}</span><button className="row-delete" onClick={onDelete} aria-label="Delete task"><Trash2 size={15}/></button></div>;
}
function PlanCard({ plan, onApprove, onReject }: { plan: Plan; onApprove: () => void; onReject: () => void }) {
  return <div className="plan-card"><div className="plan-card-title"><div className="plan-icon"><CalendarCheck size={18}/></div><div><strong>Proposed family plan</strong><small>Review before saving</small></div><span className={`pill ${plan.conflict ? "warning" : "success"}`}>{plan.conflict ? "Conflict resolved" : "Suggested"}</span></div><h3>{plan.title}</h3><p>{plan.description}</p><div className="plan-assignee"><div className="assignee-avatar">{plan.recommendedMemberName ? plan.recommendedMemberName[0] : "?"}</div><div><small>RECOMMENDED FOR</small><strong>{plan.recommendedMemberName || "No available member"}</strong></div><span className="plan-time"><Clock3 size={14}/>{formatDate(plan.dueAt)}</span></div>{plan.reasoning.length > 0 && <div className="reasoning-list">{plan.reasoning.map((r,i) => <div key={i}><CheckCircle2 size={14}/>{r}</div>)}</div>}{plan.alternatives.length > 0 && <div className="alternatives"><strong>Other options</strong>{plan.alternatives.map((a,i) => <div key={i}><ArrowDownRight size={14}/>{a}</div>)}</div>}{plan.recommendedMemberId ? <div className="plan-actions"><button className="outline-button" onClick={onReject}>Not now</button><button className="primary-button" onClick={onApprove}><Check size={16}/> Approve plan</button></div> : <div className="no-assignee"><AlertTriangle size={16}/> No one is marked available. Update availability or choose another time.</div>}</div>;
}

export default App;
