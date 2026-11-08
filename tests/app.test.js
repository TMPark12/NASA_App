const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const worker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

function section(start, end) {
  const first = script.indexOf(start);
  const last = script.indexOf(end, first);
  assert.ok(first !== -1 && last !== -1, `Missing script section: ${start}`);
  return script.slice(first, last);
}

test("date range is inclusive and respects the archive boundary", () => {
  const elements = { start: { value: "2024-03-01" }, "end-date": {} };
  const context = vm.createContext({ document: { getElementById: id => elements[id] } });
  vm.runInContext(section("const DAYS = 9;", "function youtubeEmbed"), context);
  vm.runInContext("updateEndDate()", context);
  assert.equal(elements["end-date"].textContent, "02/22/2024");
  elements.start.value = "1995-06-18";
  vm.runInContext("updateEndDate()", context);
  assert.equal(elements["end-date"].textContent, "06/16/1995");
});

test("gallery displays only the most recently requested date range", async () => {
  const pending = [];
  let replacements = 0;
  const gallery = {
    items: [],
    set innerHTML(value) { this.items = []; },
    appendChild(entry) { this.items.push(entry); }
  };
  const elements = {
    start: { value: "2024-03-01" },
    gallery,
    error: { replaceChildren() {} },
    "gallery-status": { textContent: "" },
    loading: { hidden: true }
  };
  const context = vm.createContext({
    document: { getElementById: id => elements[id] },
    fetch: url => new Promise(resolve => pending.push({ url, resolve })),
    replacePlaceholders: async data => { replacements++; return data; },
    createItem: entry => entry,
    isPlaceholder: () => false,
    showRecoveryMessage() { throw new Error("Unexpected gallery error"); },
    cache: {},
    console
  });
  vm.runInContext(section("const API_KEY", "function youtubeEmbed"), context);
  vm.runInContext(section("let galleryRequest = 0;", "function showRecoveryMessage"), context);
  const first = vm.runInContext("loadGallery()", context);
  elements.start.value = "2025-01-03";
  const second = vm.runInContext("loadGallery()", context);
  assert.match(pending[0].url, /start_date=2024-02-22&end_date=2024-03-01/);
  assert.match(pending[1].url, /start_date=2024-12-26&end_date=2025-01-03/);
  const response = dates => ({ ok: true, json: async () => dates.map(date => ({ date })) });
  pending[1].resolve(response(["2024-12-26", "2025-01-03"]));
  await second;
  assert.equal(elements["gallery-status"].textContent, "Loaded 2 astronomy entries for 12/26/2024 to 01/03/2025.");
  pending[0].resolve(response(["2024-03-01"]));
  await first;
  assert.deepEqual(gallery.items.map(entry => entry.date), ["2025-01-03", "2024-12-26"]);
  assert.equal(elements["gallery-status"].textContent, "Loaded 2 astronomy entries for 12/26/2024 to 01/03/2025.");
  assert.equal(elements.loading.hidden, true);
  assert.equal(replacements, 1);
});

test("NASA Science replacement uses the actual image instead of the article URL", async () => {
  const context = vm.createContext({
    fetchScienceFeed: async () => ({
      "2026-11-08": {
        title: "Meteor", media_type: "image",
        url: "https://science.nasa.gov/image-article/meteor/",
        hdurl: "https://assets.science.nasa.gov/meteor.jpg",
        explanation: "<p>Example</p>"
      }
    }),
    stripHtml: () => "Example",
    console
  });
  vm.runInContext(section("const isPlaceholder", "const stripHtml"), context);
  vm.runInContext(section("async function replacePlaceholders", "let pictureFailureReported"), context);
  context.input = [{ date: "2026-11-08", title: "NASA Science", url: "https://example.com/nasa-logo.png" }];
  const result = await vm.runInContext("replacePlaceholders(input, '2026-11-08', '2026-11-08')", context);
  assert.equal(result[0].url, "https://assets.science.nasa.gov/meteor.jpg");
  assert.equal(result[0].hdurl, result[0].url);
  assert.equal(result[0].title, "Meteor");
});

