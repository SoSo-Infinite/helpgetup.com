# Help Get Up: build-out 2 (Oct 9, 2026, ~9:00–9:10 PM ET)
Local branch `build-out-2-2026-10-09` (on next-milestone-2026-10-09 adaa303). Not pushed, not deployed.
Evidence: /workspace/portfolio-push-2026-10-09/helpgetup/build-out-2/

## What changed
1. **Spanish full list at /albany-food-list/es.** Same 111 places, Spanish headings, labels, help lines, 60+ program text and dates ("9 de oct. de 2026"). Place names, addresses, published hours and notes stay in English as the sources publish them (marked lang="en"), and the page says so. A visible "Traducción preliminar: falta la revisión de un hablante nativo" notice stays until a native speaker reviews it (data-needs-native-review).
2. **Shared component.** Both pages render from src/components/FoodList.tsx, so the English and Spanish lists can't drift apart. English output is unchanged apart from a "Lista en español" link.
3. **hreflang everywhere.** Page metadata has en/es/x-default alternates; sitemap.xml lists /es with xhtml:link alternates; llms.txt lists the Spanish page.
4. **mapsHref comment fixed.** It said Apple devices open Apple Maps; the link is a Google Maps search URL on every device.

## Checks
tsc clean · eslint clean · next build OK (/albany-food-list/es static) · check:food ok · check:seniors ok · axe 0 on both list pages (mobile) · 0 console errors · no overflow at 390px · no broken links.

## Known limits
- `<html lang>` stays "en" (root layout); the Spanish page sets lang="es" on header, main and footer instead. A route-group layout would fix it if Chad wants it.
- Spanish is a draft. Needs a native speaker review before it ships (same as the walk).

## Ready to ship
With the rest of next-milestone, on Chad's "yes HGU merge".
