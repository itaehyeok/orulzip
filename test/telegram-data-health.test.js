import assert from "node:assert/strict";
import test from "node:test";
import {
  notifyTelegramDataHealth,
  telegramDataHealthMessage
} from "../src/services/telegram-notifier.js";

const configKeys = ["ORULZIP_TELEGRAM_BOT_TOKEN", "ORULZIP_TELEGRAM_CHAT_ID", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"];

function configure(values = {}) {
  const previous = Object.fromEntries(configKeys.map((key) => [key, process.env[key]]));
  for (const key of configKeys) {
    if (Object.hasOwn(values, key)) process.env[key] = values[key];
    else delete process.env[key];
  }
  return () => {
    for (const key of configKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  };
}

function response(payload, { ok = true, status = 200 } = {}) {
  return { ok, status, async json() { return payload; } };
}

function event(overrides = {}) {
  return {
    environment: "production",
    status: "pass",
    summary: { endMonth: "202610", recentMonths: ["202609", "202610"], issueCount: 0, warningCount: 0 },
    checks: [],
    ...overrides
  };
}

test("accepts only a successful Telegram response and returns its receipt", async (t) => {
  const restore = configure({ ORULZIP_TELEGRAM_BOT_TOKEN: "test-token", ORULZIP_TELEGRAM_CHAT_ID: "test-chat" });
  t.after(restore);
  t.mock.method(globalThis, "fetch", async () => response({ ok: true, result: { message_id: 813 } }));

  const result = await notifyTelegramDataHealth(event());
  assert.equal(result.sent, true);
  assert.equal(result.messageId, 813);
  assert.ok(Number.isFinite(Date.parse(result.sentAt)));
});

test("requires an HTTP-successful response", async (t) => {
  const restore = configure({ ORULZIP_TELEGRAM_BOT_TOKEN: "test-token", ORULZIP_TELEGRAM_CHAT_ID: "test-chat" });
  t.after(restore);
  t.mock.method(globalThis, "fetch", async () => response({ ok: true, result: { message_id: 813 } }, { ok: false, status: 503 }));

  await assert.rejects(notifyTelegramDataHealth(event()), /HTTP 503/);
});

test("rejects HTTP 200 responses where Telegram reports API failure", async (t) => {
  const restore = configure({ ORULZIP_TELEGRAM_BOT_TOKEN: "test-token", ORULZIP_TELEGRAM_CHAT_ID: "test-chat" });
  t.after(restore);
  t.mock.method(globalThis, "fetch", async () => response({ ok: false, description: "rejected" }));

  await assert.rejects(notifyTelegramDataHealth(event()), /API rejected/);
});

test("rejects a successful API response without a message receipt", async (t) => {
  const restore = configure({ ORULZIP_TELEGRAM_BOT_TOKEN: "test-token", ORULZIP_TELEGRAM_CHAT_ID: "test-chat" });
  t.after(restore);
  t.mock.method(globalThis, "fetch", async () => response({ ok: true, result: {} }));

  await assert.rejects(notifyTelegramDataHealth(event()), /omitted the message receipt/);
});

test("returns not_configured without attempting fetch", async (t) => {
  const restore = configure();
  t.after(restore);
  let fetchCalled = false;
  t.mock.method(globalThis, "fetch", async () => { fetchCalled = true; });

  assert.deepEqual(await notifyTelegramDataHealth(event()), { sent: false, reason: "not_configured" });
  assert.equal(fetchCalled, false);
});

test("formats the optional notification label as its own line", () => {
  const message = telegramDataHealthMessage(event({ notificationLabel: "Daily collection receipt test" }));
  assert.match(message, /환경: production\nDaily collection receipt test\n기준월: 202610/);
  assert.doesNotMatch(telegramDataHealthMessage(event()), /notificationLabel/);
});

test("filters environments before attempting fetch", async (t) => {
  const restore = configure({
    ORULZIP_TELEGRAM_BOT_TOKEN: "test-token",
    ORULZIP_TELEGRAM_CHAT_ID: "test-chat",
    ORULZIP_TELEGRAM_DATA_HEALTH_ENVIRONMENTS: "production"
  });
  t.after(restore);
  let fetchCalled = false;
  t.mock.method(globalThis, "fetch", async () => { fetchCalled = true; });

  assert.deepEqual(await notifyTelegramDataHealth(event({ environment: "development" })), {
    sent: false,
    reason: "environment_filtered"
  });
  assert.equal(fetchCalled, false);
});
