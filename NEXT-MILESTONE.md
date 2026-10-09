# Help Get Up: next milestone (Oct 9, 2026, ~10:00–10:45 AM ET)

Private copy: this folder is a git worktree of /workspace/helpgetup.com on local branch `next-milestone-2026-10-09` (commit b61ba5a, on top of the walk-test branch at 131f087). Not pushed, not deployed. The original checkout and its branch weren't touched.
Evidence: ../next-milestone-evidence/ (screenshots at 390px phone width, Lighthouse JSON, flow-before.json / flow-after.json).

## What changed
1. **Phone-first hero.** The big logo is hidden on phones (the header already shows the brand) and lazy-loaded, so phones never download it. The "Start with food" button now sits at 316px from the top of a 390x844 screen, down from 637px.
2. **Header "Start with food" opens the first question.** Before, it only scrolled. After every step, focus moves to the new question, so screen readers and keyboards land in the right place.
3. **Spanish follow-through** (a leftover from the review). The skip link, the header button and the offline banner switch to Spanish along with the walk. The Spanish is a draft and still needs a native speaker's review.
4. **Plain, food-only homepage copy.** The old "How it works" and "Situations" sections promised utility bills and rides, which the site doesn't do. They now describe the actual walk. The "What's on the list" counts are computed from the data files (47 pantries, 15 meals, 21 produce stops, 4 fridges, 24 sites for people 60+), so they can't drift from the data.
5. **New /albany-food-list page.** All 111 places on one server-rendered page, with address, phone, hours as published, notes, source and check date, plus ItemList JSON-LD and print styles. This is what AI assistants and search engines can read without running the walk. It's linked from the home page, footer, sitemap and llms.txt. llms.txt was rewritten to cover the 60+ meals, Veggie Mobile (low-cost, not free), Spanish, and the list page. The sitemap date now follows the data check date.
6. Removed the 4 old unused-variable lint warnings.

## Checks
tsc clean · eslint 0/0 · next build OK · check:food ok · check:seniors ok · axe (WCAG 2.0/2.1/2.2 AA) 0 violations on home, results (12206), Spanish and the list page · 0 console errors · no horizontal overflow at 390px.
Lighthouse mobile: before, home was 100/100/100/100. After, home is 99/100/100/100 and the list page is 97/100/100/100. Perf moves a point or two between runs.

## Needs Chad
- Is the public /albany-food-list page OK? It names every pantry on one page, all copied from public sources.
- Spanish native review (still open).
- All of the earlier review's judgment calls are still open (Mater Christi holidays, Sacred Heart end time, the Unity flyer stop, card length).

## Left
- A Spanish version of /albany-food-list.
- An iOS Safari test of the .ics download.
- The mapsHref comment fix (Google Maps, not Apple Maps).
- Deploy only on Chad's word.
