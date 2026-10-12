import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  const robotsTxt = `# Bogotá al Día - Datos públicos de Bogotá
# https://bogota-al-dia.vercel.app

User-agent: *
Allow: /

# Sitemaps
Sitemap: https://bogota-al-dia.vercel.app/sitemap.xml

# Para agentes de IA
# Consultar /llms.txt para contexto
# API disponible en /api/
# OpenAPI spec en /openapi.json
`;

  return new Response(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
};
