import { mkdir, writeFile } from "node:fs/promises";

const debuggerUrl = process.env.CHROME_DEBUGGER_URL ?? "http://127.0.0.1:9222";
const appUrl = process.env.SCREENSHOT_BASE_URL ?? "http://127.0.0.1:5173";
const outputDirectory = "docs/screenshots";

const targets = [
  ["overview", "overview.png"],
  ["decisions", "decision-inbox.png"],
  ["workflow", "workflow-operations.png"],
  ["data-ops", "data-forecast-ops.png"],
];

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const withTimeout = (promise, milliseconds, label) =>
  Promise.race([
    promise,
    delay(milliseconds).then(() => {
      throw new Error(`Timed out while waiting for ${label}.`);
    }),
  ]);

const targetsResponse = await fetch(`${debuggerUrl}/json/list`);
if (!targetsResponse.ok) {
  throw new Error(`Chrome debugger returned ${targetsResponse.status}.`);
}

const browserTargets = await targetsResponse.json();
const pageTarget = browserTargets.find((target) => target.type === "page");
if (!pageTarget?.webSocketDebuggerUrl) {
  throw new Error("Chrome did not expose a debuggable page target.");
}

const socket = new WebSocket(pageTarget.webSocketDebuggerUrl);
await withTimeout(
  new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  }),
  10_000,
  "the Chrome debugger connection",
);

let commandId = 0;
const pendingCommands = new Map();
const eventWaiters = new Map();

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);

  if (message.id) {
    const pending = pendingCommands.get(message.id);
    if (!pending) {
      return;
    }

    pendingCommands.delete(message.id);
    if (message.error) {
      pending.reject(new Error(message.error.message));
    } else {
      pending.resolve(message.result ?? {});
    }
    return;
  }

  const waiters = eventWaiters.get(message.method) ?? [];
  eventWaiters.delete(message.method);
  for (const resolve of waiters) {
    resolve(message.params ?? {});
  }
});

const command = (method, params = {}) => {
  commandId += 1;
  const id = commandId;

  return new Promise((resolve, reject) => {
    pendingCommands.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
};

const nextEvent = (method) =>
  new Promise((resolve) => {
    const waiters = eventWaiters.get(method) ?? [];
    waiters.push(resolve);
    eventWaiters.set(method, waiters);
  });

await command("Page.enable");
await command("Emulation.setDeviceMetricsOverride", {
  width: 1600,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await mkdir(outputDirectory, { recursive: true });

for (const [route, filename] of targets) {
  const loaded = nextEvent("Page.loadEventFired");
  await command("Page.navigate", { url: `${appUrl}/${route}` });
  await withTimeout(loaded, 15_000, `/${route} to load`);
  await delay(4_000);

  const { data } = await withTimeout(
    command("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    }),
    15_000,
    `/${route} screenshot capture`,
  );

  const image = Buffer.from(data, "base64");
  if (image.length < 20_000) {
    throw new Error(`${filename} is unexpectedly small (${image.length} bytes).`);
  }

  await writeFile(`${outputDirectory}/${filename}`, image);
  console.log(`Captured ${filename} (${image.length} bytes).`);
}

socket.close();
