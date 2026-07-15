import { useEffect, useState } from "react";
import {
  User as UserIcon,
  Users as UsersIcon,
  Menu,
  X,
  Bell,
  GraduationCap,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AppView = "personal" | "groups" | "notifications" | "mentors";

interface Props {
  view: AppView;
  setView: (v: AppView) => void;
  user: User;
  selectedGroupId: string | null;
  setSelectedGroupId: (id: string | null) => void;
  children: React.ReactNode;
}

type SidebarGroup = { id: string; name: string };

export function AppShell({
  view,
  setView,
  user,
  selectedGroupId,
  setSelectedGroupId,
  children,
}: Props) {
  const [inviteCount, setInviteCount] = useState(0);
  const [mentorReqCount, setMentorReqCount] = useState(0);
  const [groups, setGroups] = useState<SidebarGroup[]>([]);
  const [groupsExpanded, setGroupsExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const email = user.email?.toLowerCase() ?? "";

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      const [{ data: gs }, invRes, mentRes] = await Promise.all([
        supabase.from("groups").select("id,name").order("created_at"),
        email
          ? supabase
              .from("group_invitations")
              .select("id", { count: "exact", head: true })
              .eq("status", "pending")
              .ilike("invited_email", email)
          : Promise.resolve({ count: 0 } as { count: number | null }),
        email
          ? supabase
              .from("mentorships")
              .select("id", { count: "exact", head: true })
              .eq("status", "pending")
              .ilike("mentee_email", email)
          : Promise.resolve({ count: 0 } as { count: number | null }),
      ]);
      if (cancel) return;
      setGroups(((gs ?? []) as SidebarGroup[]) ?? []);
      setInviteCount((invRes as { count: number | null }).count ?? 0);
      setMentorReqCount((mentRes as { count: number | null }).count ?? 0);
    };
    load();
    const channel = supabase
      .channel(`shell:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "groups" },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_invitations" },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members" },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mentorships" },
        load,
      )
      .subscribe();
    return () => {
      cancel = true;
      supabase.removeChannel(channel);
    };
  }, [user.id, email]);

  const notifCount = inviteCount + mentorReqCount;

  const openGroup = (id: string) => {
    setSelectedGroupId(id);
    setView("groups");
    setMobileOpen(false);
  };

  const Sidebar = (
    <nav className="flex h-full w-60 flex-col gap-1 border-r border-border bg-card p-3">
      <div className="mb-2 px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Workspace
      </div>

      <button
        onClick={() => {
          setView("personal");
          setSelectedGroupId(null);
          setMobileOpen(false);
        }}
        className={itemClass(view === "personal")}
      >
        <UserIcon className="h-4 w-4" />
        <span>Personal</span>
      </button>

      {/* Groups group */}
      <div>
        <div className="flex items-center">
          <button
            onClick={() => {
              setView("groups");
              setSelectedGroupId(null);
              setMobileOpen(false);
            }}
            className={itemClass(view === "groups" && !selectedGroupId) + " flex-1"}
          >
            <UsersIcon className="h-4 w-4" />
            <span>Groups</span>
          </button>
          <button
            onClick={() => setGroupsExpanded((v) => !v)}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
            aria-label="Toggle groups"
          >
            {groupsExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        {groupsExpanded && (
          <div className="ml-6 mt-1 flex flex-col gap-0.5">
            {groups.length === 0 ? (
              <div className="px-2 py-1 text-[11px] text-muted-foreground">
                No groups yet
              </div>
            ) : (
              groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => openGroup(g.id)}
                  className={`truncate rounded px-2 py-1 text-left text-xs ${
                    view === "groups" && selectedGroupId === g.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {g.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <button
        onClick={() => {
          setView("notifications");
          setMobileOpen(false);
        }}
        className={itemClass(view === "notifications")}
      >
        <Bell className="h-4 w-4" />
        <span>Notifications</span>
        {notifCount > 0 && (
          <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {notifCount}
          </span>
        )}
      </button>

      <button
        onClick={() => {
          setView("mentors");
          setMobileOpen(false);
        }}
        className={itemClass(view === "mentors")}
      >
        <GraduationCap className="h-4 w-4" />
        <span>Mentorship</span>
      </button>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <div className="fixed inset-y-0 left-0 z-30 hidden md:block">{Sidebar}</div>

      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen((v) => !v)}
        className="fixed left-3 top-3 z-40 flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card shadow-sm md:hidden"
        aria-label="Toggle sidebar"
      >
        {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        {notifCount > 0 && !mobileOpen && (
          <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1 py-0.5 text-[9px] font-bold text-white">
            {notifCount}
          </span>
        )}
      </button>
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-40 md:hidden">{Sidebar}</div>
        </>
      )}

      <div className="md:pl-60">{children}</div>
    </div>
  );
}

function itemClass(active: boolean) {
  return `group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    active
      ? "bg-primary/10 text-primary"
      : "text-foreground hover:bg-muted"
  }`;
}
