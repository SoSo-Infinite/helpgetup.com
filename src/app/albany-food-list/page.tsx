import type { Metadata } from "next";
import Link from "next/link";
import { FOOD_PLACES, LIST_CHECKED_ON, OFFICIAL, type FoodKind, type FoodPlace } from "@/data/albany-food";
import { SENIOR_MEAL_SITES, SENIOR_PROGRAM } from "@/data/albany-senior-meals";
import { formatIsoDate, formatPhone, mapsHref, phoneHref } from "@/lib/food-week";

/**
 * The whole Albany County list as plain, server-rendered HTML: one page a person can print or
 * share, and a page search engines and AI assistants can read without running the food walk.
 * Every line comes from the data files (src/data/*), the same rows the walk uses.
 */

const TITLE = "Albany County food help list: pantries, meals, produce, 60+ meals";
const DESCRIPTION =
  "Every food pantry, community meal, produce stop, community fridge, and 60+ meal site HelpGetUp lists in Albany County, NY, with published hours, phone numbers, and the source for each.";

export const metadata: Metadata = {
  title: `${TITLE} | HelpGetUp`,
  description: DESCRIPTION,
  alternates: { canonical: "/albany-food-list" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "https://helpgetup.com/albany-food-list", siteName: "HelpGetUp", type: "website" },
};

const GROUPS: { kind: FoodKind; title: string; id: string }[] = [
  { kind: "pantry", title: "Food pantries", id: "pantries" },
  { kind: "meal", title: "Community meals", id: "meals" },
  { kind: "produce", title: "Produce stops", id: "produce" },
  { kind: "fridge", title: "Community fridges", id: "fridges" },
];

const byPlace = (a: { city: string; name: string }, b: { city: string; name: string }) =>
  a.city.localeCompare(b.city) || a.name.localeCompare(b.name);

function placeLd(p: { name: string; address: string; city: string; zip: string; phone: string }) {
  return {
    "@type": "Place",
    name: p.name,
    address: {
      "@type": "PostalAddress",
      streetAddress: p.address,
      addressLocality: p.city,
      postalCode: p.zip,
      addressRegion: "NY",
      addressCountry: "US",
    },
    telephone: formatPhone(p.phone),
  };
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: TITLE,
  description: DESCRIPTION,
  url: "https://helpgetup.com/albany-food-list",
  numberOfItems: FOOD_PLACES.length + SENIOR_MEAL_SITES.length,
  itemListElement: [...FOOD_PLACES.slice().sort(byPlace), ...SENIOR_MEAL_SITES.slice().sort(byPlace)].map((p, i) => ({
    "@type": "ListItem",
    position: i + 1,
    item: placeLd(p),
  })),
};

function FoodRow({ p }: { p: FoodPlace }) {
  return (
    <li className="fl-row">
      <h3>{p.name}</h3>
      <p>
        {p.address}, {p.city} {p.zip} ·{" "}
        <a href={mapsHref(p)} target="_blank" rel="noopener noreferrer">
          Map
        </a>{" "}
        · <a href={phoneHref(p.phone)}>{formatPhone(p.phone)}</a>
      </p>
      <p>
        <strong>Hours as published:</strong> {p.hoursRaw || (p.alwaysOpen ? "24/7" : "Not published. Call first.")}
      </p>
      {p.unconfirmed ? (
        <p className="stale-flag">
          Could not confirm: no current public source lists this stop (only an older flyer). Call before you go.
        </p>
      ) : null}
      {p.note ? <p className="fl-note">{p.note}</p> : null}
      <p className="fl-src">
        Source:{" "}
        <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">
          {p.sourceName}
        </a>
        {p.sourceUpdated ? `, updated ${formatIsoDate(p.sourceUpdated)}` : ""}
        {p.verifiedOn ? `. Checked by HelpGetUp ${formatIsoDate(p.verifiedOn)}.` : "."}
      </p>
    </li>
  );
}

