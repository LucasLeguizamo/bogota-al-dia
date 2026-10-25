import type { VercelRequest, VercelResponse } from '@vercel/node';
// @ts-expect-error untyped JS module, shared with the CLI and the MCP
import { planTrip, tripAsText } from '../lib/trip.mjs';
// @ts-expect-error untyped JS module
import { pageHtml } from '../lib/trip-ui.mjs';

// GET /api/trip?origin=Portal+Norte&destination=Calle+26[&time=07:30][&date=2026-10-27][&city=11001][&format=json|text|html]
// For bots without MCP (Grok, WhatsApp, Telegram, Siri Shortcuts...) and for the no-JS page /viaje/ (and /trip/).
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
  const q = Object.fromEntries(['origin', 'destination', 'time', 'date', 'city', 'format'].map((k) => [k, typeof src[k] === 'string' ? src[k].slice(0, 200) : undefined]));
  // No Accept negotiation: the same URL always returns the same thing (the CDN never mixes HTML and JSON). /viaje/ sets format=html.
  const format = q.format ?? 'json';
  // Without an explicit time the answer depends on "now": short cache
  res.setHeader('Cache-Control', q.time && q.date ? 'public, s-maxage=86400' : 'public, s-maxage=60');

  if (format === 'html' && !q.origin && !q.destination) return res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(pageHtml({ q }));
  try {
    const v = planTrip(q);
    if (format === 'text') return res.status(200).setHeader('Content-Type', 'text/plain; charset=utf-8').send(tripAsText(v));
    if (format === 'html') return res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(pageHtml({ v, q }));
    return res.status(200).json(v);
  } catch (e) {
    const error = (e as Error).message;
    res.setHeader('Cache-Control', 'no-store');
    if (format === 'html') return res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8').send(pageHtml({ q, error }));
    if (format === 'text') return res.status(400).setHeader('Content-Type', 'text/plain; charset=utf-8').send(error);
    return res.status(400).json({ error });
  }
}