test("gallery does not display partial results when an item cannot be created", async () => {
  const items = [];
  let errorShown = false;
  const elements = {
    start: { value: "2024-03-01" },
    gallery: { set innerHTML(value) { items.length = 0; }, appendChild(item) { items.push(item); } },
    error: { replaceChildren() {} },
    "gallery-status": { textContent: "" },
    loading: { hidden: true }
  };
  const context = vm.createContext({
    document: { getElementById: id => elements[id] },
    fetch: async () => ({ ok: true, json: async () => [{ date: "2024-03-01" }, { date: "2024-02-29" }] }),
    replacePlaceholders: async data => data,
    createItem: entry => { if (entry.date === "2024-02-29") throw new Error("Bad item"); return entry; },
    showRecoveryMessage: () => { errorShown = true; },
    showPictureLoadFailure() {},
    cache: {},
    console: { error() {} }
  });
  vm.runInContext(section("const API_KEY", "function safeVideoUrl"), context);
  vm.runInContext(section("let galleryRequest = 0;", "function showRecoveryMessage"), context);
  await vm.runInContext("loadGallery()", context);
  assert.deepEqual(items, []);
  assert.equal(errorShown, true);
  assert.equal(elements.loading.hidden, true);
});

test("gallery notifications handle one entry and clear on a failed reload", async () => {
  const pending = [];
  const elements = {
    start: { value: "1995-06-16" },
    gallery: { set innerHTML(value) {}, appendChild() {} },
    error: { replaceChildren() {} },
    "gallery-status": { textContent: "" },
    loading: { hidden: true }
  };
  const errors = [];
  const context = vm.createContext({
    document: { getElementById: id => elements[id] },
    fetch: () => new Promise(resolve => pending.push(resolve)),
    replacePlaceholders: async data => data,
    createItem: entry => entry,
    isPlaceholder: () => false,
    showRecoveryMessage: (container, message) => errors.push(message),
    showPictureLoadFailure() { errors.push("popup"); },
    cache: {},
    console: { error() {} }
  });
  vm.runInContext(section("const API_KEY", "function youtubeEmbed"), context);
  vm.runInContext(section("let galleryRequest = 0;", "function showRecoveryMessage"), context);
  const first = vm.runInContext("loadGallery()", context);
  pending[0]({ ok: true, json: async () => [{ date: "1995-06-16" }] });
  await first;
  assert.equal(elements["gallery-status"].textContent, "Loaded 1 astronomy entry for 06/16/1995.");
  const second = vm.runInContext("loadGallery()", context);
  assert.equal(elements["gallery-status"].textContent, "");
  pending[1]({ ok: false });
  await second;
  assert.equal(elements["gallery-status"].textContent, "");
  assert.equal(errors.length, 2);
  assert.equal(elements.loading.hidden, true);
});

test("late modal results do not update a closed or reopened dialog", async () => {
  let resolveEntry;
  const elements = {
    next: { disabled: false, focus() { throw new Error("Unexpected focus"); } },
    "modal-error": { textContent: "" },
    back: { focus() { throw new Error("Unexpected focus"); } }
  };
  const context = vm.createContext({
    $: id => elements[id],
    fmt: date => date.toISOString().slice(0, 10),
    addDays: (date, offset) => new Date(Date.parse(`${date}T00:00:00Z`) + offset * 86400000),
    fetchEntry: () => new Promise(resolve => { resolveEntry = resolve; }),
    showEntry() { throw new Error("Unexpected modal update"); },
    showRecoveryMessage() { throw new Error("Unexpected error message"); },
    console
  });
  vm.runInContext("let current = { date: '2024-03-01' }; let modalRequest = 0;", context);
  vm.runInContext(section("const hasPrevious =", "function createItem"), context);
  vm.runInContext("const MIN_DATE = '1995-06-16'", context);
  const pending = vm.runInContext("showNext()", context);
  vm.runInContext("modalRequest++", context);
  resolveEntry({ date: "2024-02-29" });
  await pending;
});

