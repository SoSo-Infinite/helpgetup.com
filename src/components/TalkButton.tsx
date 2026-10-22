"use client";

/**
 * HelpGetUp talk button: same look, bounce and Grok voice technology as the albanyaiguy.com button
 * (branch grok-voice), with HelpGetUp's logo, colors and its own helper, Rosa.
 * Tap -> microphone -> /api/talk/token (ephemeral xAI secret + session plan) -> one WebSocket to xAI.
 * Food lookups (find_food, senior_meals) run here in the browser on the site's own data.
 * Caps: 5 minutes, 30 s idle hang-up, hang-up on pagehide. No LiveKit.
 */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GrokPlan, GrokTalk, SessionResult } from "@/lib/talk/grok-client";
import { AGENT_NAME } from "@/lib/talk/identity";
import type { WalkLang } from "@/lib/food-week";
import { useWalkLang } from "@/lib/walk-lang";

type State =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "talking"
  | "ended"
  | "error";

const TEXT: Record<
  WalkLang,
  {
    status: Record<State, string>;
    hint: string;
    labelOn: string;
    labelOff: string;
    end: string;
    again: string;
    fallback: string;
    fine: string;
    micBlocked: string;
    micUnsupported: string;
    noAudio: string;
    unsupported: string;
    connect: string;
    unavailable: string;
    network: string;
  }
> = {
  en: {
    status: {
      idle: "",
      connecting: "Connecting…",
      listening: "Listening",
      thinking: "Looking that up…",
      talking: `${AGENT_NAME} is talking`,
      ended: "Conversation ended",
      error: "",
    },
    hint: "Tap to talk",
    labelOn: `${AGENT_NAME} is on. Use End to stop the conversation.`,
    labelOff: `Talk to ${AGENT_NAME}, the HelpGetUp voice helper. Starts a voice conversation using your microphone.`,
    end: "End",
    again: "Talk again",
    fallback: "See the food list",
    fine: "You’re talking to an AI. Up to 5 minutes. Audio isn’t recorded, but a short written summary is kept. No name or ID needed.",
    micBlocked:
      "The microphone is blocked. Allow it in your browser settings and tap again, or use the food list.",
    micUnsupported:
      "This browser can’t use the microphone here. Open helpgetup.com in Safari or Chrome, or use the food list.",
    noAudio:
      "This browser can’t play live audio here. Open helpgetup.com in Safari or Chrome, or use the food list.",
    unsupported:
      "This browser can’t use live voice here. Open helpgetup.com in Safari or Chrome, or use the food list.",
    connect: "Couldn’t connect. Try again, or use the food list.",
    unavailable: "Live voice isn’t available right now. Use the food list.",
    network: "Couldn’t reach the server. Try again, or use the food list.",
  },
  es: {
    status: {
      idle: "",
      connecting: "Conectando…",
      listening: "Escuchando",
      thinking: "Buscando…",
      talking: `${AGENT_NAME} está hablando`,
      ended: "Conversación terminada",
      error: "",
    },
    hint: "Toca para hablar",
    labelOn: `${AGENT_NAME} está activa. Usa Terminar para parar la conversación.`,
    labelOff: `Habla con ${AGENT_NAME}, la ayudante de voz de HelpGetUp. Empieza una conversación de voz con tu micrófono.`,
    end: "Terminar",
    again: "Hablar otra vez",
    fallback: "Ver la lista de comida",
    fine: "Hablas con una IA. Hasta 5 minutos. El audio no se graba, pero se guarda un breve resumen escrito. No necesitas dar tu nombre ni identificación.",
    micBlocked:
      "El micrófono está bloqueado. Permítelo en tu navegador y toca otra vez, o usa la lista de comida.",
    micUnsupported:
      "Este navegador no puede usar el micrófono aquí. Abre helpgetup.com en Safari o Chrome, o usa la lista de comida.",
    noAudio:
      "Este navegador no puede reproducir audio en vivo aquí. Abre helpgetup.com en Safari o Chrome, o usa la lista de comida.",
    unsupported:
      "Este navegador no puede usar voz en vivo aquí. Abre helpgetup.com en Safari o Chrome, o usa la lista de comida.",
    connect: "No se pudo conectar. Intenta otra vez, o usa la lista de comida.",
    unavailable:
      "La voz en vivo no está disponible ahora. Usa la lista de comida.",
    network:
      "No se pudo llegar al servidor. Intenta otra vez, o usa la lista de comida.",
  },
};

