"use client";

/**
 * Browser side of the HelpGetUp Grok voice talk button (ported from albanyaiguy.com, branch grok-voice): one WebSocket straight to xAI's realtime API
 * (auth by ephemeral token in the subprotocol), mic -> 24 kHz PCM16 through an AudioWorklet,
 * streamed playback through Web Audio, barge-in (server VAD), and client-side caps because
 * xAI bills the whole session: hard max length, wrap-up line, idle hang-up.
 * Protocol per https://docs.x.ai/developers/rest-api-reference/inference/voice (read Oct 22, 2026).
 */

export type GrokPlan = {
  token: string;
  wsUrl: string;
  sessionUpdate: unknown;
  greeting: unknown;
  wrap: unknown;
  idleBye: unknown;
  limits: { maxMs: number; wrapBeforeMs: number; idleMs: number };
  sampleRate: number;
  alerts: boolean;
};

export type AgentState = "connecting" | "listening" | "thinking" | "talking";
export type EndReason =
  | "user"
  | "goodbye"
  | "cap"
  | "idle"
  | "dropped"
  | "error"
  | "left";
export type Turn = { role: "caller" | "agent"; text: string };
export type SessionResult = {
  reason: EndReason;
  seconds: number;
  turns: Turn[];
  connected: boolean;
};

type Handlers = {
  onState: (s: AgentState) => void;
  onConnected: () => void;
  onEnd: (r: SessionResult) => void;
  /** Runs a lookup tool (find_food, senior_meals) locally and returns its JSON result. */
  onTool?: (name: string, args: string) => unknown;
};

type ServerEvent = {
  type: string;
  delta?: string;
  transcript?: string;
  item_id?: string;
  response_id?: string;
  name?: string;
  call_id?: string;
  arguments?: string;
  error?: { code?: string; message?: string };
};

export function pcm16ToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + 0x8000) as unknown as number[],
    );
  }
  return btoa(bin);
}

export function base64ToFloat32(b64: string): Float32Array<ArrayBuffer> {
  const bin = atob(b64);
  const n = bin.length >> 1;
  const out = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
    if (v >= 0x8000) v -= 0x10000;
    out[i] = v / 0x8000;
  }
  return out;
}

export class GrokTalk {
  private ws: WebSocket | null = null;
  private node: AudioWorkletNode | null = null;
  private src: MediaStreamAudioSourceNode | null = null;
  private sink: GainNode | null = null;
  private out: GainNode;
  private analyser: AnalyserNode;
  private levelBuf: Uint8Array<ArrayBuffer>;
  private micLevel = 0;
  private playing = new Set<AudioBufferSourceNode>();
  private playHead = 0;
  private itemId: string | null = null;
  private itemStartAt = 0;
  private responding = false;
  private ready = false;
  private ended = false;
  private connected = false;
  private startedAt = 0;
  private lastActivity = 0;
  private userSpeaking = false;
  private checkIn = false;
  private wrapSent = false;
  private idleSent = false;
  private endAfterDrain: EndReason | null = null;
  private continueAfterDrain = false;
  private tick = 0;
  private greetTimer = 0;
  private agentText = "";
  private turns: Turn[] = [];

  constructor(
    private ctx: AudioContext,
    private mic: MediaStream,
    private plan: GrokPlan,
    private h: Handlers,
  ) {
    this.out = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.levelBuf = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
    this.out.connect(this.analyser);
    this.analyser.connect(ctx.destination);
  }

