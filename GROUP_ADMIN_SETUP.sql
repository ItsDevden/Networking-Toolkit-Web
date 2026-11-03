-- Run after GROUP_SETUP.sql. This adds admin-only management and anonymous classroom memberships.
-- In Supabase Authentication, create your one admin user. Then add its UUID to
-- public.devden_admins using the SQL statement in GROUP_SETUP.md.
create table if not exists public.devden_admins (
 user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.devden_group_members (
 group_code text not null references public.devden_groups(code) on delete cascade,
 member_id uuid not null,
 nickname text not null,
 joined_at timestamptz not null default now(),
 seen_at timestamptz,
 revoked boolean not null default false,
 primary key(group_code,member_id)
);
create index if not exists devden_group_members_last_seen on public.devden_group_members(seen_at);
alter table public.devden_admins enable row level security;
alter table public.devden_group_members enable row level security;
revoke all on public.devden_admins from anon, authenticated;
revoke all on public.devden_group_members from anon, authenticated;

create or replace function public.devden_register_member(p_code text, p_member_id uuid, p_nickname text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare g public.devden_groups%rowtype; m public.devden_group_members%rowtype;
begin
 if length(btrim(p_nickname))=0 then raise exception 'Invalid display name'; end if;
 select * into g from public.devden_groups where code=p_code;
 if not found then return null; end if;
 select * into m from public.devden_group_members where group_code=p_code and member_id=p_member_id;
 if found and m.revoked then raise exception 'This membership was removed'; end if;
 insert into public.devden_group_members(group_code,member_id,nickname,seen_at)
 values (p_code,p_member_id,p_nickname,now())
 on conflict (group_code,member_id) do update set nickname=excluded.nickname,seen_at=now();
 return jsonb_build_object('name',g.name,'document',g.document,'revision',g.revision);
end $$;
create or replace function public.devden_member_read(p_code text,p_member_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare g public.devden_groups%rowtype;
begin
 if not exists(select 1 from public.devden_group_members where group_code=p_code and member_id=p_member_id and not revoked) then
  return jsonb_build_object('removed',true);
 end if;
 update public.devden_group_members set seen_at=now() where group_code=p_code and member_id=p_member_id;
 select * into g from public.devden_groups where code=p_code;
 if not found then return jsonb_build_object('removed',true); end if;
 return jsonb_build_object('name',g.name,'document',g.document,'revision',g.revision);
end $$;
create or replace function public.devden_member_update(p_code text,p_member_id uuid,p_revision bigint,p_document jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare new_revision bigint;
begin
 if not exists(select 1 from public.devden_group_members where group_code=p_code and member_id=p_member_id and not revoked) then
  return jsonb_build_object('removed',true);
 end if;
 update public.devden_group_members set seen_at=now() where group_code=p_code and member_id=p_member_id;
 update public.devden_groups set document=p_document,revision=revision+1,updated_at=now()
 where code=p_code and revision=p_revision returning revision into new_revision;
 if new_revision is null then return jsonb_build_object('ok',false); end if;
 return jsonb_build_object('ok',true,'revision',new_revision);
end $$;
create or replace function public.devden_member_leave(p_code text,p_member_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
 delete from public.devden_group_members where group_code=p_code and member_id=p_member_id and not revoked;
 return true;
end $$;

create or replace function public.devden_admin_groups()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.devden_admins where user_id=auth.uid()) then raise exception 'Not authorized'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'code',g.code,'name',g.name,'updated_at',g.updated_at,
  'members',coalesce((select jsonb_agg(jsonb_build_object(
   'id',m.member_id,'name',m.nickname,'online',m.seen_at>now()-interval '25 seconds',
   'last_seen',m.seen_at,'joined_at',m.joined_at,'revoked',m.revoked
  ) order by m.joined_at) from public.devden_group_members m where m.group_code=g.code and not m.revoked),'[]'::jsonb)
 ) order by g.updated_at desc) from public.devden_groups g),'[]'::jsonb);
end $$;
create or replace function public.devden_admin_delete_group(p_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.devden_admins where user_id=auth.uid()) then raise exception 'Not authorized'; end if;
 delete from public.devden_groups where code=p_code;
 return found;
end $$;
create or replace function public.devden_admin_kick_member(p_code text,p_member_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.devden_admins where user_id=auth.uid()) then raise exception 'Not authorized'; end if;
 update public.devden_group_members set revoked=true where group_code=p_code and member_id=p_member_id and not revoked;
 return found;
end $$;
-- Keep old function names for backward compatibility, but revoke their public access.
-- The updated website exclusively uses the member-aware functions above.
revoke execute on function public.devden_read_group(text) from anon,authenticated;
revoke execute on function public.devden_update_group(text,bigint,jsonb) from anon,authenticated;
revoke all on function public.devden_register_member(text,uuid,text) from public;
revoke all on function public.devden_member_read(text,uuid) from public;
revoke all on function public.devden_member_update(text,uuid,bigint,jsonb) from public;
revoke all on function public.devden_member_leave(text,uuid) from public;
grant execute on function public.devden_register_member(text,uuid,text) to anon;
grant execute on function public.devden_member_read(text,uuid) to anon;
grant execute on function public.devden_member_update(text,uuid,bigint,jsonb) to anon;
grant execute on function public.devden_member_leave(text,uuid) to anon;
revoke all on function public.devden_admin_groups() from public;
revoke all on function public.devden_admin_delete_group(text) from public;
revoke all on function public.devden_admin_kick_member(text,uuid) from public;
grant execute on function public.devden_admin_groups() to authenticated;
grant execute on function public.devden_admin_delete_group(text) to authenticated;
grant execute on function public.devden_admin_kick_member(text,uuid) to authenticated;
