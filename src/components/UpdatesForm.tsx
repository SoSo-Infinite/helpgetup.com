"use client";

import { FormEvent, useState } from "react";
import { SIGNUP_COPY } from "@/lib/signup-copy";

type Status = "idle" | "loading" | "ok" | "err";

/** Name and email for updates. Posts to /api/updates. Works without JavaScript as a normal form. */
export default function UpdatesForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/updates", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setStatus("err");
        setMessage(data.error || SIGNUP_COPY.invalid);
        return;
      }
      setStatus("ok");
      setMessage(SIGNUP_COPY.ok);
      setName("");
      setEmail("");
    } catch {
      setStatus("err");
      setMessage(SIGNUP_COPY.network);
    }
  }

  return (
    <form className="updates-form" action="/api/updates" method="post" onSubmit={onSubmit} aria-describedby="updates-note">
      <label htmlFor="updates-name">Name</label>
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
      <label htmlFor="updates-email">Email</label>
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
        {status === "loading" ? "Sending…" : "Get updates and help resources"}
      </button>
      <p className="form-note" id="updates-note">
        We use your name and email only to send updates and help resources. Questions:{" "}
        <a href="mailto:hello@helpgetup.com">hello@helpgetup.com</a>. <a href="/privacy">Privacy</a>.
      </p>
      <p
        className={message ? (status === "ok" ? "form-status ok" : "form-status err") : undefined}
        role="status"
        aria-live="polite"
      >
        {message}
      </p>
    </form>
  );
}
