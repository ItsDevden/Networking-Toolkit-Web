-- Run in the Supabase SQL editor. No user accounts or passwords are needed.
create table if not exists public.devden_groups (
 code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{12}$'),
 name text not null check (length(name) between 1 and 64),
 document jsonb not null,
 revision bigint not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.devden_groups enable row level security;
revoke all on table public.devden_groups from anon, authenticated;
create or replace function public.devden_create_group(p_code text,p_name text,p_document jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if p_code !~ '^[A-HJ-NP-Z2-9]{12}$' or length(p_name) not between 1 and 64 then raise exception 'Invalid group details'; end if;
 insert into public.devden_groups(code,name,document) values(p_code,p_name,p_document);
 return true;
end $$;
create or replace function public.devden_read_group(p_code text)
returns jsonb language sql security definer set search_path=public as $$
 select jsonb_build_object('name',name,'document',document,'revision',revision) from public.devden_groups where code=p_code;
$$;
create or replace function public.devden_update_group(p_code text,p_revision bigint,p_document jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare new_revision bigint;
begin
 update public.devden_groups set document=p_document,revision=revision+1,updated_at=now()
 where code=p_code and revision=p_revision returning revision into new_revision;
 if new_revision is null then return jsonb_build_object('ok',false);end if;
 return jsonb_build_object('ok',true,'revision',new_revision);
end $$;
revoke all on function public.devden_create_group(text,text,jsonb) from public;
revoke all on function public.devden_read_group(text) from public;
revoke all on function public.devden_update_group(text,bigint,jsonb) from public;
grant execute on function public.devden_create_group(text,text,jsonb) to anon;
grant execute on function public.devden_read_group(text) to anon;
grant execute on function public.devden_update_group(text,bigint,jsonb) to anon;
