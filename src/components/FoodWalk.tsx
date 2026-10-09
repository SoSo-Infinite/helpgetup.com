"use client";

import {
  FormEvent,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { LIST_CHECKED_ON, OFFICIAL, type FoodPlace } from "@/data/albany-food";
import {
  formatIsoDate,
  formatPhone,
  formatWhen,
  icsFileName,
  icsHref,
  isStaleSource,
  mapsHref,
  matchFood,
  phoneHref,
  type PlaceMatch,
  type WalkLang,
} from "@/lib/food-week";
import { WALK_TEXT, type WalkText } from "@/lib/walk-text";
import { SENIOR_COUNTY_URL, SENIOR_PROGRAM, type SeniorMealSite } from "@/data/albany-senior-meals";
import { matchSeniorMeals } from "@/lib/senior-meals";
import { START_EVENT, publishWalkLang } from "@/lib/walk-lang";

type Need = "tonight" | "snap" | "both";
type SnapKind = "apply" | "renew" | "unsure";
type Step =
  | "start"
  | "need"
  | "snap"
  | "snap-next"
  | "snap-check"
  | "where"
  | "options"
  | "script"
  | "food-check"
  | "done";

type Check = "in" | "not" | "going" | "";

const LangContext = createContext<{ lang: WalkLang; t: WalkText }>({ lang: "en", t: WALK_TEXT.en });
const useLang = () => useContext(LangContext);
const noSubscribe = () => () => {};

export default function FoodWalk() {
  // ?lang=es opens the walk in Spanish (shareable link). Nothing is stored; a tap on the toggle wins.
  const urlSpanish = useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).get("lang") === "es",
    () => false,
  );
  const [chosenLang, setLang] = useState<WalkLang | null>(null);
  const lang: WalkLang = chosenLang ?? (urlSpanish ? "es" : "en");
  const [step, setStep] = useState<Step>("start");
  const [need, setNeed] = useState<Need | "">("");
  const [snapKind, setSnapKind] = useState<SnapKind | "">("");
  const [placeQuery, setPlaceQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [picked, setPicked] = useState<PlaceMatch | null>(null);
  const [snapCheck, setSnapCheck] = useState<Check>("");
  const [snapLeft, setSnapLeft] = useState("");
  const [snapSaved, setSnapSaved] = useState(false);
  const [foodCheck, setFoodCheck] = useState<Check>("");
  const [foodLeft, setFoodLeft] = useState("");
  const [foodSaved, setFoodSaved] = useState(false);
  // 60+ meal sites show only when the person says so (checkbox) or taps to see them. Not stored.
  const [senior, setSenior] = useState(false);
  const t: WalkText = WALK_TEXT[lang];
  const walkRef = useRef<HTMLDivElement>(null);
  const movedByUser = useRef(false);

  // Skip link, header button and offline banner follow the walk's language.
  useEffect(() => publishWalkLang(lang), [lang]);

  // The header "Start with food" button opens the first question instead of just scrolling.
  useEffect(() => {
    const open = () => {
      movedByUser.current = true;
      setStep((s) => (s === "start" ? "need" : s));
    };
    window.addEventListener(START_EVENT, open);
    return () => window.removeEventListener(START_EVENT, open);
  }, []);

  // After each step change, move focus to the new question so screen readers and keyboards
  // land on it (not on the button that just disappeared). Skipped on first load.
  useEffect(() => {
    if (!movedByUser.current) {
      movedByUser.current = true;
      return;
    }
    // Next tick, so a link's own #walk jump (header button) can't take focus back afterwards.
    const id = window.setTimeout(() => {
      const root = walkRef.current;
      const q = root?.querySelector<HTMLElement>(".walk-q") ?? root?.querySelector<HTMLElement>("h1");
      if (!root || !q) return;
      q.setAttribute("tabindex", "-1");
      q.focus({ preventScroll: true });
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      root.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    }, 0);
    return () => window.clearTimeout(id);
  }, [step]);

  const results = useMemo(
    () => (submitted ? matchFood(submitted, new Date(), lang) : null),
    [submitted, lang],
  );

  function reset() {
    setStep("start");
    setNeed("");
    setSnapKind("");
    setPlaceQuery("");
    setSubmitted("");
    setPicked(null);
    setSnapCheck("");
    setSnapLeft("");
    setSnapSaved(false);
    setFoodCheck("");
    setFoodLeft("");
    setFoodSaved(false);
    setSenior(false);
  }

  function chooseNeed(value: Need) {
    setNeed(value);
    setStep(value === "tonight" ? "where" : "snap");
  }

  function onWhere(e: FormEvent) {
    e.preventDefault();
    setPicked(null);
    setSubmitted(placeQuery);
    setStep("options");
  }

  const showFoodAfterSnap = need === "both";
  const other: WalkLang = lang === "en" ? "es" : "en";

  return (
    <LangContext.Provider value={{ lang, t }}>
      <div className="walk" id="walk" lang={lang} ref={walkRef}>
        <div className="lang-row">
          <button
            type="button"
            className="lang-toggle"
            lang={other}
            aria-label={t.langToggleLabel}
            aria-pressed={lang === "es"}
            onClick={() => setLang(other)}
          >
            {t.langToggle}
          </button>
          {lang === "es" ? (
            <p className="draft-notice" data-needs-native-review="true">
              {t.draftNotice}
            </p>
          ) : null}
        </div>
        <h1>{t.h1}</h1>
        {step === "start" ? (
          <div className="walk-start">
            <button className="btn btn-primary" type="button" onClick={() => setStep("need")}>
              {t.start}
            </button>
            <p className="walk-scope">{t.scope}</p>
          </div>
        ) : (
          <div className="walk-panel">
            <div className="walk-top">
              <p className="walk-kicker">{t.kicker}</p>
              <button className="text-btn" type="button" onClick={reset}>
                {t.startOver}
              </button>
            </div>

            {step === "need" && (
              <div>
                <h2 className="walk-q">{t.needQ}</h2>
                <div className="choice-grid">
                  <button type="button" className="choice" onClick={() => chooseNeed("tonight")}>
                    <strong>{t.hungry}</strong>
                    <span>{t.hungrySub}</span>
                  </button>
                  <button type="button" className="choice" onClick={() => chooseNeed("snap")}>
                    <strong>{t.snapEbt}</strong>
                    <span>{t.snapEbtSub}</span>
                  </button>
                  <button type="button" className="choice" onClick={() => chooseNeed("both")}>
                    <strong>{t.both}</strong>
                    <span>{t.bothSub}</span>
                  </button>
                </div>
              </div>
            )}

            {step === "snap" && (
              <div>
                <h2 className="walk-q">{t.snapQ}</h2>
                <p className="walk-help">{t.snapHelp}</p>
                <div className="choice-grid">
                  {(
                    [
                      ["apply", t.applying, t.applyingSub],
                      ["renew", t.renewing, t.renewingSub],
                      ["unsure", t.notSure, t.notSureSub],
                    ] as const
                  ).map(([kind, label, sub]) => (
                    <button
                      key={kind}
                      type="button"
                      className="choice"
                      data-kind={kind}
                      onClick={() => {
                        setSnapKind(kind);
                        setStep("snap-next");
                      }}
                    >
                      <strong>{label}</strong>
                      <span>{sub}</span>
                    </button>
                  ))}
                </div>
                <button className="text-btn" type="button" onClick={() => setStep("need")}>
                  {t.back}
                </button>
                {need === "both" && (
                  <button className="text-btn" type="button" onClick={() => setStep("where")}>
                    {t.foodFirst}
                  </button>
                )}
              </div>
            )}

            {step === "snap-next" && <SnapNext kind={snapKind} onContinue={() => setStep("snap-check")} />}

            {step === "snap-check" && (
              <CheckBack
                title={t.snapCheckTitle}
                prompt={t.snapCheckPrompt}
                value={snapCheck}
                note={snapLeft}
                saved={snapSaved}
                onValue={setSnapCheck}
                onNote={setSnapLeft}
                onSave={() => setSnapSaved(true)}
                next={
                  showFoodAfterSnap
                    ? { label: t.nowFood, onClick: () => setStep("where") }
                    : { label: t.doneForNow, onClick: () => setStep("done") }
                }
              />
            )}

            {step === "where" && (
              <form onSubmit={onWhere}>
                <h2 className="walk-q">{t.whereQ}</h2>
                <p className="walk-help">{t.whereHelp}</p>
                <label htmlFor="where">{t.whereLabel}</label>
                <input
                  id="where"
                  name="where"
                  value={placeQuery}
                  onChange={(e) => setPlaceQuery(e.target.value)}
                  placeholder={t.wherePlaceholder}
                  autoComplete="postal-code"
                  maxLength={40}
                  required
                />
                <label className="check-row" htmlFor="senior-60">
                  <input
                    id="senior-60"
                    type="checkbox"
                    checked={senior}
                    onChange={(e) => setSenior(e.target.checked)}
                    aria-describedby="senior-60-help"
                  />
                  <span>{t.seniorToggle}</span>
                </label>
                <p className="walk-help fine" id="senior-60-help">
                  {t.seniorToggleHelp}
                </p>
                <button className="btn btn-primary" type="submit">
                  {t.showWeek}
                </button>
                <button
                  className="text-btn"
                  type="button"
                  onClick={() => setStep(need === "tonight" ? "need" : "snap-check")}
                >
                  {t.back}
                </button>
              </form>
            )}

            {step === "options" && results && (
              <Options
                query={submitted}
                result={results}
                senior={senior}
                onSenior={setSenior}
                onPick={(match) => {
                  setPicked(match);
                  setStep("script");
                }}
                onBack={() => setStep("where")}
              />
            )}

            {step === "script" && picked && (
              <FoodScript
                match={picked}
                area={submitted}
                onCheck={() => setStep("food-check")}
                onBack={() => setStep("options")}
              />
            )}

            {step === "food-check" && picked && (
              <CheckBack
                title={t.foodCheckTitle}
                prompt={t.foodCheckPrompt(picked.place.name)}
                value={foodCheck}
                note={foodLeft}
                saved={foodSaved}
                onValue={setFoodCheck}
                onNote={setFoodLeft}
                onSave={() => setFoodSaved(true)}
                extra={
                  foodCheck === "not" ? (
                    <p className="walk-help">
                      {t.notInNext1}{" "}
                      <a href={OFFICIAL.referral.phoneHref}>{OFFICIAL.referral.phone}</a>.{" "}
                      {t.notInNext2}{" "}
                      <button type="button" className="text-btn inline" onClick={() => setStep("options")}>
                        {t.pickAnother}
                      </button>
                      .
                    </p>
                  ) : null
                }
                next={
                  need === "both" && snapKind === ""
                    ? { label: t.nowSnap, onClick: () => setStep("snap") }
                    : { label: t.doneForNow, onClick: () => setStep("done") }
                }
              />
            )}

            {step === "done" && (
              <div>
                <h2 className="walk-q">{t.doneTitle}</h2>
                <p className="walk-help">{t.doneHelp}</p>
                <button className="btn btn-primary" type="button" onClick={reset}>
                  {t.again}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </LangContext.Provider>
  );
}

function SnapNext({ kind, onContinue }: { kind: SnapKind | ""; onContinue: () => void }) {
  const { t } = useLang();
  const lead = kind === "renew" ? t.snapLeadRenew : kind === "apply" ? t.snapLeadApply : t.snapLeadUnsure;

  return (
    <div>
      <h2 className="walk-q">{t.snapNextTitle}</h2>
      <p className="walk-help">{lead}</p>
      <ol className="official-list">
        <li>
          <a href={OFFICIAL.americaGov.url} target="_blank" rel="noopener noreferrer">
            {OFFICIAL.americaGov.name}
          </a>
          <p>{t.americaGovDetail}</p>
          <p className="say">{t.askThere}</p>
        </li>
        <li>
          <a href={OFFICIAL.myBenefits.url} target="_blank" rel="noopener noreferrer">
            {OFFICIAL.myBenefits.name}
          </a>
          <p>{t.myBenefitsDetail}</p>
        </li>
        <li>
          <a href={OFFICIAL.hotline.phoneHref}>{OFFICIAL.hotline.phone}</a>
          <p>
            {t.hotlineName}. {t.hotlineHours}. {t.youCall}
          </p>
          <p>
            {t.officeAddress} {OFFICIAL.hotline.address}.{" "}
            <a href={OFFICIAL.hotline.url} target="_blank" rel="noopener noreferrer">
              {t.countyPage}
            </a>
            .
          </p>
          <p className="say">
            {kind === "renew" ? t.sayRenew : t.sayApply} {t.caseNumber}
          </p>
        </li>
      </ol>
      <p className="walk-help">{t.neverCollect}</p>
      <button className="btn btn-primary" type="button" onClick={onContinue}>
        {t.checkBack}
      </button>
    </div>
  );
}

function Options({
  query,
  result,
  senior,
  onSenior,
  onPick,
  onBack,
}: {
  query: string;
  result: ReturnType<typeof matchFood>;
  senior: boolean;
  onSenior: (v: boolean) => void;
  onPick: (match: PlaceMatch) => void;
  onBack: () => void;
}) {
  const { lang, t } = useLang();
  if (!result.ok) {
    const message =
      result.reason === "ssn"
        ? t.errSsn
        : result.reason === "empty"
          ? t.errEmpty
          : result.detail && /^\d{5}$/.test(result.detail)
            ? t.errOutsideZip(result.detail)
            : t.errUnknown(query);
    return (
      <div>
        <h2 className="walk-q">{t.cantMatch}</h2>
        <p className="walk-help">{message}</p>
        <p className="walk-help">
          <a href={OFFICIAL.map.url} target="_blank" rel="noopener noreferrer">
            {t.foodConnectMap}
          </a>
          {" · "}
          <a href={OFFICIAL.americaGov.url} target="_blank" rel="noopener noreferrer">
            America.gov
          </a>
        </p>
        <button className="text-btn" type="button" onClick={onBack}>
          {t.tryAnother}
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="walk-q">{t.thisWeekNear(result.label)}</h2>
      <p className="walk-help">
        {t.weekHelp1(result.weekLabel, result.places.length)}{" "}
        <a href={OFFICIAL.referral.phoneHref}>{OFFICIAL.referral.phone}</a> {t.weekHelp2}
      </p>
      {LIST_CHECKED_ON ? (
        <p className="checked-stamp">
          <span aria-hidden="true">✓</span>
          <span>
            {t.listChecked}{" "}
            <time dateTime={LIST_CHECKED_ON}>{formatIsoDate(LIST_CHECKED_ON, lang)}</time>.
          </span>
        </p>
      ) : null}
      {t.sourceInEnglish ? <p className="walk-help fine">{t.sourceInEnglish}</p> : null}
      {result.places.length === 0 ? (
        <p className="walk-help">
          {t.nothingLeft1}{" "}
          <a href={OFFICIAL.map.url} target="_blank" rel="noopener noreferrer">
            {t.foodConnectMap}
          </a>{" "}
          {t.nothingLeft2} {OFFICIAL.referral.phone}.
        </p>
      ) : (
        <ul className="place-list">
          {result.places.map((match) => (
            <li key={match.place.id}>
              <article className="place-card">
                <h3 lang="en">{match.place.name}</h3>
                <p className="when">
                  {match.opening
                    ? formatWhen(match.opening, lang)
                    : match.place.alwaysOpen
                      ? t.open247
                      : t.hoursNotPublished}
                  {match.opening?.nextWeek ? t.nextWeek : ""}
                </p>
                <p>
                  {match.place.address}, {match.place.city} {match.place.zip}
                  {" · "}
                  <a href={mapsHref(match.place)} target="_blank" rel="noopener noreferrer">
                    {t.openInMaps}
                  </a>
                </p>
                <p>
                  <a href={phoneHref(match.place.phone)}>{formatPhone(match.place.phone)}</a>
                </p>
                {match.place.hoursRaw ? (
                  <p className="hours-raw">
                    <span>{t.publishedHours}</span>
                    <span lang="en">{match.place.hoursRaw}</span>
                  </p>
                ) : (
                  <p className="hours-raw">{t.hoursNotListed}</p>
                )}
                {match.place.note ? (
                  // Eligibility and "call first" notes (residents only, students only, appointment) belong on the card, before someone picks it.
                  <p className="walk-help fine">
                    {t.fromSource} <span lang="en">{match.place.note}</span>
                  </p>
                ) : null}
                <SourceLine place={match.place} />
                <button className="btn btn-primary" type="button" onClick={() => onPick(match)}>
                  {t.useStop}
                </button>
              </article>
            </li>
          ))}
        </ul>
      )}
      <SeniorMeals zips={result.zips} show={senior} onShow={onSenior} />
      <p className="walk-help">
        {t.fullMap}{" "}
        <a href={OFFICIAL.map.url} target="_blank" rel="noopener noreferrer">
          {OFFICIAL.map.name}
        </a>
        . {t.flyer}{" "}
        <a href={OFFICIAL.flyer.url} target="_blank" rel="noopener noreferrer">
          {OFFICIAL.flyer.name}
        </a>
        .
      </p>
      <button className="text-btn" type="button" onClick={onBack}>
        {t.changeZip}
      </button>
    </div>
  );
}

function FoodScript({
  match,
  area,
  onCheck,
  onBack,
}: {
  match: PlaceMatch;
  area: string;
  onCheck: () => void;
  onBack: () => void;
}) {
  const { lang, t } = useLang();
  const place: FoodPlace = match.place;
  const when = match.opening
    ? formatWhen(match.opening, lang)
    : place.alwaysOpen
      ? t.whenOpen247
      : t.whenUnknown;

  return (
    <div>
      <h2 className="walk-q">{t.scriptTitle(place.name)}</h2>
      <p className="when">{when}</p>
      <p className="say">{t.say(place.kind === "meal" ? "meal" : "food", area, when)}</p>
      <p className="walk-help">{t.bring(formatPhone(place.phone))}</p>
      {place.note ? (
        <p className="walk-help">
          {t.fromSource} <span lang="en">{place.note}</span>
        </p>
      ) : null}
      <div className="walk-actions">
        <a className="btn btn-ghost" href={mapsHref(place)} target="_blank" rel="noopener noreferrer">
          {t.openInMaps}
        </a>
        {match.opening ? (
          <a className="btn btn-ghost" href={icsHref(place, match.opening)} download={icsFileName(place)}>
            {t.addToCalendar}
          </a>
        ) : null}
      </div>
      <p className="walk-help fine">{t.mapsCalFine}</p>
      <SourceLine place={place} />
      <p className="source-line">
        <a href={phoneHref(place.phone)}>{formatPhone(place.phone)}</a>
        {" · "}
        {place.address}, {place.city} {place.zip}
      </p>
      <button className="btn btn-primary" type="button" onClick={onCheck}>
        {t.pickedCheck}
      </button>
      <button className="text-btn" type="button" onClick={onBack}>
        {t.pickDifferent}
      </button>
    </div>
  );
}

function CheckBack({
  title,
  prompt,
  value,
  note,
  saved,
  onValue,
  onNote,
  onSave,
  next,
  extra,
}: {
  title: string;
  prompt: string;
  value: Check;
  note: string;
  saved: boolean;
  onValue: (v: Check) => void;
  onNote: (v: string) => void;
  onSave: () => void;
  next: { label: string; onClick: () => void };
  extra?: ReactNode;
}) {
  const { t } = useLang();
  return (
    <div>
      <h2 className="walk-q">{title}</h2>
      <p className="walk-help">{prompt}</p>
      <div className="choice-grid compact">
        {(
          [
            ["in", t.gotIn],
            ["not", t.notThisTime],
            ["going", t.stillGoing],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={value === id ? "choice selected" : "choice"}
            data-check={id}
            onClick={() => onValue(id)}
          >
            <strong>{label}</strong>
          </button>
        ))}
      </div>
      <label htmlFor="left">{t.whatsLeft}</label>
      <textarea
        id="left"
        value={note}
        onChange={(e) => onNote(e.target.value)}
        rows={3}
        maxLength={400}
        placeholder={t.notePlaceholder}
      />
      <p className="walk-help">{t.noteHelp}</p>
      <button className="btn btn-ghost" type="button" onClick={onSave} disabled={!value && !note}>
        {saved ? t.noted : t.keepNote}
      </button>
      {extra}
      <button className="btn btn-primary" type="button" onClick={next.onClick}>
        {next.label}
      </button>
    </div>
  );
}

function SourceLine({ place }: { place: FoodPlace }) {
  const { lang, t } = useLang();
  const stale = isStaleSource(place);
  return (
    <>
      {place.unconfirmed ? <p className="stale-flag">{t.unconfirmed}</p> : null}
      {stale ? <p className="stale-flag">{t.olderListing(formatIsoDate(place.sourceUpdated, lang))}</p> : null}
      <p className="source-line">
        {t.source}{" "}
        <a href={place.sourceUrl} target="_blank" rel="noopener noreferrer">
          {place.sourceName}
        </a>
        . {t.sourceUpdated}{" "}
        <time dateTime={place.sourceUpdated}>{formatIsoDate(place.sourceUpdated, lang)}</time>.
        {place.verifiedOn ? (
          <>
            {" "}
            {t.lastVerified} <time dateTime={place.verifiedOn}>{formatIsoDate(place.verifiedOn, lang)}</time>.
          </>
        ) : (
          t.notRechecked
        )}
      </p>
    </>
  );
}

/** Separate, clearly labeled 60+ group. Shown only after the person says they are 60+ or taps to show it. */
function SeniorMeals({ zips, show, onShow }: { zips: string[]; show: boolean; onShow: (v: boolean) => void }) {
  const { lang, t } = useLang();
  const matches = useMemo(() => (show ? matchSeniorMeals(zips, new Date()) : []), [show, zips]);
  if (!show) {
    return (
      <p className="senior-reveal">
        <button
          type="button"
          className="btn btn-ghost"
          aria-expanded="false"
          aria-controls="senior-meals"
          onClick={() => onShow(true)}
        >
          {t.seniorShow}
        </button>
      </p>
    );
  }
  const hdm = SENIOR_PROGRAM.homeDelivered;
  return (
    <section className="senior-section" id="senior-meals" aria-labelledby="senior-meals-title">
      <h3 className="senior-title" id="senior-meals-title">
        {t.seniorTitle}
      </h3>
      <p className="walk-help">{t.seniorIntro}</p>
      <p className="walk-help fine">
        <strong>{t.seniorWho}</strong> {t.seniorWhoText}
      </p>
      <p className="walk-help fine">
        <strong>{t.seniorCost}</strong> {t.seniorCostText}
      </p>
      <p className="checked-stamp">
        <span aria-hidden="true">✓</span>
        <span>
          {t.seniorChecked}{" "}
          <time dateTime={SENIOR_PROGRAM.checkedOn}>{formatIsoDate(SENIOR_PROGRAM.checkedOn, lang)}</time>.
        </span>
      </p>
      <ul className="place-list">
        {matches.map((m) => (
          <li key={m.site.id}>
            <SeniorCard site={m.site} when={m.opening ? formatWhen(m.opening, lang) : ""} />
          </li>
        ))}
      </ul>
      <p className="walk-help fine">{t.seniorClosedNote}</p>
      <div className="senior-hdm">
        <h4>{t.seniorHdmTitle}</h4>
        <p className="walk-help fine">{t.seniorHdmText}</p>
        <p className="senior-call">
          {t.seniorHdmCall(hdm.phoneName)} <a href={phoneHref(hdm.phone)}>{formatPhone(hdm.phone)}</a>
        </p>
        <p className="walk-help fine">
          {t.seniorHdmAlso} <span lang="en">{hdm.lifePathNote}</span>{" "}
          <a href={phoneHref(hdm.lifePathPhone)}>{formatPhone(hdm.lifePathPhone)}</a>
        </p>
        <p className="source-line">
          {t.seniorSources}{" "}
          <a href={hdm.url} target="_blank" rel="noopener noreferrer">
            Albany County — Home Delivered Meals
          </a>
          {" · "}
          <a href={hdm.lifePathUrl} target="_blank" rel="noopener noreferrer">
            LifePath — Meals on Wheels
          </a>
        </p>
      </div>
      <p className="walk-help">
        {t.seniorAll}{" "}
        <a href={SENIOR_COUNTY_URL} target="_blank" rel="noopener noreferrer">
          {SENIOR_PROGRAM.countyName}
        </a>{" "}
        · <a href={phoneHref(SENIOR_PROGRAM.countyPhone)}>{formatPhone(SENIOR_PROGRAM.countyPhone)}</a>
      </p>
      <button
        type="button"
        className="text-btn"
        aria-expanded="true"
        aria-controls="senior-meals"
        onClick={() => onShow(false)}
      >
        {t.seniorHide}
      </button>
    </section>
  );
}

function SeniorCard({ site, when }: { site: SeniorMealSite; when: string }) {
  const { lang, t } = useLang();
  return (
    <article className="place-card senior-card" data-senior-id={site.id}>
      <p className="senior-badge">60+</p>
      <h4 lang="en">{site.name}</h4>
      <p className="when">{when ? `${t.seniorNext} ${when}` : t.seniorCallFirst}</p>
      <p>
        {site.address}, {site.city} {site.zip}
        {" · "}
        <a href={mapsHref(site)} target="_blank" rel="noopener noreferrer">
          {t.openInMaps}
        </a>
      </p>
      <p className="senior-call">
        {t.seniorCall} <a href={phoneHref(site.phone)}>{formatPhone(site.phone)}</a>
      </p>
      {site.hoursRaw ? (
        <p className="hours-raw">
          <span>{t.seniorPublished}</span>
          <span lang="en">{site.hoursRaw}</span>
        </p>
      ) : null}
      <p className="walk-help fine">
        {t.seniorReserve} <span lang="en">{site.reserve}</span>
      </p>
      {site.note ? (
        <p className="walk-help fine">
          {t.fromSource} <span lang="en">{site.note}</span>
        </p>
      ) : null}
      <p className="say">{t.seniorSay}</p>
      <p className="source-line">
        {t.seniorSources}{" "}
        {site.sources.map((src, i) => (
          <span key={src.url}>
            {i ? " · " : ""}
            <a href={src.url} target="_blank" rel="noopener noreferrer">
              {src.name}
            </a>
            {src.updated ? (
              <>
                {" "}
                ({t.sourceUpdated.toLowerCase()} <time dateTime={src.updated}>{formatIsoDate(src.updated, lang)}</time>)
              </>
            ) : null}
          </span>
        ))}
        . {t.seniorPhoneFrom(site.phoneFrom)}
        {site.verifiedOn ? (
          <>
            {" "}
            {t.lastVerified} <time dateTime={site.verifiedOn}>{formatIsoDate(site.verifiedOn, lang)}</time>.
          </>
        ) : (
          t.notRechecked
        )}
      </p>
    </article>
  );
}
