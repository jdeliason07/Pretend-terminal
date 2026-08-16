(() => {
  const STORAGE_KEY = "pretend-terminal-note";
  const THINKING_MS = 2000;
  const TYPING_MS = 6000;

  const scrollback = document.getElementById("scrollback");
  const input = document.getElementById("input");
  const promptBox = document.getElementById("promptBox");
  const hintLeft = document.getElementById("hintLeft");
  const noteCount = document.getElementById("noteCount");

  const SPINNER_FRAMES = ["✢", "✳", "✶", "✻", "✽"];
  const THINKING_VERBS = [
    "Pondering", "Noodling", "Ruminating", "Percolating", "Marinating",
    "Cogitating", "Simmering", "Musing", "Brewing", "Contemplating",
  ];

  let busy = false;
  let skipRequested = false;

  function loadNote() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
    } catch {
      return null;
    }
  }

  function saveNote(note) {
    if (note) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(note));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function formatTimestamp(ts) {
    const d = new Date(ts);
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const date = d.toLocaleDateString([], { month: "short", day: "numeric" });
    return `${time} · ${date}`;
  }

  function clearEntries() {
    document.querySelectorAll(".entry, .system-line").forEach((el) => el.remove());
  }

  function renderStaticEntry(text, ts) {
    const entry = document.createElement("div");
    entry.className = "entry";
    entry.innerHTML = `
      <span class="bullet">●</span>
      <div>
        <div class="body"></div>
        <span class="timestamp">${formatTimestamp(ts)}</span>
      </div>
    `;
    entry.querySelector(".body").textContent = text;
    scrollback.appendChild(entry);
  }

  function renderAll() {
    const note = loadNote();
    clearEntries();
    if (note) renderStaticEntry(note.text, note.ts);
    noteCount.textContent = note ? "note saved" : "no note";
    scrollToBottom();
  }

  function scrollToBottom() {
    scrollback.scrollTop = scrollback.scrollHeight;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function printSystemLine(text) {
    const line = document.createElement("div");
    line.className = "system-line";
    line.textContent = text;
    scrollback.appendChild(line);
    scrollToBottom();
  }

  async function runThinking() {
    const wrap = document.createElement("div");
    wrap.className = "thinking";
    const verb = THINKING_VERBS[Math.floor(Math.random() * THINKING_VERBS.length)];
    wrap.innerHTML = `<span class="spinner">${SPINNER_FRAMES[0]}</span><span class="verb">${verb}…</span><span class="meta">(<span class="elapsed">0</span>s · esc to interrupt)</span>`;
    scrollback.appendChild(wrap);
    scrollToBottom();

    const spinnerEl = wrap.querySelector(".spinner");
    const elapsedEl = wrap.querySelector(".elapsed");

    let frame = 0;
    let elapsed = 0;
    const spinTimer = setInterval(() => {
      frame = (frame + 1) % SPINNER_FRAMES.length;
      spinnerEl.textContent = SPINNER_FRAMES[frame];
    }, 120);
    const secTimer = setInterval(() => {
      elapsed = Math.min(THINKING_MS / 1000, elapsed + 1);
      elapsedEl.textContent = elapsed;
    }, 1000);

    const start = Date.now();
    while (Date.now() - start < THINKING_MS && !skipRequested) {
      await sleep(50);
    }

    clearInterval(spinTimer);
    clearInterval(secTimer);
    wrap.remove();
  }

  async function streamText(text) {
    const entry = document.createElement("div");
    entry.className = "entry";
    entry.innerHTML = `<span class="bullet">●</span><div><div class="body"></div></div>`;
    scrollback.appendChild(entry);
    const body = entry.querySelector(".body");
    const container = entry.querySelector("div");

    const cursor = document.createElement("span");
    cursor.className = "cursor";
    body.after(cursor);

    const perCharMs = TYPING_MS / text.length;

    for (let i = 0; i < text.length; i++) {
      if (skipRequested) {
        body.textContent = text;
        break;
      }
      body.textContent += text[i];
      scrollToBottom();
      const jitter = (Math.random() - 0.5) * perCharMs * 0.6;
      await sleep(Math.max(4, perCharMs + jitter));
    }

    cursor.remove();

    const ts = document.createElement("span");
    ts.className = "timestamp";
    ts.textContent = formatTimestamp(Date.now());
    container.appendChild(ts);

    scrollToBottom();
  }

  async function handleSubmit(rawText) {
    const text = rawText.trim();
    if (!text) return;

    if (text === "/clear") {
      const note = loadNote();
      if (!note) {
        printSystemLine("(no note to clear)");
        return;
      }
      saveNote(null);
      renderAll();
      printSystemLine("(cleared)");
      return;
    }

    if (text === "/help") {
      printSystemLine("/clear   clear the current note\n/help    show this help");
      return;
    }

    busy = true;
    skipRequested = false;
    promptBox.classList.add("busy");
    input.contentEditable = "false";

    clearEntries();

    await runThinking();
    await streamText(text);

    const note = { text, ts: Date.now() };
    saveNote(note);
    noteCount.textContent = "note saved";

    busy = false;
    promptBox.classList.remove("busy");
    input.contentEditable = "true";
    input.focus();
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (busy) return;
      const text = input.innerText;
      input.textContent = "";
      handleSubmit(text);
    } else if (e.key === "Escape" && busy) {
      skipRequested = true;
    }
  });

  input.addEventListener("focus", () => promptBox.classList.add("focused"));
  input.addEventListener("blur", () => promptBox.classList.remove("focused"));

  document.addEventListener("click", (e) => {
    if (!busy && !window.getSelection().toString()) {
      input.focus();
    }
  });

  hintLeft.textContent = "shift+⏎ for newline";

  renderAll();
  input.focus();
})();
