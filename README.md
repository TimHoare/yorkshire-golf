# Yorkshire Golf Week 2026

Mobile-first web app for the 7–11 September trip: itinerary, real course data, players and handicap indexes, swipeable score entry, automatic index/course-handicap maths, live standings — synced live between every phone.

**Stack:** React 19 + TypeScript + React Router 7, built with Vite, tested with Vitest. Supabase (Postgres + realtime) for multi-phone sync. Deployed to GitHub Pages by GitHub Actions on every push to `main`.

Live at: https://timhoare.github.io/yorkshire-golf/

## Develop

```
npm install
npm run dev      # local dev server with hot reload
npm test         # vitest: scoring engine, app flow, sync engine
npm run build    # type-check + production build to dist/
```

## Structure

- `src/data/trip.ts` — everything fixed about the trip: rounds, real scorecards (men's yellow tees from each club's published card), players, rules. Tee times and groups are placeholders until the tee sheet is settled.
- `src/lib/scoring.ts` — pure scoring engine: WHS course/playing handicaps, stableford tallies, index drift (±0.5 per point from 32), week points, scramble, hidden pairs.
- `src/lib/store.ts` — app store with localStorage persistence and Supabase live sync: local-first writes, an offline outbox that retries, realtime subscription applying other phones' changes.
- `src/pages/` — Trip, Round (info: course facts, map, handicaps, course card), Scoring (swipe between holes, +/- against par), Players, Standings.
- Routes: `#/trip`, `#/players`, `#/standings`, `#/round/:rid`, `#/round/:rid/score/:hole`. The last route is remembered so a PWA cold start reopens where you were.

## Sync setup

Already configured for the trip's Supabase project in `src/config.ts` (public URL + publishable key — safe to commit; access control is the RLS policies). To point at a fresh project: run `supabase-schema.sql` in the Supabase SQL editor, then put the new Project URL and publishable key in `src/config.ts`. Empty values = single-phone localStorage mode.

## Deploy

Push to `main`. The `Deploy to GitHub Pages` action runs tests, builds, and publishes `dist/`. First-time repo setup: Settings → Pages → Source: **GitHub Actions**.
