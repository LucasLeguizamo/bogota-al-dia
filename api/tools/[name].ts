import type { VercelRequest, VercelResponse } from '@vercel/node';
// @ts-expect-error untyped JS module, shared with the CLI and the MCP
import { TOOLS } from '../../lib/bogota.mjs';

// Generic tool runner for function calling (OpenAI, xAI/Grok, Gemini, custom bots):
// definitions live at /tools.json; the bot calls POST /api/tools/<name> with the JSON arguments.
// Same `run` as the MCP: a single source of truth.
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const tool = TOOLS.find((t: { name: string }) => t.name === req.query.name);
  if (!tool) return res.status(404).json({ error: `Herramienta desconocida: ${req.query.name}`, see: '/tools.json' });
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
    // `text` = answer ready to paste into a chat; `result` = structured data
    return res.status(200).json({ result, ...(tool.text ? { text: tool.text(result) } : {}) });
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
}
