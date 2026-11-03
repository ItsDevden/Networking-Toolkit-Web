create or replace function public.devden_member_roster(p_code text,p_member_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.devden_groups where code=p_code) or
    not exists(select 1 from public.devden_group_members where group_code=p_code and member_id=p_member_id and not revoked) then
  return jsonb_build_object('removed',true);
 end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
   'id',m.member_id,'name',m.nickname,'online',coalesce(m.seen_at > now()-interval '25 seconds',false)
 ) order by m.joined_at) from public.devden_group_members m
 where m.group_code=p_code and not m.revoked),'[]'::jsonb);
end $$;
revoke all on function public.devden_member_roster(text,uuid) from public;
grant execute on function public.devden_member_roster(text,uuid) to anon;

create or replace function public.devden_member_leave(p_code text,p_member_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare removed_count integer;
begin
 perform 1 from public.devden_groups where code=p_code for update;
 if not found then return false; end if;
 delete from public.devden_group_members where group_code=p_code and member_id=p_member_id and not revoked;
 get diagnostics removed_count = row_count;
 if removed_count=0 then return false; end if;
 if not exists(select 1 from public.devden_group_members where group_code=p_code and not revoked) then
  delete from public.devden_groups where code=p_code;
 end if;
 return true;
end $$;
revoke all on function public.devden_member_leave(text,uuid) from public;
grant execute on function public.devden_member_leave(text,uuid) to anon;

-- Remove groups left behind by the previous Leave implementation.
delete from public.devden_groups g
where not exists (select 1 from public.devden_group_members m
                  where m.group_code=g.code and not m.revoked);
