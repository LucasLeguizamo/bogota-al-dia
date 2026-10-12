import type { VercelRequest, VercelResponse } from '@vercel/node';
// @ts-expect-error módulo JS sin tipos, compartido con el CLI y el plugin
import { TOOLS, handleMcp } from '../lib/bogota.mjs';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Mcp-Session-Id, Mcp-Protocol-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({
      name: 'bogota-al-dia',
      version: '1.1.0',
      description: 'MCP server para datos públicos de Bogotá',
      protocol: 'JSON-RPC over HTTP',
      tools: TOOLS.map((t: { name: string }) => t.name),
      usage: 'POST JSON-RPC requests to this endpoint',
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }

  const result = Array.isArray(body) ? body.map(handleMcp).filter(Boolean) : handleMcp(body);
  // Notificaciones: 202 sin cuerpo (Streamable HTTP)
  if (!result || (Array.isArray(result) && !result.length)) return res.status(202).end();
  return res.status(200).json(result);
}