type Problem =
  | "micBlocked"
  | "micUnsupported"
  | "noAudio"
  | "unsupported"
  | "connect"
  | "unavailable"
  | "network";

type TokenResponse = {
  ok: boolean;
  provider?: "grok";
  token?: string;
  message?: string;
  reason?: string;
  sid?: string | null;
} & Partial<GrokPlan>;

/** Created inside the tap so iOS Safari lets it play. */
function makeAudioContext(): AudioContext | null {
  try {
    const w = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    void ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

/** Safari 17+: keep playback audible with the ringer switch off while the mic is open. */
function playAndRecord(): void {
  try {
    const s = (navigator as unknown as { audioSession?: { type: string } })
      .audioSession;
    if (s) s.type = "play-and-record";
  } catch {
    /* not supported */
  }
}

function sendSummary(sid: string, r: SessionResult): void {
  const body = JSON.stringify({
    sid,
    turns: r.turns,
    seconds: Math.round(r.seconds),
    end: r.reason,
  });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/talk/summary",
        new Blob([body], { type: "application/json" }),
      );
    } else {
      void fetch("/api/talk/summary", {
        method: "POST",
        body,
        keepalive: true,
        headers: { "content-type": "application/json" },
      });
    }
  } catch {
    /* alerts must never break the page */
  }
}

function inAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /FBAN|FBAV|Instagram|Line\/|TikTok/i.test(navigator.userAgent);
}

