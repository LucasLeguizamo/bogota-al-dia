import type { APIRoute, GetStaticPaths } from 'astro';
import rutasData from '../../../../../data/transmilenio/rutas.json';
import { rutaSlug } from '../../../../lib/rutas';

export const getStaticPaths: GetStaticPaths = () => {
  return rutasData.rutas.map(ruta => ({
    params: { codigo: rutaSlug(ruta) }
  }));
};

export const GET: APIRoute = ({ params }) => {
  const ruta = rutasData.rutas.find(r => rutaSlug(r) === params.codigo);
  
  if (!ruta) {
    return new Response(JSON.stringify({
      error: 'Not Found',
      message: `Ruta con código '${params.codigo}' no encontrada`,
      available_endpoint: '/api/transmilenio/rutas.json'
    }, null, 2), {
      status: 404,
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  }
  
  return new Response(JSON.stringify(ruta, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};
