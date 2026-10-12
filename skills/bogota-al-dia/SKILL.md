---
name: bogota-al-dia
description: Consultar datos públicos de Bogotá (TransMilenio estaciones/rutas/horarios, recolección de basura por localidad). Úsalo cuando el usuario pregunte por transporte troncal o el camión de la basura en Bogotá.
---

# Bogotá al Día

Tres formas de acceder a los mismos datos (mismo núcleo `lib/bogota.mjs`):

| Vía | Cómo |
|-----|------|
| MCP | `mcp__plugin_bogota-al-dia_bogota-al-dia__*` con el plugin; `mcp__bogota-al-dia__*` vía `.mcp.json` del repo |
| CLI | `node ${CLAUDE_PLUGIN_ROOT}/bin/bogota.mjs <comando>` |
| HTTP | `https://bogota-al-dia.vercel.app/api/...` y MCP remoto en `/api/mcp` |

Herramientas MCP: `estaciones_transmilenio`, `rutas_transmilenio`, `recoleccion_por_zona`, `localidades_recoleccion`, `resumen_datos`.

CLI:
```
bogota estaciones [texto] [--troncal X] [--limit N]
bogota estacion <codigo>
bogota rutas [texto]
bogota ruta <codigo>
bogota recoleccion <localidad|codigo>
bogota localidades
bogota resumen
```

Delegación: preguntas de transporte → agente `transmilenio-expert`; de basura → `recoleccion-expert`. Preguntas mixtas → ambos en paralelo.

Nunca inventes datos que las herramientas no devuelvan. Solo red troncal, horarios programados, no tiempo real.
