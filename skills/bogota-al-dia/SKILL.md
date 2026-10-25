---
name: bogota-al-dia
description: Datos públicos de Bogotá. Cómo llegar de A a B en TransMilenio/SITP (rutas óptimas con vagón y puerta), paradas cercanas, recorrido de rutas, estaciones, horarios y recolección de basura por localidad. Úsalo cuando pregunten cómo moverse en Bogotá, qué bus tomar, o por el camión de la basura.
---

# Bogotá al Día

Tres formas de acceder a los mismos datos (mismo núcleo `lib/bogota.mjs`):

| Vía | Cómo |
|-----|------|
| MCP | `mcp__plugin_bogota-al-dia_bogota-al-dia__*` con el plugin; `mcp__bogota-al-dia__*` vía `.mcp.json` del repo |
| CLI | `node ${CLAUDE_PLUGIN_ROOT}/bin/bogota.mjs <comando>` |
| HTTP | `https://bogota-al-dia.vercel.app/api/...` y MCP remoto en `/api/mcp` |

Herramientas MCP:
- Viajes: `planear_viaje` (origen, destino, hora?, fecha?, ciudad?), `paradas_cercanas` (lat, lon), `recorrido_ruta` (ruta), `cobertura_transporte`.
- Datos: `estaciones_transmilenio`, `rutas_transmilenio`, `recoleccion_por_zona`, `localidades_recoleccion`, `resumen_datos`.

CLI:
```
bogota estaciones [texto] [--troncal X] [--limit N]
bogota estacion <codigo>
bogota rutas [texto]
bogota ruta <codigo>
bogota recoleccion <localidad|codigo>
bogota localidades
bogota viaje "<origen>" "<destino>" [--hora HH:MM] [--fecha AAAA-MM-DD] [--json]
bogota cerca <lat> <lon>
bogota recorrido <ruta>
bogota cobertura
bogota resumen
```

Delegación: "cómo llego" / qué bus tomar → `viajes-expert`; estaciones y rutas troncales → `transmilenio-expert`; de basura → `recoleccion-expert`. Preguntas mixtas → ambos en paralelo.

Nunca inventes datos que las herramientas no devuelvan. Los viajes cubren troncal, alimentadores, SITP zonal y TransMiCable con horarios programados del GTFS oficial (no hay tiempo real).
