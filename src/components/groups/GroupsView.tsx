import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { ArrowLeft, Plus, UserPlus, Trash2, Pencil, Users as UsersIcon } from "lucide-react";

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
};

type MemberRow = {
  id: string;
  group_id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
};

type InviteRow = {
  id: string;
  group_id: string;
  invited_email: string;
  invited_by: string;
  status: string;
};

type TaskRow = {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  created_by: string;
  status: "todo" | "inprogress" | "done";
  pts: number;
  priority: "low" | "medium" | "high";
  due_date: string | null;
  position: number;
  section_id: string | null;
  deleted: boolean;
};

type SectionRow = {
  id: string;
  group_id: string;
  label: string;
  color: string;
};

type WeeklyPoints = {
  user_id: string;
  points: number;
  tasks_done: number;
  week_start: string;
};

function isoMondayOf(d = new Date()): string {
  const dt = new Date(d);
  const day = (dt.getDay() + 6) % 7; // Mon=0
  dt.setDate(dt.getDate() - day);
  dt.setHours(0, 0, 0, 0);
  return dt.toISOString().slice(0, 10);
}

/* ================================================================== */
export function GroupsView({
  user,
  selectedGroupId,
  setSelectedGroupId,
}: {
  user: User;
  selectedGroupId: string | null;
  setSelectedGroupId: (id: string | null) => void;
}) {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [membersByGroup, setMembersByGroup] = useState<Record<string, MemberRow[]>>({});
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const email = (user.email ?? "").toLowerCase();

  const loadAll = async () => {
    const { data: gs } = await supabase.from("groups").select("*").order("created_at");
    setGroups((gs ?? []) as GroupRow[]);
    if (gs && gs.length) {
      const ids = gs.map((g) => g.id);
      const { data: mem } = await supabase.from("group_members").select("*").in("group_id", ids);
      const byG: Record<string, MemberRow[]> = {};
      const mCount: Record<string, number> = {};
      for (const m of (mem ?? []) as MemberRow[]) {
        (byG[m.group_id] ||= []).push(m);
        mCount[m.group_id] = (mCount[m.group_id] ?? 0) + 1;
      }
      setMembersByGroup(byG);
      setMemberCounts(mCount);
      const { data: tk } = await supabase
        .from("group_tasks")
        .select("group_id")
        .in("group_id", ids)
        .eq("deleted", false);
      const tCount: Record<string, number> = {};
      for (const t of tk ?? []) tCount[t.group_id] = (tCount[t.group_id] ?? 0) + 1;
      setTaskCounts(tCount);
    }
    if (email) {
      const { data: inv } = await supabase
        .from("group_invitations")
        .select("*")
        .eq("status", "pending")
        .ilike("invited_email", email);
      setInvites((inv ?? []) as InviteRow[]);
    }
  };

  useEffect(() => {
    loadAll();
    const ch = supabase
      .channel(`groups-view:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_invitations" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_tasks" }, loadAll)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, email]);

  const acceptInvite = async (inv: InviteRow) => {
    // Ensure a group exists to fetch name (best effort — no-op if not visible)
    const { error } = await supabase.from("group_members").insert({
      group_id: inv.group_id,
      user_id: user.id,
      email: user.email,
      display_name:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        user.email ??
        "Member",
      avatar_url:
        (user.user_metadata?.avatar_url as string | undefined) ??
        (user.user_metadata?.picture as string | undefined) ??
        null,
      role: "member",
    });
    if (error) {
      alert(`Could not accept: ${error.message}`);
      return;
    }
    await supabase.from("group_invitations").update({ status: "accepted" }).eq("id", inv.id);
    loadAll();
  };

  const declineInvite = async (inv: InviteRow) => {
    await supabase.from("group_invitations").update({ status: "declined" }).eq("id", inv.id);
    loadAll();
  };

  if (selectedGroupId) {
    const g = groups.find((x) => x.id === selectedGroupId);
    return (
      <GroupDetail
        user={user}
        groupId={selectedGroupId}
        groupName={g?.name ?? "Group"}
        isOwner={g?.owner_id === user.id}
        onBack={() => {
          setSelectedGroupId(null);
          loadAll();
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Groups</h1>
          <p className="text-sm text-muted-foreground">
            Collaborate on shared tasks with your team.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Create Group
        </button>
      </header>

      {invites.map((inv) => (
        <div
          key={inv.id}
          className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm"
        >
          <span>
            <b>{inv.invited_by.slice(0, 8)}</b> invited you to join a group.
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => acceptInvite(inv)}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            >
              Accept
            </button>
            <button
              onClick={() => declineInvite(inv)}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium"
            >
              Decline
            </button>
          </div>
        </div>
      ))}

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          <UsersIcon className="mx-auto mb-3 h-10 w-10 opacity-40" />
          No groups yet. Create one or wait for an invitation.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((g) => {
            const ms = membersByGroup[g.id] ?? [];
            return (
              <button
                key={g.id}
                onClick={() => setSelectedGroupId(g.id)}
                className="rounded-lg border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{g.name}</h3>
                    {g.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {g.description}
                      </p>
                    )}
                  </div>
                  {g.owner_id === user.id && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Owner
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {ms.slice(0, 5).map((m) => (
                      <Avatar key={m.id} m={m} />
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {memberCounts[g.id] ?? 0} members · {taskCounts[g.id] ?? 0} tasks
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateGroupModal
          user={user}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            loadAll();
          }}
        />
      )}
    </div>
  );
}

/* ================================================================== */
function Avatar({
  m,
  size = 24,
}: {
  m: Pick<MemberRow, "display_name" | "avatar_url">;
  size?: number;
}) {
  const initials = (m.display_name ?? "?")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return m.avatar_url ? (
    <img
      src={m.avatar_url}
      alt={m.display_name ?? ""}
      className="rounded-full border border-background object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="flex items-center justify-center rounded-full border border-background bg-secondary text-[10px] font-semibold text-secondary-foreground"
      style={{ width: size, height: size }}
    >
      {initials || "?"}
    </div>
  );
}

/* ================================================================== */
function CreateGroupModal({
  user,
  onClose,
  onCreated,
}: {
  user: User;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await supabase
      .from("groups")
      .insert({ name: name.trim(), description: desc.trim() || null, owner_id: user.id });
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    onCreated();
  };
  return (
    <Modal onClose={onClose} title="Create Group">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium">Name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Marketing Team"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Description (optional)</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="What is this group for?"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !name.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ================================================================== */
function GroupDetail({
  user,
  groupId,
  groupName,
  isOwner,
  onBack,
}: {
  user: User;
  groupId: string;
  groupName: string;
  isOwner: boolean;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<"tasks" | "members" | "sections" | "leaderboard">("tasks");
  const [taskMode, setTaskMode] = useState<"individual" | "board">("individual");
  const [showInvite, setShowInvite] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);

  const deleteGroup = async () => {
    if (
      !confirm(
        `Delete ${groupName}? This will permanently remove the group, all its tasks, and remove access for all members. This cannot be undone.`,
      )
    )
      return;
    const { error } = await supabase.from("groups").delete().eq("id", groupId);
    if (error) {
      alert(`Failed to delete: ${error.message}`);
      return;
    }
    onBack();
  };

  const leaveGroup = async () => {
    if (!confirm(`Leave ${groupName}? You will lose access to this group's tasks.`)) return;
    const { error } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", user.id);
    if (error) {
      alert(`Failed to leave: ${error.message}`);
      return;
    }
    onBack();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <h1 className="text-xl font-bold sm:text-2xl">{groupName}</h1>
        </div>
        {tab === "tasks" && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-md border border-border">
              {(["individual", "board"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setTaskMode(m)}
                  className={`px-3 py-1.5 text-xs font-medium capitalize ${
                    taskMode === m
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {m === "individual" ? "Individual View" : "Board View"}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAddTask(true)}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> Add Task
            </button>
            <button
              onClick={() => setShowInvite(true)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              <UserPlus className="h-3.5 w-3.5" /> Add People
            </button>
            {isOwner ? (
              <button
                onClick={deleteGroup}
                className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/20 dark:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete Group
              </button>
            ) : (
              <button
                onClick={leaveGroup}
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Leave Group
              </button>
            )}
          </div>
        )}
      </div>
      <div className="mb-4 flex gap-1 border-b border-border">
        {(["tasks", "members", "sections", "leaderboard"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "tasks" && taskMode === "board" && <GroupBoard user={user} groupId={groupId} />}
      {tab === "tasks" && taskMode === "individual" && (
        <GroupIndividual user={user} groupId={groupId} />
      )}
      {tab === "members" && <GroupMembers user={user} groupId={groupId} isOwner={isOwner} />}
      {tab === "sections" && <GroupSections groupId={groupId} isOwner={isOwner} />}
      {tab === "leaderboard" && <GroupLeaderboard groupId={groupId} />}

      {showInvite && (
        <InviteModal user={user} groupId={groupId} onClose={() => setShowInvite(false)} />
      )}
      {showAddTask && (
        <QuickAddTaskModal user={user} groupId={groupId} onClose={() => setShowAddTask(false)} />
      )}
    </div>
  );
}

/* ================================================================== */
function GroupBoard({ user, groupId }: { user: User; groupId: string }) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    const [{ data: tk }, { data: mem }] = await Promise.all([
      supabase.from("group_tasks").select("*").eq("group_id", groupId).eq("deleted", false),
      supabase.from("group_members").select("*").eq("group_id", groupId),
    ]);
    setTasks((tk ?? []) as TaskRow[]);
    setMembers((mem ?? []) as MemberRow[]);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`board:${groupId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_tasks", filter: `group_id=eq.${groupId}` },
        (payload) => {
          load();
          const n = payload.new as TaskRow | undefined;
          const o = payload.old as TaskRow | undefined;
          if (n && o && n.status !== o.status && n.created_by !== user.id) {
            const label =
              n.status === "inprogress" ? "In Progress" : n.status === "done" ? "Done" : "To Do";
            setToast(`Task "${n.title}" moved to ${label}`);
            setTimeout(() => setToast(null), 3000);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members", filter: `group_id=eq.${groupId}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, user.id]);

  const cols: { key: TaskRow["status"]; label: string }[] = [
    { key: "todo", label: "📋 To Do" },
    { key: "inprogress", label: "🔄 In Progress" },
    { key: "done", label: "✅ Done" },
  ];

  const onDragEnd = async (e: DragEndEvent) => {
    const taskId = e.active.id as string;
    const overId = e.over?.id as string | undefined;
    if (!overId) return;
    const newStatus = overId as TaskRow["status"];
    const t = tasks.find((x) => x.id === taskId);
    if (!t || t.status === newStatus) return;
    setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, status: newStatus } : x)));
    await supabase.from("group_tasks").update({ status: newStatus }).eq("id", taskId);
    if (newStatus === "done" && t.status !== "done" && t.assigned_to) {
      const wk = isoMondayOf();
      const { data: existing } = await supabase
        .from("group_weekly_points")
        .select("*")
        .eq("group_id", groupId)
        .eq("user_id", t.assigned_to)
        .eq("week_start", wk)
        .maybeSingle();
      if (existing) {
        if (t.assigned_to === user.id) {
          await supabase
            .from("group_weekly_points")
            .update({
              points: (existing as WeeklyPoints).points + t.pts,
              tasks_done: (existing as WeeklyPoints).tasks_done + 1,
            })
            .eq("group_id", groupId)
            .eq("user_id", t.assigned_to)
            .eq("week_start", wk);
        }
      } else if (t.assigned_to === user.id) {
        await supabase.from("group_weekly_points").insert({
          group_id: groupId,
          user_id: user.id,
          week_start: wk,
          points: t.pts,
          tasks_done: 1,
        });
      }
    }
  };

  return (
    <DndContext onDragEnd={onDragEnd}>
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-xs font-medium text-background shadow-lg">
          {toast}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        {cols.map((c) => (
          <Column
            key={c.key}
            id={c.key}
            label={c.label}
            tasks={tasks.filter((t) => t.status === c.key)}
            members={members}
            onEdit={(t) => setEditing(t)}
            onAdd={async (title) => {
              await supabase.from("group_tasks").insert({
                group_id: groupId,
                title,
                created_by: user.id,
                status: c.key,
                pts: 5,
                priority: "medium",
                position: tasks.length,
              });
            }}
          />
        ))}
      </div>
      {editing && (
        <TaskModal user={user} task={editing} members={members} onClose={() => setEditing(null)} />
      )}
    </DndContext>
  );
}

function Column({
  id,
  label,
  tasks,
  members,
  onEdit,
  onAdd,
}: {
  id: TaskRow["status"];
  label: string;
  tasks: TaskRow[];
  members: MemberRow[];
  onEdit: (t: TaskRow) => void;
  onAdd: (title: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border border-border bg-card p-3 ${isOver ? "ring-2 ring-primary" : ""}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium">
          {tasks.length}
        </span>
      </div>
      <div className="space-y-2">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} members={members} onEdit={() => onEdit(t)} />
        ))}
      </div>
      {adding ? (
        <div className="mt-2 space-y-2">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && title.trim()) {
                onAdd(title.trim());
                setTitle("");
                setAdding(false);
              }
            }}
            placeholder="Task title…"
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setAdding(false);
                setTitle("");
              }}
              className="rounded-md px-2 py-1 text-xs"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (title.trim()) {
                  onAdd(title.trim());
                  setTitle("");
                  setAdding(false);
                }
              }}
              className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
            >
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Add Task
        </button>
      )}
    </div>
  );
}

