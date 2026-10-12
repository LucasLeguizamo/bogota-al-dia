// Vercel Routing Middleware: Markdown negotiation + JSON/Markdown errors.
export const config = { matcher: '/((?!_astro/).*)' };

const wantsMarkdown = (a: string) => /text\/markdown/i.test(a) && !/text\/html/i.test(a.split('text/markdown')[0] || '');

export default async function middleware(request: Request): Promise<Response | undefined> {
  if (request.headers.get('x-bad-internal')) return undefined;
  const url = new URL(request.url);
  const accept = request.headers.get('accept') || '';
  const md = /text\/markdown/i.test(accept);
  const p = url.pathname;

  if (md && (p === '/' || p === '/index.html')) {
    const r = await fetch(new URL('/index.md', url), { headers: { 'x-bad-internal': '1' } });
    return new Response(await r.text(), { status: 200, headers: {
      'Content-Type': 'text/markdown; charset=utf-8', 'Vary': 'Accept', 'Cache-Control': 'public, max-age=300' } });
  }
  if (p === '/' || p === '/api/mcp' || p.startsWith('/.well-known/mcp')) return undefined;

  const isApi = p.startsWith('/api/');
  if (!isApi && !md) return undefined;

  const probe = await fetch(url, { method: request.method === 'HEAD' ? 'HEAD' : 'GET',
    headers: { 'x-bad-internal': '1', accept: isApi ? 'application/json' : 'text/html' }, redirect: 'manual' });
  if (probe.status !== 404) return isApi ? undefined : undefined;

  if (isApi) {
    return new Response(JSON.stringify({ error: { code: 'not_found', status: 404,
      message: `No existe el endpoint ${p}`,
      hint: 'Consulta la lista de endpoints en /openapi.json o /api/',
      docs: `${url.origin}/openapi.json` } }, null, 2),
      { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Vary': 'Accept', 'Access-Control-Allow-Origin': '*' } });
  }
  const r = await fetch(new URL('/404.md', url), { headers: { 'x-bad-internal': '1' } });
  return new Response(await r.text(), { status: 404, headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Vary': 'Accept' } });
}
