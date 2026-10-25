# Integrations: how a bot or agent uses the trip planner

The same core (`lib/trip.mjs`) backs every channel. Pick the one your platform supports.

| Platform | Recommended channel | What the user sees |
|---|---|---|
| Claude (claude.ai, Desktop, Code), ChatGPT, VS Code, Goose | **Remote MCP** `https://bogota-al-dia.vercel.app/api/mcp` | Interactive trip view (MCP Apps) or text |
| Autonomous agents (Instinct, Muse, …) | **Remote MCP**, or OpenAPI / function calling (see below) | Whatever the agent relays (use `text`) |
| Grok / xAI API, OpenAI API, Gemini, Groq, Mistral | **Function calling** with `/tools.json` + `POST /api/tools/<name>` (or remote MCP if the API supports it) | The model's text built from the data |
| WhatsApp, Telegram, Slack, Siri Shortcuts, custom bots | **GET** `/api/trip?origin=..&destination=..&format=text` | Message ready to send |
| Web | `/viaje/` (no-JS form; `/trip/` is an alias) | Page |

Contract: JSON keys and enum values are English (`options[].label`: `fastest` | `fewest_transfers` | `balanced` | `recommended`; `legs[].type`: `walk` | `ride`; `legs[].system`: `trunk` | `feeder` | `dual` | `zonal` | `complementary` | `special` | `cable` | `other`; `weekday` + `holiday`). The strings meant for the rider are Spanish: `notices`, error messages, `text` and the HTML page.

## Remote MCP (with a view)

```bash
claude mcp add --transport http bogota-al-dia https://bogota-al-dia.vercel.app/api/mcp
```

`plan_trip` declares `_meta.ui.resourceUri = ui://bogota-al-dia/trip.html` (`io.modelcontextprotocol/ui` extension). Hosts with MCP Apps show the view; the rest get the text in `content` and the JSON in `structuredContent`.

Tools: `plan_trip` (origin, destination, time?, date?, city?), `nearby_stops` (lat, lon, radius?, limit?, city?), `route_stops` (route, city?), `transit_coverage`.

## Function calling (Grok, OpenAI, Gemini…)

1. Fetch the definitions: `GET https://bogota-al-dia.vercel.app/tools.json` → `tools[]` in OpenAI format (`type: "function"`).
2. Pass them to the model. When it asks for a tool, run it:

```js
const r = await fetch(`https://bogota-al-dia.vercel.app/api/tools/${call.name}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: call.arguments, // JSON string exactly as the model returns it
});
const { result, text } = await r.json(); // `text` is chat-ready for plan_trip
```

Example with the xAI API (compatible with the OpenAI SDK):

```js
import OpenAI from 'openai';
const xai = new OpenAI({ baseURL: 'https://api.x.ai/v1', apiKey: process.env.XAI_API_KEY });
const { tools } = await (await fetch('https://bogota-al-dia.vercel.app/tools.json')).json();
const res = await xai.chat.completions.create({
  model: 'grok-4', // whichever model you use
  messages: [{ role: 'user', content: '¿Cómo llego de Portal Norte a la Calle 26 mañana a las 7?' }],
  tools,
});
// For each res.choices[0].message.tool_calls → POST /api/tools/<name> and send the result back as a role:"tool" message
```

Tips for the bot prompt:
- If the user gives a street address, geocode it and pass `"lat,lon"` as `origin`/`destination`.
- "Tomorrow at 7" → `date` and `time` in Colombia time.
- Show at most 2 or 3 options, with car and door, and make clear they are scheduled times.

## Autonomous agents (Instinct, Muse, …)

General-purpose autonomous agents should connect in this order of preference:

1. **Remote MCP**: `https://bogota-al-dia.vercel.app/api/mcp` — Streamable HTTP, no auth, stateless (no session). Any MCP client works; `tools/list` returns the four transit tools plus the data tools.
2. **OpenAPI**: `https://bogota-al-dia.vercel.app/openapi.json` (OpenAPI 3.1) for agents that import REST specs. `GET /api/trip` is the main operation (`planTrip`).
3. **Function calling**: definitions at `/tools.json`, execution with `POST /api/tools/<name>`.

Every channel returns the same data. `plan_trip` responses include `text` (in `/api/tools` as `text`, in MCP as `content[0].text`): a Spanish, chat-ready message the agent can relay to the rider as is.

Suggested system-prompt snippet for such an agent:

```text
You can plan public-transit trips in Bogotá (TransMilenio, SITP zonal, feeders, TransMiCable)
with the bogota-al-dia tools.
- Call plan_trip whenever the user asks how to get somewhere, which bus to take, or when to leave.
  Pass origin and destination as station/stop names, or as "lat,lon" after geocoding a street
  address yourself. Pass time (HH:MM) and date (YYYY-MM-DD) in Colombia time when the user gives them.
- If the response has suggestions, the place was ambiguous: confirm with the user.
- Present at most 2-3 options. For each ride, always show where to board: board.car and board.door
  ("vagón A, puerta 2") or the stop code, the headsign and where to get off.
- If no_service is present, say when service resumes.
- These are scheduled times from the official GTFS, not real-time arrivals: say so.
- The response includes `text`, a Spanish message ready to relay; prefer it when replying in Spanish.
```

## WhatsApp / Telegram (no LLM)

```bash
curl -L 'https://bogota-al-dia.vercel.app/api/trip/?origin=Portal%20Norte&destination=Calle%2026&format=text'
```

Returns a message with emojis and line breaks, ready to forward. Errors: HTTP 400 with the reason as text.

## Other cities

Every tool accepts `city` (name or DIVIPOLA code). `transit_coverage` tells which ones are available. To add one, see `.claude/agents/cities-expert.md`.
