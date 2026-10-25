# Integraciones: cómo usa un bot o agente el planeador

Mismo núcleo (`lib/viaje.mjs`) para todas las vías. Elige la que tu plataforma soporte.

| Plataforma | Vía recomendada | Qué ve el usuario |
|---|---|---|
| Claude (claude.ai, Desktop, Code), ChatGPT, VS Code, Goose | **MCP remoto** `https://bogota-al-dia.vercel.app/api/mcp` | Vista interactiva del viaje (MCP Apps) o texto |
| Grok / xAI API, OpenAI API, Gemini, Groq, Mistral | **Function calling** con `/tools.json` + `POST /api/tools/<nombre>` (o MCP remoto si la API lo soporta) | Texto del modelo con los datos |
| WhatsApp, Telegram, Slack, Siri Shortcuts, bots propios | **GET** `/api/viaje?origen=..&destino=..&formato=texto` | Mensaje listo para enviar |
| Web | `/viaje/` (formulario sin JS) | Página |

## MCP remoto (con vista)

```bash
claude mcp add --transport http bogota-al-dia https://bogota-al-dia.vercel.app/api/mcp
```

`planear_viaje` declara `_meta.ui.resourceUri = ui://bogota-al-dia/viaje.html` (extensión `io.modelcontextprotocol/ui`). Los hosts con MCP Apps muestran la vista; los demás reciben el texto en `content` y el JSON en `structuredContent`.

## Function calling (Grok, OpenAI, Gemini…)

1. Descarga las definiciones: `GET https://bogota-al-dia.vercel.app/tools.json` → `tools[]` en formato OpenAI (`type: "function"`).
2. Pásalas al modelo. Cuando pida una herramienta, ejecútala:

```js
const r = await fetch(`https://bogota-al-dia.vercel.app/api/tools/${call.name}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: call.arguments, // string JSON tal como lo da el modelo
});
const { resultado, texto } = await r.json(); // `texto` viene listo para chat en planear_viaje
```

Ejemplo con la API de xAI (compatible con el SDK de OpenAI):

```js
import OpenAI from 'openai';
const xai = new OpenAI({ baseURL: 'https://api.x.ai/v1', apiKey: process.env.XAI_API_KEY });
const { tools } = await (await fetch('https://bogota-al-dia.vercel.app/tools.json')).json();
const res = await xai.chat.completions.create({
  model: 'grok-4', // el modelo que uses
  messages: [{ role: 'user', content: '¿Cómo llego de Portal Norte a la Calle 26 mañana a las 7?' }],
  tools,
});
// Por cada res.choices[0].message.tool_calls → POST /api/tools/<name> y devuelve el resultado como mensaje role:"tool"
```

Consejos para el prompt del bot:
- Si el usuario da una dirección, geocodifícala y pasa `"lat,lon"` como `origen`/`destino`.
- "Mañana a las 7" → `fecha` y `hora` en hora de Colombia.
- Muestra máximo 2 o 3 opciones, con vagón y puerta, y aclara que son horarios programados.

## WhatsApp / Telegram (sin LLM)

```bash
curl -L 'https://bogota-al-dia.vercel.app/api/viaje/?origen=Portal%20Norte&destino=Calle%2026&formato=texto'
```

Devuelve un mensaje con emojis y saltos de línea, listo para reenviar. Errores: HTTP 400 con el motivo en texto.

## Otras ciudades

Todas las herramientas aceptan `ciudad` (nombre o código DIVIPOLA). `cobertura_transporte` dice cuáles están disponibles. Para agregar una, ver `.claude/agents/ciudades-expert.md`.
