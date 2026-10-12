import type { APIRoute } from 'astro';
const B = 'https://bogota-al-dia-ten.vercel.app';
export const GET: APIRoute = () => new Response(`# 404: Página no encontrada

La ruta solicitada no existe en Bogotá al Día.

- [Inicio](${B}/)
- [llms.txt](${B}/llms.txt)
- [Sitemap](${B}/sitemap.xml)
- [Documentación API](${B}/api/)
`, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