/** `caption`: optional short line directly under the button. */
export default function TalkButton({ caption }: { caption?: string } = {}) {
  const lang = useWalkLang();
  const t = TEXT[lang];
  const [state, setState] = useState<State>("idle");
  const [problem, setProblem] = useState<Problem | "">("");
  const [serverMessage, setServerMessage] = useState("");
  const [pressed, setPressed] = useState(false);
  const talkRef = useRef<GrokTalk | null>(null);
  const levelRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);
  const capRef = useRef<number>(0);

  const fail = useCallback((key: Problem, msg = "") => {
    setProblem(key);
    setServerMessage(msg);
  }, []);

  const finish = useCallback((next: State = "ended") => {
    window.cancelAnimationFrame(rafRef.current);
    window.clearTimeout(capRef.current);
    const talk = talkRef.current;
    talkRef.current = null;
    if (talk) talk.hangUp(next === "idle" ? "left" : "user");
    setState(next);
  }, []);

  useEffect(() => () => finish("idle"), [finish]);

  // Closing the tab ends the paid session right away (and still sends the alert summary).
  useEffect(() => {
    const onHide = () => {
      if (talkRef.current) finish("idle");
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [finish]);

  const startGrok = useCallback(
    async (
      ctx: AudioContext,
      mic: MediaStream,
      plan: TokenResponse & GrokPlan,
    ) => {
      const [{ GrokTalk }, { runFoodTool }] = await Promise.all([
        import("@/lib/talk/grok-client"),
        import("@/lib/talk/food-tool"),
      ]);
      const sid = plan.alerts && plan.sid ? plan.sid : null;
      const talk: GrokTalk = new GrokTalk(ctx, mic, plan, {
        onState: (s) => {
          if (talkRef.current === talk) setState(s);
        },
        onConnected: () => {
          if (talkRef.current !== talk) return;
          setState("talking");
        },
        onTool: (name, args) => runFoodTool(name, args),
        onEnd: (r) => {
          if (sid && r.connected) sendSummary(sid, r);
          if (talkRef.current !== talk) return;
          if (!r.connected) {
            fail("connect");
            finish("error");
          } else {
            finish("ended");
          }
        },
      });
      talkRef.current = talk;
      try {
        await talk.start();
      } catch (err) {
        if (talkRef.current !== talk) return;
        talkRef.current = null;
        talk.hangUp("error");
        fail(
          (err as Error)?.message === "unsupported" ? "unsupported" : "connect",
        );
        finish("error");
        return;
      }
      const loop = () => {
        const cur = talkRef.current;
        if (!cur) return;
        levelRef.current?.style.setProperty(
          "--level",
          Math.min(1, cur.level() * 2.5).toFixed(3),
        );
        rafRef.current = window.requestAnimationFrame(loop);
      };
      rafRef.current = window.requestAnimationFrame(loop);
      // Backstop only; GrokTalk ends itself at the 5-minute cap.
      capRef.current = window.setTimeout(
        () => finish("ended"),
        plan.limits.maxMs + 15000,
      );
    },
    [fail, finish],
  );

  const start = useCallback(async () => {
    if (talkRef.current || state === "connecting") return;
    setPressed(true);
    setProblem("");
    setServerMessage("");
    setState("connecting");
    playAndRecord();
    const ctx = makeAudioContext();

    // 1. Microphone first, inside the tap, so the browser prompt appears right away.
    let mic: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
      mic = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      void ctx?.close().catch(() => {});
      const unsupported = (err as Error)?.message === "unsupported";
      fail(unsupported || inAppBrowser() ? "micUnsupported" : "micBlocked");
      setState("error");
      return;
    }

    // 2. Token: an xAI ephemeral client secret plus the session plan.
    let data: TokenResponse;
    try {
      const res = await fetch("/api/talk/token", { method: "POST" });
      data = await res.json();
    } catch {
      data = { ok: false, reason: "network" };
    }
    if (!data.ok || !ctx || !data.token || !data.wsUrl) {
      for (const track of mic.getTracks()) track.stop();
      void ctx?.close().catch(() => {});
      if (!data.ok) {
        // Server messages are English; Spanish callers get the Spanish fallback line.
        fail(
          data.reason === "network" ? "network" : "unavailable",
          lang === "en" ? (data.message ?? "") : "",
        );
      } else {
        fail(ctx ? "unavailable" : "noAudio");
      }
      setState("error");
      return;
    }
    await startGrok(ctx, mic, data as TokenResponse & GrokPlan);
  }, [fail, lang, startGrok, state]);

  const active =
    state === "connecting" ||
    state === "listening" ||
    state === "thinking" ||
    state === "talking";
  const problemText = problem ? serverMessage || t[problem] : "";

  return (
    <div className="talk" data-state={state} ref={levelRef}>
      <div className="talk-bounce">
        <button
          type="button"
          className="talk-btn"
          aria-label={active ? t.labelOn : t.labelOff}
          aria-pressed={active}
          onClick={active ? undefined : start}
        >
          <span className="talk-glow" aria-hidden="true" />
          <span className="talk-ring" aria-hidden="true" />
          <span className="talk-vortex" aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element -- small fixed logo with explicit srcset */}
          <img
            className="talk-mascot"
            src="/talk/helpgetup-logo-240.png"
            srcSet="/talk/helpgetup-logo-240.png 240w, /talk/helpgetup-logo-480.png 480w"
            sizes="(min-width: 768px) 190px, 150px"
            width={240}
            height={240}
            alt=""
            loading="lazy"
          />
        </button>
        {!pressed ? (
          <span className="talk-hint" aria-hidden="true">
            {t.hint}
          </span>
        ) : null}
      </div>

      {caption ? <p className="talk-caption">{caption}</p> : null}

      <p className="talk-status" aria-live="polite">
        {state === "error" ? problemText : t.status[state]}
      </p>

      <div className="talk-actions">
        {active ? (
          <button
            type="button"
            className="talk-end"
            onClick={() => finish("ended")}
          >
            {t.end}
          </button>
        ) : state === "ended" ? (
          <button type="button" className="talk-again" onClick={start}>
            {t.again}
          </button>
        ) : null}
        {state === "error" || state === "ended" ? (
          <Link
            href={lang === "es" ? "/albany-food-list/es" : "/albany-food-list"}
            className="talk-fallback"
          >
            {t.fallback}
          </Link>
        ) : null}
      </div>
      <p className="talk-fine">{t.fine}</p>
    </div>
  );
}
