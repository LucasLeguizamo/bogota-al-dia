import type { APIRoute, GetStaticPaths } from 'astro';
import estacionesData from '../../../../../data/transmilenio/estaciones.json';

export const getStaticPaths: GetStaticPaths = () => {
  return estacionesData.estaciones.map(estacion => ({
    params: { codigo: estacion.codigo }
  }));
};

export const GET: APIRoute = ({ params }) => {
  const estacion = estacionesData.estaciones.find(e => e.codigo === params.codigo);
  
  if (!estacion) {
    return new Response(JSON.stringify({
      error: 'Not Found',
      message: `Estación con código '${params.codigo}' no encontrada`,
      available_endpoint: '/api/transmilenio/estaciones.json'
    }, null, 2), {
      status: 404,
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  }
  
  return new Response(JSON.stringify(estacion, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};
