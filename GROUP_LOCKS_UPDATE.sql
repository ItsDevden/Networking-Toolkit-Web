-- DevDen collaboration migration. Run after GROUP_SETUP, GROUP_ADMIN_SETUP,
-- GROUP_LIFECYCLE_UPDATE, and GROUP_COLLAB_UPDATE in that order.
-- Locks are short-lived and scoped to a specific group and object.
create table if not exists public.devden_edit_leases (
 group_code text not null references public.devden_groups(code) on delete cascade,
 object_key text not null,
 member_id uuid not null,
 expires_at timestamptz not null,
 primary key (group_code, object_key)
);
create index if not exists devden_edit_leases_expires on public.devden_edit_leases(expires_at);
alter table public.devden_edit_leases enable row level security;
revoke all on public.devden_edit_leases from public;

create or replace function public.devden_lock_object(p_code text,p_member_id uuid,p_object text,p_release boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare holder uuid; ttl timestamptz;
begin
 if length(p_object)>180 or length(p_object)<2 then return jsonb_build_object('ok',false);end if;
 if not exists(select 1 from public.devden_group_members where group_code=p_code and member_id=p_member_id and not revoked) then
   return jsonb_build_object('removed',true);
 end if;
 perform 1 from public.devden_groups where code=p_code for update;
 delete from public.devden_edit_leases where group_code=p_code and expires_at<now();
 if p_release then
  delete from public.devden_edit_leases where group_code=p_code and object_key=p_object and member_id=p_member_id;
  return jsonb_build_object('ok',true);
 end if;
 insert into public.devden_edit_leases(group_code,object_key,member_id,expires_at)
 values(p_code,p_object,p_member_id,now()+interval '10 seconds')
 on conflict (group_code,object_key) do update set member_id=excluded.member_id,expires_at=excluded.expires_at
 where public.devden_edit_leases.member_id=p_member_id or public.devden_edit_leases.expires_at<now();
 select member_id,expires_at into holder,ttl from public.devden_edit_leases where group_code=p_code and object_key=p_object;
 return jsonb_build_object('ok',holder=p_member_id,'owner',holder,'expires_at',ttl);
end $$;

create or replace function public.devden_list_locks(p_code text,p_member_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.devden_group_members where group_code=p_code and member_id=p_member_id and not revoked) then
  return jsonb_build_object('removed',true);
 end if;
 return coalesce((select jsonb_agg(jsonb_build_object('key',l.object_key,'member',l.member_id,'expires_at',l.expires_at))
 from public.devden_edit_leases l where l.group_code=p_code and l.expires_at>now()),'[]'::jsonb);
end $$;
revoke all on function public.devden_lock_object(text,uuid,text,boolean) from public;
revoke all on function public.devden_list_locks(text,uuid) from public;
grant execute on function public.devden_lock_object(text,uuid,text,boolean) to anon;
grant execute on function public.devden_list_locks(text,uuid) to anon;

-- Revocation is respected for active locks as well.
create or replace function public.devden_leader_kick_member(p_code text,p_actor_id uuid,p_member_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare leader_id uuid; changed int;
begin
  select member_id into leader_id from public.devden_group_members
  where group_code=p_code and not revoked order by joined_at,member_id limit 1;
  if leader_id is null or leader_id<>p_actor_id or p_member_id=p_actor_id then return false;end if;
  update public.devden_group_members set revoked=true
    where group_code=p_code and member_id=p_member_id and not revoked;
  get diagnostics changed = row_count;
  delete from public.devden_edit_leases where group_code=p_code and member_id=p_member_id;
  return changed>0;
end $$;
revoke all on function public.devden_leader_kick_member(text,uuid,uuid) from public;
grant execute on function public.devden_leader_kick_member(text,uuid,uuid) to anon;

-- Enforce object leases on the server, rather than trusting only CSS/JS.
-- This also preserves the existing optimistic revision CAS semantics.
create or replace function public.devden_member_update(p_code text,p_member_id uuid,p_revision bigint,p_document jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare old_doc jsonb; new_revision bigint; kind text; old_items jsonb; new_items jsonb; item_id text; before_item jsonb; after_item jsonb; key_name text;
begin
 if not exists(select 1 from public.devden_group_members where group_code=p_code and member_id=p_member_id and not revoked) then
  return jsonb_build_object('removed',true);
 end if;
 perform 1 from public.devden_groups where code=p_code for update;
 select document into old_doc from public.devden_groups where code=p_code and revision=p_revision;
 if not found then return jsonb_build_object('ok',false);end if;
 for kind in select unnest(array['devices','zones','links','notes']) loop
  old_items:=coalesce(old_doc #> array['topology',kind],'[]'::jsonb);
  new_items:=coalesce(p_document #> array['topology',kind],'[]'::jsonb);
  for item_id in select distinct obj->>'id' from (
    select jsonb_array_elements(old_items) as obj union all select jsonb_array_elements(new_items) as obj
  ) ids where obj ? 'id' loop
    select obj into before_item from jsonb_array_elements(old_items) obj where obj->>'id'=item_id limit 1;
    select obj into after_item from jsonb_array_elements(new_items) obj where obj->>'id'=item_id limit 1;
    if before_item is distinct from after_item then
      key_name:=case kind when 'devices' then 'device:' when 'zones' then 'zone:' when 'links' then 'link:' else 'note:' end||item_id;
      if exists(select 1 from public.devden_edit_leases where group_code=p_code and object_key=key_name
       and member_id<>p_member_id and expires_at>now()) then
        return jsonb_build_object('ok',false,'locked',true,'key',key_name);
      end if;
    end if;
  end loop;
 end loop;
 old_items:=coalesce(old_doc #> '{state,notes,pages}','[]'::jsonb);
 new_items:=coalesce(p_document #> '{state,notes,pages}','[]'::jsonb);
 for item_id in select distinct obj->>'id' from (
  select jsonb_array_elements(old_items) as obj union all select jsonb_array_elements(new_items) as obj
 ) ids where obj ? 'id' loop
   select obj into before_item from jsonb_array_elements(old_items) obj where obj->>'id'=item_id limit 1;
   select obj into after_item from jsonb_array_elements(new_items) obj where obj->>'id'=item_id limit 1;
   if before_item is distinct from after_item and exists(
    select 1 from public.devden_edit_leases where group_code=p_code and object_key='notes:'||item_id
    and member_id<>p_member_id and expires_at>now()) then
    return jsonb_build_object('ok',false,'locked',true,'key','notes:'||item_id);
   end if;
 end loop;
 update public.devden_group_members set seen_at=now() where group_code=p_code and member_id=p_member_id;
 update public.devden_groups set document=p_document,revision=revision+1,updated_at=now()
 where code=p_code and revision=p_revision returning revision into new_revision;
 return jsonb_build_object('ok',true,'revision',new_revision);
end $$;
revoke all on function public.devden_member_update(text,uuid,bigint,jsonb) from public;
grant execute on function public.devden_member_update(text,uuid,bigint,jsonb) to anon;

-- Store a character offset for Word-style presence markers in Notes.
alter table public.devden_edit_leases add column if not exists cursor_pos integer not null default -1;
create or replace function public.devden_lock_object(p_code text,p_member_id uuid,p_object text,p_release boolean default false,p_cursor integer default -1)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare holder uuid; ttl timestamptz;
begin
 if length(p_object)>180 or length(p_object)<2 then return jsonb_build_object('ok',false);end if;
 if not exists(select 1 from public.devden_group_members where group_code=p_code and member_id=p_member_id and not revoked) then
   return jsonb_build_object('removed',true);
 end if;
 perform 1 from public.devden_groups where code=p_code for update;
 delete from public.devden_edit_leases where group_code=p_code and expires_at<now();
 if p_release then
  delete from public.devden_edit_leases where group_code=p_code and object_key=p_object and member_id=p_member_id;
  return jsonb_build_object('ok',true);
 end if;
 insert into public.devden_edit_leases(group_code,object_key,member_id,expires_at,cursor_pos)
 values(p_code,p_object,p_member_id,now()+interval '10 seconds',greatest(-1,least(p_cursor,1000000)))
 on conflict (group_code,object_key) do update set member_id=excluded.member_id,expires_at=excluded.expires_at,cursor_pos=excluded.cursor_pos
 where public.devden_edit_leases.member_id=p_member_id or public.devden_edit_leases.expires_at<now();
 select member_id,expires_at into holder,ttl from public.devden_edit_leases where group_code=p_code and object_key=p_object;
 return jsonb_build_object('ok',holder=p_member_id,'owner',holder,'expires_at',ttl);
end $$;
create or replace function public.devden_list_locks(p_code text,p_member_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.devden_group_members where group_code=p_code and member_id=p_member_id and not revoked) then
  return jsonb_build_object('removed',true);
 end if;
 return coalesce((select jsonb_agg(jsonb_build_object('key',l.object_key,'member',l.member_id,'expires_at',l.expires_at,'cursor_pos',l.cursor_pos))
 from public.devden_edit_leases l where l.group_code=p_code and l.expires_at>now()),'[]'::jsonb);
end $$;
revoke all on function public.devden_lock_object(text,uuid,text,boolean,integer) from public;
grant execute on function public.devden_lock_object(text,uuid,text,boolean,integer) to anon;
revoke all on function public.devden_list_locks(text,uuid) from public;
grant execute on function public.devden_list_locks(text,uuid) to anon;
-- Revoke old 4-argument version so PostgREST will resolve the five-argument call unambiguously.
drop function if exists public.devden_lock_object(text,uuid,text,boolean);
