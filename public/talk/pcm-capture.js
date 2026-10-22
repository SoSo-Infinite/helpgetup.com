// HelpGetUp talk button: mic -> 24 kHz mono PCM16 frames (~100 ms) for the Grok realtime socket.
// Runs at the AudioContext's own rate (44.1/48 kHz on most phones) and resamples, so Safari,
// Chrome and Firefox all work without a fixed-rate context.
class PcmCapture extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = options?.processorOptions || {};
    this.outRate = o.outRate || 24000;
    this.step = sampleRate / this.outRate;
    this.pos = 0;
    this.prev = 0;
    this.frame = Math.round(this.outRate / 10);
    this.buf = new Int16Array(this.frame);
    this.n = 0;
    this.sq = 0;
  }
  process(inputs) {
    const ch = inputs[0]?.[0];
    if (!ch) return true;
    // Linear interpolation between the previous block's last sample and this block.
    let pos = this.pos;
    while (pos < ch.length) {
      const i = Math.floor(pos);
      const f = pos - i;
      const a = i === 0 ? this.prev : ch[i - 1];
      const b = ch[i];
      let s = a + (b - a) * f;
      s = s < -1 ? -1 : s > 1 ? 1 : s;
      this.sq += s * s;
      this.buf[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.n === this.frame) {
        const rms = Math.sqrt(this.sq / this.frame);
        this.port.postMessage({ pcm: this.buf.buffer, rms }, [this.buf.buffer]);
        this.buf = new Int16Array(this.frame);
        this.n = 0;
        this.sq = 0;
      }
      pos += this.step;
    }
    this.pos = pos - ch.length;
    this.prev = ch[ch.length - 1];
    return true;
  }
}
registerProcessor("pcm-capture", PcmCapture);
