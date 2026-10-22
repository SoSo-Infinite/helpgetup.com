/**
 * Grok Voice Agent (xAI realtime) session config for the HelpGetUp talk button.
 * Same technology as the albanyaiguy.com button (branch grok-voice), separate identity and job.
 * Docs (read Oct 22, 2026): https://docs.x.ai/developers/model-capabilities/audio/voice-agent
 * and https://docs.x.ai/developers/rest-api-reference/inference/voice
 * Server-only: builds the session.update payload the browser sends after it connects.
 */
import { NEIGHBORHOODS } from "@/data/albany-food";
import { AGENT_NAME, BRAND_SPOKEN, SITE_SPOKEN } from "./identity";
import { personaInstructions } from "./grok-persona";
import { REPLACE_518, say518 } from "./say518";

export const XAI_REALTIME_URL = "wss://api.x.ai/v1/realtime";
export const XAI_CLIENT_SECRETS_URL =
  "https://api.x.ai/v1/realtime/client_secrets";
/** Pinned, per xAI's advice for production; grok-voice-latest is the alias. */
export const DEFAULT_MODEL = "grok-voice-3.0";
/**
 * Built-in voice. Must differ from the Albany AI Guy's "leo" (British, authoritative) so people can tell
 * the two apart. "ara": xAI's "warm and friendly" voice. Alternates (TALK_GROK_VOICE): "celeste"
 * (compassionate, reassuring, support), "ursa" (friendly, warm, steadfast), "carina" (soft, empathetic).
 */
export const DEFAULT_VOICE = "ara";
export const ALT_VOICES = ["celeste", "ursa", "carina"] as const;
export const ALBANY_AI_GUY_VOICE = "leo";
export const SAMPLE_RATE = 24000;

/** Billing counts the whole session with server_vad, so the browser hangs up on these. */
export const MAX_SESSION_MS = 5 * 60 * 1000;
/** Wrap-up line goes out this long before the cap. */
export const WRAP_BEFORE_MS = 20 * 1000;
/** Hang up after this long with no caller speech (the agent is not talking). */
export const IDLE_HANGUP_MS = 30 * 1000;
/** Server-side gentle check-in after this much silence (xAI turn_detection.idle_timeout_ms). */
export const IDLE_CHECKIN_MS = 15 * 1000;
/** Token only has to last until the socket connects; kept >= the cap in case expiry ends a live session (unverified). */
export const TOKEN_TTL_S = 330;

export const GREETING_TEXT = `Good day. I'm ${AGENT_NAME}, an AI helper for ${BRAND_SPOKEN}. I can help you find food in Albany County, like a pantry, a free meal, SNAP, or meals for people sixty and up. También hablo español. What town or ZIP code are you in?`;
export const WRAP_TEXT = `We're almost out of time. The full food list is always on ${SITE_SPOKEN}. Take care.`;
export const IDLE_TEXT =
  "I'll let you go for now. Come back any time you need food help. Take care.";

/** Pronunciation fixes before TTS (audio only). 518 is Chad's golden rule. */
export const REPLACE: Record<string, string> = {
  ...REPLACE_518,
  HelpGetUp: BRAND_SPOKEN,
  "NY Connects": "New York Connects",
};

export const KEYTERMS: string[] = [
  ...new Set([
    "Albany",
    "Albany County",
    BRAND_SPOKEN,
    "HelpGetUp",
    "SNAP",
    "EBT",
    "food stamps",
    "food pantry",
    "Veggie Mobile",
    "Capital Roots",
    "Meals on Wheels",
    "NY Connects",
    "LifePath",
    "Albany AI Guy",
    "five-one-eight",
    "Troy",
    "Schenectady",
    ...NEIGHBORHOODS.map((n) => n.label),
  ]),
].filter((k) => k.length <= 50);

const VOICE_RE = /^[a-zA-Z0-9_-]{2,64}$/;

/** TALK_GROK_VOICE: a built-in voice id (default ara) or a custom voice id. Never the Albany AI Guy's leo. */
export function resolveVoice(raw: string | undefined): string {
  const v = (raw ?? "").trim();
  if (!VOICE_RE.test(v) || v.toLowerCase() === ALBANY_AI_GUY_VOICE)
    return DEFAULT_VOICE;
  return v;
}

export function resolveModel(raw: string | undefined): string {
  const v = (raw ?? "").trim();
  return /^grok-voice-[a-z0-9.-]+$/.test(v) ? v : DEFAULT_MODEL;
}

