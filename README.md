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

## Deploy

Vercel project `helpgetup-com`, domain `helpgetup.com` / `www.helpgetup.com`.
