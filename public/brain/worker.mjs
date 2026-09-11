"use strict";
(() => {
  // public/brain/engine.mjs
  var FlyBrain = class {
    constructor(ptr, post, weight, meta2) {
      this.ptr = ptr;
      this.post = post;
      this.weight = weight;
      this.meta = meta2;
      this.n = ptr.length - 1;
      if (ptr[0] !== 0 || ptr[this.n] !== post.length || post.length !== weight.length) throw Error("Invalid connectome dimensions");
      for (let i2 = 0; i2 < this.n; i2++) if (ptr[i2] > ptr[i2 + 1]) throw Error("Invalid CSR pointers");
      this.av = Float64Array.from({ length: 1024 }, (_2, i2) => Math.exp(-0.1 * i2 / 20));
      this.ag = Float64Array.from({ length: 1024 }, (_2, i2) => Math.exp(-0.1 * i2 / 5));
      this.reset();
    }
    reset() {
      const n2 = this.n;
      this.v = new Float32Array(n2).fill(-52);
      this.g = new Float32Array(n2);
      this.ref = new Int16Array(n2);
      this.drive = new Float32Array(n2);
      this.prev = new Float32Array(n2);
      this.last = new Float64Array(n2).fill(-1);
      this.queue = Array.from({ length: 19 }, () => new Int32Array(n2));
      this.qc = new Uint32Array(19);
      this.active = new Int32Array(n2);
      this.flags = new Uint8Array(n2);
      this.na = 0;
      this.clock = 0;
      this.counts = new Uint32Array(n2);
      this.luminance = new Float32Array(this.meta.retina.length);
      this.totalSpikes = 0;
      this.rates = new Float64Array(this.meta.readouts.length);
    }
    snapshot() {
      const state = {};
      for (const key of ["v", "g", "ref", "drive", "prev", "last", "qc", "active", "flags", "counts", "luminance", "rates"]) state[key] = this[key].slice();
      state.queue = this.queue.map((a2) => a2.slice());
      for (const key of ["na", "clock", "totalSpikes"]) state[key] = this[key];
      return state;
    }
    restore(state) {
      for (const key of ["v", "g", "ref", "drive", "prev", "last", "qc", "active", "flags", "counts", "luminance", "rates"]) this[key].set(state[key]);
      state.queue.forEach((a2, i2) => this.queue[i2].set(a2));
      for (const key of ["na", "clock", "totalSpikes"]) this[key] = state[key];
    }
    evolve(i2, now, current) {
      let d2 = now - this.last[i2];
      if (d2 <= 0) return;
      const frozen = this.ref[i2] > 0 ? this.ref[i2] - 1 : 0;
      const skip = Math.min(d2, frozen);
      this.ref[i2] = d2 >= this.ref[i2] ? 0 : this.ref[i2] - d2;
      d2 -= skip;
      if (d2 > 0) {
        const a2 = d2 < 1024 ? this.av[d2] : Math.exp(-0.1 * d2 / 20), b2 = d2 < 1024 ? this.ag[d2] : Math.exp(-0.1 * d2 / 5);
        this.v[i2] = -52 + (this.v[i2] + 52) * a2 + current * (1 - a2) + this.g[i2] * (a2 - b2) / 3;
        this.g[i2] *= b2;
      }
      this.last[i2] = now;
    }
    awaken(i2) {
      if (!this.flags[i2]) {
        this.flags[i2] = 1;
        this.active[this.na++] = i2;
      }
    }
    step(pixels, ms = 20) {
      if (pixels.length !== 32 * 32) throw Error("Expected 32 \xD7 32 luminance input");
      const steps = Math.round(ms / 0.1), alpha = 1 - Math.exp(-ms / 10);
      this.counts.fill(0);
      for (const i2 of this.meta.lamina) this.drive[i2] = 12;
      for (let k2 = 0; k2 < this.meta.retina.length; k2++) {
        const [u2, v2] = this.meta.uv[k2];
        const luminance = pixels[Math.min(31, Math.round(v2 * 31)) * 32 + Math.min(31, Math.round(u2 * 31))];
        this.luminance[k2] += alpha * (luminance - this.luminance[k2]);
        this.drive[this.meta.retina[k2]] = 30 * this.luminance[k2] / ((this.meta.sensoryHalfSaturation ?? 0.02) + this.luminance[k2]);
      }
      for (let i2 = 0; i2 < this.n; i2++) if (this.drive[i2] !== this.prev[i2]) {
        this.evolve(i2, this.clock - 1, this.prev[i2]);
        this.prev[i2] = this.drive[i2];
        this.awaken(i2);
      }
      for (let t2 = 0; t2 < steps; t2++, this.clock++) {
        const slot = this.clock % 19, future = (this.clock + 18) % 19;
        let kept = 0;
        const original = this.na;
        for (let k2 = 0; k2 < original; k2++) {
          const i2 = this.active[k2];
          this.evolve(i2, this.clock, this.drive[i2]);
          if (this.ref[i2] === 0 && this.v[i2] > -45) {
            this.queue[future][this.qc[future]++] = i2;
            this.counts[i2]++;
          }
          if (this.v[i2] > -45 || this.drive[i2] > 7 || this.drive[i2] + this.g[i2] > 7) this.active[kept++] = i2;
          else this.flags[i2] = 0;
        }
        this.na = kept;
        for (let q = 0; q < this.qc[slot]; q++) {
          const i2 = this.queue[slot][q];
          for (let e2 = this.ptr[i2]; e2 < this.ptr[i2 + 1]; e2++) {
            const j = this.post[e2];
            this.evolve(j, this.clock, this.drive[j]);
            if (this.ref[j] === 0) {
              this.g[j] += this.weight[e2];
              this.awaken(j);
            }
          }
        }
        this.qc[slot] = 0;
        for (let q = 0; q < this.qc[future]; q++) {
          const i2 = this.queue[future][q];
          this.v[i2] = -52;
          this.g[i2] = 0;
          this.ref[i2] = 22;
        }
      }
      let spikes = 0, activeCells = 0;
      for (let i2 = 0; i2 < this.n; i2++) {
        this.evolve(i2, this.clock - 1, this.drive[i2]);
        spikes += this.counts[i2];
        if (this.counts[i2]) activeCells++;
      }
      this.totalSpikes += spikes;
      const decay = Math.exp(-ms / 100);
      const readouts = this.meta.readouts.map((r2, k2) => {
        this.rates[k2] = this.rates[k2] * decay + this.counts[r2.index] / (ms / 1e3) * (1 - decay);
        return { ...r2, spikes: this.counts[r2.index], rate: this.rates[k2] };
      });
      const sum = (side) => readouts.filter((r2) => r2.type === "DNp20" && r2.side === side).reduce((s2, r2) => s2 + r2.spikes, 0);
      return { spikes, totalSpikes: this.totalSpikes, activeCells, simMs: this.clock * 0.1, readouts, left: sum("L"), right: sum("R"), activity: this.meta.displayPoints.map((p2) => this.counts[p2[0]]) };
    }
  };

  // public/brain/readout.mjs
  function predict(counts, model2) {
    let logit = model2.bias;
    for (const feature of model2.features) {
      let sum = 0;
      for (const i2 of feature.indices) sum += counts[i2];
      logit += feature.weight * sum / feature.indices.length;
    }
    const score = 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, logit))));
    return { score, decision: score >= 0.5 ? "like" : "pass", modelVersion: model2.version };
  }

  // public/brain/hash/sha256.mjs
  function e(e2) {
    return e2 instanceof Uint8Array || ArrayBuffer.isView(e2) && e2.constructor.name === "Uint8Array";
  }
  function t(t2, ...n2) {
    if (!e(t2)) throw Error("Uint8Array expected");
    if (n2.length > 0 && !n2.includes(t2.length)) throw Error("Uint8Array expected of length " + n2 + ", got length=" + t2.length);
  }
  function n(e2, t2 = true) {
    if (e2.destroyed) throw Error("Hash instance has been destroyed");
    if (t2 && e2.finished) throw Error("Hash#digest() has already been called");
  }
  function r(e2, n2) {
    t(e2);
    let r2 = n2.outputLen;
    if (e2.length < r2) throw Error("digestInto() expects output buffer of length at least " + r2);
  }
  function i(...e2) {
    for (let t2 = 0; t2 < e2.length; t2++) e2[t2].fill(0);
  }
  function a(e2) {
    return new DataView(e2.buffer, e2.byteOffset, e2.byteLength);
  }
  function o(e2, t2) {
    return e2 << 32 - t2 | e2 >>> t2;
  }
  new Uint8Array(new Uint32Array([287454020]).buffer)[0], typeof Uint8Array.from([]).toHex == "function" && Uint8Array.fromHex;
  function s(e2) {
    if (typeof e2 != "string") throw Error("string expected");
    return new Uint8Array(new TextEncoder().encode(e2));
  }
  function c(e2) {
    return typeof e2 == "string" && (e2 = s(e2)), t(e2), e2;
  }
  var l = class {
  };
  function u(e2) {
    let t2 = (t3) => e2().update(c(t3)).digest(), n2 = e2();
    return t2.outputLen = n2.outputLen, t2.blockLen = n2.blockLen, t2.create = () => e2(), t2;
  }
  function d(e2, t2, n2, r2) {
    if (typeof e2.setBigUint64 == "function") return e2.setBigUint64(t2, n2, r2);
    let i2 = BigInt(32), a2 = BigInt(4294967295), o2 = Number(n2 >> i2 & a2), s2 = Number(n2 & a2), c2 = r2 ? 4 : 0, l2 = r2 ? 0 : 4;
    e2.setUint32(t2 + c2, o2, r2), e2.setUint32(t2 + l2, s2, r2);
  }
  function f(e2, t2, n2) {
    return e2 & t2 ^ ~e2 & n2;
  }
  function p(e2, t2, n2) {
    return e2 & t2 ^ e2 & n2 ^ t2 & n2;
  }
  var m = class extends l {
    constructor(e2, t2, n2, r2) {
      super(), this.finished = false, this.length = 0, this.pos = 0, this.destroyed = false, this.blockLen = e2, this.outputLen = t2, this.padOffset = n2, this.isLE = r2, this.buffer = new Uint8Array(e2), this.view = a(this.buffer);
    }
    update(e2) {
      n(this), e2 = c(e2), t(e2);
      let { view: r2, buffer: i2, blockLen: o2 } = this, s2 = e2.length;
      for (let t2 = 0; t2 < s2; ) {
        let n2 = Math.min(o2 - this.pos, s2 - t2);
        if (n2 === o2) {
          let n3 = a(e2);
          for (; o2 <= s2 - t2; t2 += o2) this.process(n3, t2);
          continue;
        }
        i2.set(e2.subarray(t2, t2 + n2), this.pos), this.pos += n2, t2 += n2, this.pos === o2 && (this.process(r2, 0), this.pos = 0);
      }
      return this.length += e2.length, this.roundClean(), this;
    }
    digestInto(e2) {
      n(this), r(e2, this), this.finished = true;
      let { buffer: t2, view: o2, blockLen: s2, isLE: c2 } = this, { pos: l2 } = this;
      t2[l2++] = 128, i(this.buffer.subarray(l2)), this.padOffset > s2 - l2 && (this.process(o2, 0), l2 = 0);
      for (let e3 = l2; e3 < s2; e3++) t2[e3] = 0;
      d(o2, s2 - 8, BigInt(this.length * 8), c2), this.process(o2, 0);
      let u2 = a(e2), f2 = this.outputLen;
      if (f2 % 4) throw Error("_sha2: outputLen should be aligned to 32bit");
      let p2 = f2 / 4, m2 = this.get();
      if (p2 > m2.length) throw Error("_sha2: outputLen bigger than state");
      for (let e3 = 0; e3 < p2; e3++) u2.setUint32(4 * e3, m2[e3], c2);
    }
    digest() {
      let { buffer: e2, outputLen: t2 } = this;
      this.digestInto(e2);
      let n2 = e2.slice(0, t2);
      return this.destroy(), n2;
    }
    _cloneInto(e2) {
      e2 ||= new this.constructor(), e2.set(...this.get());
      let { blockLen: t2, buffer: n2, length: r2, finished: i2, destroyed: a2, pos: o2 } = this;
      return e2.destroyed = a2, e2.finished = i2, e2.length = r2, e2.pos = o2, r2 % t2 && e2.buffer.set(n2), e2;
    }
    clone() {
      return this._cloneInto();
    }
  };
  var h = /* @__PURE__ */ Uint32Array.from([
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ]);
  var _ = /* @__PURE__ */ BigInt(2 ** 32 - 1);
  var v = /* @__PURE__ */ BigInt(32);
  function y(e2, t2 = false) {
    return t2 ? {
      h: Number(e2 & _),
      l: Number(e2 >> v & _)
    } : {
      h: Number(e2 >> v & _) | 0,
      l: Number(e2 & _) | 0
    };
  }
  function b(e2, t2 = false) {
    let n2 = e2.length, r2 = new Uint32Array(n2), i2 = new Uint32Array(n2);
    for (let a2 = 0; a2 < n2; a2++) {
      let { h: n3, l: o2 } = y(e2[a2], t2);
      [r2[a2], i2[a2]] = [n3, o2];
    }
    return [r2, i2];
  }
  var x = /* @__PURE__ */ Uint32Array.from([
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ]);
  var S = /* @__PURE__ */ new Uint32Array(64);
  var C = class extends m {
    constructor(e2 = 32) {
      super(64, e2, 8, false), this.A = h[0] | 0, this.B = h[1] | 0, this.C = h[2] | 0, this.D = h[3] | 0, this.E = h[4] | 0, this.F = h[5] | 0, this.G = h[6] | 0, this.H = h[7] | 0;
    }
    get() {
      let { A: e2, B: t2, C: n2, D: r2, E: i2, F: a2, G: o2, H: s2 } = this;
      return [
        e2,
        t2,
        n2,
        r2,
        i2,
        a2,
        o2,
        s2
      ];
    }
    set(e2, t2, n2, r2, i2, a2, o2, s2) {
      this.A = e2 | 0, this.B = t2 | 0, this.C = n2 | 0, this.D = r2 | 0, this.E = i2 | 0, this.F = a2 | 0, this.G = o2 | 0, this.H = s2 | 0;
    }
    process(e2, t2) {
      for (let n3 = 0; n3 < 16; n3++, t2 += 4) S[n3] = e2.getUint32(t2, false);
      for (let e3 = 16; e3 < 64; e3++) {
        let t3 = S[e3 - 15], n3 = S[e3 - 2], r3 = o(t3, 7) ^ o(t3, 18) ^ t3 >>> 3;
        S[e3] = (o(n3, 17) ^ o(n3, 19) ^ n3 >>> 10) + S[e3 - 7] + r3 + S[e3 - 16] | 0;
      }
      let { A: n2, B: r2, C: i2, D: a2, E: s2, F: c2, G: l2, H: u2 } = this;
      for (let e3 = 0; e3 < 64; e3++) {
        let t3 = o(s2, 6) ^ o(s2, 11) ^ o(s2, 25), d2 = u2 + t3 + f(s2, c2, l2) + x[e3] + S[e3] | 0, m2 = (o(n2, 2) ^ o(n2, 13) ^ o(n2, 22)) + p(n2, r2, i2) | 0;
        u2 = l2, l2 = c2, c2 = s2, s2 = a2 + d2 | 0, a2 = i2, i2 = r2, r2 = n2, n2 = d2 + m2 | 0;
      }
      n2 = n2 + this.A | 0, r2 = r2 + this.B | 0, i2 = i2 + this.C | 0, a2 = a2 + this.D | 0, s2 = s2 + this.E | 0, c2 = c2 + this.F | 0, l2 = l2 + this.G | 0, u2 = u2 + this.H | 0, this.set(n2, r2, i2, a2, s2, c2, l2, u2);
    }
    roundClean() {
      i(S);
    }
    destroy() {
      this.set(0, 0, 0, 0, 0, 0, 0, 0), i(this.buffer);
    }
  };
  var T = b((/* @__PURE__ */ "0x428a2f98d728ae22.0x7137449123ef65cd.0xb5c0fbcfec4d3b2f.0xe9b5dba58189dbbc.0x3956c25bf348b538.0x59f111f1b605d019.0x923f82a4af194f9b.0xab1c5ed5da6d8118.0xd807aa98a3030242.0x12835b0145706fbe.0x243185be4ee4b28c.0x550c7dc3d5ffb4e2.0x72be5d74f27b896f.0x80deb1fe3b1696b1.0x9bdc06a725c71235.0xc19bf174cf692694.0xe49b69c19ef14ad2.0xefbe4786384f25e3.0x0fc19dc68b8cd5b5.0x240ca1cc77ac9c65.0x2de92c6f592b0275.0x4a7484aa6ea6e483.0x5cb0a9dcbd41fbd4.0x76f988da831153b5.0x983e5152ee66dfab.0xa831c66d2db43210.0xb00327c898fb213f.0xbf597fc7beef0ee4.0xc6e00bf33da88fc2.0xd5a79147930aa725.0x06ca6351e003826f.0x142929670a0e6e70.0x27b70a8546d22ffc.0x2e1b21385c26c926.0x4d2c6dfc5ac42aed.0x53380d139d95b3df.0x650a73548baf63de.0x766a0abb3c77b2a8.0x81c2c92e47edaee6.0x92722c851482353b.0xa2bfe8a14cf10364.0xa81a664bbc423001.0xc24b8b70d0f89791.0xc76c51a30654be30.0xd192e819d6ef5218.0xd69906245565a910.0xf40e35855771202a.0x106aa07032bbd1b8.0x19a4c116b8d2d0c8.0x1e376c085141ab53.0x2748774cdf8eeb99.0x34b0bcb5e19b48a8.0x391c0cb3c5c95a63.0x4ed8aa4ae3418acb.0x5b9cca4f7763e373.0x682e6ff3d6b2b8a3.0x748f82ee5defb2fc.0x78a5636f43172f60.0x84c87814a1f0ab72.0x8cc702081a6439ec.0x90befffa23631e28.0xa4506cebde82bde9.0xbef9a3f7b2c67915.0xc67178f2e372532b.0xca273eceea26619c.0xd186b8c721c0c207.0xeada7dd6cde0eb1e.0xf57d4f7fee6ed178.0x06f067aa72176fba.0x0a637dc5a2c898a6.0x113f9804bef90dae.0x1b710b35131c471b.0x28db77f523047d84.0x32caab7b40c72493.0x3c9ebe0a15c9bebc.0x431d67c49c100d4c.0x4cc5d4becb3e42b6.0x597f299cfc657e2a.0x5fcb6fab3ad6faec.0x6c44198c4a475817".split(".")).map((e2) => BigInt(e2)));
  T[0], T[1];
  var E = /* @__PURE__ */ u(() => new C());
  var k = E;

  // public/brain/worker-source.mjs
  var brain;
  var meta;
  var frame;
  var currentProfile;
  var model;
  var baseline;
  var exposureCounts;
  var exposureMs = 0;
  var runMs = 0;
  var runSpikes = 0;
  var loaded = 0;
  var send = (type, data = {}) => self.postMessage({ type, ...data });
  var pending = /* @__PURE__ */ new Map();
  var requestId = 0;
  function fetchResource(url) {
    return new Promise((resolve, reject) => {
      const id = ++requestId;
      pending.set(id, { resolve, reject });
      send("fetch", { id, url });
    });
  }
  async function verified(info) {
    const response = await fetchResource("/brain/" + info.file).catch((e2) => {
      throw Error(info.file + ": " + e2.message);
    });
    if (!response.ok) throw Error(`Could not download ${info.file} (${response.status})`);
    const compressed = await response.arrayBuffer();
    const raw = await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
    if (raw.byteLength !== info.rawBytes) throw Error("Connectome length check failed");
    const digest = crypto.subtle ? new Uint8Array(await crypto.subtle.digest("SHA-256", raw)) : k(new Uint8Array(raw));
    const hash = Array.from(digest, (b2) => b2.toString(16).padStart(2, "0")).join("");
    if (hash !== info.sha256) throw Error("Connectome integrity check failed");
    loaded += info.bytes;
    send("loading", { progress: Math.round(100 * loaded / meta.totalDownloadBytes), bytes: loaded });
    return raw;
  }
  async function load() {
    const res = await fetchResource("/brain/manifest.json").catch((e2) => {
      throw Error("Manifest: " + e2.message);
    });
    if (!res.ok) throw Error("Connectome manifest is unavailable");
    meta = await res.json();
    send("meta", { meta: { neurons: meta.neurons, edges: meta.edges, contacts: meta.synaptic_contacts, retina: meta.retina.length, points: meta.displayPoints, downloadBytes: meta.totalDownloadBytes, readouts: meta.readouts } });
    const ptr = new Uint32Array(await verified(meta.pointers)), post = new Uint32Array(meta.edges), weight = new Float32Array(meta.edges);
    const queue = [...meta.chunks];
    await Promise.all(Array.from({ length: 3 }, async () => {
      while (queue.length) {
        const info = queue.shift(), raw = await verified(info), u2 = new Uint32Array(raw), f2 = new Float32Array(raw);
        for (let k2 = 0; k2 < info.count; k2++) {
          post[info.start + k2] = u2[k2 * 2];
          weight[info.start + k2] = f2[k2 * 2 + 1];
        }
      }
    }));
    for (let e2 = 0; e2 < post.length; e2++) if (post[e2] >= meta.neurons || !Number.isFinite(weight[e2])) throw Error("Invalid edge data");
    const modelRes = await fetchResource("/brain/readout.json");
    if (!modelRes.ok) throw Error("Trained model unavailable");
    model = await modelRes.json();
    meta.sensoryHalfSaturation = model.sensoryHalfSaturation;
    brain = new FlyBrain(ptr, post, weight, meta);
    const neutral = new Float32Array(1024).fill(0.5);
    for (let i2 = 0; i2 < model.settleMs / 20; i2++) brain.step(neutral);
    baseline = brain.snapshot();
    exposureCounts = new Uint32Array(meta.neurons);
    send("model", { evaluation: model.evaluation, version: model.version, exposureMs: model.exposureMs });
    send("ready");
  }
  async function input(path) {
    if (currentProfile === path && frame) return;
    const res = await fetchResource(path.replace(/\.jpg$/, ".retina.bin"));
    if (!res.ok) throw Error("Portrait sensory input unavailable");
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length !== 1024) throw Error("Invalid portrait sensory input");
    frame = Float32Array.from(bytes, (b2) => b2 / 255);
    brain.restore(baseline);
    exposureCounts.fill(0);
    exposureMs = 0;
    currentProfile = path;
    send("retina", { pixels: Array.from(frame) });
  }
  var busy = false;
  self.onmessage = async ({ data }) => {
    if (data.type === "fetched") {
      const p2 = pending.get(data.id);
      if (!p2) return;
      pending.delete(data.id);
      if (data.error) p2.reject(Error(data.error));
      else p2.resolve(new Response(data.buffer, { status: data.status, headers: { "Content-Type": data.contentType || "application/octet-stream" } }));
      return;
    }
    if (busy) {
      send("error", { message: "Overlapping simulation request" });
      return;
    }
    busy = true;
    try {
      if (data.type === "init") await load();
      if (data.type === "step") {
        if (!brain) throw Error("Brain has not loaded");
        await input(data.image);
        const t2 = performance.now();
        const result = brain.step(frame, 20);
        exposureMs += 20;
        runMs += 20;
        runSpikes += result.spikes;
        for (let i2 = 0; i2 < exposureCounts.length; i2++) exposureCounts[i2] += brain.counts[i2];
        const prediction = exposureMs >= model.exposureMs ? predict(exposureCounts, model) : void 0;
        send("tick", { ...result, simMs: runMs, totalSpikes: runSpikes, exposureMs, prediction, computeMs: performance.now() - t2 });
      }
      if (data.type === "reset") {
        brain.restore(baseline);
        frame = null;
        currentProfile = null;
        runMs = 0;
        runSpikes = 0;
        exposureCounts.fill(0);
        send("reset");
      }
    } catch (error) {
      send("error", { message: error.message || String(error) });
    } finally {
      busy = false;
    }
  };
})();
