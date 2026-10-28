import Link from "next/link";
import { FOOD_PLACES, LIST_CHECKED_ON, OFFICIAL, type FoodKind, type FoodPlace } from "@/data/albany-food";
import { SENIOR_MEAL_SITES, SENIOR_PROGRAM } from "@/data/albany-senior-meals";
import { formatIsoDate, formatPhone, mapsHref, phoneHref } from "@/lib/food-week";
import { reportChangeHref } from "@/lib/freshness";

/**
 * The whole Albany County list as plain, server-rendered HTML: one page a person can print or
 * share, and a page search engines and AI assistants can read without running the food walk.
 * Every line comes from the data files (src/data/*), the same rows the walk uses.
 *
 * Two languages share this component: /albany-food-list (en) and /albany-food-list/es (es).
 * NEEDS NATIVE REVIEW: the Spanish strings are a first draft (same rule as src/lib/walk-text.ts),
 * and the Spanish page shows a visible notice until a native speaker reviews it.
 * Source rows (names, addresses, published hours, notes) stay in English as published, and the
 * Spanish page says so, so nothing a pantry published gets reworded.
 */
export type ListLang = "en" | "es";

const TOTAL = FOOD_PLACES.length + SENIOR_MEAL_SITES.length;

export const LIST_TEXT = {
  en: {
    path: "/albany-food-list",
    title: "Albany County food help list: pantries, meals, produce, 60+ meals",
    description:
      "Every food pantry, community meal, produce stop, community fridge, and 60+ meal site HelpGetUp lists in Albany County, NY, with published hours, phone numbers, and the source for each.",
    skip: "Skip to the list",
    tag: "Albany County food list",
    cta: "Find food near me",
    home: "Home",
    crumb: "Full food list",
    otherLang: "Lista en español",
    otherLangHref: "/albany-food-list/es",
    otherLangCode: "es",
    h1: "Food help in Albany County, NY",
    lede: (n: number) => `${n} places, grouped by type and sorted by town. Hours are copied from each source and change often, so call before you go.`,
    checked: (d: string) => ` Hours last checked: ${d}.`,
    reportChange: "Report a change",
    walkPre: " For what’s open this week near you, ",
    walkLink: "use the food walk",
    asPublished: "",
    draftNotice: "",
    callH: "Not sure where to start? Call",
    referralHours: OFFICIAL.referral.hours,
    hotlineHours: OFFICIAL.hotline.hours,
    snapPre: "Apply for or renew SNAP yourself at ",
    groups: { pantry: "Food pantries", meal: "Community meals", produce: "Produce stops", fridge: "Community fridges" } as Record<FoodKind, string>,
    seniorsJump: "60+ meals",
    jumpLabel: "Jump to a section",
    map: "Map",
    hoursLabel: "Hours as published:",
    always: "24/7",
    noHours: "Not published. Call first.",
    unconfirmed: "Could not confirm: no current public source lists this stop (only an older flyer). Call before you go.",
    source: "Source",
    sources: "Sources",
    updated: (d: string) => `, updated ${d}`,
    checkedBy: (d: string) => `. Checked by HelpGetUp ${d}.`,
    seniorsH: "Meals for people 60 and older",
    eligibility: SENIOR_PROGRAM.eligibility,
    contribution: SENIOR_PROGRAM.contribution,
    homeDeliveredName: SENIOR_PROGRAM.homeDelivered.name,
    homeDeliveredCall: "call",
    homeDeliveredEligibility: SENIOR_PROGRAM.homeDelivered.eligibility,
    mealsLabel: "Meals as published:",
    noMeals: "Not published. Call to ask the meal time (60+).",
    footer: "HelpGetUp is not an emergency service. If you are in immediate danger, call 911.",
    back: "Back to the food walk",
    privacy: "Privacy",
    terms: "Terms",
  },
  es: {
    path: "/albany-food-list/es",
    title: "Lista de ayuda con comida en el condado de Albany: despensas, comidas, productos frescos, comidas para 60+",
    description:
      "Todas las despensas de comida, comidas comunitarias, puntos de productos frescos, refrigeradores comunitarios y comedores para personas de 60 años o más que HelpGetUp tiene en el condado de Albany, NY, con horarios publicados, teléfonos y la fuente de cada uno.",
    skip: "Ir a la lista",
    tag: "Lista de comida del condado de Albany",
    cta: "Buscar comida cerca",
    home: "Inicio",
    crumb: "Lista completa",
    otherLang: "List in English",
    otherLangHref: "/albany-food-list",
    otherLangCode: "en",
    h1: "Ayuda con comida en el condado de Albany, NY",
    lede: (n: number) =>
      `${n} lugares, agrupados por tipo y ordenados por pueblo. Los horarios se copian de cada fuente y cambian a menudo, así que llame antes de ir.`,
    checked: (d: string) => ` Horarios revisados por última vez: ${d}.`,
    reportChange: "Reportar un cambio",
    walkPre: " Para ver qué abre esta semana cerca de usted, ",
    walkLink: "use la guía paso a paso",
    asPublished:
      "Los nombres, direcciones, horarios y notas de cada lugar se muestran en inglés, tal como los publica la fuente.",
    draftNotice: "Traducción preliminar: falta la revisión de un hablante nativo.",
    callH: "¿No sabe por dónde empezar? Llame",
    referralHours: "Línea de referencias. El folleto de Albany de febrero de 2026 indica la extensión 1.",
    hotlineHours: "de lunes a viernes, de 8:00 a. m. a 5:00 p. m",
    snapPre: "Solicite o renueve SNAP usted mismo en ",
    groups: {
      pantry: "Despensas de comida",
      meal: "Comidas comunitarias",
      produce: "Productos frescos",
      fridge: "Refrigeradores comunitarios",
    } as Record<FoodKind, string>,
    seniorsJump: "Comidas 60+",
    jumpLabel: "Ir a una sección",
    map: "Mapa",
    hoursLabel: "Horario publicado (en inglés):",
    always: "24/7",
    noHours: "No publicado. Llame primero.",
    unconfirmed:
      "No se pudo confirmar: ninguna fuente pública actual incluye este lugar (solo un folleto anterior). Llame antes de ir.",
    source: "Fuente",
    sources: "Fuentes",
    updated: (d: string) => `, actualizada ${d}`,
    checkedBy: (d: string) => `. Revisado por HelpGetUp ${d}.`,
    seniorsH: "Comidas para personas de 60 años o más",
    eligibility:
      "Personas de 60 años o más, y el cónyuge de una persona elegible a cualquier edad (Departamento para Personas Mayores del condado de Albany). LifePath: adultos menores de 60 años o que viven fuera del condado de Albany pueden participar como invitados que pagan.",
    contribution:
      "Contribución sugerida: $3 por comida. No es obligatoria; nadie es rechazado por no pagar (página de Servicios de Nutrición del condado).",
    homeDeliveredName: "Comidas a domicilio (Meals on Wheels)",
    homeDeliveredCall: "llame a",
    homeDeliveredEligibility:
      "Para personas de 60 años o más que no pueden salir de casa. El condado pide tres condiciones, todas obligatorias: incapacidad por accidente, enfermedad o fragilidad; sin apoyo de familia, amigos o vecinos; y no poder preparar sus comidas. Familiares, amigos o agencias pueden hacer la referencia. Llame a NY Connects para la evaluación.",
    mealsLabel: "Comidas publicadas (en inglés):",
    noMeals: "No publicado. Llame para preguntar la hora de la comida (60+).",
    footer:
      "HelpGetUp no es un servicio de emergencia. Si está en peligro inmediato, llame al 911.",
    back: "Volver a la guía de comida",
    privacy: "Privacidad",
    terms: "Términos",
  },
} as const;

