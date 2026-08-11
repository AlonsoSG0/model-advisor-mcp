# model-advisor-mcp

<p align="center">
  <a href="README.md">English version</a>
  ·
  <a href="guia_gentle_ai.md">Criterios de selección (guía)</a>
</p>

> **📢 Aporte comunitario** — Las recomendaciones de este MCP están diseñadas para los agentes del harness [Gentle AI](https://github.com/Gentleman-Programming/gentle-ai). Este es un proyecto independiente creado para ayudar a la comunidad a elegir los mejores modelos para cada agente. No está afiliado oficialmente con Gentle AI ni con OpenCode.

Servidor MCP que ayuda a los LLMs a elegir el mejor modelo de IA para cada agente de coding. Obtiene datos en tiempo real de los catálogos públicos de modelos OpenCode Go/Zen y los cruza con benchmarks y capacidades de razonamiento de OpenRouter.

> ⚠️ **Aviso**: El paquete aún no está publicado en npm. La instalación solo está disponible clonando el repositorio (ver [Opción B: Manual](#opción-b-manual-desarrollo)). El soporte para `npm install -g model-advisor-mcp` llegará próximamente.

## Qué hace

- Lista todos los modelos disponibles en las suscripciones **OpenCode Go y/o Zen**
- Los enriquece con **benchmarks de OpenRouter** (inteligencia, coding, agentic), precios y ventana de contexto
- Muestra el **soporte de razonamiento** — si el modelo tiene niveles explícitos (`xhigh`, `high`, `low`) o solo un toggle on/off
- Lee los **criterios de selección** de la guía Gentle AI para que el LLM sepa qué necesita cada agente antes de elegir modelo
- Recomienda modelos por agente basándose en datos reales, no en suposiciones

## Instalación

### Opción A: npm (recomendado)

```bash
npm install -g model-advisor-mcp
```

Luego, configúralo en OpenCode (consulta [Configuración](#configuración)).

### Opción B: Manual (desarrollo)

```bash
git clone https://github.com/AlonsoSG0/model-advisor-mcp.git
cd model-advisor-mcp
pnpm install
pnpm build
```

## Requisitos

- **Node.js 18+**

**No se requieren API keys.** Los catálogos de modelos de OpenCode (Zen/Go) y OpenRouter son endpoints públicos; el servidor hace solicitudes sin autenticación y funciona tal cual.

## Configuración

No se necesitan variables de entorno ni API keys. El servidor consulta los catálogos públicos de modelos de OpenCode (Zen y Go) y OpenRouter sin credenciales.

Agrega lo siguiente a tu `opencode.json` o `opencode.jsonc`:

```jsonc
{
  "mcp": {
    "model-advisor": {
      "type": "local",
      "command": [
        "node",
        "/ruta/a/model-advisor-mcp/dist/server.js"
      ],
      "cwd": "/ruta/a/model-advisor-mcp",
      "enabled": true,
      "timeout": 30000
    }
  }
}
```

Si instalaste vía npm (`npm install -g model-advisor-mcp`):

```jsonc
{
  "mcp": {
    "model-advisor": {
      "type": "local",
      "command": ["model-advisor-mcp"],
      "enabled": true,
      "timeout": 30000
    }
  }
}
```

## Inicio rápido y ejemplos

Después de instalar y configurar el MCP:

1. Verifica en la terminal que el ejecutable instalado globalmente esté disponible:

   ```bash
   command -v model-advisor-mcp
   ```

   El comando debe devolver la ruta del ejecutable. Si hiciste una instalación manual, este paso no aplica: OpenCode usa la ruta a `dist/server.js` configurada arriba.

2. Reinicia OpenCode para que cargue la configuración y verifica el estado de la conexión:

   ```bash
   opencode mcp list
   ```

   `model-advisor` debe aparecer conectado.
3. Envía uno de estos prompts a tu agente u orquestador de IA. **No son comandos de terminal**:

   > Usando el MCP model-advisor, dime qué modelos hay disponibles en las suscripciones OpenCode Go y Zen.

   > Usando el MCP model-advisor, dame una recomendación low cost usando solamente modelos de OpenCode Go.

Si el agente puede listar modelos o generar una recomendación usando datos del MCP, la conexión funciona correctamente.

## Herramientas

### `list_available_models`

Obtiene todos los modelos de IA de los catálogos OpenCode Go y/o Zen, enriquecidos con OpenRouter.

**Parámetros:**

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `subscription` | `"go"` \| `"zen"` \| `"both"` | `"both"` | Qué suscripción consultar |
| `enrich` | `boolean` | `true` | Poner `false` para omitir OpenRouter (más rápido) |

**Devuelve por cada modelo:**

| Campo | Descripción |
|-------|-------------|
| `ocId` / `ocName` / `ocProvider` | Identidad del modelo |
| `pricing` | Costo input/output por 1M tokens (USD) |
| `contextLength` | Ventana de contexto máxima en tokens |
| `benchmarks` | Puntajes de inteligencia, coding y agentic (Artificial Analysis) |
| `reasoning` | Niveles de esfuerzo disponibles (`supportedEfforts`) y defaults |
| `subscription` | A qué suscripción(es) pertenece el modelo |

**Ejemplo de reasoning:**

```json
// Modelo con niveles de esfuerzo explícitos
"reasoning": {
  "supportedEfforts": ["xhigh", "high"],
  "defaultEffort": "high",
  "mandatory": false,
  "defaultEnabled": true
}

// Modelo con toggle on/off
"reasoning": {
  "supportedEfforts": [],
  "defaultEffort": null,
  "mandatory": false,
  "defaultEnabled": true
}

// Modelo sin razonamiento
"reasoning": null
```

### `get_agent_criteria`

Lee los criterios de selección de agentes de la guía Gentle AI. Usa esta herramienta **antes** de elegir modelo: cada agente tiene necesidades específicas (contexto, razonamiento, velocidad y costo).

**Parámetros:**

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `agent` | `string` | (guía completa) | ID del agente a filtrar. Omitir para obtener todos. |

**IDs de agentes:** `gentle-orchestrator`, `sdd-init`, `sdd-onboard`, `sdd-explore`, `sdd-propose`, `sdd-spec`, `sdd-design`, `sdd-tasks`, `sdd-apply`, `sdd-verify`, `sdd-archive`, `review-risk`, `review-readability`, `review-reliability`, `review-resilience`, `review-refuter`, `jd-judge-a`, `jd-judge-b`, `jd-fix-agent`

**Grupos de agentes** (mostrar recomendaciones en este orden):
1. Orchestrator
2. Agentes SDD
3. Review (4R)
4. Judgment Day

### `get_model_benchmarks`

Búsqueda detallada de un modelo específico en OpenRouter. Útil cuando `list_available_models` no trajo benchmarks para un modelo.

**Parámetros:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `query` | `string` (requerido) | ID o nombre del modelo (ej. `"deepseek-v4-pro"`, `"kimi"`) |

## Cómo usa el LLM estas herramientas

El flujo típico:

1. **`list_available_models`** → ve qué hay disponible, sus benchmarks y soporte de razonamiento
2. **`get_agent_criteria`** (por agente) → entiende qué necesita cada agente
3. **`get_model_benchmarks`** (opcional) → datos más profundos de un modelo específico
4. **El LLM razona** → empareja modelos con agentes según criterios + benchmarks + costo

## Desarrollo

```bash
# Instalar dependencias
pnpm install

# Compilar TypeScript
pnpm build

# Ejecutar directo (para pruebas)
pnpm start

# Modo watch (recarga automática)
pnpm dev
```
