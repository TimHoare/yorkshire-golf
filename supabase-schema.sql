-- Yorkshire Golf Week — database setup.
-- Run this once in your Supabase project: Dashboard → SQL Editor → paste → Run.
-- Safe to re-run.

-- One row per player per hole per round. gross is null when a score is cleared.
create table if not exists hole_scores (
  round_id   text not null,
  player_id  text not null,
  hole       smallint not null check (hole between 1 and 18),
  gross      smallint check (gross between 1 and 20),
  updated_at timestamptz not null default now(),
  primary key (round_id, player_id, hole)
);

-- Scramble day: one row per team per hole.
create table if not exists team_scores (
  round_id   text not null,
  team       smallint not null,
  hole       smallint not null check (hole between 1 and 18),
  gross      smallint check (gross between 1 and 20),
  updated_at timestamptz not null default now(),
  primary key (round_id, team, hole)
);

-- Hidden-pairs draw per round: the sealed pairs and whether they've been revealed.
create table if not exists pair_draws (
  round_id   text primary key,
  pairs      jsonb not null,
  revealed   boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Access model: the app URL is the secret. Anyone with the link can read and
-- write scores (it's a mates' trip, not a bank). RLS is on with open policies
-- so the anon key can't touch anything except these three tables.
alter table hole_scores enable row level security;
alter table team_scores enable row level security;
alter table pair_draws  enable row level security;

drop policy if exists "open access" on hole_scores;
create policy "open access" on hole_scores for all using (true) with check (true);
drop policy if exists "open access" on team_scores;
create policy "open access" on team_scores for all using (true) with check (true);
drop policy if exists "open access" on pair_draws;
create policy "open access" on pair_draws for all using (true) with check (true);

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
