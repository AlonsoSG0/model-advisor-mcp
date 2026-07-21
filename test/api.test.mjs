import assert from "node:assert/strict";
import test from "node:test";

import { buildOpenRouterHeaders, matchOR } from "../dist/lib/api.js";

test("OpenRouter authentication is optional", () => {
  assert.deepEqual(buildOpenRouterHeaders(""), {});
  assert.deepEqual(buildOpenRouterHeaders("test-token"), {
    Authorization: "Bearer test-token",
  });
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
