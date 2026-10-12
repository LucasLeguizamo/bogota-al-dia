import type { APIRoute } from 'astro';

const apiCatalog = {
  "$schema": "https://api.apis.guru/v1/catalog-schema.json",
  "apis": [
    {
      "name": "Bogotá al Día API",
      "description": "API pública con datos de servicios públicos de Bogotá: TransMilenio y recolección de residuos.",
      "baseUrl": "https://bogota-al-dia.vercel.app/api",
      "humanUrl": "https://bogota-al-dia.vercel.app/api/",
      "openapiUrl": "https://bogota-al-dia.vercel.app/openapi.json",
      "contact": {
        "name": "Bogotá al Día"
      },
      "tags": ["open-data", "bogota", "transmilenio", "public-services"],
      "properties": [
        {
          "type": "x-llms-txt",
          "url": "https://bogota-al-dia.vercel.app/llms.txt"
        }
      ]
    }
  ]
};

export const GET: APIRoute = () => {
  return new Response(JSON.stringify(apiCatalog, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=86400'
    }
  });
};