const END_CALL_TOOL = {
  type: "function",
  name: "end_call",
  description:
    "End the conversation after you have said your one-sentence goodbye and the caller is done.",
  parameters: { type: "object", properties: {}, required: [] },
};

const FIND_FOOD_TOOL = {
  type: "function",
  name: "find_food",
  description:
    "Look up food pantries, free community meals, community fridges and Capital Roots Veggie Mobile stops in Albany County, closest first, with their published hours and phone numbers. Use it before naming any place or time.",
  parameters: {
    type: "object",
    properties: {
      place: {
        type: "string",
        description:
          "The caller's ZIP code, town or neighborhood in Albany County, as they said it (for example 12206, Cohoes, Arbor Hill).",
      },
      kind: {
        type: "string",
        enum: ["any", "pantry", "meal", "produce", "fridge"],
        description:
          "pantry = groceries to take home, meal = a free hot meal, produce = Veggie Mobile and fresh produce, fridge = community fridge. Use any if they did not say.",
      },
    },
    required: ["place"],
  },
};

const SENIOR_MEALS_TOOL = {
  type: "function",
  name: "senior_meals",
  description:
    "Look up Albany County meal sites for people 60 and older near the caller, plus who can go, the suggested contribution, and how to get home-delivered meals.",
  parameters: {
    type: "object",
    properties: {
      place: {
        type: "string",
        description:
          "The caller's ZIP code, town or neighborhood in Albany County.",
      },
    },
    required: ["place"],
  },
};

export const TOOL_NAMES = ["end_call", "find_food", "senior_meals"] as const;

export type SessionOptions = {
  voice?: string;
  reasoning?: string;
  speed?: string;
  transcribeModel?: string;
};

/** The full `session.update` client event for the talk button. */
export function buildSessionUpdate(opts: SessionOptions = {}) {
  const session: Record<string, unknown> = {
    voice: resolveVoice(opts.voice),
    instructions: personaInstructions(),
    turn_detection: { type: "server_vad", idle_timeout_ms: IDLE_CHECKIN_MS },
    audio: {
      input: {
        format: { type: "audio/pcm", rate: SAMPLE_RATE },
        transcription: {
          keyterms: KEYTERMS,
          ...(opts.transcribeModel ? { model: opts.transcribeModel } : {}),
        },
      },
      output: {
        format: { type: "audio/pcm", rate: SAMPLE_RATE },
        ...speedField(opts.speed),
      },
    },
    replace: { ...REPLACE },
    tools: [END_CALL_TOOL, FIND_FOOD_TOOL, SENIOR_MEALS_TOOL],
  };
  const effort = (opts.reasoning ?? "").trim();
  if (effort === "none" || effort === "high") session.reasoning = { effort };
  return { type: "session.update", session };
}

function speedField(raw: string | undefined): { speed?: number } {
  const n = Number(raw);
  if (!raw || !Number.isFinite(n)) return {};
  return { speed: Math.min(1.5, Math.max(0.7, n)) };
}

/** A verbatim, TTS-only line (xAI force_message). 518 is pre-spoken as five-one-eight. */
export function forceMessage(text: string, interruptible = true) {
  return {
    type: "conversation.item.create",
    item: {
      type: "force_message",
      role: "assistant",
      interruptible,
      content: [{ type: "output_text", text: say518(text) }],
    },
  };
}

/** Everything the browser needs to run one session (no secrets besides the ephemeral token). */
export function buildClientPlan(env: Record<string, string | undefined>) {
  const model = resolveModel(env.TALK_GROK_MODEL);
  return {
    wsUrl: `${XAI_REALTIME_URL}?model=${encodeURIComponent(model)}`,
    model,
    sessionUpdate: buildSessionUpdate({
      voice: env.TALK_GROK_VOICE,
      reasoning: env.TALK_GROK_REASONING,
      speed: env.TALK_GROK_SPEED,
      transcribeModel: env.TALK_GROK_TRANSCRIBE_MODEL,
    }),
    greeting: forceMessage(GREETING_TEXT, true),
    wrap: forceMessage(WRAP_TEXT, false),
    idleBye: forceMessage(IDLE_TEXT, true),
    limits: {
      maxMs: MAX_SESSION_MS,
      wrapBeforeMs: WRAP_BEFORE_MS,
      idleMs: IDLE_HANGUP_MS,
    },
    sampleRate: SAMPLE_RATE,
  };
}

export type ClientPlan = ReturnType<typeof buildClientPlan>;