export default function FoodList() {
  const groups = GROUPS.map((g) => ({ ...g, rows: FOOD_PLACES.filter((p) => p.kind === g.kind).sort(byPlace) }));
  const seniors = SENIOR_MEAL_SITES.slice().sort(byPlace);
  return (
    <>
      <a className="skip-link" href="#list-top">
        Skip to the list
      </a>
      <header className="site-header">
        <div className="wrap header-inner">
          <Link className="brand-lockup" href="/">
            <span className="brand-text">
              <span className="brand-name">
                HelpGet<span className="up">Up</span>
              </span>
              <span className="brand-tag">Albany County food list</span>
            </span>
          </Link>
          <Link className="header-cta" href="/#walk">
            Find food near me
          </Link>
        </div>
      </header>
      <main id="list-top" className="wrap fl">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <nav className="fl-crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link> <span aria-hidden="true">›</span> <span aria-current="page">Full food list</span>
        </nav>
        <h1>Food help in Albany County, NY</h1>
        <p className="fl-lede">
          {FOOD_PLACES.length + SENIOR_MEAL_SITES.length} places, grouped by type and sorted by town. Hours are copied
          from each source and change often, so call before you go.
          {LIST_CHECKED_ON ? ` List last checked ${formatIsoDate(LIST_CHECKED_ON)}.` : ""} For what’s open this week near
          you, <Link href="/#walk">use the food walk</Link>.
        </p>

        <section className="fl-help" aria-labelledby="fl-phone">
          <h2 id="fl-phone">Not sure where to start? Call</h2>
          <ul>
            <li>
              {OFFICIAL.referral.name}:{" "}
              <a href={OFFICIAL.referral.phoneHref}>{OFFICIAL.referral.phone}</a>. {OFFICIAL.referral.hours}
            </li>
            <li>
              {OFFICIAL.hotline.name}: <a href={OFFICIAL.hotline.phoneHref}>{OFFICIAL.hotline.phone}</a>,{" "}
              {OFFICIAL.hotline.hours}. {OFFICIAL.hotline.address}.
            </li>
            <li>
              Apply for or renew SNAP yourself at{" "}
              <a href={OFFICIAL.myBenefits.url} target="_blank" rel="noopener noreferrer">
                {OFFICIAL.myBenefits.name}
              </a>
              .
            </li>
          </ul>
        </section>

        <nav className="fl-jump" aria-label="Jump to a section">
          {groups.map((g) => (
            <a key={g.id} href={`#${g.id}`}>
              {g.title} ({g.rows.length})
            </a>
          ))}
          <a href="#seniors">60+ meals ({seniors.length})</a>
        </nav>

        {groups.map((g) => (
          <section key={g.id} id={g.id} aria-labelledby={`${g.id}-h`}>
            <h2 id={`${g.id}-h`}>
              {g.title} <span className="fl-count">({g.rows.length})</span>
            </h2>
            <ul className="fl-list">
              {g.rows.map((p) => (
                <FoodRow key={p.id} p={p} />
              ))}
            </ul>
          </section>
        ))}

        <section id="seniors" aria-labelledby="seniors-h">
          <h2 id="seniors-h">
            Meals for people 60 and older <span className="fl-count">({seniors.length})</span>
          </h2>
          <p className="fl-note">{SENIOR_PROGRAM.eligibility}</p>
          <p className="fl-note">{SENIOR_PROGRAM.contribution}</p>
          <p className="fl-note">
            {SENIOR_PROGRAM.homeDelivered.name}: call {SENIOR_PROGRAM.homeDelivered.phoneName}{" "}
            <a href={phoneHref(SENIOR_PROGRAM.homeDelivered.phone)}>{formatPhone(SENIOR_PROGRAM.homeDelivered.phone)}</a>.{" "}
            {SENIOR_PROGRAM.homeDelivered.eligibility}
          </p>
          <ul className="fl-list">
            {seniors.map((s) => (
              <li className="fl-row" key={s.id}>
                <h3>{s.name}</h3>
                <p>
                  {s.address}, {s.city} {s.zip} ·{" "}
                  <a href={mapsHref(s)} target="_blank" rel="noopener noreferrer">
                    Map
                  </a>{" "}
                  · <a href={phoneHref(s.phone)}>{formatPhone(s.phone)}</a>
                </p>
                <p>
                  <strong>Meals as published:</strong> {s.hoursRaw || "Not published. Call to ask the meal time (60+)."}
                </p>
                <p className="fl-note">{s.reserve}</p>
                {s.note ? <p className="fl-note">{s.note}</p> : null}
                <p className="fl-src">
                  Source{s.sources.length > 1 ? "s" : ""}:{" "}
                  {s.sources.map((src, i) => (
                    <span key={src.url}>
                      {i ? "; " : ""}
                      <a href={src.url} target="_blank" rel="noopener noreferrer">
                        {src.name}
                      </a>
                    </span>
                  ))}
                  {s.verifiedOn ? `. Checked by HelpGetUp ${formatIsoDate(s.verifiedOn)}.` : "."}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <footer className="site-footer">
        <div className="wrap footer-grid">
          <p className="fineprint">
            HelpGetUp is not an emergency service. If you are in immediate danger, call 911. HelpGetUp doesn’t call
            anyone or fill out forms for you. <Link href="/">Back to the food walk</Link>.
          </p>
        </div>
      </footer>
    </>
  );
}
