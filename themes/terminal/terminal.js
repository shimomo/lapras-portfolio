// Brings the pre-rendered terminal to life. Every command's output is already
// in the page (as a transcript section or a <template>); this script only
// clones those pieces. Anything the visitor types is shown with textContent.
(() => {
  const out = document.getElementById("out");
  const inputLine = document.getElementById("inputline");
  const input = document.getElementById("in");
  const skipHint = document.getElementById("skip");
  const hint = document.getElementById("hint");
  const lastLogin = document.getElementById("last-login");
  const ps1 = inputLine.querySelector(".ps1");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // key -> .out node, from transcript sections and templates alike
  const outputs = new Map();
  const boots = [];
  for (const section of document.querySelectorAll("section.cmd")) {
    outputs.set(section.dataset.cmd, section.querySelector(".out"));
    if (section.dataset.boot) boots.push(section.dataset.boot);
  }
  for (const template of document.querySelectorAll("template[data-cmd]")) {
    outputs.set(template.dataset.cmd, template.content.querySelector(".out"));
  }

  const dirs = [...outputs.keys()]
    .filter((k) => k.startsWith("ls "))
    .map((k) => k.slice(3));
  const linkKeys = [
    ...(outputs.get("open")?.querySelectorAll("[data-key]") ?? []),
  ].map((row) => row.dataset.key);
  const HIDDEN = new Set(["sudo", "exit"]);
  const firstWords = [
    ...new Set([
      ...[...outputs.keys()].map((k) => k.split(" ")[0]),
      "history",
      "clear",
    ]),
  ].filter((w) => !HIDDEN.has(w));
  const secondWords = {
    ls: dirs,
    open: linkKeys,
    lapras: ["score"],
    git: ["log"],
    cat: ["README.md"],
  };

  // ---------- small helpers ----------
  let skipping = reduced;
  const sleep = (ms) =>
    skipping || ms <= 0
      ? Promise.resolve()
      : new Promise((resolve) => setTimeout(resolve, ms));
  const scrollDown = () => window.scrollTo(0, document.body.scrollHeight);
  const span = (cls, text) => {
    const el = document.createElement("span");
    if (cls) el.className = cls;
    el.textContent = text;
    return el;
  };
  const runLink = (cmd) => {
    const el = span("run", cmd);
    el.dataset.run = cmd;
    return el;
  };
  const print = (...parts) => {
    const line = document.createElement("div");
    line.className = "line";
    line.append(...parts);
    out.append(line);
    return line;
  };
  const promptLine = (text) => {
    const typed = span("typed", text);
    print(ps1.cloneNode(true), typed);
    return typed;
  };

  async function show(key, limit) {
    const node = outputs.get(key).cloneNode(true);
    if (limit !== null) {
      for (const row of [...node.querySelectorAll(".row")].slice(limit)) {
        row.remove();
      }
    }
    const delayed = [...node.querySelectorAll("[data-delay]")];
    for (const el of delayed) el.hidden = true;
    out.append(node);
    for (const el of delayed) {
      await sleep(Number(el.dataset.delay));
      el.hidden = false;
      scrollDown();
    }
  }

  const notFound = (name) =>
    print(`${name}: command not found. try `, runLink("help"));

  // ---------- parsing ----------
  async function dispatch(line) {
    const [main, ...pipes] = line.split("|").map((part) => part.trim());
    let limit = null;
    for (const pipe of pipes) {
      const m = pipe.match(/^head(?:\s+-n)?\s+-?(\d+)$/);
      if (m) limit = Number(m[1]);
    }
    const [rawName, ...args] = main.split(/\s+/).filter(Boolean);
    if (!rawName) return;
    const name = rawName === "ll" || rawName === "dir" ? "ls" : rawName;
    const plain = args.filter((a) => !a.startsWith("-"));

    switch (name) {
      case "clear":
        out.replaceChildren();
        return;
      case "history":
        history.forEach((entry, i) => {
          print(span("dim", String(i + 1).padStart(4)), `  ${entry}`);
        });
        return;
      case "echo":
        print(args.join(" "));
        return;
      case "ls": {
        const dir = (plain[0] ?? "").replace(/^~\//, "").replace(/\/$/, "");
        if (!dir) {
          if (outputs.has("ls")) await show("ls", limit);
          return;
        }
        if (outputs.has(`ls ${dir}`)) return show(`ls ${dir}`, limit);
        print(`ls: cannot access '${dir}': No such file or directory`);
        return;
      }
      case "lapras":
        return outputs.has("lapras score")
          ? show("lapras score", limit)
          : notFound(name);
      case "git":
        return outputs.has("git log") ? show("git log", limit) : notFound(name);
      case "cat":
        if (plain[0] && plain[0].toLowerCase() !== "readme.md") {
          print(`cat: ${plain[0]}: No such file or directory`);
          return;
        }
        return show("cat README.md", limit);
      case "sudo":
        return show(
          args.join(" ").includes("hire") ? "sudo hire" : "sudo",
          limit,
        );
      case "open": {
        if (!plain[0]) return show("open", limit);
        const row = outputs
          .get("open")
          ?.querySelector(`[data-key="${CSS.escape(plain[0])}"]`);
        const href = row?.querySelector("a")?.href;
        if (!href) {
          print(`open: unknown target '${plain[0]}'. try `, runLink("open"));
          return;
        }
        const a = document.createElement("a");
        a.href = href;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = href;
        print(span("dim", "opening "), a, span("dim", " …"));
        window.open(href, "_blank", "noopener");
        return;
      }
      default: {
        const key = [name, ...args].join(" ");
        if (outputs.has(key)) return show(key, limit);
        if (outputs.has(name) && args.length === 0) return show(name, limit);
        notFound(name);
      }
    }
  }

  // ---------- execution ----------
  const history = [];
  let historyIndex = 0;
  let busy = false;

  async function execute(line, { echo = true } = {}) {
    if (busy) return;
    busy = true;
    try {
      if (echo) promptLine(line);
      if (line.trim()) {
        history.push(line);
        historyIndex = history.length;
      }
      await dispatch(line);
    } finally {
      busy = false;
      scrollDown();
    }
  }

  // ---------- boot ----------
  async function typeLine(text) {
    const typed = promptLine("");
    const cursor = span("cursor", "");
    typed.after(cursor);
    await sleep(350);
    for (const ch of text) {
      if (skipping) {
        typed.textContent = text;
        break;
      }
      typed.textContent += ch;
      scrollDown();
      await sleep(35 + Math.random() * 55);
    }
    await sleep(220);
    cursor.remove();
    await execute(text, { echo: false });
    await sleep(500);
  }

  async function boot() {
    lastLogin.textContent = `Last login: ${new Date().toDateString()} from lapras.com`;
    out.replaceChildren(lastLogin);
    const skip = () => {
      skipping = true;
    };
    addEventListener("keydown", skip, { once: true });
    addEventListener("pointerdown", skip, { once: true });
    if (!reduced) skipHint.hidden = false;

    for (const line of boots) await typeLine(line);
    out.append(hint.content.cloneNode(true));

    skipHint.hidden = true;
    removeEventListener("keydown", skip);
    removeEventListener("pointerdown", skip);
    // skipping only fast-forwards the boot; later delays (sudo) still play
    skipping = reduced;
    inputLine.hidden = false;
    input.focus({ preventScroll: true });
    scrollDown();
  }

  // ---------- input ----------
  function complete(value) {
    const parts = value.split(/\s+/);
    const pool =
      parts.length === 1 ? firstWords : (secondWords[parts[0]] ?? []);
    if (parts.length > 2) return value;
    const last = parts[parts.length - 1];
    const hits = pool.filter((p) => p.startsWith(last)).sort();
    if (hits.length === 1) {
      parts[parts.length - 1] = hits[0];
      return `${parts.join(" ")} `;
    }
    if (hits.length > 1) {
      promptLine(value);
      print(hits.join("  "));
      scrollDown();
    }
    return value;
  }

  input.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (busy) return;
      const value = input.value;
      input.value = "";
      await execute(value);
    } else if (e.key === "Tab") {
      e.preventDefault();
      input.value = complete(input.value);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex > 0) input.value = history[--historyIndex];
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = history[historyIndex] ?? "";
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      out.replaceChildren();
    } else if (e.key === "c" && e.ctrlKey && !getSelection().toString()) {
      e.preventDefault();
      promptLine(`${input.value}^C`);
      input.value = "";
    }
  });

  document.addEventListener("click", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const runner = target?.closest(".run[data-run]");
    if (runner) {
      e.preventDefault();
      if (!inputLine.hidden) execute(runner.dataset.run);
      return;
    }
    if (target?.closest("a, button, input") || getSelection().toString())
      return;
    if (!inputLine.hidden) input.focus({ preventScroll: true });
  });

  boot();
})();
