import Image from "next/image";
import WaitlistForm from "@/components/WaitlistForm";

export default function Home() {
  return (
    <>
      <header className="site-header">
        <div className="wrap header-inner">
          <a className="brand-lockup" href="#top" aria-label="HelpGetUp home">
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
          <a className="header-cta" href="#waitlist">
            Join waitlist
          </a>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="wrap">
            <Image
              className="hero-logo"
              src="/helpgetup-logo.png"
              alt="HelpGetUp — Take the next step."
              width={560}
              height={560}
              priority
            />
            <h1>Stuck on a problem? Start with one clear next step.</h1>
            <p className="lede">
              HelpGetUp is an early-access assistant for everyday friction —
              unpaid bills, food and benefits paperwork, getting to an
              appointment. You name the goal. It proposes a concrete next
              action. You decide whether to take it.
            </p>
            <div className="btn-row">
              <a className="btn btn-primary" href="#waitlist">
                Join the waitlist
              </a>
              <a className="btn btn-ghost" href="#how">
                See how it works
              </a>
            </div>
          </div>
        </section>

        <section className="section alt" id="how">
          <div className="wrap">
            <h2>How it works</h2>
            <p className="sub">
              Three moves. No jargon. Built for real situations where the hard
              part is knowing what to do first.
            </p>
            <div className="steps">
              <article className="card">
                <div className="step-num">1</div>
                <h3>Name the goal</h3>
                <p>
                  Tell HelpGetUp what you need to get done — keep the lights on,
                  renew benefits, find a ride to a clinic.
                </p>
              </article>
              <article className="card">
                <div className="step-num">2</div>
                <h3>Get the next step</h3>
                <p>
                  You get one specific action you can take now — who to call,
                  what to bring, which form to start — not a wall of links.
                </p>
              </article>
              <article className="card">
                <div className="step-num">3</div>
                <h3>You stay in control</h3>
                <p>
                  Nothing happens without your say-so. Later, HelpGetUp may help
                  carry out steps you approve, within clear limits. Today it is
                  guidance first.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="section" id="examples">
          <div className="wrap">
            <h2>Situations it is built for</h2>
            <p className="sub">
              Illustrative — not live case studies, and not a claim that every
              agency connection works yet.
            </p>
            <div className="examples">
              <article className="example">
                <h3>Utility bill pressure</h3>
                <p>
                  Past-due notice on the kitchen table. Next step might be:
                  call the utility with your account number and ask about
                  payment arrangements before the shutoff date.
                </p>
              </article>
              <article className="example">
                <h3>Food and benefits</h3>
                <p>
                  SNAP or similar paperwork that keeps stalling. Next step
                  might be: gather ID and last month&apos;s income proof, then
                  start the renewal on the state portal.
                </p>
              </article>
              <article className="example">
                <h3>Getting somewhere</h3>
                <p>
                  Appointment tomorrow, no car. Next step might be: check the
                  clinic&apos;s ride options, then confirm a pickup time that
                  leaves a buffer.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="section alt waitlist" id="waitlist">
          <div className="wrap">
            <h2>Early access waitlist</h2>
            <p className="sub" style={{ marginInline: "auto" }}>
              HelpGetUp is in early build. Join if you want a note when a first
              version is ready to try. Honest about the stage — no fake
              metrics, no pretend partnerships.
            </p>
            <div className="panel">
              <WaitlistForm />
            </div>
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
            Early access / waitlist only. HelpGetUp is not a substitute for
            emergency services. If you are in immediate danger, call 911 (or
            your local emergency number). Contact:{" "}
            <a href="mailto:cjames112@gmail.com">cjames112@gmail.com</a>
          </p>
          <p className="fineprint">
            © {new Date().getFullYear()} HelpGetUp. Built by{" "}
            <a href="mailto:cjames112@gmail.com">cjames112@gmail.com</a>.
          </p>
        </div>
      </footer>
    </>
  );
}
