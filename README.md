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

Everything fixed about the trip is hard-coded at the top of `app.js` — edit there before you go:

- `ROUNDS` — courses, tee times, notes, par / course rating / slope (placeholders; check the scorecards).
- `PLAYERS` — the eight names and starting handicap indexes.
- `RULES` — place points (8·6·4·2), allowance %, scramble points, the 32-point pivot.

### The maths

- Course handicap = round(index × slope ÷ 113 + (CR − par)); playing handicap applies the allowance %.
- After each stableford round: index −0.5 per point above 32, +0.5 per point below. Applied in date order, so each day's course handicap uses the index entering that day. Scramble day doesn't move indexes.
- Week points per round default to 8 · 6 · 4 · 2 for 1st–4th; ties share the points of the places they cover. Scramble winners get 4 each (editable).

### Sharing

Data is stored in the phone's localStorage. **Copy share link** in Settings puts the whole state into the URL — anyone who opens it gets an exact copy. Nominate one scorer and have them re-share after each round.
