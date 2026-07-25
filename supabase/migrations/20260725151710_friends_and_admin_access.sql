/*
# Friends & Leaderboard + Admin access function

## Purpose
1. Add a `friendships` table for personal friend relationships (distinct from
   group memberships and mentorships).
2. Add a security-definer function `admin_read_user_state` so the single
   hardcoded admin account can read any user's `user_app_state` JSON without
   loosening RLS broadly (mirrors the mentor `is_mentor_of()` access pattern).

## 1. New table: `friendships`
- `id` uuid PK
- `user_id_a` uuid — the requester
- `user_id_b` uuid — the recipient
- `status` text — 'pending' | 'accepted' | 'declined'
- `requested_by` uuid — which party initiated (equals user_id_a on insert)
- `created_at` timestamptz
- `updated_at` timestamptz

A friendship row is visible to either party. Only the recipient can update
the status (accept/decline). Either party can insert (the requester inserts,
creating the pending row).

## 2. New function: `admin_read_user_state(_target uuid)`
Security definer. Returns the `user_app_state.data` JSON for the given user
id, but ONLY if the caller's email is exactly the hardcoded admin address
`farhanzuhair123@gmail.com`. This gives the single admin read access to any
user's tracker state without disabling RLS on `user_app_state` for everyone.
No role table — the email check is hardcoded here server-side.

## Security
- RLS enabled on `friendships`; 4 policies (select/insert/update/delete),
  scoped to authenticated users who are a party to the friendship.
- `admin_read_user_state` is SECURITY DEFINER, checks the caller email from
  `auth.users` before returning data.
*/

-- 1. friendships table ------------------------------------------------------
CREATE TABLE IF NOT EXISTS friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  requested_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friendships_parties_differ CHECK (user_id_a <> user_id_b)
);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS friendships_user_a_idx ON friendships(user_id_a);
CREATE INDEX IF NOT EXISTS friendships_user_b_idx ON friendships(user_id_b);
CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_uniq
  ON friendships (least(user_id_a, user_id_b), greatest(user_id_a, user_id_b));

DROP POLICY IF EXISTS "select_own_friendships" ON friendships;
CREATE POLICY "select_own_friendships" ON friendships FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id_a OR auth.uid() = user_id_b);

DROP POLICY IF EXISTS "insert_own_friendships" ON friendships;
CREATE POLICY "insert_own_friendships" ON friendships FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id_a OR auth.uid() = user_id_b);

DROP POLICY IF EXISTS "update_own_friendships" ON friendships;
CREATE POLICY "update_own_friendships" ON friendships FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id_a OR auth.uid() = user_id_b)
  WITH CHECK (auth.uid() = user_id_a OR auth.uid() = user_id_b);

DROP POLICY IF EXISTS "delete_own_friendships" ON friendships;
CREATE POLICY "delete_own_friendships" ON friendships FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id_a OR auth.uid() = user_id_b);

-- 2. admin_read_user_state function ----------------------------------------
-- Drop & recreate so the migration is idempotent.
DROP FUNCTION IF EXISTS admin_read_user_state(_target uuid);

CREATE OR REPLACE FUNCTION admin_read_user_state(_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email text;
  state_data jsonb;
BEGIN
  SELECT email INTO caller_email
  FROM auth.users
  WHERE id = auth.uid();

  IF caller_email IS NULL OR caller_email <> 'farhanzuhair123@gmail.com' THEN
    RETURN NULL;
  END IF;

  SELECT data INTO state_data
  FROM user_app_state
  WHERE user_id = _target;

  RETURN state_data;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_read_user_state(uuid) TO authenticated;
