# Guía Gentle AI — Criterios de Selección por Agente / Sub-Agente

> Extraído de la Guía Maestra v4 (Mayo 2026) + nuevos agentes del ecosistema Gentle AI.
> **Solo criterios y justificaciones. Sin tablas de modelos recomendados.**

---

## Filosofía y Metodología

- **Criterios primero, modelos después**: cada agente define QUÉ necesita (contexto, razonamiento, velocidad, costo) antes de elegir QUIÉN lo hace.
- **Regla estricta de distribución**: máximo 2 fases como principal por modelo. Forzamos diversidad de perspectivas.
- **Todos los proveedores representados**: OpenCode Go, OpenAI, Anthropic Claude, Google, NVIDIA, Free-OpenCode, Zen, GitHub Copilot Student.
- Cada elección con justificación detallada: no hay decisiones por intuición.

---

## Agentes SDD Originales

### sdd-orchestrator

**Criticidad: CRÍTICO** — Sistema nervioso del pipeline. Mínimo 1M ctx + máximo instruction following.

El cerebro central que lee el prompt, decide qué fases invocar, delega a sub-agentes y coordina el flujo completo. NO escribe código: su trabajo es ROUTING, DELEGACIÓN, COORDINACIÓN.

**CRITERIOS DE SELECCIÓN PARA ESTA FASE**
- Contexto extenso (mínimo 400K, idealmente 1M tokens): la sesión acumula tokens con cada tool call y fase
- Instruction following de máximo nivel: debe interpretar correctamente prompts ambiguos y decidir a qué agente delegar
- Capacidad de tool routing (MCP, function calling): decide qué herramienta llamar y con qué parámetros
- Coordinación de sub-agentes: debe mantener coherencia entre fases secuenciales y paralelas
- NO necesita máxima inteligencia de coding: DELEGA esa tarea a sdd-apply
- Estabilidad en sesiones largas (8+ horas): no debe perder el hilo cuando el contexto crece

**Justificación / Ejemplos comparativos**

El orchestrator no escribe código, su única función es interpretar el prompt y decidir a qué sub-agente delegar cada parte. Para esa tarea, el instruction following es el criterio único más importante, no la capacidad de coding.

*Ejemplo de razonamiento de selección:* GPT-5.5 combina el mejor instruction following del mercado (líder Terminal-Bench 2.0 con 82.7%) con un contexto de 1M tokens. Claude Opus 4.7 como alternativa es #1 en SWE-Pro (64.3%) y tiene el razonamiento más profundo, ideal cuando el routing requiere decisiones arquitectónicas complejas — pero su contexto de 200K limita sesiones muy largas. DeepSeek V4 Pro ofrece el mejor balance open-source: 1M ctx eficiente (arquitectura HCA que reduce FLOPs al 27% vs V3.2 a 1M tokens), agentic-optimized nativamente, y disponible vía OpenCode Go a costo predecible.

---

### sdd-init

**Criticidad: MEDIA** — Ingestión de contexto inicial. NO requiere alto razonamiento.

Ingesta el repositorio completo, documentación y requerimientos iniciales. El factor CRÍTICO es la ventana de contexto. El modelo debe leer y comprender — NO razonar profundamente.

**CRITERIOS DE SELECCIÓN PARA ESTA FASE**
- Ventana de contexto MASIVA (1M tokens idealmente): debe absorber repositorios enteros sin chunking
- Buena comprensión documental: debe entender estructura, dependencias, tecnologías usadas
- Velocidad alta: esta fase se ejecuta muchas veces durante el proyecto
- Costo bajo: alta frecuencia + tarea simple, no se justifica un modelo premium
- NO necesita razonamiento profundo: es lectura y comprensión, no resolución de problemas
- Tolerancia a alucinación cero en estructura del proyecto (un init mal hecho contamina todas las fases siguientes)

**Justificación / Ejemplos comparativos**

