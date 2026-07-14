import { useEffect, useState } from "react";
import { User as UserIcon, Users as UsersIcon, Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AppView = "personal" | "groups";

interface Props {
  view: AppView;
  setView: (v: AppView) => void;
  user: User;
  children: React.ReactNode;
}

export function AppShell({ view, setView, user, children }: Props) {
  const [inviteCount, setInviteCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const email = user.email?.toLowerCase() ?? "";

  useEffect(() => {
    if (!email) return;
    let cancel = false;
    const load = async () => {
      const { count } = await supabase
        .from("group_invitations")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .ilike("invited_email", email);
      if (!cancel) setInviteCount(count ?? 0);
    };
    load();
    const channel = supabase
      .channel(`invites:${email}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_invitations" },
        load,
      )
      .subscribe();
    return () => {
      cancel = true;
      supabase.removeChannel(channel);
    };
  }, [email]);

  const items: { key: AppView; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "personal", label: "Personal", icon: <UserIcon className="h-5 w-5" /> },
    {
      key: "groups",
      label: "Groups",
      icon: <UsersIcon className="h-5 w-5" />,
      badge: inviteCount,
    },
  ];

  const SidebarContent = (
    <nav className="flex h-full w-56 flex-col gap-1 border-r border-border bg-card p-3">
      <div className="mb-3 px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Workspace
      </div>
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => {
            setView(it.key);
            setMobileOpen(false);
          }}
          className={`group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            view === it.key
              ? "bg-primary/10 text-primary"
              : "text-foreground hover:bg-muted"
          }`}
        >
          <span className="shrink-0">{it.icon}</span>
          <span>{it.label}</span>
          {it.badge ? (
            <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {it.badge}
            </span>
          ) : null}
        </button>
      ))}
    </nav>
  );

  const IconRail = (
    <nav className="fixed inset-y-0 left-0 z-30 hidden w-14 flex-col items-center gap-2 border-r border-border bg-card py-3 md:flex">
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => setView(it.key)}
          title={it.label}
          className={`relative flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
            view === it.key
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {it.icon}
          {it.badge ? (
            <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1 py-0.5 text-[9px] font-bold text-white">
              {it.badge}
            </span>
          ) : null}
        </button>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {IconRail}
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen((v) => !v)}
        className="fixed left-3 top-3 z-40 flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card shadow-sm md:hidden"
        aria-label="Toggle sidebar"
      >
        {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        {inviteCount > 0 && !mobileOpen && (
          <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1 py-0.5 text-[9px] font-bold text-white">
            {inviteCount}
          </span>
        )}
      </button>
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-40 md:hidden">
            {SidebarContent}
          </div>
        </>
      )}
      <div className="md:pl-14">{children}</div>
    </div>
  );
}
