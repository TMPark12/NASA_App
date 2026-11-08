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
  const gallery = {
    items: [],
    set innerHTML(value) { this.items = []; },
    appendChild(entry) { this.items.push(entry); }
  };
  const elements = {
    start: { value: "2024-03-01" },
    gallery,
    error: { replaceChildren() {} },
    loading: { hidden: true }
  };
  const context = vm.createContext({
    document: { getElementById: id => elements[id] },
    fetch: url => new Promise(resolve => pending.push({ url, resolve })),
    replacePlaceholders: async data => data,
    createItem: entry => entry,
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
  pending[0].resolve(response(["2024-03-01"]));
  await first;
  assert.deepEqual(gallery.items.map(entry => entry.date), ["2025-01-03", "2024-12-26"]);
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
      async keys() { return ["nasa-explorer-cache-v5", "nasa-explorer-cache-v7", "nasa-explorer-api", "another-app"]; },
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