const KINDS: { kind: FoodKind; id: string }[] = [
  { kind: "pantry", id: "pantries" },
  { kind: "meal", id: "meals" },
  { kind: "produce", id: "produce" },
  { kind: "fridge", id: "fridges" },
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

function jsonLd(lang: ListLang) {
  const t = LIST_TEXT[lang];
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t.title,
    description: t.description,
    inLanguage: lang,
    url: `https://helpgetup.com${t.path}`,
    numberOfItems: TOTAL,
    itemListElement: [...FOOD_PLACES.slice().sort(byPlace), ...SENIOR_MEAL_SITES.slice().sort(byPlace)].map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: placeLd(p),
    })),
  };
}

function FoodRow({ p, lang }: { p: FoodPlace; lang: ListLang }) {
  const t = LIST_TEXT[lang];
  return (
    <li className="fl-row">
      <h3 lang="en">{p.name}</h3>
      <p>
        <span lang="en">
          {p.address}, {p.city} {p.zip}
        </span>{" "}
        ·{" "}
        <a href={mapsHref(p)} target="_blank" rel="noopener noreferrer">
          {t.map}
        </a>{" "}
        · <a href={phoneHref(p.phone)}>{formatPhone(p.phone)}</a>
      </p>
      <p>
        <strong>{t.hoursLabel}</strong>{" "}
        {p.hoursRaw ? <span lang="en">{p.hoursRaw}</span> : p.alwaysOpen ? t.always : t.noHours}
      </p>
      {p.unconfirmed ? <p className="stale-flag">{t.unconfirmed}</p> : null}
      {p.note ? (
        <p className="fl-note" lang="en">
          {p.note}
        </p>
      ) : null}
      <p className="fl-src">
        {t.source}:{" "}
        <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">
          {p.sourceName}
        </a>
        {p.sourceUpdated ? t.updated(formatIsoDate(p.sourceUpdated, lang)) : ""}
        {p.verifiedOn ? t.checkedBy(formatIsoDate(p.verifiedOn, lang)) : "."}
      </p>
      <p className="fl-src">
        <a href={reportChangeHref(p.name)}>{t.reportChange}</a>
      </p>
    </li>
  );
}

