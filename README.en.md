# model-advisor-mcp

<p align="center">
  <a href="README.md">Versión en español</a>
  ·
  <a href="guia_gentle_ai.md">Selection criteria (guide)</a>
</p>

> **📢 Community contribution** — This MCP's recommendations are designed for agents in the [Gentle AI](https://github.com/Gentleman-Programming/gentle-ai) harness. This is an independent project created to help the community choose the best models for each agent. It is not officially affiliated with Gentle AI or OpenCode.

MCP server that helps LLMs pick the best AI model for each coding agent. Fetches real-time data from your OpenCode subscriptions and cross-references with OpenRouter benchmarks and reasoning capabilities.

## What it does

- Lists all available models in your **OpenCode Go and/or Zen** subscriptions
- Enriches them with **OpenRouter benchmarks** (intelligence, coding, agentic scores), pricing, and context window
- Shows **reasoning effort support** — whether a model supports explicit effort levels (`xhigh`, `high`, `low`) or a simple toggle
- Reads **agent selection criteria** from the Gentle AI guide so the LLM knows what each agent needs before choosing a model
- Recommends models per agent based on actual data, not guesses

## Installation

### Option A: npm (recommended)

```bash
npm install -g model-advisor-mcp
```

Then configure OpenCode to use it (see [Configuration](#configuration)).

### Option B: Manual (development)

```bash
git clone https://github.com/AlonsoSG0/model-advisor-mcp.git
cd model-advisor-mcp
pnpm install
pnpm build
```

## Requirements

- **Node.js 18+**
- **OpenCode API key** — get yours at [opencode.ai](https://opencode.ai) (required)
- **OpenRouter API key** — get yours at [openrouter.ai/keys](https://openrouter.ai/keys) (optional; the public catalog works without one)

## Configuration

Add this to your `opencode.json` or `opencode.jsonc`:

```jsonc
{
  "mcp": {
    "model-advisor": {
      "type": "local",
      "command": [
        "node",
        "/path/to/model-advisor-mcp/dist/server.js"
      ],
      "cwd": "/path/to/model-advisor-mcp",
      "enabled": true,
      "timeout": 30000,
      "environment": {
        "OPENCODE_API_KEY": "{env:OPENCODE_API_KEY}",
        "OPENROUTER_API_KEY": "{env:OPENROUTER_API_KEY}"
      }
    }
  }
}
```

If you installed via npm (`npm install -g model-advisor-mcp`):

```jsonc
{
  "mcp": {
    "model-advisor": {
      "type": "local",
      "command": ["model-advisor-mcp"],
      "enabled": true,
      "timeout": 30000,
      "environment": {
        "OPENCODE_API_KEY": "{env:OPENCODE_API_KEY}"
      }
    }
  }
}
```

> **Note**: `OPENROUTER_API_KEY` is optional. The server queries the public catalog without credentials; when provided, the key is sent as authentication on enrichment requests.

## Quick start and examples

After installing and configuring the MCP:

1. Verify in your terminal that the globally installed executable is available:

   ```bash
   command -v model-advisor-mcp
   ```

   The command should return the executable path. If you installed manually, this step does not apply: OpenCode uses the path to `dist/server.js` configured above.

2. Restart OpenCode so it loads the configuration, then verify the connection status:

   ```bash
   opencode mcp list
   ```

   `model-advisor` should appear connected.
3. Send one of these prompts to your AI agent or orchestrator. **They are not terminal commands**:

   > Using the model-advisor MCP, tell me which models are available in the OpenCode Go and Zen subscriptions.

   > Using the model-advisor MCP, give me a low-cost recommendation using only OpenCode Go models.

If the agent can list models or produce a recommendation using MCP data, the connection is working correctly.

## Tools

### `list_available_models`

Fetches all AI models from your OpenCode subscriptions (Go and/or Zen), cross-referenced with OpenRouter.

**Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `subscription` | `"go"` \| `"zen"` \| `"both"` | `"both"` | Which subscription to query |
| `enrich` | `boolean` | `true` | Set `false` to skip OpenRouter enrichment (faster) |

**Returns for each model:**

| Field | Description |
|-------|-------------|
| `ocId` / `ocName` / `ocProvider` | Model identity |
| `pricing` | Input/output cost per 1M tokens (USD) |
| `contextLength` | Max context window in tokens |
| `benchmarks` | Intelligence, coding, and agentic scores (Artificial Analysis) |
| `reasoning` | Effort levels available (`supportedEfforts`) and defaults |
| `subscription` | Which subscription(s) the model belongs to |

**Example reasoning output:**

```json
// Model with explicit effort levels
"reasoning": {
  "supportedEfforts": ["xhigh", "high"],
  "defaultEffort": "high",
  "mandatory": false,
  "defaultEnabled": true
}

// Model with toggle only (on/off)
"reasoning": {
  "supportedEfforts": [],
  "defaultEffort": null,
  "mandatory": false,
  "defaultEnabled": true
}

// Model without reasoning
"reasoning": null
```

### `get_agent_criteria`

Reads agent selection criteria from the Gentle AI guide. Use this **before** picking a model — each agent has specific needs (context window, reasoning ability, speed, cost).

**Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `agent` | `string` | (full guide) | Agent ID to filter by. Omit to get all agents. |

**Agent IDs:** `gentle-orchestrator`, `sdd-init`, `sdd-onboard`, `sdd-explore`, `sdd-propose`, `sdd-spec`, `sdd-design`, `sdd-tasks`, `sdd-apply`, `sdd-verify`, `sdd-archive`, `review-risk`, `review-readability`, `review-reliability`, `review-resilience`, `review-refuter`, `jd-judge-a`, `jd-judge-b`, `jd-fix-agent`

**Agent Groups** (display recommendations in this order):
1. Orchestrator
2. SDD agents
3. Review (4R)
4. Judgment Day

### `get_model_benchmarks`

Deep-dive into a specific model's OpenRouter data. Useful when `list_available_models` didn't return benchmarks for a model.

**Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `query` | `string` (required) | Model ID or name (e.g. `"deepseek-v4-pro"`, `"kimi"`) |

## How the LLM uses these tools

The typical workflow:

1. **`list_available_models`** → sees what's available, their benchmarks, and reasoning support
2. **`get_agent_criteria`** (per agent) → understands what each agent needs
3. **`get_model_benchmarks`** (optional) → deeper data on a specific model
4. **LLM reasons** → matches models to agents based on criteria + benchmarks + cost

## Development

```bash
# Install dependencies
pnpm install

# Compile TypeScript
pnpm build

# Run directly (for testing)
pnpm start

# Watch mode (auto-reload on changes)
pnpm dev
```

## Publishing to npm (maintainers)

Publish only from a clean repository checkout and after inspecting the package's actual contents:

```bash
# Authentication and local verification
npm whoami
pnpm verify
npm pack --dry-run

# Create and inspect the tarball before publishing
npm pack
tar -tf model-advisor-mcp-*.tgz

# Publish (npm may require 2FA or another authentication method)
npm publish --access public
```

After publishing, verify the registry entry and test the package in an isolated environment:

```bash
npm view model-advisor-mcp name version dist-tags --json
prefix="$(mktemp -d)"
npm install --prefix "$prefix" --global model-advisor-mcp
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"npm-smoke-test","version":"1.0.0"}}}' \
  | "$prefix/bin/model-advisor-mcp"
```

Stop if the tarball contains secrets, local files, or anything outside `dist/`, the guide, the READMEs, `LICENSE`, and `package.json`.

## License

MIT