*Ejemplo de razonamiento de selección:* DeepSeek V4 Flash entrega la combinación específica que init exige: ventana de contexto máxima (1M tokens) + velocidad + bajo costo. Su 31,650 req/5h es el rate limit más alto del stack. NO usar GPT-5.5-Pro aquí: cuesta $30/1M input vs $0.40/1M del Flash (75x más caro) para una tarea de ingestión que NO requiere razonamiento profundo. El criterio fundamental que muchos sistemas malinterpretan es que init NO es una fase de inteligencia — es una fase de CAPACIDAD. Necesitamos un modelo que pueda tragar 800K tokens de código y devolver un resumen coherente, no uno que pueda resolver issues complejos. V4 Flash está a solo 1.6 puntos del V4 Pro en SWE-Verified (79.0% vs 80.6%) — para ingestión esa diferencia es invisible.

---

### sdd-onboard

**Criticidad: MEDIA** — Comprensión del estado actual del proyecto para un agente nuevo.

Introduce un agente nuevo al proyecto: lee specs existentes, memoria Engram y árbol del repositorio. Diferente a init: onboard necesita ENTENDER el estado, no solo ingerirlo.

**CRITERIOS DE SELECCIÓN PARA ESTA FASE**
- Contexto largo (idealmente 1M): debe leer specs + Engram + estructura completa
- Comprensión documental superior: debe entender DECISIONES previas, no solo descripciones
- Razonamiento moderado: debe deducir el estado del proyecto desde fragmentos
- Coherencia entre múltiples fuentes: specs, código, memoria deben converger en un modelo mental único
- Se ejecuta pocas veces por proyecto: el presupuesto puede ser ligeramente más alto que init

**Justificación / Ejemplos comparativos**

La diferencia clave vs init: init solo necesita ABSORBER el contexto, onboard necesita ENTENDER las decisiones previas. Por eso se usa un modelo con más capacidad analítica en lugar de uno con más capacidad bruta.

*Ejemplo de razonamiento de selección:* DeepSeek V4 Pro combina 1M ctx (puede leer specs + Engram + repo de una vez) con comprensión sólida (líder open-source en GDPval-AA, que mide trabajo profesional complejo). Es ligeramente más caro que el Flash pero la calidad adicional vale la pena para una fase que define el modelo mental del agente nuevo. GPT-5.4 como alternativa entra cuando V4 Pro está saturado por orchestrator/explore (comparten proveedor): 1M ctx + razonamiento sólido + costo controlado ($2.50/1M).

---

### sdd-explore

**Criticidad: ALTA** — Análisis profundo del codebase. Descomposición multi-paso de cadenas de impacto.

Analiza el codebase para detectar cadenas de rotura: "si toco A, se rompe B, lo que afecta C". Kimi K2.6 es el principal porque su Agent Swarm (300 sub-agentes coordinados, 4,000 pasos) está DISEÑADO precisamente para esta descomposición multi-paso. Mapear dependencias en cadena es exactamente un problema de coordinación multi-agente.

**CRITERIOS DE SELECCIÓN PARA ESTA FASE**
- Descomposición multi-paso (cadena A→B→C→D): encaja perfecto con arquitecturas Agent Swarm
- Razonamiento sobre código existente: comprende lógica de negocio, no solo sintaxis
- Detección de efectos secundarios sutiles entre módulos
- Comprensión arquitectónica de codebases reales (no juguetes)
- Long context suficiente (256K cubre análisis típicos; 1M para codebases enormes)
- Performance probada en SWE-Bench Pro (GitHub issues reales)

**Justificación / Ejemplos comparativos**

*Ejemplo de razonamiento de selección:* Kimi K2.6 tiene una razón específica de diseño: su Agent Swarm fue construido para coordinar 300 sub-agentes en 4,000 pasos. Mapear dependencias en código (A rompe B, que afecta C, que impacta D) es literalmente un problema de descomposición multi-paso. Su 58.6% SWE-Pro está al mismo nivel que GPT-5.5 y solo 6 puntos por debajo de Opus 4.7. Para análisis de código existente (no para coding production), esa diferencia es invisible en la práctica. Y a $0.95/1M vs $5/1M de Opus, es 5x más barato.

