import type { VercelRequest, VercelResponse } from '@vercel/node';
// @ts-expect-error módulo JS sin tipos, compartido con el CLI y el MCP
import { planearViaje, viajeComoTexto } from '../lib/viaje.mjs';
// @ts-expect-error módulo JS sin tipos
import { paginaHtml } from '../lib/viaje-ui.mjs';

// GET /api/viaje?origen=Portal+Norte&destino=Calle+26[&hora=07:30][&fecha=2026-10-27][&ciudad=11001][&formato=json|texto|html]
// Para bots sin MCP (Grok, WhatsApp, Telegram, Siri Shortcuts...) y para la página /viaje/ sin JS.
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  let body: unknown = req.method === 'POST' ? req.body : undefined;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = undefined;
    }
  }
  const src = (body && typeof body === 'object' ? body : req.query) as Record<string, string>;
  const q = Object.fromEntries(['origen', 'destino', 'hora', 'fecha', 'ciudad', 'formato'].map((k) => [k, typeof src[k] === 'string' ? src[k].slice(0, 200) : undefined]));
  // Sin negociar por Accept: la misma URL siempre da lo mismo (la CDN no mezcla HTML y JSON). /viaje/ pone formato=html.
  const formato = q.formato ?? 'json';
  // Sin hora explícita la respuesta depende de "ahora": caché corta
  res.setHeader('Cache-Control', q.hora && q.fecha ? 'public, s-maxage=86400' : 'public, s-maxage=60');

  if (formato === 'html' && !q.origen && !q.destino) return res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(paginaHtml({ q }));
  try {
    const v = planearViaje(q);
    if (formato === 'texto') return res.status(200).setHeader('Content-Type', 'text/plain; charset=utf-8').send(viajeComoTexto(v));
    if (formato === 'html') return res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(paginaHtml({ v, q }));
    return res.status(200).json(v);
  } catch (e) {
    const error = (e as Error).message;
    res.setHeader('Cache-Control', 'no-store');
    if (formato === 'html') return res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8').send(paginaHtml({ q, error }));
    if (formato === 'texto') return res.status(400).setHeader('Content-Type', 'text/plain; charset=utf-8').send(error);
    return res.status(400).json({ error });
  }
}
