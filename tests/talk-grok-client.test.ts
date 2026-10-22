/* eslint-disable @typescript-eslint/no-explicit-any -- fake browser objects for a mocked session */
/** HelpGetUp GrokTalk (port of albanyaiguy tests) against a fake WebSocket and fake Web Audio: no network, no paid calls. */
import assert from "node:assert/strict";
import test, { mock } from "node:test";

class FakeNode {
  connect() {}
  disconnect() {}
}
class FakeSource extends FakeNode {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  stopped = false;
  start() {}
  stop() {
    this.stopped = true;
  }
}
class FakeCtx {
  currentTime = 0;
  destination = new FakeNode();
  sources: FakeSource[] = [];
  closed = false;
  audioWorklet = { addModule: async () => {} };
  createGain() {
    return Object.assign(new FakeNode(), { gain: { value: 1 } });
  }
  createAnalyser() {
    return Object.assign(new FakeNode(), {
      fftSize: 256,
      getByteTimeDomainData: (b: Uint8Array) => b.fill(128),
    });
  }
  createMediaStreamSource() {
    return new FakeNode();
  }
  createBuffer(_c: number, len: number, rate: number) {
    return { duration: len / rate, copyToChannel() {} };
  }
  createBufferSource() {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  async close() {
    this.closed = true;
  }
}
class FakeWS {
  static OPEN = 1;
  static last: FakeWS | null = null;
  readyState = 1;
  sent: any[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(
    public url: string,
    public protocols: string[],
  ) {
    FakeWS.last = this;
  }
  send(s: string) {
    this.sent.push(JSON.parse(s));
  }
  close() {
    this.readyState = 3;
  }
  emit(ev: unknown) {
    this.onmessage?.({ data: JSON.stringify(ev) });
  }
  types() {
    return this.sent.map((e) => e.type as string);
  }
}

const g = globalThis as any;
g.window = globalThis;
g.WebSocket = FakeWS;
g.AudioWorkletNode = class extends FakeNode {
  port = { onmessage: null as any };
};

const { GrokTalk } = await import("../src/lib/talk/grok-client.ts");
const { buildClientPlan } = await import("../src/lib/talk/grok-config.ts");

function setup(alerts = false, onTool?: (n: string, a: string) => unknown) {
  const plan = { ...buildClientPlan({}), token: "tok123", alerts };
  const ctx = new FakeCtx();
  let stopped = 0;
  const mic = { getTracks: () => [{ stop: () => stopped++ }] };
  const states: string[] = [];
  const ends: any[] = [];
  const talk = new GrokTalk(ctx as any, mic as any, plan as any, {
    onState: (s) => states.push(s),
    onConnected: () => states.push("connected"),
    onEnd: (r) => ends.push(r),
    onTool,
  });
  return { plan, ctx, talk, states, ends, mic: () => stopped };
}

const audio = Buffer.from(new Int16Array(2400).buffer).toString("base64");

test("connects with the subprotocol token, configures, then greets with force_message", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const s = setup();
  await s.talk.start();
  const ws = FakeWS.last as FakeWS;
  assert.deepEqual(ws.protocols, ["xai-client-secret.tok123"]);
  assert.match(ws.url, /^wss:\/\/api\.x\.ai\/v1\/realtime\?model=/);
  ws.onopen?.();
  assert.deepEqual(ws.types(), ["session.update"]);
  ws.emit({ type: "session.updated" });
  assert.equal(ws.sent[1].item.type, "force_message");
  assert.ok(s.states.includes("connected"));
  s.talk.hangUp("user");
  assert.equal(s.ends[0].reason, "user");
  assert.equal(s.mic(), 1, "mic released");
  assert.ok(s.ctx.closed);
  mock.timers.reset();
});

test("barge-in stops playback and truncates what was not heard", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const s = setup();
  await s.talk.start();
  const ws = FakeWS.last as FakeWS;
  ws.onopen?.();
  ws.emit({ type: "session.updated" });
  ws.emit({ type: "response.created" });
  ws.emit({
    type: "response.output_audio.delta",
    delta: audio,
    item_id: "it1",
  });
  ws.emit({
    type: "response.output_audio.delta",
    delta: audio,
    item_id: "it1",
  });
  s.ctx.currentTime = 0.15;
  ws.emit({ type: "input_audio_buffer.speech_started" });
  assert.ok(s.ctx.sources.every((x) => x.stopped));
  const tr = ws.sent.find((e) => e.type === "conversation.item.truncate");
  assert.equal(tr.item_id, "it1");
  assert.ok(tr.audio_end_ms >= 100 && tr.audio_end_ms <= 150);
  s.talk.hangUp();
  mock.timers.reset();
});

