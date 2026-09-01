-- Yorkshire Golf Week — database setup.
-- Run this once in your Supabase project: Dashboard → SQL Editor → paste → Run.
-- Safe to re-run.

-- One row per player per hole per round. gross is null when a score is cleared;
-- 0 means the ball was picked up (hole played, no score).
create table if not exists hole_scores (
  round_id   text not null,
  player_id  text not null,
  hole       smallint not null check (hole between 1 and 18),
  gross      smallint check (gross between 0 and 20),
  updated_at timestamptz not null default now(),
  primary key (round_id, player_id, hole)
);

-- Scramble day: one row per team per hole.
create table if not exists team_scores (
  round_id   text not null,
  team       smallint not null,
  hole       smallint not null check (hole between 1 and 18),
  gross      smallint check (gross between 0 and 20),
  updated_at timestamptz not null default now(),
  primary key (round_id, team, hole)
);

-- Databases created before pickups existed allow only 1–20; widen to 0–20.
alter table hole_scores drop constraint if exists hole_scores_gross_check;
alter table hole_scores add constraint hole_scores_gross_check check (gross between 0 and 20);
alter table team_scores drop constraint if exists team_scores_gross_check;
alter table team_scores add constraint team_scores_gross_check check (gross between 0 and 20);

-- Hidden-pairs draw per round: the sealed pairs and whether they've been revealed.
create table if not exists pair_draws (
  round_id   text primary key,
  pairs      jsonb not null,
  revealed   boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Group draw per round: player ids per tee group, overriding the placeholders.
create table if not exists group_draws (
  round_id   text primary key,
  groups     jsonb not null,
  updated_at timestamptz not null default now()
);

-- Side bets: one row per round, tee group, kind (cuckoo/camel/fish/threeputt)
-- and hole. counts = { player_id: n }; last_pid = who had the last one there.
create table if not exists bit_events (
  round_id   text not null,
  grp        smallint not null,
  kind       text not null check (kind in ('cuckoo','camel','fish','threeputt')),
  hole       smallint not null check (hole between 1 and 18),
  counts     jsonb not null default '{}',
  last_pid   text,
  updated_at timestamptz not null default now(),
  primary key (round_id, grp, kind, hole)
);

-- Side-bet stakes (pence each), one shared row edited from app settings.
create table if not exists stakes (
  id         smallint primary key,
  stakes     jsonb not null,
  updated_at timestamptz not null default now()
);

-- Access model: the app URL is the secret. Anyone with the link can read and
-- write scores (it's a mates' trip, not a bank). RLS is on with open policies
-- so the anon key can't touch anything except these tables.
alter table hole_scores enable row level security;
alter table team_scores enable row level security;
alter table pair_draws  enable row level security;
alter table group_draws enable row level security;
alter table bit_events  enable row level security;
alter table stakes      enable row level security;

drop policy if exists "open access" on hole_scores;
create policy "open access" on hole_scores for all using (true) with check (true);
drop policy if exists "open access" on team_scores;
create policy "open access" on team_scores for all using (true) with check (true);
drop policy if exists "open access" on pair_draws;
create policy "open access" on pair_draws for all using (true) with check (true);
drop policy if exists "open access" on group_draws;
create policy "open access" on group_draws for all using (true) with check (true);
drop policy if exists "open access" on bit_events;
create policy "open access" on bit_events for all using (true) with check (true);
drop policy if exists "open access" on stakes;
create policy "open access" on stakes for all using (true) with check (true);

-- Realtime: broadcast row changes to connected phones.
do $$
begin
  alter publication supabase_realtime add table hole_scores;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table team_scores;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table pair_draws;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table group_draws;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table bit_events;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table stakes;
exception when duplicate_object then null;
end $$;
