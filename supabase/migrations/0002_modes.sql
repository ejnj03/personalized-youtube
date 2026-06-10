-- Migration 0002: modes — parallel personalization sessions per (visitor, site).
--
-- A "mode" is a save slot: an independent (config, chat history) pair the
-- visitor can name and switch between via chat-panel pills. Existing data
-- pre-dates modes and is backfilled into a per-(visitor, site) "Default" row.

create table if not exists modes (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references visitors(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);
create index if not exists modes_visitor_site_idx on modes(visitor_id, site_id);

-- Add mode_id as nullable so we can backfill, then enforce NOT NULL.
alter table preferences add column if not exists mode_id uuid references modes(id) on delete cascade;
alter table chat_turns add column if not exists mode_id uuid references modes(id) on delete cascade;

-- Backfill: one Default mode per unique (visitor, site) that has any data,
-- then point existing prefs + chat_turns at it.
do $$
declare
  vs record;
  new_mode_id uuid;
begin
  for vs in
    select distinct visitor_id, site_id from (
      select visitor_id, site_id from preferences where mode_id is null
      union
      select visitor_id, site_id from chat_turns where mode_id is null
    ) existing
  loop
    insert into modes (visitor_id, site_id, title)
    values (vs.visitor_id, vs.site_id, 'Default')
    returning id into new_mode_id;

    update preferences
       set mode_id = new_mode_id
     where visitor_id = vs.visitor_id and site_id = vs.site_id and mode_id is null;

    update chat_turns
       set mode_id = new_mode_id
     where visitor_id = vs.visitor_id and site_id = vs.site_id and mode_id is null;
  end loop;
end $$;

-- Now mode_id is required on both tables going forward.
alter table preferences alter column mode_id set not null;
alter table chat_turns  alter column mode_id set not null;

-- Composite indexes for the most common query: read one visitor+mode's data.
create index if not exists preferences_visitor_site_mode_created_idx
  on preferences(visitor_id, site_id, mode_id, created_at);
create index if not exists chat_turns_visitor_site_mode_created_idx
  on chat_turns(visitor_id, site_id, mode_id, created_at desc);
