import type { VercelRequest, VercelResponse } from '@vercel/node';
// @ts-expect-error módulo JS sin tipos, compartido con el CLI y el plugin
import { TOOLS, VERSION, PROTOCOL_VERSIONS, handleMcpMessage } from '../lib/bogota.mjs';

// MCP Streamable HTTP sin sesiones: cada POST lleva JSON-RPC y recibe JSON.
// No hay stream SSE de servidor (GET con Accept: text/event-stream → 405, como pide la spec).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    // Clientes MCP abren aquí un stream SSE opcional; no lo ofrecemos.
    if (String(req.headers.accept ?? '').includes('text/event-stream')) {
      res.setHeader('Allow', 'POST, OPTIONS');
      return res.status(405).json({ error: 'Este servidor no ofrece stream SSE; usa POST con JSON-RPC.' });
    }
    return res.status(200).json({
      name: 'bogota-al-dia',
      version: VERSION,
      description: 'MCP server para datos públicos de Bogotá',
      protocol: 'MCP Streamable HTTP (JSON-RPC sobre POST, sin sesiones)',
      protocolVersions: PROTOCOL_VERSIONS,
      tools: TOOLS.map((t: { name: string }) => t.name),
      usage: 'POST JSON-RPC requests to this endpoint',
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // La spec 2025-06-18+ pide 400 si el cliente declara una versión que no soportamos.
  const pv = req.headers['mcp-protocol-version'];
  if (typeof pv === 'string' && pv && !PROTOCOL_VERSIONS.includes(pv)) {
    return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: `Unsupported MCP-Protocol-Version: ${pv}` } });
  }

  // @vercel/node parsea req.body perezosamente y lanza si el JSON es inválido.
  let body: unknown;
  try {
    body = req.body;
    if (typeof body === 'string' || Buffer.isBuffer(body)) body = JSON.parse(String(body));
  } catch {
    body = undefined;
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }

  const result = handleMcpMessage(body);
  // Notificaciones y respuestas: 202 sin cuerpo (Streamable HTTP)
  if (!result) return res.status(202).end();
  return res.status(200).json(result);
}