test("modal navigation does not steal focus while a picture is loading", async () => {
  let resolveEntry;
  let focused = false;
  const document = { body: {}, activeElement: null };
  const elements = {
    next: { disabled: false, focus() { focused = true; } },
    "modal-error": { textContent: "" },
    "picture-error-dialog": { open: false },
    back: { focus() { focused = true; } }
  };
  const context = vm.createContext({
    document,
    $: id => elements[id],
    fmt: date => date.toISOString().slice(0, 10),
    addDays: (date, offset) => new Date(Date.parse(`${date}T00:00:00Z`) + offset * 86400000),
    fetchEntry: () => new Promise(resolve => { resolveEntry = resolve; }),
    showEntry() {},
    console
  });
  vm.runInContext("let current = { date: '2024-03-01' }; let modalRequest = 0; const MIN_DATE = '1995-06-16';", context);
  vm.runInContext(section("const hasPrevious =", "function createItem"), context);
  const pending = vm.runInContext("showNext()", context);
  document.activeElement = elements.back;
  resolveEntry({ date: "2024-02-29" });
  await pending;
  assert.equal(focused, false);
  assert.equal(elements.next.disabled, false);
});

test("modal navigation restores focus when disabling Next left focus on the document", async () => {
  const document = { body: {}, activeElement: null };
  document.activeElement = document.body;
  let focused = false;
  const elements = {
    next: { disabled: false, focus() { focused = true; } },
    "modal-error": { textContent: "" },
    "picture-error-dialog": { open: false },
    back: { focus() { throw new Error("Unexpected focus"); } }
  };
  const context = vm.createContext({
    document,
    $: id => elements[id],
    fmt: date => date.toISOString().slice(0, 10),
    addDays: (date, offset) => new Date(Date.parse(`${date}T00:00:00Z`) + offset * 86400000),
    fetchEntry: async () => ({ date: "2024-02-29" }),
    showEntry() {},
    console
  });
  vm.runInContext("let current = { date: '2024-03-01' }; let modalRequest = 0; const MIN_DATE = '1995-06-16';", context);
  vm.runInContext(section("const hasPrevious =", "function createItem"), context);
  await vm.runInContext("showNext()", context);
  assert.equal(focused, true);
});

test("video links must use HTTP and only real YouTube hosts are embedded", () => {
  const warnings = [];
  const context = vm.createContext({ URL, console: { warn: (...args) => warnings.push(args) } });
  vm.runInContext(section("function safeVideoUrl", "const isPlaceholder"), context);
  context.input = "https://www.youtube.com/embed/abc";
  assert.equal(vm.runInContext("youtubeEmbed(safeVideoUrl(input))", context), context.input);
  context.input = "https://youtube.com.example.org/embed/abc";
  assert.equal(vm.runInContext("youtubeEmbed(safeVideoUrl(input))", context), null);
  context.input = "http://www.youtube.com/embed/abc";
  assert.equal(vm.runInContext("youtubeEmbed(safeVideoUrl(input))", context), null);
  for (const input of ["javascript:alert(1)", "not a URL"]) {
    context.input = input;
    assert.equal(vm.runInContext("safeVideoUrl(input)", context), null);
  }
  assert.equal(warnings.length, 2);
});

