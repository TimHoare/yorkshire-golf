# Yorkshire Golf Week 2026

Mobile-first web app for the 7–11 September trip: itinerary, players and handicap indexes, score entry, automatic index/course-handicap maths, and the week's leaderboard.

Plain HTML/CSS/JS — no build step, no dependencies.

## Run it

Open `index.html` in a browser, or serve the folder (e.g. `python3 -m http.server`) and open it on your phone. Host it anywhere static (GitHub Pages works: Settings → Pages → deploy from `main`). On iPhone/Android use "Add to Home Screen" for an app-like install.

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

