(() => {
  const output = document.getElementById("introOutput");
  const fade = document.getElementById("introFade");

  const PROMPT_TEXT = "For the creators of the world";
  const WELCOME_TEXT = "Welcome";
  const ASK_TEXT = "Create.";

  const SPINNER_FRAMES = ["✢", "✳", "✶", "✻", "✽"];
  const THINKING_VERBS = ["Pondering", "Noodling", "Ruminating", "Percolating"];

  const CODE_LINES = [
    [
      { t: "function ", c: "tok-kw" }, { t: "generateField", c: "tok-fn" },
      { t: "(seed, ", c: "tok-plain" }, { t: "density", c: "tok-plain" }, { t: ") {", c: "tok-plain" },
    ],
    [
      { t: "  const ", c: "tok-kw" }, { t: "nodes", c: "tok-plain" }, { t: " = [];", c: "tok-plain" },
    ],
    [
      { t: "  for ", c: "tok-kw" }, { t: "(let i = 0; i < ", c: "tok-plain" },
      { t: "2048", c: "tok-num" }, { t: "; i++) {", c: "tok-plain" },
    ],
    [
      { t: "    nodes.push(", c: "tok-plain" }, { t: "spawn", c: "tok-fn" },
      { t: "(seed + i, ", c: "tok-plain" }, { t: "0.62", c: "tok-num" }, { t: "));", c: "tok-plain" },
    ],
    [
      { t: "  }", c: "tok-plain" },
    ],
    [
      { t: "  ", c: "tok-plain" }, { t: "// converge toward attractor", c: "tok-com" },
    ],
    [
      { t: "  return ", c: "tok-kw" }, { t: "nodes.filter", c: "tok-fn" },
      { t: "(n => n.alive);", c: "tok-plain" },
    ],
    [
      { t: "}", c: "tok-plain" },
    ],
  ];

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

  async function typeTokens(lineEl, tokens, minMs, maxMs) {
    for (const tok of tokens) {
      const span = document.createElement("span");
      span.className = tok.c || "tok-plain";
      lineEl.appendChild(span);
      for (const ch of tok.t) {
        span.textContent += ch;
        await sleep(minMs + Math.random() * (maxMs - minMs));
      }
    }
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

    const codeBlock = el("pre", "code-block");
    output.appendChild(codeBlock);
    for (const tokens of CODE_LINES) {
      const lineEl = el("div", "code-line");
      codeBlock.appendChild(lineEl);
      await typeTokens(lineEl, tokens, 5, 14);
    }

    await sleep(650);

    const askLine = el("div", "line response-line");
    const bullet2 = el("span", "bullet");
    bullet2.textContent = "●";
    const askText = el("span");
    askLine.append(bullet2, askText);
    output.appendChild(askLine);
    await typeInto(askText, ASK_TEXT, 45, 85);

    await sleep(1100);

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
