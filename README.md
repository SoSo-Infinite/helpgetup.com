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

## Deploy

Vercel project `helpgetup-com`, domain `helpgetup.com` / `www.helpgetup.com`.
