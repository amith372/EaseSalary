-- **A policy's expression is evaluated as the role making the request**, not as
-- the table's owner. So a policy that calls a function requires the calling
-- role to be able to execute that function, and the first migration revoked
-- exactly that: every signed-in insert came back
-- `42501 permission denied for function is_household_member`.
--
-- The general advice this was written from -- keep a `security definer` helper
-- out of reach of the roles that must not call it -- is right about a helper
-- called from application code and wrong about one named in a policy. The two
-- cases look identical in a migration and behave nothing alike.
--
-- **Granting it is safe, and not merely necessary.** The function answers one
-- question: is *the caller* a member of this household. It reads the caller's
-- own identity inside its own body from `auth.uid()` and takes no argument that
-- could make it answer for anyone else, so a signed-in person who calls it
-- directly learns only which households they are already in. That is the
-- property that makes it grantable, and it is why the identity check lives
-- inside the function rather than in the policy that calls it.

grant usage on schema private to authenticated;

grant execute on function private.is_household_member(uuid) to authenticated;

-- `anon` stays revoked. A request with nobody behind it has no `auth.uid()`, so
-- the function could only ever answer false -- but a function it cannot call is
-- one less thing to reason about.
revoke execute on function private.is_household_member(uuid) from anon, public;

-- The two trigger functions stay unreachable. Nothing calls them by name: they
-- fire from `create trigger`, which runs them with the privileges of the
-- trigger's owner, so no grant to `authenticated` is needed and any grant would
-- be a way to run them outside the statement they exist to guard.