¿Por qué NO usar Opus aquí? Por el principio ARCHITECT=BUILDER. Opus es el #1 absoluto del mercado — debe ir donde más impacto tiene: en propose (diseñar la arquitectura) Y en apply (implementarla). Que el mismo modelo diseñe Y construya elimina la pérdida de información entre las dos fases. Si Opus también hace explore, se gasta uno de sus dos usos disponibles en análisis (donde Kimi K2.6 es suficiente) en lugar de en propose (donde nadie lo iguala).

---

### sdd-propose

**Criticidad: CRÍTICO** — Propone la arquitectura. Mayor impacto a largo plazo. ARCHITECT = BUILDER.

Propone la arquitectura: Clean vs Hexagonal, DI vs Singleton, microservicios vs monolito. Una propuesta mala genera meses de deuda técnica.

**CRITERIOS DE SELECCIÓN PARA ESTA FASE**
- Razonamiento arquitectónico de máximo nivel (#1 del mercado idealmente)
- Capacidad de evaluar trade-offs (no hay UNA respuesta correcta en arquitectura)
- Conocimiento profundo de patrones de diseño (SOLID, GRASP, GoF)
- Comprensión de implicaciones a largo plazo (escalabilidad, mantenibilidad, deuda técnica)
- COHERENCIA con apply: idealmente el mismo modelo que diseña, implementa (principio architect=builder)
- Contexto moderado suficiente (200K — trabaja sobre el resumen de explore, no el codebase entero)

**Justificación / Ejemplos comparativos**

PRINCIPIO ARCHITECT = BUILDER: La elección del modelo para propose ES intencionalmente la misma que para apply. La razón es coherencia: el modelo que diseña la arquitectura es el mismo que la implementa. Cero pérdida de información en la "traducción" entre el spec arquitectónico y el código. El arquitecto entiende perfectamente la intención de cada decisión porque él mismo la tomó. En desarrollo de software, esto es objetivamente mejor que dos cerebros distintos (uno diseña, otro implementa) — incluso si ambos son top tier.

*Ejemplo de razonamiento de selección:* Claude Opus 4.7 es #1 SWE-Pro absoluto del mercado (64.3%). Para una fase donde el criterio único es la calidad del razonamiento arquitectónico, no hay otra opción defendible. Kimi K2.6 como alternativa mantiene calidad arquitectónica alta (58.6% SWE-Pro, mismo nivel que GPT-5.5) cuando Opus está saturado. Su Agent Swarm es excelente para evaluar trade-offs complejos donde cada decisión tiene sub-implicaciones.

---

### sdd-spec

**Criticidad: ALTA** — Documento técnico que el modelo de apply leerá. Coherencia crítica.

Escribe el documento técnico: plan de archivos, criterios de aceptación, contratos de API.

**CRITERIOS DE SELECCIÓN PARA ESTA FASE**
- Especialización en escritura técnica + código (no es escritura general)
- Seguimiento estricto de plantillas Markdown
- Coherencia perfecta con el output de propose (la spec implementa la arquitectura)
- Generación de contratos de API correctos (tipos, parámetros, errores)
- Output estructurado predecible (el modelo de apply leerá esto, no humanos)
- Velocidad moderada: la spec se escribe una vez por feature

**Justificación / Ejemplos comparativos**

*Ejemplo de razonamiento de selección:* GPT-5.3-Codex fue construido específicamente para el ecosistema de desarrollo. A diferencia de modelos generalistas, Codex entiende nativamente la estructura de contratos de API, planes de archivos y criterios de aceptación. Su 77.3% Terminal-Bench supera a GLM-5.1 por +14 puntos, lo que indica comprensión profunda del flujo de desarrollo. Su 1M de contexto le permite leer toda la propuesta de explore + propose para generar specs perfectamente coherentes. Claude Sonnet 4.5 como alternativa es objetivamente excelente para escritura técnica: 79.6% SWE-Verified (muy cerca de Opus a 1/5 del precio). Su calidad documental es superior cuando la spec requiere mucha narrativa explicativa, no solo estructura.

---

### sdd-design

**Criticidad: MEDIA** — Diseño de componentes UI/UX. Gemini es insustituible aquí.

Estructura componentes UI/UX, layouts, Atomic Design, componentes React/Angular. Analiza maquetas si se proporcionan. Gemini 3.1 Pro tiene una brecha del +17% en MMMU-Pro sobre el segundo mejor — esto es estructural, no marginal.

**CRITERIOS DE SELECCIÓN PARA ESTA FASE**
- Especialización VISUAL/MULTIMODAL (este es el criterio único más importante)
- Comprensión nativa de imágenes y maquetas
- Razonamiento espacial (cómo se relacionan elementos en una UI)
- Comprensión de patrones de diseño UI (Atomic Design, Material, etc.)
- Capacidad de generar componentes React/Angular/Vue funcionales
- Contexto suficiente para leer la propuesta completa

**Justificación / Ejemplos comparativos**

*Ejemplo de razonamiento de selección:* Gemini 3.1 Pro lidera MMMU-Pro con 82.8% vs 70.4% de GPT-5.5 — una brecha estructural del +17% que es consistente en múltiples benchmarks visuales (incluido ARC-AGI-2 para razonamiento espacial). Para una fase donde el criterio único más importante es comprensión visual y multimodal, Gemini no tiene rival real en el stack. GPT-5.5 como alternativa es el segundo mejor visual del stack. La brecha es real pero GPT-5.5 sigue siendo competente — solo no tan bueno como Gemini específicamente en esta dimensión. Claude Sonnet 4.5 tiene comprensión visual razonable y es excelente generando código de componentes React/Vue después de analizar diseños.

---

### sdd-tasks

**Criticidad: BAJA** — Particionar la spec en tickets. Velocidad > inteligencia.

Particiona la spec en tareas/tickets/JSON estructurado. Esta es una fase de FORMAT FOLLOWING, no de razonamiento. El criterio único es velocidad y costo mínimo.

**CRITERIOS DE SELECCIÓN PARA ESTA FASE**
- VELOCIDAD máxima (criterio único más importante)
- Format following confiable (JSON schema, listas numeradas)
- Costo mínimo: esta fase corre frecuentemente
- NO requiere razonamiento profundo en absoluto
- Contexto moderado (suficiente para leer la spec)

**Justificación / Ejemplos comparativos**

*Ejemplo de razonamiento de selección:* GPT-5.4-mini-fast es literalmente el modelo más rápido y económico de OpenAI (~$0.35/1M). Para una fase donde la inteligencia raw no aporta valor — solo necesitamos partir una spec en JSON — la velocidad y el costo son los únicos criterios que importan. Usar GPT-5.5 aquí sería como pagar un taxi de lujo para cruzar la calle. DeepSeek V4 Flash como alternativa ofrece el mayor rate limit del stack (31,650 req/5h) sin costo de API adicional (parte de OpenCode Go).

---

### sdd-apply

**Criticidad: CRÍTICO** — El código real. Necesita el MEJOR modelo de coding del mercado.

Implementa el código siguiendo spec y diseño.

**CRITERIOS DE SELECCIÓN PARA ESTA FASE**
- MÁXIMA capacidad de coding del mercado (criterio único más importante)
- Comprensión arquitectónica (SOLID, patrones, Clean/Hexagonal)
- Coherencia en sesiones largas (8h de ejecución autónoma si es necesario)
- Contexto suficiente para leer spec + diseño + código relacionado
- Performance probada en GitHub issues reales (SWE-Bench Pro)
- Capacidad de mantener estilo consistente con el codebase existente

**Justificación / Ejemplos comparativos**

*Ejemplo de razonamiento de selección:* Claude Opus 4.7 es objetivamente el mejor modelo de coding del mercado: lidera tanto SWE-Pro (64.3% issues reales en 4 lenguajes) como SWE-Verified (87.6% subset Python validado). Para apply, donde el criterio único es la calidad del código generado, no hay otra opción defensible. GPT-5.3-Codex como alternativa es el especialista de OpenAI en agentic coding: su 77.3% Terminal-Bench supera a GLM-5.1 por +14 puntos, ideal cuando el código requiere mucha interacción con terminal/DevOps. GLM-5.1 es el mejor open-source: 58.4% SWE-Pro supera a GPT-5.4 (57.7%) y Claude Opus 4.6 (57.3%), diseñado específicamente para 8 horas de ejecución autónoma sin estancarse (patrón staircase).

---

### sdd-verify

**Criticidad: CRÍTICO** — La última línea de defensa. Necesita MÁXIMO razonamiento.

Audita el código de apply. Detecta bugs, vulnerabilidades, violaciones de SOLID, errores de lógica de negocio. Es la ÚLTIMA oportunidad de capturar errores antes de producción.

**CRITERIOS DE SELECCIÓN PARA ESTA FASE**
- MÁXIMO razonamiento disponible (Senior Auditor mental)
- Profundidad de análisis (no solo sintaxis: lógica de negocio, seguridad, performance)
- DIFERENTE al modelo de apply (principio de separación autor≠auditor)
- Detección de bugs sutiles, race conditions, edge cases
- Comprensión de SOLID, vulnerabilidades OWASP, anti-patterns
- Long context para leer la implementación completa + tests

**Justificación / Ejemplos comparativos**

*Ejemplo de razonamiento de selección:* GPT-5.5-Pro tiene la mayor capacidad de razonamiento disponible en el stack: "GPT-5.5 Pro earns its keep on research tasks, hard math, and the deepest BrowseComp searches (90.1% vs 83.4% on standard)". Para verify, donde el criterio único es detectar lo que el modelo de apply pasó por alto, MÁS razonamiento siempre es mejor. El costo ($30/1M input) se justifica porque un bug capturado aquí ahorra horas de debugging en producción.

Claude Opus 4.7 como alternativa está específicamente recomendado para code review: "Use Claude Opus 4.7 for code review and repository-level reasoning". Es #1 SWE-Pro. La única razón por la que no es el principal aquí es la regla de no usar el mismo modelo más de 2 veces (Opus ya está en explore + apply). DeepSeek V4 Pro como alternativa ofrece tres ventajas críticas: (1) es DIFERENTE al modelo de apply, manteniendo el principio de separación; (2) tiene 1M ctx para leer la implementación completa + todos los tests + dependencias; (3) soporta nativamente reasoning mode "Think Max" para análisis más profundo del normal.

---

### sdd-archive

**Criticidad: BAJA** — Compresión de texto administrativa. Costo cero es el ideal.

Resume el trabajo realizado y lo guarda en memoria Engram. Tarea 100% administrativa.

**CRITERIOS DE SELECCIÓN PARA ESTA FASE**
- Costo mínimo absoluto (idealmente cero): criterio único más importante
- Velocidad alta: corre al final de cada feature
- Compresión de texto adecuada (resumir logs largos)
- NO requiere razonamiento: cero tokens de thinking
- Disponibilidad alta: no debe bloquear el cierre del pipeline

**Justificación / Ejemplos comparativos**

*Ejemplo de razonamiento de selección:* OpenCode Zen cumple PERFECTAMENTE el criterio único de esta fase: costo absoluto cero. Es el modelo nativo del ecosistema OpenCode, diseñado precisamente para tareas administrativas como esta. No tiene sentido pagar tokens premium ($5/1M de GPT-5.5) para comprimir un log que nadie va a leer críticamente. GPT-5.4-mini-fast como alternativa es la versión paga más económica (~$0.35/1M).

---

## Agentes de Review (4R + Refuter)

Estos agentes NO están en la Guía Maestra v4. Son parte del sistema de bounded review de Gentle AI.

### review-risk (R1 — Risk Reviewer)

**Criticidad: CRÍTICO** — Seguridad, permisos, exposición de datos. Puede bloquear un merge.

Inspecciona el diff candidato en busca de vulnerabilidades de seguridad, escalamiento de privilegios, exposición de datos, manejo inseguro de inputs, secrets, y riesgos en dependencias. Requiere backend enforcement y evidencia de exploit concreta o scanner — no reporta riesgo hipotético sin impacto alcanzable.

**CRITERIOS DE SELECCIÓN PARA ESTA FASE**
- Conocimiento profundo de seguridad (OWASP Top 10, CWE, vulnerabilidades comunes)
- Capacidad de distinguir riesgo real de riesgo hipotético (requiere evidencia concreta)
- Comprensión de boundaries de privilegio y flujos de datos sensibles
- Read-only: no modifica código, solo reporta hallazgos
- DIFERENTE al modelo de apply (principio de separación autor≠auditor)
- Contexto suficiente para leer el diff completo + dependencias relevantes

**Razonamiento para la selección**

A diferencia de verify (que audita lógica de negocio, SOLID, y bugs generales), review-risk se enfoca EXCLUSIVAMENTE en seguridad y exposición de datos. Necesita un modelo con conocimiento específico de patrones de ataque, no solo capacidad general de razonamiento. La evidencia debe ser concreta (cambió un hunk, exploit alcanzable, scanner output), no especulación. Como es read-only y se ejecuta por cada cambio que toca superficies de seguridad, el costo importa pero no debe sacrificar precisión: un falso negativo aquí es peligroso, un falso positivo bloquea el pipeline innecesariamente.

---

### review-readability (R2 — Readability Reviewer)

**Criticidad: MEDIA** — Naming, complejidad, intención, mantenibilidad.

Inspecciona defectos de mantenibilidad que oscurecen el comportamiento: nombres engañosos, lógica duplicada o muerta, constantes de negocio no explicadas, complejidad insegura, y contexto de cambio faltante. Reporta estilo SOLO cuando esconde un defecto concreto o hace el cambio inseguro de mantener.

**CRITERIOS DE SELECCIÓN PARA ESTA FASE**
- Juicio de naming y estructura (no es sintaxis, es semántica e intención)
- Detección de código muerto, duplicación, y complejidad innecesaria
- Capacidad de distinguir preferencia de estilo de defecto real
- Read-only, una sola pasada sobre el diff
- Costo moderado: se ejecuta en todo diff estándar, no solo en hot paths

**Razonamiento para la selección**

La diferencia clave entre readability y los otros reviewers: readability NO busca bugs de comportamiento, busca código que es DIFÍCIL de mantener y por lo tanto PROPENSO a bugs futuros. El modelo necesita "olfato" para código que técnicamente funciona pero está mal estructurado. No necesita el razonamiento más profundo del mercado (eso va a verify/review-risk), pero sí necesita buen juicio de diseño de software. Un modelo demasiado "inteligente" puede sobre-pensar y reportar preferencias de estilo como defects; uno demasiado simple puede pasar por alto problemas reales de mantenibilidad.

---

### review-reliability (R3 — Reliability Reviewer)

**Criticidad: ALTA** — Comportamiento, tests, edge cases, determinismo, contratos, regresiones.

Inspecciona comportamiento, tests, boundaries, inputs inválidos, caminos de fallo, determinismo, y regresiones. Requiere assertions observables externamente al nivel de test más barato y útil; reporta cobertura faltante SOLO cuando deja comportamiento candidato sin probar.

**CRITERIOS DE SELECCIÓN PARA ESTA FASE**
- Mentalidad behavior-first: piensa en términos de "qué debería pasar", no "qué dice el código"
- Detección de edge cases e inputs inválidos que el autor no consideró
- Comprensión de contratos (precondiciones, postcondiciones, invariantes)
- Capacidad de evaluar si los tests existentes realmente prueban el comportamiento nuevo
- Determinismo: detecta flakiness potencial (timing, random, orden de ejecución)

**Razonamiento para la selección**

Review-reliability es el complemento perfecto de review-readability: readability mira la FORMA del código, reliability mira el COMPORTAMIENTO. Necesita un modelo que piense como un tester senior: "si yo paso este input raro, ¿qué pasa?", "¿esta función es determinista?", "¿el test realmente prueba el caso de borde o solo hace code coverage?". No necesita el razonamiento mega-profundo de verify (que audita todo el diff), pero sí necesita ser minucioso dentro de su scope — y diferente al modelo de apply.

---

### review-resilience (R4 — Resilience Reviewer)

**Criticidad: ALTA** — Fallbacks, retry/backoff, degradación graceful, observabilidad, carga, rollback, SLOs.

Inspecciona manejo de fallos, comportamiento de rollback o fix-forward, seguridad de retries, degradación graceful, observabilidad, latencia, y carga. Requiere un modo de fallo de producción concreto o impacto medido; no reporta especulación operacional genérica.

**CRITERIOS DE SELECCIÓN PARA ESTA FASE**
- Comprensión de sistemas distribuidos y modos de fallo en producción
- Conocimiento de patrones de resiliencia: circuit breaker, retry con backoff, bulkhead, timeout
- Capacidad de evaluar Observability (logs, métricas, traces) generada por el cambio
- Detección de riesgos de SLO: ¿este cambio aumenta latencia? ¿consume más recursos?
- Evaluación de estrategias de rollback: ¿se puede revertir este cambio sin pérdida de datos?

**Razonamiento para la selección**

Review-resilience es el más "SRE-minded" de los cuatro. No le importa si el código es bonito (readability), si los tests pasan (reliability), o si hay vulnerabilidades (risk) — le importa si el sistema SE ROMPE en producción y cómo se recupera. Necesita un modelo que entienda patrones de fallo del mundo real: ¿qué pasa si la API externa devuelve 429? ¿si la DB está lenta? ¿si hay un pico de tráfico? Las respuestas deben ser concretas ("este retry sin backoff va a causar un thundering herd") no genéricas ("considerar agregar manejo de errores").

---

### review-refuter (Refuter — Batched Adversarial Review)

**Criticidad: ALTA** — Evalúa findings BLOCKER/CRITICAL de los 4R. Read-only, un lote por transacción.

Recibe todos los claims severos inferenciales de los cuatro reviewers, los evalúa uno por uno, y devuelve corroborado | refutado | inconcluso para cada finding. No agrega findings nuevos, no modifica código, y termina después de una pasada.

**CRITERIOS DE SELECCIÓN PARA ESTA FASE**
- Capacidad de evaluar evidencia adversarialmente: "¿este claim realmente se sostiene?"
- Rigor lógico: distinguir correlación de causalidad en las pruebas presentadas
- DIFERENTE a los modelos de los 4R (principio de refutación independiente)
- Read-only, sin acceso a escritura
- Rápido: procesa un lote de findings en una sola pasada

**Razonamiento para la selección**

El refuter es un "juez de hallazgos", no un reviewer. Su trabajo no es encontrar problemas nuevos sino evaluar si los problemas reportados por otros son REALES. Necesita un modelo con pensamiento crítico y capacidad de decir "no, esta evidencia no prueba lo que el reviewer dice que prueba". Como trabaja sobre findings ya reportados (no sobre el diff completo), su ventana de contexto es más chica. Debe ser un modelo DIFERENTE a los 4R para garantizar independencia real en la evaluación.

---

## Agentes de Judgment Day

El protocolo Judgment Day es una revisión adversarial de último recurso para cambios de altísimo riesgo. Usa dos jueces ciegos independientes + un agente de corrección quirúrgica.

### jd-judge-a y jd-judge-b (Blind Judges)

**Criticidad: CRÍTICO** — Revisión adversarial ciega con proof requirements estrictos.

Cada juez inspecciona el target inmutable de forma independiente y ciega (no ven el output del otro juez). Reportan SOLO defects reales con impacto al usuario. Cada finding severo debe probar si el candidato introdujo, activó, o empeoró el comportamiento, citando changed-hunk, differential-test, candidate-created-path, o before/after proof. Defectos no cambiados se marcan como pre-existing o base-only.

**CRITERIOS DE SELECCIÓN PARA ESTA FASE**
- MÁXIMA capacidad de razonamiento adversarial (son la última barrera)
- DEBEN ser modelos DIFERENTES entre sí (diversidad de criterio — si ambos son el mismo modelo, no hay verdadera revisión independiente)
- Read-only: no modifican código bajo ninguna circunstancia
- Rigor probatorio: BLOCKER/CRITICAL requiere concrete causal proof, no sospecha
- Capacidad de distinguir defects introducidos de pre-existentes (causalidad, no correlación)

**Razonamiento para la selección**

La regla MÁS importante para Judgment Day: **los dos jueces DEBEN ser modelos distintos.** Si ambos son Claude Opus 4.7, van a tener los mismos sesgos, los mismos puntos ciegos, y van a fallar en detectar las mismas cosas. La diversidad de arquitectura de modelo es la única garantía real de revisión independiente.

*Ejemplo de pairing efectivo:* Juez A = DeepSeek V4 Pro (razonamiento profundo, 1M ctx, open-source) + Juez B = Qwen 3.7 Plus (arquitectura y training data completamente diferentes). Dos modelos con filosofías distintas ven el mismo código desde ángulos diferentes — lo que uno pasa por alto, el otro puede detectar.

---

### jd-fix-agent (Surgical Fix Agent)

**Criticidad: ALTA** — Correcciones quirúrgicas de issues confirmados por los jueces.

Ejecuta EXACTAMENTE las instrucciones de fix proporcionadas. NO delega, NO refactoriza más allá de lo estrictamente necesario, y solo corrige los issues CONFIRMADOS listados en el task prompt.

**CRITERIOS DE SELECCIÓN PARA ESTA FASE**
- Instruction following PRECISO: debe ejecutar exactamente lo que se le pide, sin creatividad
- Capacidad de coding sólida pero NO creativa: corrige bugs, no reinventa
- Contexto suficiente para entender el fix y su impacto local
- Rápido: son correcciones puntuales, no implementaciones completas
- NO debe ser el mismo modelo que los jueces (separación de roles)

**Razonamiento para la selección**

El fix agent es un CIRUJANO, no un arquitecto. Su trabajo es corregir issues puntuales confirmados por los jueces, no repensar el diseño. Necesita un modelo con buen instruction following y capacidad de coding, pero que no sea CREATIVO — un modelo demasiado "inteligente" podría decidir "mejorar" cosas que no debería tocar, introduciendo nuevos bugs. Debe ser diferente a los jueces para mantener la separación de roles: el que encuentra el problema no es el que lo arregla (segregation of duties).

---

## Resumen de Criterios por Tipo de Tarea

| Tipo de tarea | Criterio dominante | Ejemplo de agente |
|:---|:---|:---|
| Coordinación / Routing | Instruction following + contexto largo | orchestrator |
| Ingestión de contexto | Ventana de contexto masiva + bajo costo | init |
| Comprensión de estado | Contexto largo + razonamiento moderado | onboard |
| Análisis multi-paso | Descomposición + razonamiento sobre código | explore |
| Diseño arquitectónico | Máximo razonamiento + COHERENCIA con apply | propose |
| Escritura técnica | Especialización en código + output estructurado | spec |
| Diseño UI/UX | Especialización VISUAL/MULTIMODAL | design |
| Partición de tareas | Velocidad + format following + costo mínimo | tasks |
| Implementación | MÁXIMA capacidad de coding | apply |
| Auditoría general | MÁXIMO razonamiento + DIFERENTE al autor | verify |
| Seguridad | Conocimiento de vulnerabilidades + evidencia concreta | review-risk |
| Mantenibilidad | Juicio de estructura + detección de código muerto | review-readability |
| Comportamiento | Mentalidad behavior-first + edge cases | review-reliability |
| Resiliencia | Patrones de fallo en producción + SRE mindset | review-resilience |
| Refutación | Rigor lógico + independencia de los 4R | review-refuter |
| Juicio adversarial ciego | Diversidad de modelos + proof requirements | jd-judge-a/b |
| Corrección quirúrgica | Instruction following preciso + no creatividad | jd-fix-agent |
| Bookkeeping | Costo mínimo + velocidad | archive |
