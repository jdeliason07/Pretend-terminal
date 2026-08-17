(() => {
  const output = document.getElementById("introOutput");
  const fade = document.getElementById("introFade");

  const PROMPT_TEXT = "For the creators of the world";
  const WELCOME_TEXT = "Welcome";
  const ASK_TEXT = "What will you create?";

  const SCROLL_MS = 3500;
  const BLINK_MS = 2000;

  const SPINNER_FRAMES = ["✢", "✳", "✶", "✻", "✽"];
  const THINKING_VERBS = ["Pondering", "Noodling", "Ruminating", "Percolating"];

  const KEYWORDS = new Set([
    "const", "let", "var", "function", "return", "if", "else", "for", "while",
    "await", "async", "import", "from", "export", "default", "new", "class",
    "extends", "try", "catch", "finally", "throw", "of", "in", "typeof",
    "yield", "static", "this", "null", "true", "false", "undefined",
  ]);

  const CODE_SOURCE = `
// ─── field/generate.js ────────────────────────────────
import { createNoise3D } from "./noise";
import { Attractor, Particle } from "./primitives";
import { clamp, lerp, smoothstep } from "../math/util";

const DEFAULTS = { density: 0.62, decay: 0.9714, seed: 20260817 };

export function generateField(seed, density = DEFAULTS.density) {
  const noise = createNoise3D(seed);
  const nodes = [];
  for (let i = 0; i < 2048; i++) {
    const theta = (i / 2048) * Math.PI * 2;
    const radius = 180 + noise(theta, i * 0.004, seed) * 96;
    nodes.push(spawn(seed + i, radius, theta, density));
  }
  return nodes.filter((n) => n.alive);
}

function spawn(seed, radius, theta, density) {
  const jitter = hash(seed) * 0.5 - 0.25;
  return new Particle({
    x: Math.cos(theta + jitter) * radius,
    y: Math.sin(theta + jitter) * radius,
    mass: lerp(0.4, 1.8, hash(seed >> 3)),
    alive: hash(seed << 1) < density,
  });
}

// converge every particle toward the nearest attractor
export function step(nodes, attractors, dt) {
  for (const n of nodes) {
    let fx = 0;
    let fy = 0;
    for (const a of attractors) {
      const dx = a.x - n.x;
      const dy = a.y - n.y;
      const d2 = dx * dx + dy * dy + 1e-6;
      const pull = (a.strength * n.mass) / d2;
      fx += dx * pull;
      fy += dy * pull;
    }
    n.vx = (n.vx + fx * dt) * DEFAULTS.decay;
    n.vy = (n.vy + fy * dt) * DEFAULTS.decay;
    n.x += n.vx * dt;
    n.y += n.vy * dt;
    n.age += dt;
    if (n.age > 12.5) n.alive = false;
  }
  return nodes;
}

// ─── render/paint.js ──────────────────────────────────
export class Painter {
  constructor(ctx, palette) {
    this.ctx = ctx;
    this.palette = palette;
    this.trails = new Map();
  }

  clear(alpha = 0.08) {
    this.ctx.fillStyle = \`rgba(0, 0, 0, \${alpha})\`;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  paint(nodes, t) {
    for (const n of nodes) {
      const hue = (n.seed * 37 + t * 12) % 360;
      const glow = smoothstep(0, 1, 1 - n.age / 12.5);
      this.ctx.globalAlpha = clamp(glow, 0.05, 0.92);
      this.ctx.fillStyle = \`hsl(\${hue}, 68%, 62%)\`;
      this.ctx.fillRect(n.x | 0, n.y | 0, 1.5, 1.5);
    }
    this.ctx.globalAlpha = 1;
  }
}

// ─── worker/pipeline.js ───────────────────────────────
async function pipeline(request) {
  const { frames, width, height, quality } = request;
  const buffers = await Promise.all(
    frames.map((f) => encode(f, { width, height, quality }))
  );
  let written = 0;
  for (const buf of buffers) {
    written += await sink.write(buf);
    if (written > MAX_CHUNK) await sink.flush();
  }
  return { written, frames: frames.length, ok: true };
}

self.addEventListener("message", async (event) => {
  try {
    const result = await pipeline(event.data);
    self.postMessage({ type: "done", result });
  } catch (err) {
    self.postMessage({ type: "error", message: err.message });
  }
});

// ─── build ────────────────────────────────────────────
resolving dependencies ......................... ok
compiling 412 modules ......................... ok
optimizing bundle (gzip 84.2kb) ............... ok
running 218 tests ............................. ok
`.trim().split("\n");

  let playing = false;
  let autoplayTimer = null;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function el(tag, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  async function typeInto(target, text, minMs, maxMs) {
    for (const ch of text) {
      target.textContent += ch;
      await sleep(minMs + Math.random() * (maxMs - minMs));
    }
  }

  function push(parts, text, cls) {
    if (text) parts.push({ t: text, c: cls });
  }

  // Lightweight tokenizer: comments, strings, numbers, keywords, call names.
  function tokenize(line) {
    const parts = [];
    const commentAt = line.indexOf("//");
    let head = line;
    let comment = "";
    if (commentAt !== -1 && !/["'`]/.test(line.slice(0, commentAt))) {
      head = line.slice(0, commentAt);
      comment = line.slice(commentAt);
    }

    const re = /("[^"]*"|'[^']*'|`[^`]*`)|(\b\d+(?:\.\d+)?(?:e-?\d+)?\b)|([A-Za-z_$][\w$]*)/g;
    let last = 0;
    let m;
    while ((m = re.exec(head)) !== null) {
      push(parts, head.slice(last, m.index), "tok-plain");
      if (m[1]) push(parts, m[1], "tok-str");
      else if (m[2]) push(parts, m[2], "tok-num");
      else if (KEYWORDS.has(m[3])) push(parts, m[3], "tok-kw");
      else if (head[re.lastIndex] === "(") push(parts, m[3], "tok-fn");
      else push(parts, m[3], "tok-plain");
      last = re.lastIndex;
    }
    push(parts, head.slice(last), "tok-plain");
    push(parts, comment, "tok-com");
    return parts;
  }

  function buildCodeLine(source) {
    const lineEl = el("div", "code-line");
    for (const part of tokenize(source)) {
      const span = document.createElement("span");
      span.className = part.c;
      span.textContent = part.t;
      lineEl.appendChild(span);
    }
    return lineEl;
  }

  // Re-jitter numeric literals so repeated passes never read identically.
  function vary(source, pass) {
    if (pass === 0) return source;
    return source.replace(/\b(\d{3,})\b/g, (n) => {
      const bumped = Number(n) + pass * 7 + ((pass * 31) % 13);
      return String(bumped);
    });
  }

  // Dump code into the viewport as fast as the frame budget allows for
  // SCROLL_MS, then cut dead — no deceleration.
  function scrollCode(stream, durationMs) {
    return new Promise((resolve) => {
      const MAX_LINES = 80;
      const start = performance.now();
      let index = 0;
      let carry = 0;

      const frame = (now) => {
        const elapsed = now - start;
        if (elapsed >= durationMs) {
          resolve();
          return;
        }

        // Ramp from fast to blistering over the first ~500ms.
        const ramp = Math.min(1, elapsed / 500);
        carry += 0.9 + ramp * 2.4;
        const count = Math.floor(carry);
        carry -= count;

        for (let i = 0; i < count; i++) {
          const pass = Math.floor(index / CODE_SOURCE.length);
          const source = CODE_SOURCE[index % CODE_SOURCE.length];
          stream.appendChild(buildCodeLine(vary(source, pass)));
          index++;
        }
        while (stream.childElementCount > MAX_LINES) {
          stream.removeChild(stream.firstElementChild);
        }
        stream.scrollTop = stream.scrollHeight;

        requestAnimationFrame(frame);
      };

      requestAnimationFrame(frame);
    });
  }

  function reset() {
    output.innerHTML = "";
    fade.classList.remove("show");
  }

  async function play() {
    if (playing) return;
    playing = true;
    if (autoplayTimer) clearTimeout(autoplayTimer);
    reset();

    const promptLine = el("div", "line prompt-line");
    const chevron = el("span", "chevron");
    chevron.textContent = "> ";
    const typed = el("span", "typed");
    const cursor = el("span", "cursor");
    promptLine.append(chevron, typed, cursor);
    output.appendChild(promptLine);

    const blinkTimer = setInterval(() => cursor.classList.toggle("cursor-off"), 530);

    await sleep(700);
    await typeInto(typed, PROMPT_TEXT, 35, 75);
    await sleep(450);
    clearInterval(blinkTimer);
    cursor.remove();
    promptLine.classList.add("submitted");

    const thinkLine = el("div", "line thinking-line");
    const spinner = el("span", "spinner");
    spinner.textContent = SPINNER_FRAMES[0];
    const verb = el("span", "verb");
    verb.textContent = THINKING_VERBS[Math.floor(Math.random() * THINKING_VERBS.length)] + "…";
    thinkLine.append(spinner, verb);
    output.appendChild(thinkLine);

    let frame = 0;
    const spinTimer = setInterval(() => {
      frame = (frame + 1) % SPINNER_FRAMES.length;
      spinner.textContent = SPINNER_FRAMES[frame];
    }, 120);
    await sleep(1100 + Math.random() * 900);
    clearInterval(spinTimer);
    thinkLine.remove();

    const welcomeLine = el("div", "line response-line");
    const bullet1 = el("span", "bullet");
    bullet1.textContent = "●";
    const welcomeText = el("span");
    welcomeLine.append(bullet1, welcomeText);
    output.appendChild(welcomeLine);
    await typeInto(welcomeText, WELCOME_TEXT, 45, 85);

    await sleep(550);

    const stream = el("pre", "code-stream");
    output.appendChild(stream);
    await scrollCode(stream, SCROLL_MS);

    const askLine = el("div", "line response-line");
    const bullet2 = el("span", "bullet");
    bullet2.textContent = "●";
    const askWrap = el("span");
    const askText = el("span");
    const askCursor = el("span", "cursor");
    askWrap.append(askText, askCursor);
    askLine.append(bullet2, askWrap);
    output.appendChild(askLine);

    const askBlink = setInterval(() => askCursor.classList.toggle("cursor-off"), 530);
    await sleep(BLINK_MS);
    clearInterval(askBlink);
    askCursor.classList.remove("cursor-off");

    await typeInto(askText, ASK_TEXT, 45, 85);

    await sleep(1100);
    askCursor.remove();

    fade.classList.add("show");
    await sleep(1400);

    playing = false;
    window.dispatchEvent(new CustomEvent("terminal-intro:complete"));
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") play();
  });
  document.addEventListener("click", () => play());

  window.TerminalIntro = { play, reset };

  autoplayTimer = setTimeout(play, 600);
})();
