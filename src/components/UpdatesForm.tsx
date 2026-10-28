"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { clientSignupError, SIGNUP_CLIENT_TIMEOUT_MS, signupCopy } from "@/lib/signup-copy";
import { useWalkLang } from "@/lib/walk-lang";

type Status = "idle" | "loading" | "ok" | "err";

/** Name and email for updates. Posts to /api/updates. Works without JavaScript as a normal form. */
export default function UpdatesForm() {
  const copy = signupCopy(useWalkLang());
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const started = useRef<number | null>(null);

  useEffect(() => {
    started.current = performance.now();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dataIn = new FormData(e.currentTarget);
    const hgu_leave_blank = String(dataIn.get("hgu_leave_blank") ?? "");
    const elapsed = started.current == null ? undefined : Math.round(performance.now() - started.current);
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/updates", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ name, email, hgu_leave_blank, elapsed }),
        signal: AbortSignal.timeout(SIGNUP_CLIENT_TIMEOUT_MS),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setStatus("err");
        setMessage(clientSignupError(res.status, data.error, copy));
        return;
      }
      setStatus("ok");
      setMessage(copy.ok);
      setName("");
      setEmail("");
    } catch {
      setStatus("err");
      setMessage(copy.network);
    }
  }

  return (
    <form className="updates-form" action="/api/updates" method="post" onSubmit={onSubmit} aria-describedby="updates-note">
      <div className="updates-hp" aria-hidden="true">
        <label htmlFor="updates-hp">Leave blank</label>
        <input
          id="updates-hp"
          name="hgu_leave_blank"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>
      <label htmlFor="updates-name">{copy.labelName}</label>
      <input
        id="updates-name"
        name="name"
        type="text"
        autoComplete="name"
        required
        maxLength={80}
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={status === "loading"}
      />
      <label htmlFor="updates-email">{copy.labelEmail}</label>
      <input
        id="updates-email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        spellCheck={false}
        required
        maxLength={254}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={status === "loading"}
      />
      <button className="btn btn-primary" type="submit" disabled={status === "loading"}>
        {status === "loading" ? copy.sending : copy.button}
      </button>
      <p className="form-note" id="updates-note">
        {copy.note} <a href="mailto:hello@helpgetup.com">hello@helpgetup.com</a>. <a href="/privacy">Privacy</a>.
      </p>
      <p
        className={message ? (status === "ok" ? "form-status ok" : "form-status err") : undefined}
        role="status"
        aria-live="polite"
      >
        {status === "ok" ? (
          <>
            <strong className="signup-lead">{copy.okLead}</strong>
            {copy.okNext} {copy.okFoodBefore}
            <a href="/albany-food-list">{copy.okFoodLabel}</a>
            {copy.okFoodAfter}
          </>
        ) : (
          message
        )}
      </p>
    </form>
  );
}