test("the picture dialog displays a message instead of an invalid video link", () => {
  const media = { innerHTML: "", textContent: "", appendChild() { throw new Error("Unexpected video link"); } };
  const elements = {
    "modal-error": {}, "modal-media": media, "modal-title": {}, "modal-date": {}, "modal-text": {},
    modal: { querySelector: () => ({}) }, next: {}
  };
  const warnings = [];
  const context = vm.createContext({
    URL,
    document: { createElement() { throw new Error("Unexpected media element"); } },
    $: id => elements[id],
    hasPrevious: () => true,
    console: { warn: (...args) => warnings.push(args) }
  });
  vm.runInContext("let current = null;", context);
  vm.runInContext(section("function safeVideoUrl", "const isPlaceholder"), context);
  vm.runInContext(section("function showEntry", "function closeModal"), context);
  context.entry = { media_type: "video", url: "javascript:alert(1)", title: "Test", date: "2024-03-01" };
  vm.runInContext("showEntry(entry)", context);
  assert.equal(media.textContent, "The video link is unavailable.");
  assert.equal(warnings.length, 1);
});

test("gallery thumbnails prefer the standard image over the high-resolution image", () => {
  const nodes = [];
  const context = vm.createContext({
    document: {
      createElement(tag) {
        const node = { tag, children: [], appendChild(child) { this.children.push(child); }, append(...children) { this.children.push(...children); }, setAttribute() {}, addEventListener() {} };
        nodes.push(node);
        return node;
      }
    }
  });
  vm.runInContext(section("function loadPicture", "let lastFocus"), context);
  context.entry = { media_type: "image", url: "https://example.com/standard.jpg", hdurl: "https://example.com/large.jpg", title: "Test", date: "2024-03-01" };
  vm.runInContext("createItem(entry)", context);
  assert.equal(nodes.find(node => node.tag === "img").src, context.entry.url);
});

test("failed pictures try the alternate image before offering a refresh", () => {
  const errors = [];
  let failures = 0;
  const context = vm.createContext({
    console: { error: (...args) => errors.push(args) },
    showPictureLoadFailure: () => { failures++; },
    queueMicrotask
  });
  vm.runInContext(section("function loadPicture", "function createItem"), context);
  const img = {
    isConnected: true,
    addEventListener(name, callback) { this[name] = callback; }
  };
  context.img = img;
  vm.runInContext("loadPicture(img, 'standard.jpg', 'large.jpg')", context);
  assert.equal(img.src, "standard.jpg");
  img.error();
  assert.equal(img.src, "large.jpg");
  assert.equal(failures, 0);
  img.error();
  assert.equal(failures, 1);
  assert.match(img.alt, /unavailable/);
  assert.equal(errors.length, 1);
  img.isConnected = false;
  img.error();
  assert.equal(failures, 1);
});

test("missing image URLs offer a refresh after the image is attached", async () => {
  let failures = 0;
  const context = vm.createContext({
    console: { error() {} },
    showPictureLoadFailure: () => { failures++; },
    queueMicrotask
  });
  vm.runInContext(section("function loadPicture", "function createItem"), context);
  context.img = { isConnected: true, addEventListener() {} };
  vm.runInContext("loadPicture(img, '', '')", context);
  await new Promise(resolve => queueMicrotask(resolve));
  assert.equal(failures, 1);
});

test("picture failure dialog waits for the install dialog and is offered only once", () => {
  let opens = 0;
  const install = { open: true };
  const picture = { showModal() { opens++; } };
  const context = vm.createContext({ $: id => id === "install-dialog" ? install : picture });
  vm.runInContext(section("let pictureFailureReported", "let galleryRequest"), context);
  vm.runInContext("showPictureLoadFailure()", context);
  assert.equal(opens, 0);
  assert.equal(vm.runInContext("pictureFailurePending", context), true);
  install.open = false;
  vm.runInContext("showPictureLoadFailure(); showPictureLoadFailure()", context);
  assert.equal(opens, 1);
});

