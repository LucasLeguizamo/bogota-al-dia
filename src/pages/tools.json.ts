import type { APIRoute } from 'astro';
import { TOOL_DEFS, SITE, MCP_URL } from '../lib/agentes';

// Definiciones para function calling (formato OpenAI Chat/Responses, que también aceptan xAI/Grok,
// Groq, Mistral y la capa OpenAI de Gemini). Ejecutar: POST {SITE}/api/tools/<name> con los argumentos.
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      {
        ejecutar: `POST ${SITE}/api/tools/{name} con los argumentos como JSON → { resultado, texto? }`,
        mcp: MCP_URL,
        tools: TOOL_DEFS.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema } })),
      },
      null,
      2,
    ),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
  );