test("end_call: answers the tool, hangs up after playback drains, collects turns", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const s = setup();
  await s.talk.start();
  const ws = FakeWS.last as FakeWS;
  ws.onopen?.();
  ws.emit({ type: "session.updated" });
  ws.emit({
    type: "conversation.item.input_audio_transcription.completed",
    transcript: "Thanks, bye.",
  });
  ws.emit({ type: "response.created" });
  ws.emit({
    type: "response.output_audio_transcript.done",
    transcript: "Take care.",
  });
  ws.emit({
    type: "response.function_call_arguments.done",
    name: "end_call",
    call_id: "c1",
    arguments: "{}",
  });
  ws.emit({ type: "response.done" });
  const out = ws.sent.find(
    (e) =>
      e.type === "conversation.item.create" &&
      e.item.type === "function_call_output",
  );
  assert.equal(out.item.call_id, "c1");
  assert.ok(
    !ws.types().includes("response.create"),
    "no follow-up turn after end_call",
  );
  mock.timers.tick(500);
  assert.equal(s.ends[0]?.reason, "goodbye");
  assert.deepEqual(s.ends[0].turns, [
    { role: "caller", text: "Thanks, bye." },
    { role: "agent", text: "Take care." },
  ]);
  mock.timers.reset();
});

test("idle: ~30 s of caller silence sends the goodbye line, then hangs up", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const s = setup();
  await s.talk.start();
  const ws = FakeWS.last as FakeWS;
  ws.onopen?.();
  ws.emit({ type: "session.updated" });
  mock.timers.tick(29000);
  assert.equal(
    ws.sent.filter((e) => e.item?.type === "force_message").length,
    1,
    "only the greeting so far",
  );
  mock.timers.tick(2000);
  const bye = ws.sent.filter((e) => e.item?.type === "force_message");
  assert.equal(bye.length, 2);
  assert.match(bye[1].item.content[0].text, /let you go/);
  ws.emit({ type: "response.created" });
  ws.emit({ type: "response.done" });
  mock.timers.tick(500);
  assert.equal(s.ends[0]?.reason, "idle");
  mock.timers.reset();
});

test("cap: wrap-up line at 4:40, hard hang-up at 5:00 regardless", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const s = setup();
  await s.talk.start();
  const ws = FakeWS.last as FakeWS;
  ws.onopen?.();
  ws.emit({ type: "session.updated" });
  // Keep the caller "talking" so idle never fires.
  ws.emit({ type: "input_audio_buffer.speech_started" });
  mock.timers.tick(280500);
  const wrap = ws.sent.filter((e) => e.item?.type === "force_message");
  assert.equal(wrap.length, 2);
  assert.equal(wrap[1].item.interruptible, false);
  assert.equal(s.ends.length, 0);
  mock.timers.tick(20000);
  assert.equal(s.ends[0]?.reason, "cap");
  mock.timers.reset();
});

test("food tool: runs locally, answers each call, one response.create after playback", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const calls: string[] = [];
  const s = setup(false, (name, args) => {
    calls.push(`${name} ${args}`);
    return { ok: true, results: [] };
  });
  await s.talk.start();
  const ws = FakeWS.last as FakeWS;
  ws.onopen?.();
  ws.emit({ type: "session.updated" });
  ws.emit({ type: "response.created" });
  ws.emit({
    type: "response.function_call_arguments.done",
    name: "find_food",
    call_id: "f1",
    arguments: JSON.stringify({ place: "Cohoes" }),
  });
  ws.emit({
    type: "response.function_call_arguments.done",
    name: "senior_meals",
    call_id: "f2",
    arguments: JSON.stringify({ place: "Cohoes" }),
  });
  assert.ok(!ws.types().includes("response.create"), "not before response.done");
  ws.emit({ type: "response.done" });
  const outs = ws.sent.filter((e) => e.item?.type === "function_call_output");
  assert.deepEqual(
    outs.map((o) => o.item.call_id),
    ["f1", "f2"],
  );
  assert.equal(calls.length, 2);
  assert.equal(ws.types().filter((t) => t === "response.create").length, 1);
  s.talk.hangUp();
  mock.timers.reset();
});

test("save_followup (Albany only) and unknown tools get an error, never crash", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const s = setup(true);
  await s.talk.start();
  const ws = FakeWS.last as FakeWS;
  ws.onopen?.();
  ws.emit({ type: "session.updated" });
  ws.emit({ type: "response.created" });
  ws.emit({
    type: "response.function_call_arguments.done",
    name: "save_followup",
    call_id: "c2",
    arguments: "{}",
  });
  ws.emit({ type: "response.done" });
  const out = ws.sent.find((e) => e.item?.type === "function_call_output");
  assert.match(out.item.output, /unknown tool/);
  s.talk.hangUp();
  assert.ok(!("lead" in s.ends[0]));
  mock.timers.reset();
});

test("a throwing tool returns a safe fallback instead of breaking the call", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const s = setup(false, () => {
    throw new Error("boom");
  });
  await s.talk.start();
  const ws = FakeWS.last as FakeWS;
  ws.onopen?.();
  ws.emit({ type: "session.updated" });
  ws.emit({
    type: "response.function_call_arguments.done",
    name: "find_food",
    call_id: "f9",
    arguments: "{}",
  });
  const out = ws.sent.find((e) => e.item?.type === "function_call_output");
  assert.match(out.item.output, /help get up dot com/);
  assert.equal(s.ends.length, 0);
  s.talk.hangUp();
  mock.timers.reset();
});

test("socket closing before connect reports an error, not a session", async () => {
  const s = setup();
  await s.talk.start();
  (FakeWS.last as FakeWS).onclose?.();
  assert.equal(s.ends[0].reason, "error");
  assert.equal(s.ends[0].connected, false);
});