  /** Throws if the browser can't do it (no AudioWorklet); the caller shows the fallback. */
  async start(): Promise<void> {
    const { ctx } = this;
    if (!ctx.audioWorklet) throw new Error("unsupported");
    await ctx.audioWorklet.addModule("/talk/pcm-capture.js");
    if (this.ended) return;
    this.src = ctx.createMediaStreamSource(this.mic);
    this.node = new AudioWorkletNode(ctx, "pcm-capture", {
      processorOptions: { outRate: this.plan.sampleRate },
    });
    // Keep the worklet pulled by the graph without playing the mic back.
    this.sink = ctx.createGain();
    this.sink.gain.value = 0;
    this.src.connect(this.node);
    this.node.connect(this.sink);
    this.sink.connect(ctx.destination);
    this.node.port.onmessage = (
      e: MessageEvent<{ pcm: ArrayBuffer; rms: number }>,
    ) => {
      this.micLevel = e.data.rms;
      if (!this.ready || this.ws?.readyState !== WebSocket.OPEN) return;
      this.send({
        type: "input_audio_buffer.append",
        audio: pcm16ToBase64(e.data.pcm),
      });
    };

    const ws = new WebSocket(this.plan.wsUrl, [
      `xai-client-secret.${this.plan.token}`,
    ]);
    this.ws = ws;
    ws.onopen = () => {
      this.send(this.plan.sessionUpdate);
      // If session.updated never arrives, greet anyway.
      this.greetTimer = window.setTimeout(() => this.begin(), 3000);
    };
    ws.onmessage = (m) => {
      if (typeof m.data !== "string") return;
      try {
        this.onEvent(JSON.parse(m.data) as ServerEvent);
      } catch {
        /* ignore malformed */
      }
    };
    ws.onclose = () => {
      if (!this.ended) this.finish(this.connected ? "dropped" : "error");
    };
    ws.onerror = () => {
      /* onclose follows */
    };
  }

  /** 0..1, for the ring animation. */
  level(): number {
    this.analyser.getByteTimeDomainData(this.levelBuf);
    let sq = 0;
    for (const v of this.levelBuf) {
      const x = (v - 128) / 128;
      sq += x * x;
    }
    return Math.max(this.micLevel, Math.sqrt(sq / this.levelBuf.length));
  }

  hangUp(reason: EndReason = "user"): void {
    this.finish(reason);
  }

