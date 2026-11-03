-- Run after GROUP_ADMIN_SETUP.sql and GROUP_LIFECYCLE_UPDATE.sql.
-- Existing groups use the earliest currently active member as leader.
-- A kicked user cannot rejoin with the same local membership ID.
create or replace function public.devden_leader_kick_member(p_code text,p_actor_id uuid,p_member_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare leader_id uuid; changed int;
begin
  select member_id into leader_id from public.devden_group_members
  where group_code=p_code and not revoked order by joined_at,member_id limit 1;
  if leader_id is null or leader_id<>p_actor_id or p_member_id=p_actor_id then return false; end if;
  update public.devden_group_members set revoked=true
    where group_code=p_code and member_id=p_member_id and not revoked;
  get diagnostics changed = row_count;
  return changed>0;
end $$;
revoke all on function public.devden_leader_kick_member(text,uuid,uuid) from public;
grant execute on function public.devden_leader_kick_member(text,uuid,uuid) to anon;
