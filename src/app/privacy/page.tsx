import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy — HelpGetUp",
  description:
    "What HelpGetUp and the Rosa talk button collect, how Vercel Analytics is used, and how hello@helpgetup.com is used. This site sells nothing.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Privacy — HelpGetUp",
    description:
      "What HelpGetUp and the Rosa talk button collect, how Vercel Analytics is used, and how hello@helpgetup.com is used. This site sells nothing.",
    url: "https://helpgetup.com/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <>
      <a className="skip-link" href="#privacy">
        Skip to privacy details
      </a>
      <header className="site-header">
        <div className="wrap header-inner">
          <Link className="brand-lockup" href="/">
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
          <Link className="header-cta" href="/#walk">
            Start with food
          </Link>
        </div>
      </header>
      <main id="privacy" className="section">
        <article className="wrap narrow privacy">
          <h1>Privacy</h1>
          <p>
            HelpGetUp is a guide to food help in Albany County, New York. This page says what the
            site collects, in plain language.
          </p>

          <h2>What the site collects</h2>
          <p>
            The food walk runs in your browser. A ZIP code or neighborhood you type stays on that
            page. It is not sent to us and it is not saved on a server.
          </p>
          <p>
            We do not ask for a Social Security number, a driver’s license, a benefits password, or
            a photo of an ID.
          </p>
          <p>
            If you choose “Get updates and help resources,” we collect the name and email you type.
            How we use them is described below.
          </p>
          <p>
            After one visit, the browser can save a copy of the home page on your phone so the food
            list still works without a signal. That copy stays on your device.
          </p>

          <h2>Rosa, the talk button</h2>
          <p>
            Rosa is an AI voice helper. Nothing is collected unless you tap the button. If you do:
          </p>
          <ul>
            <li>
              Your browser uses the microphone. The live audio goes to xAI, the company that runs
              the voice, so Rosa can answer in the moment. HelpGetUp does not keep a recording of
              the audio.
            </li>
            <li>
              When notifications are turned on, a short written summary of what you asked and what
              Rosa said is sent to the person who runs HelpGetUp. Long runs of digits — a phone
              number, a card number, or a Social Security number someone might say — are removed
              before that summary is sent. When notifications are off, the summary is not kept.
            </li>
            <li>
              We count a few events so we can tell whether the button works: that someone pressed
              it, that the microphone was blocked, that a conversation connected, about how long it
              lasted (a range such as “1–2 minutes,” not the exact time), and whether it failed.
              Those counts do not include what anyone said. They do not use cookies, and they do
              not include an IP address or the name of the browser.
            </li>
            <li>
              To limit how often the button can be started, we briefly keep a count for the network
              address of the request. That count expires. It is not tied to your name.
            </li>
          </ul>

          <h2>Vercel Analytics</h2>
          <p>
            This site uses Vercel Analytics, the page counter from our host, Vercel. It does not
            use cookies. A visit record includes the page you opened, the site you came from, the
            kind of browser and device, and the country guessed from the network address. Vercel
            uses that address to guess the country and to tell visits apart, and it does not store
            the address itself. We use the counts to see which pages people open. We do not use
            them to advertise.
          </p>

          <h2>How hello@helpgetup.com is used</h2>
          <p>
            <a href="mailto:hello@helpgetup.com">hello@helpgetup.com</a> is the contact address for
            HelpGetUp. Mail sent there is forwarded to a private inbox so we can read it and reply.
            We use that address to answer questions.
          </p>
          <p>
            If you leave your name and email to get updates and help resources, we save them as a
            private file with our host, Vercel. We keep that file until you ask us to delete it. We
            do not erase it on a schedule. If a signup looks automated, we keep that name and email
            in a separate private file, not with the regular signups, until you ask us to delete it.
            We do not send a notice for those. The site log does not include your name or email. We
            also save a short note that a signup step happened, and that note has no name and no email.
            To limit repeats, we count up to 8 signups from one connection in an hour. That
            count is a short hash of the network address, not the address itself. It is meant to
            last an hour, and it can linger past that hour. When notifications are turned on, we
            send your name and email to the person who runs the site, through the same notification
            used for Rosa summaries. We use them only to send updates and help resources, and we
            write from hello@helpgetup.com. We do not sell, rent, or trade your email, and we do not
            give it to advertisers.
          </p>
          <p>
            To ask us to delete your name and email, write to{" "}
            <a href="mailto:hello@helpgetup.com">hello@helpgetup.com</a>.
          </p>

          <h2>This site sells nothing</h2>
          <p>
            HelpGetUp sells nothing. Not food, not the list, not your email, and not anything else.
            There is nothing to buy.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about this page:{" "}
            <a href="mailto:hello@helpgetup.com">hello@helpgetup.com</a>.
          </p>
        </article>
      </main>
      <footer className="site-footer">
        <div className="wrap footer-grid">
          <div>
            <div className="footer-brand">
              HelpGet<span className="up">Up</span>
            </div>
            <div>Take the next step.</div>
          </div>
          <p className="fineprint">
            HelpGetUp is not a substitute for emergency services. If you are in immediate danger,
            call 911 (or your local emergency number). <Link href="/">Home</Link>.{" "}
            <Link href="/albany-food-list">Full food list</Link>.{" "}
            <Link href="/privacy">Privacy</Link>. Contact:{" "}
            <a href="mailto:hello@helpgetup.com">hello@helpgetup.com</a>
          </p>
          <p className="fineprint">© {new Date().getFullYear()} HelpGetUp.</p>
        </div>
      </footer>
    </>
  );
}
