// ---------------------------------------------------------------------------
// MCP Data Layer — OpenCode + OpenRouter API clients
//
// Node-native fetch (no Astro/Vite deps). Uses process.env for API keys.
// ---------------------------------------------------------------------------

// ---- Types ----------------------------------------------------------------

export interface OCModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface ORModel {
  id: string;
  name: string;
  description?: string;
  pricing?: {
    prompt: string;
    completion: string;
    input_cache_read?: string;
  };
  context_length?: number;
  architecture?: {
    modality?: string;
    tokenizer?: string;
    instruct_type?: string | null;
  };
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number | null;
    is_moderated?: boolean;
  };
  benchmarks?: {
    artificial_analysis?: {
      intelligence_index?: number;
      coding_index?: number;
      agentic_index?: number;
    };
  };
  /** Reasoning effort configuration — from OpenRouter. Present when the model supports reasoning. */
  reasoning?: {
    supported_efforts?: string[];
    default_effort?: string | null;
    default_enabled?: boolean;
    mandatory?: boolean;
  };
}

export interface EnrichedModel {
  ocId: string;
  ocName: string;
  ocProvider: string;
  orId: string | null;
  orName: string | null;
  pricing: { prompt: number; completion: number } | null;
  contextLength: number | null;
  benchmarks: {
    intelligence: number | null;
    coding: number | null;
    agentic: number | null;
  };
  /** The subscription(s) this model belongs to: "go" | "zen" | "both" */
  subscription: string;
  /** Reasoning effort support — from OpenRouter. null = not available / not enriched. */
  reasoning: {
    supportedEfforts: string[];
    defaultEffort: string | null;
    mandatory: boolean;
    /** When true, reasoning is a toggle (on/off) rather than effort levels. */
    defaultEnabled: boolean;
  } | null;
}

// ---- API key helper -------------------------------------------------------

function getOcApiKey(): string {
  const key = process.env.OPENCODE_API_KEY;
  if (!key) {
    throw new Error("OPENCODE_API_KEY not set in environment");
  }
  return key;
}

// ---- OpenCode API ---------------------------------------------------------

const OC_GO_URL = "https://opencode.ai/zen/go/v1/models";
const OC_ZEN_URL = "https://opencode.ai/zen/v1/models";

async function fetchOcModels(url: string, label: string): Promise<OCModel[]> {
  const apiKey = getOcApiKey();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`OpenCode ${label} API returned ${res.status}: ${res.statusText}`);
  }
  const body = (await res.json()) as { data?: OCModel[] };
  return body.data ?? (Array.isArray(body) ? body : []);
}

/**
 * Fetch models from OpenCode Go and/or Zen subscriptions.
 * @param subscription "go" | "zen" | "both"
 * @param enrichWithOR If true, cross-reference with OpenRouter benchmarks
 */
export async function listModels(
  subscription: "go" | "zen" | "both" = "both",
  enrichWithOR = true,
): Promise<EnrichedModel[]> {
  const fetchers: Promise<{ models: OCModel[]; sub: string }>[] = [];

  if (subscription === "go" || subscription === "both") {
    fetchers.push(
      fetchOcModels(OC_GO_URL, "Go").then((models) => ({ models, sub: "go" })),
    );
  }
  if (subscription === "zen" || subscription === "both") {
    fetchers.push(
      fetchOcModels(OC_ZEN_URL, "Zen").then((models) => ({ models, sub: "zen" })),
    );
  }

  const results = await Promise.allSettled(fetchers);
  const seen = new Map<string, EnrichedModel>(); // dedupe by ocId

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[mcp-api] OC fetch failed:", result.reason);
      continue;
    }
    for (const model of result.value.models) {
      if (seen.has(model.id)) {
        // Model already exists — mark as "both" subscriptions
        const existing = seen.get(model.id)!;
        existing.subscription = "both";
      } else {
        seen.set(model.id, {
          ocId: model.id,
          ocName: deriveDisplayName(model.id),
          ocProvider: deriveProvider(model.id),
          orId: null,
          orName: null,
          pricing: null,
          contextLength: null,
          benchmarks: { intelligence: null, coding: null, agentic: null },
          subscription: result.value.sub,
          reasoning: null,
        });
      }
    }
  }

  if (seen.size === 0) {
    throw new Error("No models fetched — both subscriptions may have failed");
  }

  const models = [...seen.values()];

  // Enrich with OpenRouter benchmarks if requested
  if (enrichWithOR) {
    try {
      const orModels = await fetchOpenRouterModels();
      enrichWithOpenRouter(models, orModels);
    } catch (err) {
      console.error("[mcp-api] OR enrichment failed (models returned without benchmarks):", err);
    }
  }

  return models;
}