  private send(ev: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN)
      this.ws.send(JSON.stringify(ev));
  }

  private begin() {
    if (this.ready || this.ended) return;
    window.clearTimeout(this.greetTimer);
    this.ready = true;
    this.connected = true;
    this.startedAt = Date.now();
    this.lastActivity = this.startedAt;
    this.send(this.plan.greeting);
    this.h.onConnected();
    this.tick = window.setInterval(() => this.onTick(), 500);
  }

  private onTick() {
    if (this.ended) return;
    const now = Date.now();
    const { maxMs, wrapBeforeMs, idleMs } = this.plan.limits;
    const elapsed = now - this.startedAt;
    if (elapsed >= maxMs) return this.finish("cap");
    if (!this.wrapSent && elapsed >= maxMs - wrapBeforeMs) {
      this.wrapSent = true;
      if (this.responding) this.send({ type: "response.cancel" });
      this.stopPlayback(true);
      this.send(this.plan.wrap);
      this.endAfterDrain = "cap";
      return;
    }
    const quiet =
      !this.userSpeaking && !this.responding && this.playing.size === 0;
    if (quiet && this.idleSent && now - this.lastActivity > idleMs + 10000) {
      return this.finish("idle");
    }
    if (
      quiet &&
      !this.idleSent &&
      !this.endAfterDrain &&
      now - this.lastActivity > idleMs
    ) {
      this.idleSent = true;
      this.send(this.plan.idleBye);
      this.endAfterDrain = "idle";
    }
  }

  private onEvent(ev: ServerEvent) {
    switch (ev.type) {
      case "session.updated":
        this.begin();
        break;
      case "input_audio_buffer.speech_started":
        this.userSpeaking = true;
        this.lastActivity = Date.now();
        if (this.playing.size) this.stopPlayback(true);
        if (!this.endAfterDrain) this.h.onState("listening");
        break;
      case "input_audio_buffer.speech_stopped":
        this.userSpeaking = false;
        this.lastActivity = Date.now();
        this.idleSent = false;
        if (!this.endAfterDrain) this.h.onState("thinking");
        break;
      case "input_audio_buffer.timeout_triggered":
        this.checkIn = true;
        break;
      case "response.created":
        this.responding = true;
        this.agentText = "";
        break;
      case "response.output_item.added":
        if (ev.item_id) this.itemId = ev.item_id;
        break;
      case "response.output_audio.delta":
      case "response.audio.delta":
        if (ev.delta) this.play(ev.delta, ev.item_id);
        break;
      case "response.output_audio_transcript.delta":
        if (ev.delta) this.agentText += ev.delta;
        break;
      case "response.output_audio_transcript.done": {
        const t = (ev.transcript ?? this.agentText).trim();
        if (t) this.turns.push({ role: "agent", text: t });
        this.agentText = "";
        break;
      }
      case "conversation.item.input_audio_transcription.completed": {
        const t = (ev.transcript ?? "").trim();
        if (t) this.turns.push({ role: "caller", text: t });
        break;
      }
      case "response.function_call_arguments.done":
        this.onFunction(ev);
        break;
      case "response.done":
        this.responding = false;
        this.maybeDrained();
        break;
      case "error":
        if (process.env.NODE_ENV !== "production")
          console.warn(
            "grok realtime error",
            ev.error?.code,
            ev.error?.message,
          );
        break;
    }
  }

  private onFunction(ev: ServerEvent) {
    const reply = (output: unknown) =>
      this.send({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: ev.call_id,
          output: JSON.stringify(output),
        },
      });
    if (ev.name === "end_call") {
      reply({ ok: true });
      this.endAfterDrain = this.endAfterDrain ?? "goodbye";
      return;
    }
    let out: unknown;
    try {
      out = this.h.onTool
        ? this.h.onTool(ev.name ?? "", ev.arguments ?? "{}")
        : { ok: false, error: "unknown tool" };
    } catch {
      out = {
        ok: false,
        say: "The lookup didn't work. Give the food referral line or help get up dot com instead.",
      };
    }
    reply(out);
    // Per xAI: send response.create only after this turn's audio has played out, and once for all calls.
    this.continueAfterDrain = true;
  }

  private play(b64: string, itemId?: string) {
    const { ctx } = this;
    const data = base64ToFloat32(b64);
    if (!data.length) return;
    const buf = ctx.createBuffer(1, data.length, this.plan.sampleRate);
    buf.copyToChannel(data, 0);
    const node = ctx.createBufferSource();
    node.buffer = buf;
    node.connect(this.out);
    const at = Math.max(ctx.currentTime + 0.04, this.playHead);
    if ((itemId && itemId !== this.itemId) || !this.itemStartAt) {
      if (itemId) this.itemId = itemId;
      this.itemStartAt = at;
    }
    node.start(at);
    this.playHead = at + buf.duration;
    this.playing.add(node);
    node.onended = () => {
      this.playing.delete(node);
      this.maybeDrained();
    };
    this.h.onState("talking");
  }

  /** Barge-in: silence what's queued and tell the server how much the caller actually heard. */
  private stopPlayback(truncate: boolean) {
    const heardMs = Math.max(
      0,
      Math.round((this.ctx.currentTime - this.itemStartAt) * 1000),
    );
    for (const n of this.playing) {
      n.onended = null;
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
    }
    const had = this.playing.size > 0;
    this.playing.clear();
    this.playHead = 0;
    if (truncate && had && this.itemId) {
      this.send({
        type: "conversation.item.truncate",
        item_id: this.itemId,
        content_index: 0,
        audio_end_ms: heardMs,
      });
    }
    this.itemStartAt = 0;
  }

  private maybeDrained() {
    if (this.ended || this.responding || this.playing.size) return;
    this.itemStartAt = 0;
    if (this.endAfterDrain) {
      const r = this.endAfterDrain;
      window.setTimeout(() => this.finish(r), 400);
      return;
    }
    if (this.continueAfterDrain) {
      this.continueAfterDrain = false;
      this.send({ type: "response.create" });
      this.h.onState("thinking");
      return;
    }
    // A server check-in doesn't count as activity, so the idle hang-up still lands ~30 s after the caller went quiet.
    if (this.checkIn) this.checkIn = false;
    else this.lastActivity = Date.now();
    this.h.onState("listening");
  }

  private finish(reason: EndReason) {
    if (this.ended) return;
    this.ended = true;
    window.clearInterval(this.tick);
    window.clearTimeout(this.greetTimer);
    this.stopPlayback(false);
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.onmessage = null;
      try {
        ws.close(1000);
      } catch {
        /* ignore */
      }
    }
    if (this.node) this.node.port.onmessage = null;
    for (const n of [this.src, this.node, this.sink, this.out, this.analyser]) {
      try {
        n?.disconnect();
      } catch {
        /* ignore */
      }
    }
    for (const t of this.mic.getTracks()) t.stop();
    void this.ctx.close().catch(() => {});
    this.h.onEnd({
      reason,
      seconds: this.startedAt ? (Date.now() - this.startedAt) / 1000 : 0,
      turns: this.turns.slice(0, 32),
      connected: this.connected,
    });
  }
}
