"use client";

import { FormEvent, useMemo, useState, type ReactNode } from "react";
import { OFFICIAL, type FoodPlace } from "@/data/albany-food";
import {
  formatPhone,
  formatWhen,
  matchFood,
  phoneHref,
  type PlaceMatch,
} from "@/lib/food-week";

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

export default function FoodWalk() {
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

  const results = useMemo(
    () => (submitted ? matchFood(submitted, new Date()) : null),
    [submitted],
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

  return (
    <div className="walk" id="walk">
      <h1>Stuck on food? Start with one clear next step.</h1>
      {step === "start" ? (
        <div className="walk-start">
          <button className="btn btn-primary" type="button" onClick={() => setStep("need")}>
            Start with food
          </button>
          <p className="walk-scope">
            Albany County. Food only. This walk does not call anyone or fill out a form.
          </p>
        </div>
      ) : (
        <div className="walk-panel">
          <div className="walk-top">
            <p className="walk-kicker">Albany County · food</p>
            <button className="text-btn" type="button" onClick={reset}>
              Start over
            </button>
          </div>

          {step === "need" && (
            <div>
              <h2 className="walk-q">What do you need?</h2>
              <div className="choice-grid">
                <button type="button" className="choice" onClick={() => chooseNeed("tonight")}>
                  <strong>Hungry tonight</strong>
                  <span>A pantry, meal, or produce stop this week.</span>
                </button>
                <button type="button" className="choice" onClick={() => chooseNeed("snap")}>
                  <strong>SNAP / EBT</strong>
                  <span>Where to apply or renew. You click the official site.</span>
                </button>
                <button type="button" className="choice" onClick={() => chooseNeed("both")}>
                  <strong>Both</strong>
                  <span>SNAP first, then food tonight.</span>
                </button>
              </div>
            </div>
          )}

          {step === "snap" && (
            <div>
              <h2 className="walk-q">Applying, or renewing?</h2>
              <p className="walk-help">
                That is the only question. Do not type a Social Security number, driver’s
                license, myBenefits password, or anything from an ID.
              </p>
              <div className="choice-grid">
                <button
                  type="button"
                  className="choice"
                  onClick={() => {
                    setSnapKind("apply");
                    setStep("snap-next");
                  }}
                >
                  <strong>Applying</strong>
                  <span>First time, or no open case you know of.</span>
                </button>
                <button
                  type="button"
                  className="choice"
                  onClick={() => {
                    setSnapKind("renew");
                    setStep("snap-next");
                  }}
                >
                  <strong>Renewing</strong>
                  <span>You already have SNAP and need to recertify.</span>
                </button>
                <button
                  type="button"
                  className="choice"
                  onClick={() => {
                    setSnapKind("unsure");
                    setStep("snap-next");
                  }}
                >
                  <strong>Not sure</strong>
                  <span>Start with the official explainer, then the state site.</span>
                </button>
              </div>
              <button className="text-btn" type="button" onClick={() => setStep("need")}>
                Back
              </button>
              {need === "both" && (
                <button className="text-btn" type="button" onClick={() => setStep("where")}>
                  I need food first
                </button>
              )}
            </div>
          )}

          {step === "snap-next" && <SnapNext kind={snapKind} onContinue={() => setStep("snap-check")} />}

          {step === "snap-check" && (
            <CheckBack
              title="Did you get into SNAP?"
              prompt="Did you open the official site, or reach the county line?"
              value={snapCheck}
              note={snapLeft}
              saved={snapSaved}
              onValue={setSnapCheck}
              onNote={setSnapLeft}
              onSave={() => setSnapSaved(true)}
              next={
                showFoodAfterSnap
                  ? { label: "Now food tonight", onClick: () => setStep("where") }
                  : { label: "Done for now", onClick: () => setStep("done") }
              }
            />
          )}

          {step === "where" && (
            <form onSubmit={onWhere}>
              <h2 className="walk-q">Where in Albany County?</h2>
              <p className="walk-help">
                A ZIP or a neighborhood. We use it only to sort this list. It is not sent
                anywhere.
              </p>
              <label htmlFor="where">ZIP or neighborhood</label>
              <input
                id="where"
                name="where"
                value={placeQuery}
                onChange={(e) => setPlaceQuery(e.target.value)}
                placeholder="12206 or Arbor Hill"
                autoComplete="postal-code"
                maxLength={40}
                required
              />
              <button className="btn btn-primary" type="submit">
                Show this week
              </button>
              <button
                className="text-btn"
                type="button"
                onClick={() => setStep(need === "tonight" ? "need" : "snap-check")}
              >
                Back
              </button>
            </form>
          )}

          {step === "options" && results && (
            <Options
              query={submitted}
              result={results}
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
              title="Did you get in?"
              prompt={`At ${picked.place.name} — did you get food?`}
              value={foodCheck}
              note={foodLeft}
              saved={foodSaved}
              onValue={setFoodCheck}
              onNote={setFoodLeft}
              onSave={() => setFoodSaved(true)}
              extra={
                foodCheck === "not" ? (
                  <p className="walk-help">
                    Next: call the pantry, or the Food Pantries referral line{" "}
                    <a href={OFFICIAL.referral.phoneHref}>{OFFICIAL.referral.phone}</a>.
                    HelpGetUp does not call for you. You can also{" "}
                    <button type="button" className="text-btn inline" onClick={() => setStep("options")}>
                      pick another stop
                    </button>
                    .
                  </p>
                ) : null
              }
              next={
                need === "both" && snapKind === ""
                  ? { label: "Now the SNAP step", onClick: () => setStep("snap") }
                  : { label: "Done for now", onClick: () => setStep("done") }
              }
            />
          )}

          {step === "done" && (
            <div>
              <h2 className="walk-q">That’s the next step.</h2>
              <p className="walk-help">
                You stay in control of what happens after this. The waitlist below is
                optional — it is not required to use this walk.
              </p>
              <button className="btn btn-primary" type="button" onClick={reset}>
                Walk it again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SnapNext({ kind, onContinue }: { kind: SnapKind | ""; onContinue: () => void }) {
  const lead =
    kind === "renew"
      ? "Renew on myBenefits. You sign in there, not here."
      : kind === "apply"
        ? "Start the application on myBenefits. You click their site. We do not open it as you."
        : "If you are not sure you have a case, read the program path on America.gov first. Renewals still happen on myBenefits.";

  return (
    <div>
      <h2 className="walk-q">Your next step for SNAP</h2>
      <p className="walk-help">{lead}</p>
      <ol className="official-list">
        <li>
          <a href={OFFICIAL.americaGov.url} target="_blank" rel="noopener noreferrer">
            {OFFICIAL.americaGov.name}
          </a>
          <p>{OFFICIAL.americaGov.detail}</p>
          <p className="say">
            What to ask there: “How do I apply for SNAP in Albany County, New York?”
          </p>
        </li>
        <li>
          <a href={OFFICIAL.myBenefits.url} target="_blank" rel="noopener noreferrer">
            {OFFICIAL.myBenefits.name}
          </a>
          <p>{OFFICIAL.myBenefits.detail}</p>
        </li>
        <li>
          <a href={OFFICIAL.hotline.phoneHref}>{OFFICIAL.hotline.phone}</a>
          <p>
            {OFFICIAL.hotline.name}. {OFFICIAL.hotline.hours}. You call. We do not.
          </p>
          <p className="say">
            What to say: “I need to {kind === "renew" ? "renew" : "apply for"} SNAP in
            Albany County.” Have a case number only if you already have one. Do not give
            that number to HelpGetUp.
          </p>
        </li>
      </ol>
      <p className="walk-help">
        HelpGetUp never collects a Social Security number, driver’s license, myBenefits
        password, or ID photo. There is no place to store one here.
      </p>
      <button className="btn btn-primary" type="button" onClick={onContinue}>
        Check back
      </button>
    </div>
  );
}

function Options({
  query,
  result,
  onPick,
  onBack,
}: {
  query: string;
  result: ReturnType<typeof matchFood>;
  onPick: (match: PlaceMatch) => void;
  onBack: () => void;
}) {
  if (!result.ok) {
    const message =
      result.reason === "ssn"
        ? "Don’t put a Social Security number here. A ZIP or a neighborhood is enough."
        : result.reason === "empty"
          ? "Enter a ZIP or an Albany County neighborhood."
          : result.detail && /^\d{5}$/.test(result.detail)
            ? `${result.detail} is outside this demo. HelpGetUp’s food list is Albany County only. For SNAP in another state, start at America.gov. For pantries outside this county, use the Food Connect map.`
            : `“${query}” isn’t a ZIP or neighborhood this demo knows. Try 12206, South End, Cohoes, or Ravena.`;
    return (
      <div>
        <h2 className="walk-q">Can’t match that yet</h2>
        <p className="walk-help">{message}</p>
        <p className="walk-help">
          <a href={OFFICIAL.map.url} target="_blank" rel="noopener noreferrer">
            Food Connect map
          </a>
          {" · "}
          <a href={OFFICIAL.americaGov.url} target="_blank" rel="noopener noreferrer">
            America.gov
          </a>
        </p>
        <button className="text-btn" type="button" onClick={onBack}>
          Try another place
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="walk-q">This week near {result.label}</h2>
      <p className="walk-help">
        Week of {result.weekLabel}. {result.places.length} stops, closest first. Hours
        can change. If an end time was not published, the card says so. Confirm with the
        phone number or{" "}
        <a href={OFFICIAL.referral.phoneHref}>{OFFICIAL.referral.phone}</a> (Food
        Pantries referral line). We do not call.
      </p>
      {result.places.length === 0 ? (
        <p className="walk-help">
          Nothing in this file has a published time left this week for that spot. Use the{" "}
          <a href={OFFICIAL.map.url} target="_blank" rel="noopener noreferrer">
            Food Connect map
          </a>{" "}
          or call {OFFICIAL.referral.phone}.
        </p>
      ) : (
        <ul className="place-list">
          {result.places.map((match) => (
            <li key={match.place.id}>
              <article className="place-card">
                <h3>{match.place.name}</h3>
                <p className="when">
                  {match.opening
                    ? formatWhen(match.opening)
                    : "Hours not published"}
                  {match.opening?.nextWeek ? " · next opening is next week" : ""}
                </p>
                <p>
                  {match.place.address}, {match.place.city} {match.place.zip}
                </p>
                <p>
                  <a href={phoneHref(match.place.phone)}>{formatPhone(match.place.phone)}</a>
                </p>
                {match.place.hoursRaw ? (
                  <p className="hours-raw">
                    <span>Published hours: </span>
                    {match.place.hoursRaw}
                  </p>
                ) : (
                  <p className="hours-raw">Published hours: not listed. Don’t assume it is open.</p>
                )}
                <p className="source-line">
                  Source:{" "}
                  <a href={match.place.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {match.place.sourceName}
                  </a>
                  . Updated {match.place.sourceUpdated}.
                </p>
                <button className="btn btn-primary" type="button" onClick={() => onPick(match)}>
                  Use this stop
                </button>
              </article>
            </li>
          ))}
        </ul>
      )}
      <p className="walk-help">
        Full map:{" "}
        <a href={OFFICIAL.map.url} target="_blank" rel="noopener noreferrer">
          {OFFICIAL.map.name}
        </a>
        . Flyer:{" "}
        <a href={OFFICIAL.flyer.url} target="_blank" rel="noopener noreferrer">
          {OFFICIAL.flyer.name}
        </a>
        .
      </p>
      <button className="text-btn" type="button" onClick={onBack}>
        Change ZIP
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
  const place: FoodPlace = match.place;
  const when = match.opening ? formatWhen(match.opening) : "hours not published";
  const kindWord = place.kind === "meal" ? "the community meal" : "food";

  return (
    <div>
      <h2 className="walk-q">What to say at {place.name}</h2>
      <p className="when">{when}</p>
      <p className="say">
        “Hi, I need {kindWord}. I’m in {area}. Are you open {when}? Do I need to call
        ahead?”
      </p>
      <p className="walk-help">
        What to bring: only what they ask for. This demo does not have a confirmed
        document list for this stop. Call {formatPhone(place.phone)} and ask. Common
        asks are an ID and something with your address — treat that as a guess until
        they say so.
      </p>
      {place.note ? <p className="walk-help">From the source: {place.note}</p> : null}
      <p className="source-line">
        Source:{" "}
        <a href={place.sourceUrl} target="_blank" rel="noopener noreferrer">
          {place.sourceName}
        </a>
        . Updated {place.sourceUpdated}.{" "}
        <a href={phoneHref(place.phone)}>{formatPhone(place.phone)}</a>
        {" · "}
        {place.address}, {place.city} {place.zip}
      </p>
      <button className="btn btn-primary" type="button" onClick={onCheck}>
        I picked this. Check back.
      </button>
      <button className="text-btn" type="button" onClick={onBack}>
        Pick a different stop
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
  return (
    <div>
      <h2 className="walk-q">{title}</h2>
      <p className="walk-help">{prompt}</p>
      <div className="choice-grid compact">
        {(
          [
            ["in", "I got in"],
            ["not", "Not this time"],
            ["going", "Still going"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={value === id ? "choice selected" : "choice"}
            onClick={() => onValue(id)}
          >
            <strong>{label}</strong>
          </button>
        ))}
      </div>
      <label htmlFor="left">What’s left?</label>
      <textarea
        id="left"
        value={note}
        onChange={(e) => onNote(e.target.value)}
        rows={3}
        maxLength={400}
        placeholder="Optional. Stays on this page. Not sent."
      />
      <p className="walk-help">
        This note stays in the browser until you leave or start over. HelpGetUp does
        not email it, store it, or call anyone about it.
      </p>
      <button className="btn btn-ghost" type="button" onClick={onSave} disabled={!value && !note}>
        {saved ? "Noted on this page" : "Keep this note here"}
      </button>
      {extra}
      <button className="btn btn-primary" type="button" onClick={next.onClick}>
        {next.label}
      </button>
    </div>
  );
}
