import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, UserPlus, X } from "lucide-react";
import { useDateRangeFilter } from "@/components/DateRangeFilter";
import { toDateParam } from "@/lib/dateRange";

export type FriendshipRow = {
  id: string;
  user_id_a: string;
  user_id_b: string | null;
  invited_email: string;
  name_a: string | null;
  name_b: string | null;
  avatar_a: string | null;
  avatar_b: string | null;
  status: string;
  requested_by: string;
};

export function displayName(user: User) {
  return (
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    "Me"
  );
}
export function avatarOf(user: User) {
  return (
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined) ??
    null
  );
}

/** Shared "Add Friend" modal — used from the tracker home page and this view. */
export function AddFriendModal({
  user,
  onClose,
  onSent,
}: {
  user: User;
  onClose: () => void;
  onSent: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    const target = email.trim().toLowerCase();
    if (!target) return;
    if (target === (user.email ?? "").toLowerCase()) {
      setErr("That's your own email.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("friendships").insert({
      user_id_a: user.id,
      invited_email: target,
      name_a: displayName(user),
      avatar_a: avatarOf(user),
      requested_by: user.id,
      status: "pending",
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onSent(target);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-xl"
      >
        <h2 className="mb-3 text-lg font-semibold">Add a friend</h2>
        <input
          autoFocus
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setErr(null);
          }}
          placeholder="friend@email.com"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        {err && <p className="mt-2 text-xs text-red-500">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !email.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Send request
          </button>
        </div>
      </div>
    </div>
  );
}

type Row = {
  userId: string;
  name: string;
  avatar: string | null;
  points: number;
  tasksDone: number;
  isMe: boolean;
};

export function FriendsView({ user }: { user: User }) {
  const { range, control } = useDateRangeFilter("week");
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, setPending] = useState<FriendshipRow[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  };

  const load = useCallback(async () => {
    const [{ data: fs }, { data: pts }] = await Promise.all([
      supabase.from("friendships").select("*"),
      supabase.rpc("friends_points", {
        _start: toDateParam(range.start) ?? undefined,
        _end: toDateParam(range.end) ?? undefined,
      }),
    ]);
    const friendships = (fs ?? []) as FriendshipRow[];
    const accepted = friendships.filter((f) => f.status === "accepted");
    setPending(
      friendships.filter((f) => f.status === "pending" && f.requested_by === user.id),
    );

    const scores = new Map<string, { points: number; tasks: number }>();
    for (const p of (pts ?? []) as { user_id: string; points: number; tasks_done: number }[]) {
      scores.set(p.user_id, { points: p.points, tasks: p.tasks_done });
    }

    const list: Row[] = [
      {
        userId: user.id,
        name: displayName(user),
        avatar: avatarOf(user),
        points: scores.get(user.id)?.points ?? 0,
        tasksDone: scores.get(user.id)?.tasks ?? 0,
        isMe: true,
      },
    ];
    for (const f of accepted) {
      const isA = f.user_id_a === user.id;
      const friendId = isA ? f.user_id_b : f.user_id_a;
      if (!friendId) continue;
      list.push({
        userId: friendId,
        name: (isA ? f.name_b : f.name_a) ?? f.invited_email,
        avatar: isA ? f.avatar_b : f.avatar_a,
        points: scores.get(friendId)?.points ?? 0,
        tasksDone: scores.get(friendId)?.tasks ?? 0,
        isMe: false,
      });
    }
    list.sort((a, b) => b.points - a.points);
    setRows(list);
  }, [user, range.start, range.end]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`friends:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () =>
        load(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "user_app_state" }, () =>
        load(),
      )
      .subscribe();
    // Friends' task rows aren't readable directly (points come from the
    // security-definer aggregate), so refresh periodically to stay live.
    const timer = setInterval(load, 20000);
    return () => {
      clearInterval(timer);
      supabase.removeChannel(ch);
    };
  }, [load, user.id]);

  const removeFriend = async (userId: string) => {
    const { data } = await supabase.from("friendships").select("*");
    const row = ((data ?? []) as FriendshipRow[]).find(
      (f) => f.user_id_a === userId || f.user_id_b === userId,
    );
    if (row) await supabase.from("friendships").delete().eq("id", row.id);
    load();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-xs font-medium text-background shadow-lg">
          {toast}
        </div>
      )}
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <Trophy className="h-6 w-6" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Friends & Leaderboard</h1>
          <p className="text-sm text-muted-foreground">
            Ranked by points earned in the selected period.
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
        >
          <UserPlus className="h-3.5 w-3.5" /> Add Friend
        </button>
      </header>

      <div className="mb-4">{control}</div>

      <div className="rounded-lg border border-border bg-card">
        {rows.map((r, i) => (
          <div
            key={r.userId}
            className={`flex items-center gap-3 border-b border-border p-3 last:border-b-0 ${
              r.isMe ? "bg-primary/10" : ""
            }`}
          >
            <span className="w-6 text-center text-sm font-bold text-muted-foreground">
              {i + 1}
            </span>
            {r.avatar ? (
              <img src={r.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                {r.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex-1 truncate text-sm font-medium">
              {r.name} {r.isMe && <span className="text-xs text-primary">(you)</span>}
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">{r.points} pts</div>
              <div className="text-[11px] text-muted-foreground">{r.tasksDone} tasks</div>
            </div>
            {!r.isMe && (
              <button
                onClick={() => removeFriend(r.userId)}
                className="rounded p-1 text-muted-foreground hover:bg-muted"
                aria-label="Remove friend"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {pending.length > 0 && (
        <div className="mt-5">
          <h2 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Sent requests
          </h2>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {pending.map((p) => (
              <li key={p.id}>{p.invited_email} — pending</li>
            ))}
          </ul>
        </div>
      )}

      {addOpen && (
        <AddFriendModal
          user={user}
          onClose={() => setAddOpen(false)}
          onSent={(e) => showToast(`Friend request sent to ${e}.`)}
        />
      )}
    </div>
  );
}
