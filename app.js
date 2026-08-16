(() => {
  const STORAGE_KEY = "pretend-terminal-notes";

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

  function loadNotes() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveNotes(notes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }

  function formatTimestamp(ts) {
    const d = new Date(ts);
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const date = d.toLocaleDateString([], { month: "short", day: "numeric" });
    return `${time} · ${date}`;
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
    const notes = loadNotes();
    document.querySelectorAll(".entry, .system-line").forEach((el) => el.remove());
    notes.forEach((n) => renderStaticEntry(n.text, n.ts));
    noteCount.textContent = notes.length;
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

  async function runThinking(charCount) {
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
      elapsed += 1;
      elapsedEl.textContent = elapsed;
    }, 1000);

    const duration = skipRequested ? 0 : Math.min(1600, 500 + charCount * 4);
    const start = Date.now();
    while (Date.now() - start < duration && !skipRequested) {
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

    for (let i = 0; i < text.length; i++) {
      if (skipRequested) {
        body.textContent = text;
        break;
      }
      body.textContent += text[i];
      scrollToBottom();
      const ch = text[i];
      const delay = /\s/.test(ch) ? 20 : 12 + Math.random() * 26;
      await sleep(delay);
    }

    cursor.remove();

    const ts = document.createElement("span");
    ts.className = "timestamp";
    ts.textContent = formatTimestamp(Date.now());
    container.appendChild(ts);

    scrollToBottom();
    return Date.now();
  }

  async function handleSubmit(rawText) {
    const text = rawText.trim();
    if (!text) return;

    if (text === "/clear") {
      const notes = loadNotes();
      if (notes.length === 0) {
        printSystemLine("(no notes to clear)");
        return;
      }
      saveNotes([]);
      renderAll();
      printSystemLine("(cleared)");
      return;
    }

    if (text === "/help") {
      printSystemLine("/clear   clear all notes\n/help    show this help");
      return;
    }

    busy = true;
    skipRequested = false;
    promptBox.classList.add("busy");
    input.contentEditable = "false";

    await runThinking(text.length);
    await streamText(text);

    const notes = loadNotes();
    notes.push({ text, ts: Date.now() });
    saveNotes(notes);
    noteCount.textContent = notes.length;

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
