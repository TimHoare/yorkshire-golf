# Yorkshire Golf Week 2026

Mobile-first web app for the 7–11 September trip: itinerary, players and handicap indexes, score entry, automatic index/course-handicap maths, and the week's leaderboard.

Plain HTML/CSS/JS — no build step. Live multi-phone score sync via Supabase (optional; without it the app runs single-phone from localStorage).

## Run it

Open `index.html` in a browser, or serve the folder (e.g. `python3 -m http.server`) and open it on your phone. Host it anywhere static (GitHub Pages works: Settings → Pages → deploy from `main`). On iPhone/Android use "Add to Home Screen" for an app-like install.

## Live sync (everyone scores on their own phone)

1. Create a free project at [supabase.com](https://supabase.com) (any name/region; note the database password it asks you to set — you won't need it day to day).
2. In the dashboard: **SQL Editor** → paste the contents of `supabase-schema.sql` → **Run**.
3. **Settings → API**: copy the **Project URL** and the **anon public** key into `config.js`, commit and push.

That's it — every phone with the link now shares one live scoreboard. Scores entered with no signal queue on the phone (the header pill shows *Offline · n to send*) and send automatically when signal returns. Both `config.js` values are public by design; access control is the RLS policies in the schema (anyone with the link can score — it's a mates' trip).

On first open each phone asks "Who's this?" — picking a name makes score entry default to your group and tags your rows; it's remembered per phone and switchable from the ⚙ sheet.

## How it works

- **Trip** — itinerary for the five rounds (tee times, notes, course figures), plus the rules.
- **Players** — current index, movement so far, and course handicap for the next round.
- **Scores** — pick a day, enter stableford points per player. Hidden-pairs days have a sealed draw and reveal; scramble day has team assignment and team scores.
- **Standings** — week points, per-round places, index drift, round-by-round table, pairs results.
- **⚙** — share link, JSON backup/restore, clear scores.

### Setting it up

Everything fixed about the trip is hard-coded at the top of `app.js`:

- `ROUNDS` — one entry per day: club, par / course rating / slope, format (`stableford` or `scramble`), whether hidden pairs run, the 18-hole scorecard (`holes`, par + stroke index) and the `groups` (tee time + player ids; on scramble day the groups are the two teams).
- `PLAYERS` — the eight names and starting handicap indexes.
- `RULES` — week points 8/6/4/2, allowance, scramble points, the 32-point pivot, and the 25/20/15/10 % scramble team allowance.

Scorecards, tee times, groups and course figures are placeholders — check them against the real cards and tee sheet before the trip.

