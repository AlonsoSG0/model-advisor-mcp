import assert from "node:assert/strict";
import test from "node:test";

import { listModels, listORModels, matchOR } from "../dist/lib/api.js";

test("catalog requests carry no Authorization header", async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(
      JSON.stringify({
        data: [{ id: `test-${calls.length}`, object: "model", created: 0, owned_by: "test" }],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  };

  try {
    await listModels("both", false);
    await listORModels();
  } finally {
    globalThis.fetch = realFetch;
  }

  assert.equal(calls.length, 3, "expected OC go, OC zen and OpenRouter fetches");
  for (const { init } of calls) {
    assert.ok(!init || !init.headers || Object.keys(init.headers).length === 0);
  }
});

test("OpenCode model IDs match exact and aliased OpenRouter IDs", () => {
  const models = [
    { id: "openai/gpt-5", name: "GPT-5" },
    { id: "moonshotai/kimi-k2", name: "Kimi K2" },
  ];

  assert.equal(matchOR("openai/gpt-5", models)?.id, "openai/gpt-5");
  assert.equal(matchOR("kimi-k2", models)?.id, "moonshotai/kimi-k2");
  assert.equal(matchOR("missing-model", models), null);
});
