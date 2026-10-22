# HelpGetUp

Landing + waitlist site for [helpgetup.com](https://helpgetup.com).

**Take the next step.** Early-access outcome-resolution assistant — name a goal, get a concrete next action, decide whether to take it.

## Stack

- Next.js App Router (TypeScript)
- Waitlist via Route Handler → [FormSubmit](https://formsubmit.co) → `cjames112@gmail.com`
- Brand lockup: `public/helpgetup-logo.png`

## Local

```bash
npm install
npm run dev
```

## Albany County food demo

The homepage walk is food-only and Albany County only. Stops live in `src/data/albany-food.ts`. Hours are copied from the [Food Connect map](https://map.thefoodpantries.org/) (checked 2026-09-30), including the Albany County pantries and community meals on that map, and from the February 2026 Albany resource flyer for Unity on the Move at A Child’s Place. SNAP links go to America.gov, NYS myBenefits, and the Albany County hotline. The demo does not collect IDs or place calls.

### Freshness, offline, Spanish (Oct 9, 2026)
- `npm run verify:sources`: compares every row with the Food Connect map's own published data; `--write` stamps `src/data/verified.ts`. Each card shows "Source updated" and "Last verified by HelpGetUp"; rows whose source is over 12 months old get a "call before you go" flag.
- `npm run check:links`: status of every official and source URL.
- Offline: `public/sw.js` (production only) keeps the last loaded page and its assets, so the walk works without signal after one visit. It never caches `/api/*`.
- Spanish: the toggle above the walk (or `/?lang=es`) switches the walk to Spanish. Source names, hours and notes stay in English as published. The Spanish text in `src/lib/walk-text.ts` is a first draft that needs a native speaker's review.

### Senior meals and Veggie Mobile (Oct 9, 2026)
- Senior (60+) meal sites: `src/data/albany-senior-meals.ts`. All 24 Albany County Department for Aging congregate dining sites, plus how to ask for home-delivered meals (Albany County NY Connects, 518-447-7177). Days and times appear only where the county or the site's sponsor publishes them (LifePath Community Dining, Colonie Senior Service Centers' monthly newsletter, Town of Berne). Every other site shows "60+, call first" with the official phone. When sources disagree, the card says so. The walk shows this group only after the person checks "I'm 60 or older" or taps "60 or older? Show senior meal sites".
- Capital Roots Veggie Mobile: `src/data/albany-food-veggie.ts`. 14 Albany County stops copied from Capital Roots' own 2026 schedule PDF (effective June 15, 2026). The PDF is an image, so `verify:sources` checks that the Veggie Mobile page still links the same file and that its bytes haven't changed. A changed hash means re-read it by hand.
- `npm run check:seniors` checks the data rules (no slot without a published day and time, no end times, 24 sites, every phone dialable) and the ranking.
- `verify:sources` also checks LifePath's page (parsed), the Berne page, and the CSSC newsletter hash. The county's congregate dining panels are drawn by JavaScript, so pass `--county-snapshot <file>`, rendered by `render-county-congregate.mjs` in the portfolio evidence folder. Without the snapshot, county-only sites print "not checked" and keep their old verified date.
- Phone links: an extension or "press N" now dials as a pause (`tel:+15184631516,110`).

## Deploy

Vercel project `helpgetup-com`, domain `helpgetup.com` / `www.helpgetup.com`.

## Talk button: Rosa, the voice helper (Oct 22, 2026, branch `talk-button`)

Same technology as the albanyaiguy.com Grok voice button (branch `grok-voice`), with its own identity and job.
Rosa is a warm, judgment-free AI voice helper for food help in Albany County. She is not the Albany AI Guy.

- Browser talks straight to xAI's Grok Voice Agent (`wss://api.x.ai/v1/realtime`) with a short-lived client
  secret from `POST /api/talk/token`. `XAI_API_KEY` never leaves the server. No LiveKit.
- Facts come only from this site's data. `find_food` and `senior_meals` (`src/lib/talk/food-tool.ts`) run in
  the browser on `src/data/*` and return published hours word for word, with "call before you go" flags.
- Hand-offs: restaurants, things to do, businesses, contractors → Albany AI Guy (albany A I guy dot com);
  rent, housing, shelter, utilities, heating, other benefits → 211; emergencies → 911; self-harm → 988.
- "Good day" greeting, says she's an AI. 518 is always "five-one-eight" (`replace` map and pre-spoken numbers).
- Caps: 5 minutes (wrap-up line at 4:40), 30 s idle hang-up, hang-up when the tab closes; per-IP, per-minute and
  daily token limits.
- `public/sw.js` still never caches `/api/*`.

Env (Vercel project `helpgetup-com`; nothing is set yet, so the button answers "Live voice is off right now"):

| Var | Default | |
| --- | --- | --- |
| `XAI_API_KEY` | (unset = off) | xAI key, server only |
| `TALK_ENABLED` | on | `0` turns voice off |
| `TALK_GROK_VOICE` | `ara` | warm and friendly; alternates `celeste`, `ursa`, `carina`. `leo` (Albany AI Guy) is refused. |
| `TALK_GROK_MODEL` | `grok-voice-3.0` | |
| `TALK_PER_IP_LIMIT` / `TALK_PER_IP_WINDOW_S` / `TALK_GLOBAL_PER_MIN` / `TALK_DAILY_CAP` | 4 / 600 / 8 / 60 | |
| `TALK_ALERT_WEBHOOK_URL` + `TALK_ALERT_WEBHOOK_KEY` | unset = no-op | short written summary after each call (long digit runs masked) |

Tests: `npm test` (mocked; no network, no paid calls). Paid smoke test, only with Chad's OK:
`XAI_API_KEY=... npm run smoke:voice -- --yes-paid` (about 3 to 6 cents; refuses without the flag).