export function FoodList({ lang }: { lang: ListLang }) {
  const t = LIST_TEXT[lang];
  const groups = KINDS.map((g) => ({
    ...g,
    title: t.groups[g.kind],
    rows: FOOD_PLACES.filter((p) => p.kind === g.kind).sort(byPlace),
  }));
  const seniors = SENIOR_MEAL_SITES.slice().sort(byPlace);
  return (
    <>
      <a className="skip-link" href="#list-top" lang={lang}>
        {t.skip}
      </a>
      <header className="site-header" lang={lang}>
        <div className="wrap header-inner">
          <Link className="brand-lockup" href="/">
            <span className="brand-text">
              <span className="brand-name">
                HelpGet<span className="up">Up</span>
              </span>
              <span className="brand-tag">{t.tag}</span>
            </span>
          </Link>
          <Link className="header-cta" href={lang === "es" ? "/?lang=es#walk" : "/#walk"}>
            {t.cta}
          </Link>
        </div>
      </header>
      <main id="list-top" className="wrap fl" lang={lang}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(lang)) }} />
        <nav className="fl-crumbs" aria-label={lang === "es" ? "Ruta de navegación" : "Breadcrumb"}>
          <Link href="/">{t.home}</Link> <span aria-hidden="true">›</span> <span aria-current="page">{t.crumb}</span>
          <span className="fl-lang">
            <Link href={t.otherLangHref} hrefLang={t.otherLangCode} lang={t.otherLangCode}>
              {t.otherLang}
            </Link>
          </span>
        </nav>
        <h1>{t.h1}</h1>
        {t.draftNotice ? (
          <p className="fl-draft" data-needs-native-review="true">
            {t.draftNotice}
          </p>
        ) : null}
        <p className="fl-lede">
          {t.lede(TOTAL)}
          {LIST_CHECKED_ON ? t.checked(formatIsoDate(LIST_CHECKED_ON, lang)) : ""}
          {t.walkPre}
          <Link href={lang === "es" ? "/?lang=es#walk" : "/#walk"}>{t.walkLink}</Link>.
        </p>
        {t.asPublished ? <p className="fl-note">{t.asPublished}</p> : null}

        <section className="fl-help" aria-labelledby="fl-phone">
          <h2 id="fl-phone">{t.callH}</h2>
          <ul>
            <li>
              <span lang="en">{OFFICIAL.referral.name}</span>:{" "}
              <a href={OFFICIAL.referral.phoneHref}>{OFFICIAL.referral.phone}</a>. {t.referralHours}
            </li>
            <li>
              {lang === "es" ? "Línea de SNAP del condado de Albany" : OFFICIAL.hotline.name}:{" "}
              <a href={OFFICIAL.hotline.phoneHref}>{OFFICIAL.hotline.phone}</a>, {t.hotlineHours}.{" "}
              <span lang="en">{OFFICIAL.hotline.address}</span>.
            </li>
            <li>
              {t.snapPre}
              <a href={OFFICIAL.myBenefits.url} target="_blank" rel="noopener noreferrer">
                {OFFICIAL.myBenefits.name}
              </a>
              .
            </li>
          </ul>
        </section>

        <nav className="fl-jump" aria-label={t.jumpLabel}>
          {groups.map((g) => (
            <a key={g.id} href={`#${g.id}`}>
              {g.title} ({g.rows.length})
            </a>
          ))}
          <a href="#seniors">
            {t.seniorsJump} ({seniors.length})
          </a>
        </nav>

        {groups.map((g) => (
          <section key={g.id} id={g.id} aria-labelledby={`${g.id}-h`}>
            <h2 id={`${g.id}-h`}>
              {g.title} <span className="fl-count">({g.rows.length})</span>
            </h2>
            <ul className="fl-list">
              {g.rows.map((p) => (
                <FoodRow key={p.id} p={p} lang={lang} />
              ))}
            </ul>
          </section>
        ))}

        <section id="seniors" aria-labelledby="seniors-h">
          <h2 id="seniors-h">
            {t.seniorsH} <span className="fl-count">({seniors.length})</span>
          </h2>
          <p className="fl-note">{t.eligibility}</p>
          <p className="fl-note">{t.contribution}</p>
          <p className="fl-note">
            {t.homeDeliveredName}: {t.homeDeliveredCall} {SENIOR_PROGRAM.homeDelivered.phoneName}{" "}
            <a href={phoneHref(SENIOR_PROGRAM.homeDelivered.phone)}>{formatPhone(SENIOR_PROGRAM.homeDelivered.phone)}</a>.{" "}
            {t.homeDeliveredEligibility}
          </p>
          <ul className="fl-list">
            {seniors.map((s) => (
              <li className="fl-row" key={s.id}>
                <h3 lang="en">{s.name}</h3>
                <p>
                  <span lang="en">
                    {s.address}, {s.city} {s.zip}
                  </span>{" "}
                  ·{" "}
                  <a href={mapsHref(s)} target="_blank" rel="noopener noreferrer">
                    {t.map}
                  </a>{" "}
                  · <a href={phoneHref(s.phone)}>{formatPhone(s.phone)}</a>
                </p>
                <p>
                  <strong>{t.mealsLabel}</strong> {s.hoursRaw ? <span lang="en">{s.hoursRaw}</span> : t.noMeals}
                </p>
                <p className="fl-note" lang="en">
                  {s.reserve}
                </p>
                {s.note ? (
                  <p className="fl-note" lang="en">
                    {s.note}
                  </p>
                ) : null}
                <p className="fl-src">
                  {s.sources.length > 1 ? t.sources : t.source}:{" "}
                  {s.sources.map((src, i) => (
                    <span key={src.url}>
                      {i ? "; " : ""}
                      <a href={src.url} target="_blank" rel="noopener noreferrer">
                        {src.name}
                      </a>
                    </span>
                  ))}
                  {s.verifiedOn ? t.checkedBy(formatIsoDate(s.verifiedOn, lang)) : "."}
                </p>
                <p className="fl-src">
                  <a href={reportChangeHref(s.name)}>{t.reportChange}</a>
                </p>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <footer className="site-footer" lang={lang}>
        <div className="wrap footer-grid">
          <p className="fineprint">
            {t.footer} <Link href={lang === "es" ? "/?lang=es" : "/"}>{t.back}</Link>.{" "}
            <Link href="/privacy">{t.privacy}</Link>.{" "}
            <Link href={lang === "es" ? "/terms/es" : "/terms"}>{t.terms}</Link>.
          </p>
        </div>
      </footer>
    </>
  );
}

export function listMetadata(lang: ListLang) {
  const t = LIST_TEXT[lang];
  return {
    title: `${t.title} | HelpGetUp`,
    description: t.description,
    alternates: {
      canonical: t.path,
      languages: { en: LIST_TEXT.en.path, es: LIST_TEXT.es.path, "x-default": LIST_TEXT.en.path },
    },
    openGraph: {
      title: t.title,
      description: t.description,
      url: `https://helpgetup.com${t.path}`,
      siteName: "HelpGetUp",
      type: "website" as const,
      locale: lang === "es" ? "es_US" : "en_US",
    },
  };
}
