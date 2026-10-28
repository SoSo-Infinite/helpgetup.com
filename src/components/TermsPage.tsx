import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

/**
 * Terms of use, English and Spanish.
 * Same shell as the privacy page. Spanish is a first draft for a native speaker,
 * same rule as the food list, and the Spanish page says so.
 */
export type TermsLang = "en" | "es";

const EFFECTIVE = "2026-10-28";
const EFFECTIVE_LABEL: Record<TermsLang, string> = {
  en: "Oct 28, 2026",
  es: "28 de oct. de 2026",
};

const COPY = {
  en: {
    path: "/terms",
    title: "Terms of use — HelpGetUp",
    description:
      "Ground rules for HelpGetUp, a free guide to food help in Albany County, NY. Listings can change, Rosa is an AI, and this is not an emergency service.",
    skip: "Skip to terms",
    cta: "Start with food",
    ctaHref: "/#walk",
    other: "Español",
    otherLabel: "Ver en español",
    otherHref: "/terms/es",
    otherCode: "es" as const,
    h1: "Terms of use",
    home: "Home",
    homeHref: "/",
    list: "Full food list",
    listHref: "/albany-food-list",
    privacy: "Privacy",
    terms: "Terms",
    termsHref: "/terms",
    contact: "Contact",
    footer:
      "HelpGetUp is not a substitute for emergency services. If you are in immediate danger, call 911 (or your local emergency number).",
  },
  es: {
    path: "/terms/es",
    title: "Términos de uso — HelpGetUp",
    description:
      "Reglas de uso de HelpGetUp, una guía gratuita de ayuda con comida en el condado de Albany, NY. Las listas pueden cambiar, Rosa es una inteligencia artificial y esto no es un servicio de emergencia.",
    skip: "Ir a los términos",
    cta: "Empezar con comida",
    ctaHref: "/?lang=es#walk",
    other: "English",
    otherLabel: "View in English",
    otherHref: "/terms",
    otherCode: "en" as const,
    h1: "Términos de uso",
    home: "Inicio",
    homeHref: "/?lang=es",
    list: "Lista de comida",
    listHref: "/albany-food-list/es",
    privacy: "Privacidad",
    terms: "Términos",
    termsHref: "/terms/es",
    contact: "Contacto",
    footer:
      "HelpGetUp no es un sustituto de los servicios de emergencia. Si está en peligro inmediato, llame al 911 (o al número de emergencia de su zona).",
  },
} as const;

export function termsMetadata(lang: TermsLang): Metadata {
  const t = COPY[lang];
  return {
    title: t.title,
    description: t.description,
    alternates: {
      canonical: t.path,
      languages: { en: "/terms", es: "/terms/es", "x-default": "/terms" },
    },
    robots: { index: true, follow: true },
    openGraph: {
      title: t.title,
      description: t.description,
      url: `https://helpgetup.com${t.path}`,
    },
  };
}

function EnglishBody() {
  return (
    <>
      <p>
        HelpGetUp is a free guide to food help in Albany County, New York. These are the ground
        rules for using the site, the listings, and Rosa.
      </p>
      <p>
        Effective date: <time dateTime={EFFECTIVE}>{EFFECTIVE_LABEL.en}</time>.
      </p>

      <h2>The guide is free</h2>
      <p>
        Using HelpGetUp costs nothing. There is no account, and there is nothing to buy. The guide
        sells nothing.
      </p>
      <p>
        A listing says when a stop is not free food. That can be a low-cost produce market, or a
        meal that asks for a suggested contribution. That money is for the pantry or meal site, not
        for HelpGetUp.
      </p>

      <h2>Listings</h2>
      <p>
        Listings are copied from published sources. Each one shows when it was last checked, when we
        have that date. Hours, addresses, and rules change. Call the place before you go, or check
        the source named on the listing.
      </p>
      <p>
        The guide covers food help in Albany County. For food outside this county, call or text 211.
      </p>

      <h2>Not an emergency service</h2>
      <p>HelpGetUp is not an emergency service and not a crisis line.</p>
      <ul>
        <li>If you are in immediate danger, call 911.</li>
        <li>If you are thinking about hurting yourself, or you are in crisis, call or text 988.</li>
        <li>
          For other help, such as housing or utilities, call or text 211.
        </li>
      </ul>

      <h2>Rosa</h2>
      <p>
        Rosa is an AI voice helper. She can make mistakes. Check the listing, or call the place,
        before you rely on what she says. A talk lasts up to 5 minutes, and it can end sooner if it
        goes quiet. What the site keeps from a talk is described on the{" "}
        <Link href="/privacy">Privacy</Link> page.
      </p>

      <h2>Not advice</h2>
      <p>
        This is not legal, medical, or benefits advice. HelpGetUp does not decide whether you
        qualify for SNAP or any other program. The official SNAP site and the agency decide that.
        HelpGetUp does not fill out the SNAP form and does not store a login.
      </p>

      <h2>Acceptable use</h2>
      <p>
        You can report a change to a listing, or leave your name and email to get updates and help
        resources. Use those for that. Do not send junk, or someone else’s information. We limit how
        often the updates form can be sent.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms:{" "}
        <a href="mailto:hello@helpgetup.com">hello@helpgetup.com</a>.
      </p>
      <p>
        If you run a pantry or meal program, you can email hour changes to the same address.
      </p>

      <h2>If these rules change</h2>
      <p>If these rules change, the date at the top of this page will change.</p>
    </>
  );
}

