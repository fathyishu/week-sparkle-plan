import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, UserPlus, Users } from "lucide-react";

type Friend = {
  id: string;
  userId: string;
  email: string;
  name: string;
  avatar: string | null;
  status: string;
  incoming: boolean;
};

type Standing = {
  userId: string;
  email: string;
  name: string;
  avatar: string | null;
  todayPoints: number;
  totalPoints: number;
  tasksDone: number;
};

export function LeaderboardView({ user }: { user: User }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2500);
  };

  const loadFriends = async () => {
    const { data } = await supabase.from("friendships").select("*");
    const rows = (data ?? []) as {
      id: string;
      user_id_a: string;
      user_id_b: string;
      status: string;
      requested_by: string;
    }[];
    const friendIds = new Set<string>();
    const list: Friend[] = [];
    for (const r of rows) {
      const incoming = r.user_id_b === user.id;
      const otherId = incoming ? r.user_id_a : r.user_id_b;
      friendIds.add(otherId);
      list.push({
        id: r.id,
        userId: otherId,
        email: "",
        name: "",
        avatar: null,
        status: r.status,
        incoming,
      });
    }
    if (friendIds.size > 0) {
      const { data: users } = await supabase
        .from("group_members")
        .select("user_id, email, display_name, avatar_url")
        .in("user_id", [...friendIds]);
      const map = new Map<string, { email: string; name: string; avatar: string | null }>();
      for (const u of users ?? []) {
        const ex = map.get(u.user_id as string);
        if (!ex || !ex.email) {
          map.set(u.user_id as string, {
            email: (u.email as string) ?? "",
            name: (u.display_name as string) ?? "",
            avatar: (u.avatar_url as string) ?? null,
          });
        }
      }
      for (const f of list) {
        const info = map.get(f.userId);
        if (info) {
          f.email = info.email;
          f.name = info.name;
          f.avatar = info.avatar;
        }
      }
    }
    setFriends(list);
  };

  const computeStandings = async () => {
    const { data: myState } = await supabase
      .from("user_app_state")
      .select("data")
      .eq("user_id", user.id)
      .maybeSingle();
    const standingsList: Standing[] = [];
    const extract = (
      data: unknown,
      uid: string,
      email: string,
      name: string,
      avatar: string | null,
    ) => {
      const state = data as {
        days?: { tasks: { status: string; points: number }[] }[];
      } | null;
      let today = 0;
      let total = 0;
      let done = 0;
      if (state?.days) {
        for (let i = 0; i < state.days.length; i++) {
          for (const t of state.days[i].tasks) {
            if (t.status === "done") {
              total += t.points;
              done += 1;
              if (i === new Date().getDay() - 1 || i === 0) today += t.points;
            }
          }
        }
      }
      standingsList.push({
        userId: uid,
        email,
        name,
        avatar,
        todayPoints: today,
        totalPoints: total,
        tasksDone: done,
      });
    };
    const myName =
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      user.email ??
      "You";
    const myAvatar =
      (user.user_metadata?.avatar_url as string | undefined) ??
      (user.user_metadata?.picture as string | undefined) ??
      null;
    extract(myState?.data, user.id, user.email ?? "", myName, myAvatar);
    for (const f of friends.filter((fr) => fr.status === "accepted")) {
      const { data: fs } = await supabase
        .from("user_app_state")
        .select("data")
        .eq("user_id", f.userId)
        .maybeSingle();
      extract(fs?.data, f.userId, f.email, f.name || f.email, f.avatar);
    }
    setStandings(standingsList.sort((a, b) => b.totalPoints - a.totalPoints));
  };

  useEffect(() => {
    loadFriends();
  }, [user.id]);

  useEffect(() => {
    computeStandings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friends]);

  const sendRequest = async (email: string) => {
    const target = email.trim().toLowerCase();
    if (!target) return;
    const { data: found } = await supabase
      .from("group_members")
      .select("user_id, email")
      .ilike("email", target)
      .limit(1);
    const targetUser = (found ?? [])[0] as { user_id: string; email: string } | undefined;
    if (!targetUser) {
      showToast("No user found with that email.");
      return;
    }
    const { error } = await supabase.from("friendships").insert({
      user_id_a: user.id,
      user_id_b: targetUser.user_id,
      requested_by: user.id,
      status: "pending",
    });
    if (error) {
      showToast(error.message);
      return;
    }
    await supabase.from("notifications").insert({
      user_id: targetUser.user_id,
      kind: "friend_request",
      title: "New friend request",
      body: `${user.email} wants to be your friend.`,
      actor_id: user.id,
      actor_name: (user.user_metadata?.full_name as string | undefined) ?? user.email ?? null,
    });
    showToast("Friend request sent!");
    loadFriends();
  };

  const pendingIncoming = friends.filter((f) => f.status === "pending" && f.incoming);
  const acceptedFriends = friends.filter((f) => f.status === "accepted");

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-xs font-medium text-background shadow-lg">
          {toast}
        </div>
      )}
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
            <p className="text-sm text-muted-foreground">Compete with friends on task points.</p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"
        >
          <UserPlus className="h-4 w-4" /> Add Friend
        </button>
      </header>

      {pendingIncoming.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Pending Requests
          </h2>
          <div className="space-y-2">
            {pendingIncoming.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
              >
                <span className="text-sm">{f.email || f.name}</span>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      await supabase
                        .from("friendships")
                        .update({ status: "accepted" })
                        .eq("id", f.id);
                      loadFriends();
                    }}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                  >
                    Accept
                  </button>
                  <button
                    onClick={async () => {
                      await supabase
                        .from("friendships")
                        .update({ status: "declined" })
                        .eq("id", f.id);
                      loadFriends();
                    }}
                    className="rounded-md border border-border px-3 py-1.5 text-xs"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Total Points
        </h2>
        <div className="space-y-2">
          {standings.map((s, i) => (
            <div
              key={s.userId}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-bold">
                {i + 1}
              </span>
              {s.avatar ? (
                <img src={s.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {(s.name || s.email || "?")[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <div className="text-sm font-medium">
                  {s.name || s.email}
                  {s.userId === user.id && " (You)"}
                </div>
                <div className="text-xs text-muted-foreground">{s.tasksDone} tasks done</div>
              </div>
              <span className="text-lg font-bold text-primary">{s.totalPoints}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Friends ({acceptedFriends.length})
        </h2>
        {acceptedFriends.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            <Users className="mx-auto mb-2 h-6 w-6 opacity-50" />
            No friends yet. Add one to start competing!
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {acceptedFriends.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
              >
                {f.avatar ? (
                  <img src={f.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {(f.name || f.email || "?")[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 text-sm">
                  <div className="font-medium">{f.name || f.email}</div>
                  <div className="text-xs text-muted-foreground">{f.email}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showAdd && <AddFriendModal onClose={() => setShowAdd(false)} onSend={sendRequest} />}
    </div>
  );
}

function AddFriendModal({
  onClose,
  onSend,
}: {
  onClose: () => void;
  onSend: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!email.trim()) return;
    setBusy(true);
    onSend(email);
    setBusy(false);
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
        <h2 className="mb-3 text-lg font-semibold">Add Friend</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Enter your friend's email. They'll get a notification to accept.
        </p>
        <input
          autoFocus
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="friend@example.com"
          className="mb-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !email.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Send Request
          </button>
        </div>
      </div>
    </div>
  );
}