function installHarness(navigator, { standalone = false, secure = true, logger = console, storage = new Map() } = {}) {
  const windowHandlers = {};
  const status = { textContent: "" };
  const element = () => ({
    handlers: {},
    addEventListener(name, callback) { this.handlers[name] = callback; },
    focus() { this.focused = true; }
  });
  const button = element();
  const confirm = element();
  const dismiss = element();
  const dialog = {
    ...element(),
    open: false,
    showModal() { this.open = true; },
    close() { this.open = false; this.handlers.close(); }
  };
  const elements = {
    "install-app": button,
    "install-dialog": dialog,
    "install-confirm": confirm,
    "install-dismiss": dismiss,
    "install-status": status,
    "picture-refresh": element(),
    "picture-dismiss": element()
  };
  const context = vm.createContext({
    $: id => elements[id],
    navigator,
    pictureFailurePending: false,
    showPictureLoadFailure() {},
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value)
    },
    window: {
      isSecureContext: secure,
      matchMedia: () => ({ matches: standalone }),
      addEventListener(name, callback) { windowHandlers[name] = callback; }
    },
    console: logger
  });
  vm.runInContext(section("let installPrompt = null;", "async function showFact()"), context);
  return { windowHandlers, button, confirm, dismiss, dialog, status };
}

test("mobile install instructions cover iPhone, desktop-mode iPad and Android", async () => {
  for (const navigator of [
    { userAgent: "iPhone", platform: "iPhone" },
    { userAgent: "Macintosh", platform: "MacIntel", maxTouchPoints: 5 }
  ]) {
    const app = installHarness(navigator);
    assert.equal(app.dialog.open, true);
    await app.confirm.handlers.click();
    assert.match(app.status.textContent, /Safari.*Share.*Add to Home Screen.*Add/);
  }
  const android = installHarness({ userAgent: "Android", platform: "Linux" });
  await android.confirm.handlers.click();
  assert.match(android.status.textContent, /Install app or Add to Home screen/);
});

test("install button opens the Android prompt and reports installation", async () => {
  const app = installHarness({ userAgent: "Android", platform: "Linux" });
  let prevented = false;
  let prompted = false;
  app.windowHandlers.beforeinstallprompt({
    preventDefault() { prevented = true; },
    async prompt() { prompted = true; },
    userChoice: Promise.resolve({ outcome: "accepted" })
  });
  assert.equal(app.confirm.textContent, "Install");
  const pending = app.confirm.handlers.click();
  assert.equal(prevented, true);
  assert.equal(prompted, true);
  assert.equal(app.confirm.disabled, true);
  await pending;
  assert.equal(app.confirm.disabled, false);
  assert.match(app.status.textContent, /Installation accepted/);
  app.windowHandlers.appinstalled();
  assert.match(app.status.textContent, /has been installed/);
  assert.equal(app.confirm.hidden, true);
  assert.equal(app.dismiss.focused, true);
  app.dismiss.handlers.click();
  app.button.handlers.click();
  assert.match(app.status.textContent, /already installed/);
});

test("the install dialog updates when Android's native prompt arrives later", async () => {
  const app = installHarness({ userAgent: "Android" });
  assert.equal(app.confirm.textContent, "Show installation steps");
  assert.match(app.status.textContent, /has not provided an installation prompt/);
  app.windowHandlers.beforeinstallprompt({
    preventDefault() {},
    async prompt() {},
    userChoice: Promise.resolve({ outcome: "dismissed" })
  });
  assert.equal(app.confirm.textContent, "Install");
  assert.match(app.status.textContent, /confirm in your browser/);
  await app.confirm.handlers.click();
  assert.match(app.status.textContent, /canceled/);
});

test("the install button cannot open multiple native prompts at once", async () => {
  const app = installHarness({ userAgent: "Android" });
  let resolveChoice;
  let calls = 0;
  app.windowHandlers.beforeinstallprompt({
    preventDefault() {},
    prompt() { calls++; return Promise.resolve(); },
    userChoice: new Promise(resolve => { resolveChoice = resolve; })
  });
  const first = app.confirm.handlers.click();
  await app.confirm.handlers.click();
  assert.equal(calls, 1);
  resolveChoice({ outcome: "dismissed" });
  await first;
  assert.equal(app.confirm.disabled, false);
});

