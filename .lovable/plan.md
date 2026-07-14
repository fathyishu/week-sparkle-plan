## Overview

Two additive features to the existing weekly tracker — zero changes to existing personal tracker logic, UI, or tables.

1. **Demo starter tasks** for brand-new users (no `user_app_state` row yet) + dismissible welcome banner.
2. **Left sidebar** with Personal / Groups navigation, and a full **Groups** feature (invitations, kanban board, members, sections, leaderboard, realtime).

---

## Change 1 — Demo tasks for new users

- In `useCloudSync` initial hydrate: if `user_app_state` row is missing for the user, seed local state with a `DEMO_TEMPLATE` (5 sections, tasks with points as specified) instead of the existing hardcoded personal data, then save it up to Supabase so it persists.
- Demo tasks flow through the exact same task pipeline (click cycling, carry, delete, bulk, points) — they are just seed data.
- Welcome banner: shown above the tracker only when `demo_seeded && !demo_banner_dismissed`. Dismiss state persisted in `user_app_state` JSON (`ui.demoBannerDismissed = true`) so it syncs and never returns.
- No existing user is affected — anyone with a row keeps their data verbatim.

## Change 2 — Sidebar + Groups feature

### Layout
- New `AppShell` wrapping the authed app: fixed left sidebar (icon-only on desktop, hamburger drawer on mobile) with two items: **Personal** (default) and **Groups** (with unread invitation badge).
- Main content area conditionally renders either the untouched `<PersonalTracker />` (current `index.tsx` body, extracted into a component with zero logic changes) or the new `<GroupsView />`.
- Sidebar uses the same CSS variables / radius / font as the rest of the app.

### Database (new tables only)
Migration creates: `groups`, `group_members`, `group_invitations`, `group_tasks`, `group_sections`, `group_weekly_points` (for weekly leaderboard snapshots). Each table:
- `CREATE TABLE` + `GRANT` to `authenticated` + `service_role` + `ENABLE RLS` + policies.
- Security-definer helper `public.is_group_member(_group uuid, _user uuid)` to avoid recursive RLS on `group_members`.
- Policies:
  - `groups`: SELECT if member; INSERT by any authenticated user (self as owner); UPDATE/DELETE by owner.
  - `group_members`: SELECT if member of same group (via helper); INSERT owner or accept-invite flow; DELETE by owner or self.
  - `group_invitations`: SELECT by inviter or by invited email (matches `auth.jwt()->>'email'`); INSERT by group owner/member; UPDATE by invited user.
  - `group_tasks` / `group_sections`: SELECT/INSERT/UPDATE/DELETE if member.
  - `group_weekly_points`: SELECT if member; INSERT/UPDATE by member (self row).
- Add all six new tables to `supabase_realtime` publication.
- `updated_at` triggers via existing `set_updated_at` function.

### Groups UI
- **Groups list**: cards showing name, member avatars (up to 5), task count, member count. `+ Create Group` button (modal: name, description). Empty state message. Pending-invitation banners at top with Accept/Decline.
- **Group detail** with tabs: **Board**, **Members**, **Sections**, **Leaderboard**. Back button returns to list.
- **Board (Kanban)**: 3 columns (To Do / In Progress / Done). Drag & drop between columns with `@dnd-kit/core` (install). Task cards show title, assignee avatar, priority badge (low/med/high), points badge (matching personal tracker style), due date, edit icon. `+ Add Task` inline input per column. Task detail modal: title, description, assignee dropdown, priority, points ±, due date, status, delete (soft), save.
- **Members**: list with name/avatar/email/role + per-member stats (tasks assigned / done / points this week). Owner can remove members. `Invite Member` opens modal (email input → creates pending invitation).
- **Sections**: owner can add/remove label+color sections used to tag tasks.
- **Leaderboard**: sorted list of members by weekly points from `group_weekly_points` (row per user per week, incremented when a task is moved to Done).
- **Realtime**: subscribe to `group_tasks`, `group_members`, `group_invitations`, `group_sections` filtered by `group_id`; toast on remote task moves ("Member moved 'Task' to In Progress").

### Files (new)
- `src/components/AppShell.tsx` — sidebar + main content switcher.
- `src/components/PersonalTrackerView.tsx` — thin wrapper re-exporting the existing tracker body (extracted verbatim from `routes/index.tsx`, no logic edits).
- `src/components/groups/GroupsView.tsx`, `GroupList.tsx`, `GroupDetail.tsx`, `GroupBoard.tsx`, `GroupTaskCard.tsx`, `GroupTaskModal.tsx`, `GroupMembers.tsx`, `GroupSections.tsx`, `GroupLeaderboard.tsx`, `InviteModal.tsx`, `CreateGroupModal.tsx`.
- `src/lib/demo-template.ts` — the 5 demo sections + tasks.
- `src/hooks/useGroups.ts`, `useGroupTasks.ts`, `useGroupInvitations.ts` — Supabase queries + realtime subscriptions.
- `supabase/migrations/<ts>_groups.sql` — full schema + RLS + realtime.

### Files (minimally edited)
- `src/routes/index.tsx` — wrap current returned JSX in `<AppShell activeView={...}>{existing content}</AppShell>`. The existing tracker body itself is not touched; only the outer wrapper is added.
- `src/hooks/useCloudSync.ts` — on load, if no row exists, seed with demo template and mark `demo_seeded=true`.

### Dependencies
- Add `@dnd-kit/core` and `@dnd-kit/sortable` via `bun add`.

---

## Technical notes

- The personal tracker route file is large; extraction is a pure "cut the JSX, paste into `PersonalTrackerView.tsx`" — no reorder, no rename, no logic touch. If any state must remain co-located with sync, we instead keep the tracker in `index.tsx` and simply render sidebar + tracker side-by-side, gating tracker visibility with `activeView === 'personal'` while `<GroupsView />` renders when `'groups'`. Preferred approach = keep everything in `index.tsx`, add sidebar wrapper and view switch there.
- Demo seed writes through the same `user_app_state` path so realtime + offline queue continue to work.
- Group invitations match on `auth.jwt()->>'email'` so invited users see pending invites even before accepting.
- Weekly leaderboard uses ISO week start (Monday) already computed elsewhere in the app.