function TaskCard({
  task,
  members,
  onEdit,
}: {
  task: TaskRow;
  members: MemberRow[];
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });
  const style: React.CSSProperties = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : {};
  const assignee = members.find((m) => m.user_id === task.assigned_to);
  const priColor =
    task.priority === "high"
      ? "bg-red-500/15 text-red-600 dark:text-red-400"
      : task.priority === "medium"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
        : "bg-gray-500/15 text-gray-600 dark:text-gray-400";
  const ptsColor =
    task.status === "done"
      ? "bg-green-500/15 text-green-700 dark:text-green-400"
      : "bg-secondary text-secondary-foreground";
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group cursor-grab rounded-md border border-border bg-background p-2.5 shadow-sm active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{task.title}</p>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="opacity-0 transition group-hover:opacity-100"
        >
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${priColor}`}>
          {task.priority}
        </span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${ptsColor}`}>
          {task.pts} pts
        </span>
        {task.due_date && (
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">{task.due_date}</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {assignee ? (
            <>
              <Avatar m={assignee} size={18} />
              <span className="text-[10px] text-muted-foreground">
                {assignee.display_name?.split(" ")[0]}
              </span>
            </>
          ) : (
            <span className="text-[10px] text-muted-foreground">Unassigned</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
function TaskModal({
  user,
  task,
  members,
  onClose,
}: {
  user: User;
  task: TaskRow;
  members: MemberRow[];
  onClose: () => void;
}) {
  const [t, setT] = useState<TaskRow>(task);
  void user;
  const save = async () => {
    await supabase
      .from("group_tasks")
      .update({
        title: t.title,
        description: t.description,
        assigned_to: t.assigned_to,
        priority: t.priority,
        pts: t.pts,
        due_date: t.due_date,
        status: t.status,
      })
      .eq("id", t.id);
    onClose();
  };
  const del = async () => {
    if (!confirm("Delete this task?")) return;
    await supabase.from("group_tasks").update({ deleted: true }).eq("id", t.id);
    onClose();
  };
  return (
    <Modal onClose={onClose} title="Edit Task">
      <div className="space-y-3">
        <input
          value={t.title}
          onChange={(e) => setT({ ...t, title: e.target.value })}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-medium"
        />
        <textarea
          value={t.description ?? ""}
          onChange={(e) => setT({ ...t, description: e.target.value })}
          rows={3}
          placeholder="Description"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Assign to</label>
            <select
              value={t.assigned_to ?? ""}
              onChange={(e) => setT({ ...t, assigned_to: e.target.value || null })}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.user_id}>
                  {m.display_name ?? m.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Status</label>
            <select
              value={t.status}
              onChange={(e) => setT({ ...t, status: e.target.value as TaskRow["status"] })}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="todo">To Do</option>
              <option value="inprogress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Priority</label>
            <select
              value={t.priority}
              onChange={(e) => setT({ ...t, priority: e.target.value as TaskRow["priority"] })}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Points</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setT({ ...t, pts: Math.max(1, t.pts - 1) })}
                className="h-8 w-8 rounded-md border border-border"
              >
                −
              </button>
              <span className="w-8 text-center text-sm font-medium">{t.pts}</span>
              <button
                onClick={() => setT({ ...t, pts: Math.min(20, t.pts + 1) })}
                className="h-8 w-8 rounded-md border border-border"
              >
                +
              </button>
            </div>
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium">Due date</label>
            <input
              type="date"
              value={t.due_date ?? ""}
              onChange={(e) => setT({ ...t, due_date: e.target.value || null })}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
        </div>
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={del}
            className="inline-flex items-center gap-1 rounded-md border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-border px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ================================================================== */
function GroupMembers({
  user,
  groupId,
  isOwner,
}: {
  user: User;
  groupId: string;
  isOwner: boolean;
}) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [showInvite, setShowInvite] = useState(false);

  const load = async () => {
    const [{ data: m }, { data: t }] = await Promise.all([
      supabase.from("group_members").select("*").eq("group_id", groupId),
      supabase.from("group_tasks").select("*").eq("group_id", groupId).eq("deleted", false),
    ]);
    setMembers((m ?? []) as MemberRow[]);
    setTasks((t ?? []) as TaskRow[]);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const removeMember = async (m: MemberRow) => {
    if (!confirm(`Remove ${m.display_name ?? m.email} from the group?`)) return;
    await supabase.from("group_members").delete().eq("id", m.id);
    load();
  };

  const stats = (userId: string) => {
    const assigned = tasks.filter((t) => t.assigned_to === userId);
    const done = assigned.filter((t) => t.status === "done");
    return {
      assigned: assigned.length,
      done: done.length,
      points: done.reduce((s, t) => s + t.pts, 0),
    };
  };

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          onClick={() => setShowInvite(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
        >
          <UserPlus className="h-4 w-4" /> Invite Member
        </button>
      </div>
      <div className="rounded-lg border border-border bg-card">
        {members.map((m) => {
          const s = stats(m.user_id);
          return (
            <div
              key={m.id}
              className="flex items-center gap-3 border-b border-border p-3 last:border-b-0"
            >
              <Avatar m={m} size={36} />
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {m.display_name ?? m.email}
                  {m.role === "owner" && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Owner
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{m.email}</div>
              </div>
              <div className="hidden text-right text-xs text-muted-foreground sm:block">
                <div>
                  {s.done}/{s.assigned} tasks
                </div>
                <div className="font-medium text-foreground">{s.points} pts</div>
              </div>
              {isOwner && m.user_id !== user.id && (
                <button
                  onClick={() => removeMember(m)}
                  className="ml-2 rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {showInvite && (
        <InviteModal user={user} groupId={groupId} onClose={() => setShowInvite(false)} />
      )}
    </div>
  );
}

function InviteModal({
  user,
  groupId,
  onClose,
}: {
  user: User;
  groupId: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const send = async () => {
    if (!email.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("group_invitations").insert({
      group_id: groupId,
      invited_email: email.trim().toLowerCase(),
      invited_by: user.id,
      status: "pending",
    });
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    setSent(true);
    setTimeout(onClose, 900);
  };
  return (
    <Modal onClose={onClose} title="Invite Member">
      <div className="space-y-3">
        <label className="block text-xs font-medium">Email address</label>
        <input
          autoFocus
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@example.com"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button
            onClick={send}
            disabled={busy || !email.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {sent ? "Sent ✓" : "Send Invite"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ================================================================== */
function GroupSections({ groupId, isOwner }: { groupId: string; isOwner: boolean }) {
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#7F77DD");
  const load = async () => {
    const { data } = await supabase.from("group_sections").select("*").eq("group_id", groupId);
    setSections((data ?? []) as SectionRow[]);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);
  const add = async () => {
    if (!label.trim()) return;
    await supabase.from("group_sections").insert({ group_id: groupId, label: label.trim(), color });
    setLabel("");
    load();
  };
  const remove = async (id: string) => {
    await supabase.from("group_sections").delete().eq("id", id);
    load();
  };
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-3">
        {sections.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No sections yet.</p>
        ) : (
          sections.map((s) => (
            <div key={s.id} className="flex items-center gap-2 py-1.5">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: s.color }} />
              <span className="text-sm">{s.label}</span>
              {isOwner && (
                <button
                  onClick={() => remove(s.id)}
                  className="ml-auto text-muted-foreground hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
      {isOwner && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Section name"
            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-9 rounded-md border border-border bg-transparent"
          />
          <button
            onClick={add}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Add Section
          </button>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
function GroupLeaderboard({ groupId }: { groupId: string }) {
  const [rows, setRows] = useState<(WeeklyPoints & { member?: MemberRow })[]>([]);
  useEffect(() => {
    const wk = isoMondayOf();
    (async () => {
      const [{ data: pts }, { data: mem }] = await Promise.all([
        supabase
          .from("group_weekly_points")
          .select("*")
          .eq("group_id", groupId)
          .eq("week_start", wk),
        supabase.from("group_members").select("*").eq("group_id", groupId),
      ]);
      const memList = (mem ?? []) as MemberRow[];
      const list = (pts ?? []).map((p) => ({
        ...(p as WeeklyPoints),
        member: memList.find((m) => m.user_id === (p as WeeklyPoints).user_id),
      }));
      list.sort((a, b) => b.points - a.points);
      setRows(list);
    })();
  }, [groupId]);

  const week = useMemo(() => isoMondayOf(), []);
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
        Week of {week}
      </div>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No points earned yet this week. Complete tasks to appear here!
        </p>
      ) : (
        rows.map((r, i) => (
          <div
            key={r.user_id}
            className="flex items-center gap-3 border-b border-border p-3 last:border-b-0"
          >
            <span className="w-6 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>
            {r.member ? (
              <Avatar m={r.member} size={32} />
            ) : (
              <div className="h-8 w-8 rounded-full bg-secondary" />
            )}
            <div className="flex-1 text-sm font-medium">
              {r.member?.display_name ?? r.user_id.slice(0, 8)}
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">{r.points} pts</div>
              <div className="text-[11px] text-muted-foreground">{r.tasks_done} tasks</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ================================================================== */
function Modal({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl"
      >
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

/* ================================================================== */
function QuickAddTaskModal({
  user,
  groupId,
  onClose,
}: {
  user: User;
  groupId: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [pts, setPts] = useState(5);
  const [priority, setPriority] = useState<TaskRow["priority"]>("medium");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("group_tasks").insert({
      group_id: groupId,
      title: title.trim(),
      created_by: user.id,
      status: "todo",
      pts,
      priority,
      position: 0,
    });
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    onClose();
  };
  return (
    <Modal onClose={onClose} title="Add Task">
      <div className="space-y-3">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskRow["priority"])}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Points</label>
            <input
              type="number"
              min={1}
              max={20}
              value={pts}
              onChange={(e) => setPts(Number(e.target.value) || 1)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !title.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ================================================================== */
function GroupIndividual({ user, groupId }: { user: User; groupId: string }) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [editing, setEditing] = useState<TaskRow | null>(null);

  const load = async () => {
    const [{ data: tk }, { data: mem }] = await Promise.all([
      supabase.from("group_tasks").select("*").eq("group_id", groupId).eq("deleted", false),
      supabase.from("group_members").select("*").eq("group_id", groupId),
    ]);
    setTasks((tk ?? []) as TaskRow[]);
    setMembers((mem ?? []) as MemberRow[]);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`indiv:${groupId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_tasks", filter: `group_id=eq.${groupId}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const cycle = async (t: TaskRow) => {
    const next: TaskRow["status"] =
      t.status === "todo" ? "inprogress" : t.status === "inprogress" ? "done" : "todo";
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: next } : x)));
    await supabase.from("group_tasks").update({ status: next }).eq("id", t.id);
  };

  const del = async (t: TaskRow) => {
    if (!confirm(`Delete "${t.title}"?`)) return;
    await supabase.from("group_tasks").update({ deleted: true }).eq("id", t.id);
    load();
  };

  const groups: { key: TaskRow["status"]; label: string; color: string }[] = [
    { key: "todo", label: "To Do", color: "#6B7280" },
    { key: "inprogress", label: "In Progress", color: "#F59E0B" },
    { key: "done", label: "Done", color: "#10B981" },
  ];

  const totalPts = tasks.filter((t) => t.status === "done").reduce((s, t) => s + t.pts, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm">
        <span className="text-muted-foreground">
          {tasks.length} task{tasks.length === 1 ? "" : "s"} ·{" "}
          {tasks.filter((t) => t.status === "done").length} done
        </span>
        <span className="font-semibold">{totalPts} pts</span>
      </div>
      {groups.map((g) => {
        const list = tasks.filter((t) => t.status === g.key);
        if (list.length === 0) return null;
        return (
          <div key={g.key} className="rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: g.color }}
              />
              <h3 className="text-sm font-semibold">{g.label}</h3>
              <span className="ml-auto text-xs text-muted-foreground">{list.length}</span>
            </div>
            <ul>
              {list.map((t) => {
                const assignee = members.find((m) => m.user_id === t.assigned_to);
                const priColor =
                  t.priority === "high"
                    ? "bg-red-500/15 text-red-600 dark:text-red-400"
                    : t.priority === "medium"
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                      : "bg-gray-500/15 text-gray-600 dark:text-gray-400";
                const ptsColor =
                  t.status === "done"
                    ? "bg-green-500/15 text-green-700 dark:text-green-400"
                    : "bg-secondary text-secondary-foreground";
                return (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 border-b border-border p-3 last:border-b-0"
                  >
                    <button
                      onClick={() => cycle(t)}
                      className={`h-5 w-5 shrink-0 rounded-full border-2 ${
                        t.status === "done"
                          ? "border-green-500 bg-green-500"
                          : t.status === "inprogress"
                            ? "border-amber-500 bg-amber-500/30"
                            : "border-border"
                      }`}
                      title="Click to cycle status"
                    />
                    <div className="flex-1">
                      <div
                        className={`text-sm font-medium ${
                          t.status === "done" ? "text-muted-foreground line-through" : ""
                        }`}
                      >
                        {t.title}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${priColor}`}
                        >
                          {t.priority}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${ptsColor}`}
                        >
                          {t.pts} pts
                        </span>
                        {t.due_date && (
                          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">
                            {t.due_date}
                          </span>
                        )}
                        {assignee && (
                          <span className="ml-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Avatar m={assignee} size={16} />
                            {assignee.display_name?.split(" ")[0]}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setEditing(t)}
                      className="rounded p-1 text-muted-foreground hover:bg-muted"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => del(t)}
                      className="rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {tasks.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No tasks yet. Click "Add Task" above to create one.
        </div>
      )}
      {editing && (
        <TaskModal user={user} task={editing} members={members} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