test("Android installation steps explain how to open the browser menu", async () => {
  const app = installHarness({ userAgent: "Android" });
  await app.confirm.handlers.click();
  assert.match(app.status.textContent, /Close this dialog.*three-dot menu.*Install app or Add to Home screen.*Chrome/);
  assert.equal(app.dismiss.textContent, "Close");
});

test("the install dialog can be dismissed and reopened, but is suppressed in the installed app", () => {
  const app = installHarness({ userAgent: "Chrome", platform: "Win32" });
  assert.equal(app.dialog.open, true);
  app.dismiss.handlers.click();
  assert.equal(app.dialog.open, false);
  app.button.handlers.click();
  assert.equal(app.dialog.open, true);

  const installed = installHarness({ userAgent: "Chrome", platform: "Win32" }, { standalone: true });
  assert.equal(installed.dialog.open, false);
  installed.button.handlers.click();
  assert.match(installed.status.textContent, /already installed/);
  assert.equal(installed.confirm.hidden, true);
});

test("automatic install offer is remembered across visits but can be reopened manually", () => {
  const storage = new Map();
  const first = installHarness({ userAgent: "Chrome" }, { storage });
  assert.equal(first.dialog.open, true);
  first.dismiss.handlers.click();
  const returning = installHarness({ userAgent: "Chrome" }, { storage });
  assert.equal(returning.dialog.open, false);
  returning.button.handlers.click();
  assert.equal(returning.dialog.open, true);
});

test("install remains available when browser storage is blocked", () => {
  const warnings = [];
  const storage = { get() { throw new Error("storage blocked"); } };
  const app = installHarness({ userAgent: "Chrome" }, { storage, logger: { warn: (...args) => warnings.push(args) } });
  assert.equal(app.dialog.open, false);
  assert.equal(warnings.length, 1);
  app.button.handlers.click();
  assert.equal(app.dialog.open, true);
});

