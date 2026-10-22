import Image from "next/image";
import Link from "next/link";
import FoodWalk from "@/components/FoodWalk";
import TalkButton from "@/components/TalkButton";
import { AGENT_NAME } from "@/lib/talk/identity";
import { HeaderStart, SkipLink } from "@/components/WalkChrome";
import { FOOD_PLACES, LIST_CHECKED_ON } from "@/data/albany-food";
import { SENIOR_MEAL_SITES } from "@/data/albany-senior-meals";
import { formatIsoDate } from "@/lib/food-week";

/** Counts come straight from the data files, so they can't drift from what the walk shows. */
const count = (kind: string) => FOOD_PLACES.filter((p) => p.kind === kind).length;
const ON_LIST = [
  { n: count("pantry"), label: "food pantries", detail: "Groceries to take home. Each listing shows its rules, like once a month or call first." },
  { n: count("meal"), label: "community meals", detail: "A hot meal, sit-down or take-out. Each listing says who it serves." },
  { n: count("produce"), label: "produce stops", detail: "Fresh fruit and vegetables, including Capital Roots’ Veggie Mobile (a low-cost market that takes SNAP/EBT, not free)." },
  { n: count("fridge"), label: "community fridges", detail: "Free food you can take. Some are listed as open 24/7; check each one." },
  { n: SENIOR_MEAL_SITES.length, label: "meal sites for people 60+", detail: "County senior meal sites. In the walk they show only if you check “I’m 60 or older.”" },
];

export default function Home() {
  return (
    <>
      <SkipLink />
      <header className="site-header">
        <div className="wrap header-inner">
          <a className="brand-lockup" href="#top">
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
          </a>
          <HeaderStart />
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="wrap">
            {/* Big logo on wide screens only. On a phone the header already shows the brand,
                and the question + button need to sit above the fold. Lazy, so phones skip the download. */}
            <Image
              className="hero-logo"
              src="/helpgetup-logo.png"
              alt="HelpGetUp — Take the next step."
              width={560}
              height={560}
              sizes="220px"
            />
            <FoodWalk />
          </div>
        </section>

        {/* Voice helper. Below the walk so the first question stays above the fold on phones. */}
        <section className="section talk-section" id="talk" aria-labelledby="talk-title">
          <div className="wrap narrow">
            <h2 id="talk-title">Rather talk?</h2>
            <p className="sub">
              Tap and ask {AGENT_NAME}, our AI voice helper, about food near you. Se habla español.
            </p>
            <TalkButton caption="Free. Pantries, meals, SNAP, and meals for people 60 and up in Albany County." />
          </div>
        </section>

        <section className="section" id="gap">
          <div className="wrap narrow">
            <h2>What this is</h2>
            <p className="sub">
              Government sites explain SNAP. They don’t tell you which pantry near
              you is open on Thursday. HelpGetUp does that one job for Albany
              County: pantries, community meals, and produce stops with their published
              hours for this week, closest first.
            </p>
            <p className="sub">
              Every stop shows where the information came from and when we last
              checked it.
            </p>
          </div>
        </section>

        <section className="section alt" id="how">
          <div className="wrap">
            <h2>How it works</h2>
            <p className="sub">Three steps. No account, no forms.</p>
            <ol className="steps">
              <li className="card">
                <div className="step-num" aria-hidden="true">1</div>
                <h3>Pick what you need</h3>
                <p>Food tonight, help with SNAP / EBT, or both.</p>
              </li>
              <li className="card">
                <div className="step-num" aria-hidden="true">2</div>
                <h3>Type your ZIP or neighborhood</h3>
                <p>
                  See stops open this week, closest first, with hours, phone, and
                  any rules like “residents only” or “call first.”
                </p>
              </li>
              <li className="card">
                <div className="step-num" aria-hidden="true">3</div>
                <h3>Call, then go</h3>
                <p>
                  Tap to call, open it in Maps, or add it to your calendar. Hours
                  change, so a quick call saves a wasted trip.
                </p>
              </li>
            </ol>
          </div>
        </section>

        <section className="section" id="list">
          <div className="wrap">
            <h2>What’s on the list</h2>
            <p className="sub">
              {FOOD_PLACES.length + SENIOR_MEAL_SITES.length} places in Albany
              County, copied from the Food Pantries for the Capital District’s Food
              Connect map, Capital Roots, and the Albany County Department for Aging
              {LIST_CHECKED_ON ? <>. Last checked {formatIsoDate(LIST_CHECKED_ON)}.</> : "."}
            </p>
            <ul className="examples">
              {ON_LIST.map((row) => (
                <li className="example" key={row.label}>
                  <h3>
                    {row.n} {row.label}
                  </h3>
                  <p>{row.detail}</p>
                </li>
              ))}
            </ul>
            <p className="list-link">
              <Link href="/albany-food-list">See the full list on one page</Link>{" "}
              (easy to print or share).
            </p>
          </div>
        </section>
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
            HelpGetUp is not a substitute for
            emergency services. If you are in immediate danger, call 911 (or
            your local emergency number).{" "}
            <Link href="/albany-food-list">Full food list</Link>. Contact:{" "}
            <a href="mailto:hello@helpgetup.com">hello@helpgetup.com</a>
          </p>
          <p className="fineprint">
            © {new Date().getFullYear()} HelpGetUp.
          </p>
        </div>
      </footer>
    </>
  );
}
