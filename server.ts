#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Model Advisor MCP Server
//
// Tools:
//   list_available_models  — fetch OC Go + Zen models with OR benchmarks
//   get_agent_criteria     — read guia_gentle_ai.md (full or per-agent)
//   get_model_benchmarks   — search OpenRouter for specific model benchmarks
//
// The LLM uses these tools to gather data, then REASONS about which model
// fits which agent based on the criteria in guia_gentle_ai.md.
// ---------------------------------------------------------------------------

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { listModels, listORModels } from "./lib/api.js";

// ---- Resolve package root (works from source and dist/) -------------------

function findProjectRoot(start: string): string {
  let dir = start;
  while (dir !== resolve(dir, "..")) {
    // Walk up until we find 'guia_gentle_ai.md'
    if (existsSync(resolve(dir, "guia_gentle_ai.md"))) return dir;
    if (existsSync(resolve(dir, ".git"))) return dir; // fallback to git root
    dir = resolve(dir, "..");
  }
  return resolve(start, ".."); // sensible default
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = findProjectRoot(__dirname);
const GUIDE_PATH = resolve(PROJECT_ROOT, "guia_gentle_ai.md");

// ---- Server -----------------------------------------------------------------

const server = new McpServer({
  name: "model-advisor",
  version: "1.5.1",
  description:
    "Agent-Model Recommendation Advisor. Fetches available models from OpenCode subscriptions and OpenRouter benchmarks, reads agent selection criteria from the Gentle AI guide, and helps recommend the best model for each agent/sub-agent.",
});

// ---- Tool: list_available_models ------------------------------------------

server.tool(
  "list_available_models",
  `Fetch all available AI models from your OpenCode subscriptions (Go and/or Zen),
cross-referenced with OpenRouter benchmarks when available.

Returns for each model:
- ID, name, provider
- Which subscription(s) it belongs to (go, zen, or both)
- Pricing per 1M tokens (input/output) — from OpenRouter
- Context length (max tokens)
- Benchmarks: intelligence_index, coding_index, agentic_index (Artificial Analysis)
- Reasoning: available effort levels (e.g. ["xhigh","high"]) and default — when the model supports reasoning_effort

Use this tool FIRST to understand what models are available before making recommendations.`,
  {
    subscription: z
      .enum(["go", "zen", "both"])
      .default("both")
      .describe("Which OpenCode subscription(s) to query: go (paid), zen (free), or both"),
    enrich: z
      .boolean()
      .default(true)
      .describe("Cross-reference with OpenRouter for benchmarks and pricing. Set false for a fast listing without enrichment."),
  },
  async ({ subscription, enrich }) => {
    try {
      const models = await listModels(subscription, enrich);
      const withReasoning = models.filter((m) => m.reasoning != null);
      const withEffort = models.filter((m) => m.reasoning?.supportedEfforts?.length);
      const withToggle = models.filter((m) => m.reasoning && !m.reasoning.supportedEfforts.length);
      const summary = {
        total: models.length,
        bySubscription: {
          go: models.filter((m) => m.subscription === "go" || m.subscription === "both").length,
          zen: models.filter((m) => m.subscription === "zen" || m.subscription === "both").length,
          both: models.filter((m) => m.subscription === "both").length,
        },
        withBenchmarks: models.filter((m) => m.benchmarks.intelligence != null).length,
        withoutBenchmarks: models.filter((m) => m.benchmarks.intelligence == null).length,
        reasoning: {
          withEffortLevels: withEffort.length,
          withToggleOnly: withToggle.length,
          none: models.length - withReasoning.length,
        },
        models,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  },
);

// ---- Tool: get_agent_criteria ---------------------------------------------

server.tool(
  "get_agent_criteria",
  `Read the Gentle AI agent selection criteria from guia_gentle_ai.md.

Each agent section defines:
- What the agent does (description)
- CRITERIOS DE SELECCIÓN: what qualities the model needs (context, reasoning, speed, cost, etc.)
- Razonamiento para la selección: why certain tradeoffs matter

Use this to understand WHAT each agent needs BEFORE picking a model.
Pass an agent ID to get only that agent's criteria.

AGENT GROUPS (display recommendations in this order):
1. Orchestrator: gentle-orchestrator
2. SDD agents: sdd-init, sdd-onboard, sdd-explore, sdd-propose, sdd-spec, sdd-design, sdd-tasks, sdd-apply, sdd-verify, sdd-archive
3. Review (4R): review-risk, review-readability, review-reliability, review-resilience, review-refuter
4. Judgment Day: jd-judge-a, jd-judge-b, jd-fix-agent`,
  {
    agent: z
      .string()
      .optional()
      .describe(
        "Agent ID to filter by (e.g., 'sdd-apply', 'gentle-orchestrator', 'review-risk', 'jd-judge-a'). Omit to get the full guide.",
      ),
  },
  async ({ agent }) => {
    try {
      const content = await readFile(GUIDE_PATH, "utf-8");

      if (!agent) {
        return { content: [{ type: "text", text: content }] };
      }

      // Extract the section for the requested agent
      // Agent sections start with "### <agent-id>" or "### <name> ("
      const lines = content.split("\n");
      const startIdx = lines.findIndex(
        (l) =>
          l.toLowerCase().includes(`### ${agent.toLowerCase()}`) ||
          l.toLowerCase().includes(`### sdd-${agent.toLowerCase()}`) ||
          l.toLowerCase().includes(`### review-${agent.toLowerCase()}`) ||
          l.toLowerCase().includes(`### jd-${agent.toLowerCase()}`),
      );

      if (startIdx === -1) {
        return {
          content: [
            {
              type: "text",
              text: `Agent "${agent}" not found in guia_gentle_ai.md. Available agents: gentle-orchestrator, sdd-init, sdd-onboard, sdd-explore, sdd-propose, sdd-spec, sdd-design, sdd-tasks, sdd-apply, sdd-verify, sdd-archive, review-risk, review-readability, review-reliability, review-resilience, review-refuter, jd-judge-a, jd-judge-b, jd-fix-agent`,
            },
          ],
        };
      }

      // Extract until next "###" or "##" section
      const sectionLines: string[] = [];
      for (let i = startIdx; i < lines.length; i++) {
        if (i > startIdx && (lines[i].startsWith("### ") || lines[i].startsWith("## "))) break;
        sectionLines.push(lines[i]);
      }

      return {
        content: [{ type: "text", text: sectionLines.join("\n") }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  },
);

// ---- Tool: get_model_benchmarks -------------------------------------------

server.tool(
  "get_model_benchmarks",
  `Search OpenRouter for detailed benchmarks and pricing for a specific model.
Use this when you need deeper data on a particular model beyond what list_available_models returns.

Returns: model ID, name, pricing, context length, and artificial_analysis benchmarks.`,
  {
    query: z
      .string()
      .describe("Model ID or name to search for (e.g., 'deepseek-v4-pro', 'kimi', 'qwen3.7')"),
  },
  async ({ query }) => {
    try {
      const models = await listORModels(query);
      if (models.length === 0) {
        return {
          content: [{ type: "text", text: `No models found matching "${query}" on OpenRouter.` }],
        };
      }

      // Extract relevant fields
      const results = models.map((m) => ({
        id: m.id,
        name: m.name,
        context_length: m.context_length ?? m.top_provider?.context_length ?? null,
        pricing: m.pricing
          ? {
              input_per_1M: Number(m.pricing.prompt) * 1_000_000,
              output_per_1M: Number(m.pricing.completion) * 1_000_000,
            }
          : null,
        benchmarks: m.benchmarks?.artificial_analysis
          ? {
              intelligence_index: m.benchmarks.artificial_analysis.intelligence_index ?? null,
              coding_index: m.benchmarks.artificial_analysis.coding_index ?? null,
              agentic_index: m.benchmarks.artificial_analysis.agentic_index ?? null,
            }
          : null,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ query, count: results.length, results }, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  },
);

// ---- Start server ---------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();

  // Graceful shutdown
  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await server.close();
    process.exit(0);
  });

  await server.connect(transport);
  // Log AFTER connection — stderr before JSON-RPC handshake breaks MCP clients
  console.error(`[model-advisor] ready (guide: ${GUIDE_PATH})`);
}

main().catch((err) => {
  console.error("[model-advisor] Fatal error:", err);
  process.exit(1);
});