test("desktop installation gives browser-specific and secure-context instructions", async () => {
  const cases = [
    [{ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15" }, /File, then Add to Dock/],
    [{ userAgent: "Mozilla/5.0 Firefox/130.0" }, /Firefox does not support/],
    [{ userAgent: "Mozilla/5.0 Chrome/130.0" }, /Chrome or Edge.*desktop shortcut/]
  ];
  for (const [navigator, expected] of cases) {
    const app = installHarness(navigator);
    await app.confirm.handlers.click();
    assert.match(app.status.textContent, expected);
  }
  const insecure = installHarness({ userAgent: "Chrome" }, { secure: false });
  await insecure.confirm.handlers.click();
  assert.match(insecure.status.textContent, /HTTPS or localhost/);
});

test("dismissed native installation does not claim success and can use manual instructions", async () => {
  const app = installHarness({ userAgent: "Android" });
  let prompts = 0;
  app.windowHandlers.beforeinstallprompt({
    preventDefault() {},
    async prompt() { prompts++; },
    userChoice: Promise.resolve({ outcome: "dismissed" })
  });
  await app.confirm.handlers.click();
  assert.equal(prompts, 1);
  assert.match(app.status.textContent, /canceled.*Install app or Add to Home screen/);
  await app.confirm.handlers.click();
  assert.equal(prompts, 1);
  assert.match(app.status.textContent, /Install app or Add to Home screen/);
});

test("native install failures show actionable instructions", async () => {
  const errors = [];
  const app = installHarness({ userAgent: "Android" }, { logger: { error: (...args) => errors.push(args) } });
  app.windowHandlers.beforeinstallprompt({
    preventDefault() {},
    async prompt() { throw new Error("prompt failed"); }
  });
  await app.confirm.handlers.click();
  assert.equal(errors.length, 1);
  assert.match(app.status.textContent, /could not be opened.*Install app or Add to Home screen/);
});

test("a confirmed installation is not overwritten by an accepted prompt outcome", async () => {
  const app = installHarness({ userAgent: "Chrome" });
  let resolveChoice;
  app.windowHandlers.beforeinstallprompt({
    preventDefault() {},
    async prompt() {},
    userChoice: new Promise(resolve => { resolveChoice = resolve; })
  });
  const pending = app.confirm.handlers.click();
  app.windowHandlers.appinstalled();
  resolveChoice({ outcome: "accepted" });
  await pending;
  assert.match(app.status.textContent, /has been installed/);
});

test("a confirmed installation is not overwritten by a late canceled prompt outcome", async () => {
  const app = installHarness({ userAgent: "Android" });
  let resolveChoice;
  app.windowHandlers.beforeinstallprompt({
    preventDefault() {},
    async prompt() {},
    userChoice: new Promise(resolve => { resolveChoice = resolve; })
  });
  const pending = app.confirm.handlers.click();
  app.windowHandlers.appinstalled();
  resolveChoice({ outcome: "dismissed" });
  await pending;
  assert.match(app.status.textContent, /has been installed/);
  assert.equal(app.confirm.hidden, true);
});

test("mobile home-screen icons are correctly sized PNGs and included in the app shell", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  for (const size of [180, 192, 512]) {
    const name = `icon-${size}.png`;
    const image = fs.readFileSync(path.join(root, name));
    assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(image.readUInt32BE(16), size);
    assert.equal(image.readUInt32BE(20), size);
    assert.ok(worker.includes(`"./${name}"`));
    if (size === 180) assert.match(html, /rel="apple-touch-icon" sizes="180x180" href="icon-180\.png"/);
    else assert.ok(manifest.icons.some(icon => icon.src === `./${name}` && icon.sizes === `${size}x${size}` && icon.type === "image/png"));
  }
});

test("a successful API response survives a cache write failure", async () => {
  const response = { ok: true, clone() { return this; } };
  const logs = [];
  const context = vm.createContext({
    self: { addEventListener() {} },
    caches: { async open() { return { async put() { throw new Error("quota exceeded"); } }; } },
    fetch: async () => response,
    console: { error: (...args) => logs.push(args) },
    URL
  });
  vm.runInContext(worker, context);
  context.request = { url: "https://api.nasa.gov/test" };
  assert.equal(await vm.runInContext("networkFirst(request)", context), response);
  assert.equal(logs.length, 1);
});

test("API responses use their own persistent offline cache", async () => {
  const cached = { ok: true };
  const opened = [];
  const context = vm.createContext({
    self: { addEventListener() {} },
    caches: {
      async open(name) {
        opened.push(name);
        return { async match() { return cached; } };
      }
    },
    fetch: async () => { throw new Error("offline"); },
    console,
    URL
  });
  vm.runInContext(worker, context);
  context.request = { url: "https://api.nasa.gov/test" };
  assert.equal(await vm.runInContext("networkFirst(request)", context), cached);
  assert.deepEqual(opened, ["nasa-explorer-api"]);
});

test("activation migrates old API responses without overwriting newer ones", async () => {
  const handlers = {};
  const request = { url: "https://api.nasa.gov/planetary/apod?date=2024-01-01" };
  const oldResponse = { body: "old" };
  const newResponse = { body: "new" };
  const deleted = [];
  let written = false;
  const context = vm.createContext({
    self: {
      addEventListener(name, callback) { handlers[name] = callback; },
      clients: { async claim() {} }
    },
    caches: {
      async keys() { return ["nasa-explorer-cache-v5", "nasa-explorer-cache-v13", "nasa-explorer-api", "another-app"]; },
      async open(name) {
        if (name === "nasa-explorer-cache-v5") {
          return { async keys() { return [request]; }, async match() { return oldResponse; } };
        }
        assert.equal(name, "nasa-explorer-api");
        return { async match() { return newResponse; }, async put() { written = true; } };
      },
      async delete(name) { deleted.push(name); }
    },
    console,
    URL
  });
  vm.runInContext(worker, context);
  let activation;
  handlers.activate({ waitUntil(promise) { activation = promise; } });
  await activation;
  assert.equal(written, false);
  assert.deepEqual(deleted, ["nasa-explorer-cache-v5"]);
});