function SpanishBody() {
  return (
    <>
      <p className="fl-draft" data-needs-native-review="true">
        Traducción preliminar: falta la revisión de un hablante nativo.
      </p>
      <p>
        HelpGetUp es una guía gratuita de ayuda con comida en el condado de Albany, Nueva York.
        Estas son las reglas para usar el sitio, las listas y Rosa.
      </p>
      <p>
        Fecha de vigencia: <time dateTime={EFFECTIVE}>{EFFECTIVE_LABEL.es}</time>.
      </p>

      <h2>La guía es gratis</h2>
      <p>
        Usar HelpGetUp no cuesta nada. No hay una cuenta y no hay nada que comprar. La guía no vende
        nada.
      </p>
      <p>
        Una lista dice cuándo un lugar no es comida gratis. Puede ser un mercado de productos
        frescos de bajo costo, o una comida que pide una contribución sugerida. Ese dinero es para
        la despensa o el comedor, no para HelpGetUp.
      </p>

      <h2>Las listas</h2>
      <p>
        Las listas se copian de fuentes publicadas. Cada lugar muestra cuándo se revisó por última
        vez, cuando tenemos esa fecha. Los horarios, las direcciones y las reglas cambian. Llame al
        lugar antes de ir, o revise la fuente que aparece en la lista.
      </p>
      <p>
        La guía cubre ayuda con comida en el condado de Albany. Para comida fuera de este condado,
        llame o envíe un mensaje de texto al 211.
      </p>

      <h2>No es un servicio de emergencia</h2>
      <p>HelpGetUp no es un servicio de emergencia ni una línea de crisis.</p>
      <ul>
        <li>Si está en peligro inmediato, llame al 911.</li>
        <li>
          Si piensa en hacerse daño, o está en crisis, llame o envíe un mensaje de texto al 988.
        </li>
        <li>
          Para otra ayuda, como vivienda o servicios públicos, llame o envíe un mensaje de texto al
          211.
        </li>
      </ul>

      <h2>Rosa</h2>
      <p>
        Rosa es una inteligencia artificial que ayuda por voz y puede equivocarse. Revise la lista,
        o llame al lugar, antes de confiar en lo que diga. Una conversación dura hasta 5 minutos y
        puede terminar antes si queda en silencio. Lo que el sitio guarda de una conversación se
        explica en la página de <Link href="/privacy">Privacidad</Link> (en inglés).
      </p>

      <h2>No es asesoría</h2>
      <p>
        Esto no es asesoría legal, médica ni de beneficios. HelpGetUp no decide si usted califica
        para SNAP ni para ningún otro programa. El sitio oficial de SNAP y la agencia lo deciden.
        HelpGetUp no llena el formulario de SNAP y no guarda una contraseña.
      </p>

      <h2>Uso aceptable</h2>
      <p>
        Puede reportar un cambio de un lugar, o dejar su nombre y correo electrónico para recibir
        novedades y recursos de ayuda. Úselos para eso. No envíe basura ni la información de otra
        persona. Limitamos cuántas veces se puede enviar el formulario de novedades.
      </p>

      <h2>Contacto</h2>
      <p>
        Preguntas sobre estos términos:{" "}
        <a href="mailto:hello@helpgetup.com">hello@helpgetup.com</a>.
      </p>
      <p>
        Si dirige una despensa o un programa de comidas, puede enviar cambios de horario a la misma
        dirección.
      </p>

      <h2>Si estas reglas cambian</h2>
      <p>Si estas reglas cambian, cambiará la fecha al inicio de esta página.</p>
    </>
  );
}

export default function TermsPage({ lang }: { lang: TermsLang }) {
  const t = COPY[lang];
  return (
    <>
      <a className="skip-link" href="#terms" lang={lang}>
        {t.skip}
      </a>
      <header className="site-header" lang={lang}>
        <div className="wrap header-inner">
          <Link className="brand-lockup" href={t.homeHref}>
            <Image
              src="/helpgetup-mark.png"
              alt=""
              width={84}
              height={78}
              priority
              style={{ width: 40, height: 37, objectFit: "contain" }}
            />
            <span className="brand-text">
              <span className="brand-name">
                HelpGet<span className="up">Up</span>
              </span>
              <span className="brand-tag">Take the next step.</span>
            </span>
          </Link>
          <Link className="header-cta" href={t.ctaHref}>
            {t.cta}
          </Link>
        </div>
      </header>
      <main id="terms" className="section" lang={lang}>
        <article className="wrap narrow terms">
          <div className="lang-row">
            <Link
              className="lang-toggle"
              href={t.otherHref}
              hrefLang={t.otherCode}
              lang={t.otherCode}
              aria-label={t.otherLabel}
            >
              {t.other}
            </Link>
          </div>
          <h1>{t.h1}</h1>
          {lang === "en" ? <EnglishBody /> : <SpanishBody />}
        </article>
      </main>
      <footer className="site-footer" lang={lang}>
        <div className="wrap footer-grid">
          <div>
            <div className="footer-brand">
              HelpGet<span className="up">Up</span>
            </div>
            <div>Take the next step.</div>
          </div>
          <p className="fineprint">
            {t.footer} <Link href={t.homeHref}>{t.home}</Link>.{" "}
            <Link href={t.listHref}>{t.list}</Link>. <Link href="/privacy">{t.privacy}</Link>.{" "}
            <Link href={t.termsHref}>{t.terms}</Link>. {t.contact}:{" "}
            <a href="mailto:hello@helpgetup.com">hello@helpgetup.com</a>
          </p>
          <p className="fineprint">© {new Date().getFullYear()} HelpGetUp.</p>
        </div>
      </footer>
    </>
  );
}
