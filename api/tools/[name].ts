import type { VercelRequest, VercelResponse } from '@vercel/node';
// @ts-expect-error módulo JS sin tipos, compartido con el CLI y el MCP
import { TOOLS } from '../../lib/bogota.mjs';

// Ejecutor genérico de herramientas para function calling (OpenAI, xAI/Grok, Gemini, bots propios):
// las definiciones están en /tools.json; el bot llama POST /api/tools/<nombre> con los argumentos en JSON.
// Mismo `run` que el MCP: una sola fuente de verdad.
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const tool = TOOLS.find((t: { name: string }) => t.name === req.query.name);
  if (!tool) return res.status(404).json({ error: `Herramienta desconocida: ${req.query.name}`, ver: '/tools.json' });
  let args: unknown = req.method === 'POST' ? req.body : req.query;
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args);
    } catch {
      return res.status(400).json({ error: 'JSON inválido' });
    }
  }
  const { name: _omit, ...params } = (args && typeof args === 'object' && !Array.isArray(args) ? args : {}) as Record<string, unknown>;
  try {
    const result = tool.run(params);
    // `texto` = respuesta lista para pegar en un chat; `resultado` = datos estructurados
    return res.status(200).json({ resultado: result, ...(tool.texto ? { texto: tool.texto(result) } : {}) });
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
}
