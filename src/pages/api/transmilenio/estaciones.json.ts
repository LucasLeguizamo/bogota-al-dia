import type { APIRoute } from 'astro';
import estacionesData from '../../../../data/transmilenio/estaciones.json';

export const GET: APIRoute = () => {
  return new Response(JSON.stringify(estacionesData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};
