import type { APIRoute } from 'astro';
import rutasData from '../../../../data/transmilenio/rutas.json';

export const GET: APIRoute = () => {
  return new Response(JSON.stringify(rutasData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};
