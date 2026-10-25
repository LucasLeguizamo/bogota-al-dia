import type { APIRoute } from 'astro';
import { TOOL_DEFS, SITE, MCP_URL } from '../lib/agentes';

// Function-calling definitions (OpenAI Chat/Responses format, also accepted by xAI/Grok,
// Groq, Mistral and Gemini's OpenAI layer). Run: POST {SITE}/api/tools/<name> with the arguments.
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      {
        execute: `POST ${SITE}/api/tools/{name} with the arguments as JSON → { result, text? }`,
        mcp: MCP_URL,
        tools: TOOL_DEFS.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema } })),
      },
      null,
      2,
    ),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
  );
