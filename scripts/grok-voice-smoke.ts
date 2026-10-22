/* eslint-disable @typescript-eslint/no-explicit-any -- reads loose JSON payloads */
/**
 * HelpGetUp (Rosa) Grok voice talk-button smoke test. PAID: about 20-40 seconds of xAI realtime
 * (about 3-6 cents). NOT run by default; needs Chad's explicit OK and
 * credits on the xAI team.
 *
 *   XAI_API_KEY=... npm run smoke:voice -- --yes-paid
 *
 * Does exactly what the browser does: mints an ephemeral client secret, connects with the
 * `xai-client-secret.` subprotocol, sends the real session.update, plays the force_message greeting,
 * then asks for food in Cohoes. The find_food tool runs locally on the site's data (same code the
 * browser runs) and its result goes back to the model. Saves each turn as a WAV file and prints the
 * transcripts. Listen: greeting says "Good day" and that she's an AI helper for Help Get Up; the answer
 * names only places/hours from the tool and reads 518 numbers as "five-one-eight", never "five eighteen".
 */
import { writeFileSync } from "node:fs";
import {
  buildClientPlan,
  TOKEN_TTL_S,
  XAI_CLIENT_SECRETS_URL,
} from "../src/lib/talk/grok-config.ts";
import { runFoodTool } from "../src/lib/talk/food-tool.ts";

if (!process.argv.includes("--yes-paid")) {
  console.error(
    "Refusing to run: this makes paid xAI calls. Re-run with --yes-paid once Chad has approved.",
  );
  process.exit(2);
}
const key = process.env.XAI_API_KEY;
if (!key) {
  console.error("XAI_API_KEY is not set.");
  process.exit(2);
}
const outDir = process.env.SMOKE_OUT || "/tmp";
const plan = buildClientPlan(process.env);

function wav(pcm: Buffer, rate: number): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

const res = await fetch(XAI_CLIENT_SECRETS_URL, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${key}`,
  },
  body: JSON.stringify({ expires_after: { seconds: TOKEN_TTL_S } }),
});
if (!res.ok) {
  console.error(
    `client_secrets HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`,
  );
  process.exit(1);
}
const { value, expires_at } = (await res.json()) as {
  value: string;
  expires_at: number;
};
console.log(
  `ephemeral token ok, expires_at ${new Date(expires_at * 1000).toISOString()}`,
);

const turns: { label: string; audio: Buffer[]; text: string }[] = [];
let cur: (typeof turns)[number] | null = null;
let step = 0;
let pendingTool = false;
const ws = new WebSocket(plan.wsUrl, [`xai-client-secret.${value}`]);
const started = Date.now();
const hardStop = setTimeout(() => {
  console.error("timeout after 45 s");
  ws.close();
}, 45000);

ws.onopen = () => {
  console.log("socket open; sending session.update");
  ws.send(JSON.stringify(plan.sessionUpdate));
};
ws.onmessage = (m) => {
  const ev = JSON.parse(String(m.data)) as Record<string, any>;
  if (ev.type === "error") console.error("server error:", ev.error ?? ev);
  if (ev.type === "session.updated" && step === 0) {
    step = 1;
    console.log(
      "session.updated; replace =",
      JSON.stringify(ev.session?.replace ?? null),
      "voice =",
      ev.session?.voice,
    );
    ws.send(JSON.stringify(plan.greeting));
  }
  if (ev.type === "response.created") {
    cur = {
      label: step === 1 ? "greeting" : `answer-${step}`,
      audio: [],
      text: "",
    };
    turns.push(cur);
  }
  if (
    (ev.type === "response.output_audio.delta" ||
      ev.type === "response.audio.delta") &&
    cur
  ) {
    cur.audio.push(Buffer.from(ev.delta, "base64"));
  }
  if (ev.type === "response.output_audio_transcript.delta" && cur)
    cur.text += ev.delta;
  if (ev.type === "response.function_call_arguments.done") {
    const out = runFoodTool(ev.name, ev.arguments);
    console.log(`tool ${ev.name}(${ev.arguments}) -> ${JSON.stringify(out).slice(0, 400)}…`);
    ws.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: ev.call_id, output: JSON.stringify(out) },
      }),
    );
    pendingTool = true;
  }
  if (ev.type === "response.done") {
    if (pendingTool) {
      pendingTool = false;
      step += 1;
      ws.send(JSON.stringify({ type: "response.create" }));
      return;
    }
    if (step === 1) {
      step = 2;
      ws.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: "I need food this week. I live in Cohoes.",
              },
            ],
          },
        }),
      );
      ws.send(JSON.stringify({ type: "response.create" }));
    } else if (step >= 2) {
      ws.close(1000);
    }
  }
};
ws.onclose = () => {
  clearTimeout(hardStop);
  console.log(`closed after ${((Date.now() - started) / 1000).toFixed(1)} s`);
  for (const t of turns) {
    const file = `${outDir}/grok-smoke-${t.label}.wav`;
    writeFileSync(file, wav(Buffer.concat(t.audio), plan.sampleRate));
    console.log(
      `${t.label}: transcript = ${JSON.stringify(t.text)}  audio -> ${file}`,
    );
  }
  const g = turns[0]?.text ?? "";
  console.log(
    `check greeting starts "Good day": ${/^\s*good day/i.test(g) ? "PASS" : "CHECK"}`,
  );
  console.log(
    "Now LISTEN to the WAVs: each 518 must be spoken five-one-eight (the transcript may still show 518).",
  );
};
