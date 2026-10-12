import type { APIRoute } from 'astro';
import estacionesData from '../../data/transmilenio/estaciones.json';
import rutasData from '../../data/transmilenio/rutas.json';
import localidadesData from '../../data/recoleccion/localidades.json';

const site = 'https://bogota-al-dia-ten.vercel.app';

export const GET: APIRoute = () => {
  const pages = [
    '',
    '/transmilenio/',
    '/transmilenio/estaciones/',
    '/transmilenio/rutas/',
    '/recoleccion/',
    '/alertas/',
    '/api/',
    '/mcp/',
  ];

  const estacionPages = estacionesData.estaciones.map(
    e => `/transmilenio/estaciones/${e.codigo}/`
  );

  const rutaPages = rutasData.rutas.map(
    r => `/transmilenio/rutas/${r.codigo}/`
  );

  const localidadPages = localidadesData.localidades.map(
    l => `/recoleccion/${l.codigo}/`
  );

  const allPages = [...pages, ...estacionPages, ...rutaPages, ...localidadPages];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(page => `  <url>
    <loc>${site}${page}</loc>
    <changefreq>weekly</changefreq>
  </url>`).join('\n')}
</urlset>`;

  return new Response(sitemap, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8'
    }
  });
};