// ---- OpenRouter API -------------------------------------------------------

const OR_URL = "https://openrouter.ai/api/v1/models";

export function buildOpenRouterHeaders(apiKey = process.env.OPENROUTER_API_KEY): HeadersInit {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

async function fetchOpenRouterModels(): Promise<ORModel[]> {
  const res = await fetch(OR_URL, { headers: buildOpenRouterHeaders() });
  if (!res.ok) {
    throw new Error(`OpenRouter API returned ${res.status}`);
  }
  const body = (await res.json()) as { data?: ORModel[] };
  return body.data ?? (Array.isArray(body) ? body : []);
}

/**
 * Fetch full OpenRouter model list with benchmarks.
 * Optionally filter by a model ID or search term.
 */
export async function listORModels(filter?: string): Promise<ORModel[]> {
  const models = await fetchOpenRouterModels();
  if (!filter) return models;
  const q = filter.toLowerCase();
  return models.filter(
    (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
  );
}

// ---- Cross-reference (matching logic) -------------------------------------

const PROVIDER_ALIASES: Record<string, string> = {
  "kimi-": "moonshotai/",
  "gpt-": "openai/gpt-",
  "gemini-": "google/gemini-",
  "grok-": "x-ai/grok-",
  "deepseek-": "deepseek/",
  "qwen": "qwen/",
  "glm-": "z-ai/glm-",
  "mimo-": "xiaomi/mimo-",
  "minimax-": "minimax/",
  "hy3": "tencent/hy3",
  "nemotron-": "nvidia/nemotron-",
  "north-mini-": "cohere/north-mini-",
};

function enrichWithOpenRouter(enriched: EnrichedModel[], orModels: ORModel[]): void {
  for (const model of enriched) {
    const match = matchOR(model.ocId, orModels);
    if (match) {
      model.orId = match.id;
      model.orName = match.name;
      model.pricing = match.pricing
        ? { prompt: Number(match.pricing.prompt), completion: Number(match.pricing.completion) }
        : null;
      model.contextLength = match.context_length ?? match.top_provider?.context_length ?? null;
      const aa = match.benchmarks?.artificial_analysis;
      model.benchmarks = {
        intelligence: aa?.intelligence_index ?? null,
        coding: aa?.coding_index ?? null,
        agentic: aa?.agentic_index ?? null,
      };
      // Enrich reasoning support (effort levels OR toggle)
      if (match.reasoning) {
        model.reasoning = {
          supportedEfforts: match.reasoning.supported_efforts ?? [],
          defaultEffort: match.reasoning.default_effort ?? null,
          mandatory: match.reasoning.mandatory ?? false,
          defaultEnabled: match.reasoning.default_enabled ?? !match.reasoning.mandatory,
        };
      }
    }
  }
}

export function matchOR(ocId: string, orModels: ORModel[]): ORModel | null {
  // 1. Exact match
  const exact = orModels.find((m) => m.id.toLowerCase() === ocId.toLowerCase());
  if (exact) return exact;

  // 2. Provider alias
  for (const [prefix, replacement] of Object.entries(PROVIDER_ALIASES)) {
    if (ocId.startsWith(prefix)) {
      const aliased = ocId.replace(prefix, replacement);
      const match = orModels.find((m) => m.id.toLowerCase() === aliased.toLowerCase());
      if (match) return match;
    }
  }

  // 3. Substring match (single)
  const lower = ocId.toLowerCase();
  const subs = orModels.filter((m) => {
    const o = m.id.toLowerCase();
    return o.includes(lower) || lower.includes(o);
  });
  if (subs.length === 1) return subs[0];
  if (subs.length > 1) {
    subs.sort((a, b) => a.id.length - b.id.length);
    return subs[0];
  }

  return null;
}

// ---- Display name helpers -------------------------------------------------

function deriveProvider(ocId: string): string {
  const map: Record<string, string> = {
    deepseek: "DeepSeek", minimax: "MiniMax", kimi: "Kimi",
    qwen: "Qwen", glm: "GLM", grok: "Grok", mimo: "MiMo",
    hy3: "Hy3", claude: "Anthropic", gpt: "OpenAI",
    llama: "Meta", gemini: "Google", mistral: "Mistral",
    opencode: "OpenCode", big: "Big",
  };
  const lower = ocId.toLowerCase();
  for (const [prefix, display] of Object.entries(map)) {
    if (lower.startsWith(prefix)) return display;
  }
  return ocId.split("-")[0].replace(/^./, (c) => c.toUpperCase());
}

function deriveDisplayName(ocId: string): string {
  const provider = deriveProvider(ocId);
  const rest = ocId
    .replace(/^[a-z0-9]+-?/i, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return rest.trim() ? `${provider} ${rest.trim()}` : provider;
}
