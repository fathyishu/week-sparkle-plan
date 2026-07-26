import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Users as UsersIcon, GraduationCap, Check, X } from "lucide-react";

type GroupInvite = {
  id: string;
  group_id: string;
  invited_by: string;
  invited_email: string;
  status: string;
  created_at: string;
  groupName?: string;
  inviterName?: string;
};

type MentorReq = {
  id: string;
  mentor_id: string;
  mentee_email: string;
  status: string;
  created_at: string;
  mentor_name: string | null;
};

export function NotificationsView({ user }: { user: User }) {
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [mentorReqs, setMentorReqs] = useState<MentorReq[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const email = (user.email ?? "").toLowerCase();

  const load = async () => {
    if (!email) return;
    const [{ data: inv }, { data: mr }] = await Promise.all([
      supabase
        .from("group_invitations")
        .select("*")
        .eq("status", "pending")
        .ilike("invited_email", email),
      supabase
        .from("mentorships")
        .select("*")
        .eq("status", "pending")
        .ilike("mentee_email", email),
    ]);
    const invList = (inv ?? []) as GroupInvite[];
    if (invList.length) {
      const gIds = [...new Set(invList.map((i) => i.group_id))];
      const { data: gs } = await supabase.from("groups").select("id,name").in("id", gIds);
      const map: Record<string, string> = {};
      for (const g of gs ?? []) map[g.id as string] = g.name as string;
      for (const i of invList) i.groupName = map[i.group_id] ?? "a group";
    }
    setInvites(invList);
    setMentorReqs((mr ?? []) as MentorReq[]);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`notif:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_invitations" },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mentorships" },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, email]);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2500);
  };

  const acceptInvite = async (inv: GroupInvite) => {
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
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      showToast(`Could not accept: ${error.message}`);
      return;
    }
    await supabase.from("group_invitations").update({ status: "accepted" }).eq("id", inv.id);
    showToast(`Joined ${inv.groupName ?? "group"}`);
    load();
  };

  const declineInvite = async (inv: GroupInvite) => {
    await supabase.from("group_invitations").update({ status: "declined" }).eq("id", inv.id);
    load();
  };

  const acceptMentor = async (m: MentorReq) => {
    const { error } = await supabase
      .from("mentorships")
      .update({
        status: "accepted",
        mentee_id: user.id,
        mentee_name:
          (user.user_metadata?.full_name as string | undefined) ??
          user.email ??
          null,
        mentee_avatar:
          (user.user_metadata?.avatar_url as string | undefined) ??
          (user.user_metadata?.picture as string | undefined) ??
          null,
      })
      .eq("id", m.id);
    if (error) {
      showToast(error.message);
      return;
    }
    showToast(`Accepted mentor ${m.mentor_name ?? ""}`);
    load();
  };

  const declineMentor = async (m: MentorReq) => {
    await supabase.from("mentorships").update({ status: "declined" }).eq("id", m.id);
    load();
  };

  const total = invites.length + mentorReqs.length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-xs font-medium text-background shadow-lg">
          {toast}
        </div>
      )}
      <header className="mb-6 flex items-center gap-3">
        <Bell className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {total > 0
              ? `${total} pending item${total === 1 ? "" : "s"}`
              : "You're all caught up."}
          </p>
        </div>
      </header>

      {total === 0 && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nothing to review right now.
        </div>
      )}

      <div className="space-y-3">
        {invites.map((inv) => (
          <div
            key={inv.id}
            className="rounded-lg border border-border bg-card p-4 shadow-sm"
          >
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-primary">
              <UsersIcon className="h-3.5 w-3.5" /> Group invite
            </div>
            <p className="text-sm font-medium">
              You've been invited to join <b>{inv.groupName}</b>.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Once accepted, you will be added to the group. You can collaborate on
              tasks.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => acceptInvite(inv)}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                <Check className="h-3.5 w-3.5" /> Accept
              </button>
              <button
                onClick={() => declineInvite(inv)}
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" /> Decline
              </button>
            </div>
          </div>
        ))}

        {mentorReqs.map((m) => (
          <div
            key={m.id}
            className="rounded-lg border border-border bg-card p-4 shadow-sm"
          >
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-primary">
              <GraduationCap className="h-3.5 w-3.5" /> Mentor request
            </div>
            <p className="text-sm font-medium">
              <b>{m.mentor_name ?? "Someone"}</b> wants to be your mentor.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              If you accept, they will have <b>full access</b> to view, add, edit,
              and delete your individual tasks. They cannot see any group tasks.
              You can revoke access at any time.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => acceptMentor(m)}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                <Check className="h-3.5 w-3.5" /> Accept
              </button>
              <button
                onClick={() => declineMentor(m)}
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" /> Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
