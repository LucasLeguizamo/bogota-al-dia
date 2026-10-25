---
name: bogota-al-dia
description: Public data for Bogotá. Plan trips from A to B on TransMilenio/SITP (optimal routes with boarding car and door), nearby stops, route stops, stations, schedules and garbage collection by locality. Use it when someone asks how to get around Bogotá, which bus to take, or about the garbage truck.
---

# Bogotá al Día

Tres formas de acceder a los mismos datos (mismo núcleo `lib/bogota.mjs`):

| Vía | Cómo |
|-----|------|
| MCP | `mcp__plugin_bogota-al-dia_bogota-al-dia__*` con el plugin; `mcp__bogota-al-dia__*` vía `.mcp.json` del repo |
| CLI | `node ${CLAUDE_PLUGIN_ROOT}/bin/bogota.mjs <comando>` |
| HTTP | `https://bogota-al-dia.vercel.app/api/...` y MCP remoto en `/api/mcp` |

MCP tools:
- Trips: `plan_trip` (origin, destination, time?, date?, city?), `nearby_stops` (lat, lon, radius?), `route_stops` (route), `transit_coverage`.
- Data: `estaciones_transmilenio`, `rutas_transmilenio`, `recoleccion_por_zona`, `localidades_recoleccion`, `resumen_datos`.

CLI:
```
bogota estaciones [texto] [--troncal X] [--limit N]
bogota estacion <codigo>
bogota rutas [texto]
bogota ruta <codigo>
bogota recoleccion <localidad|codigo>
bogota localidades
bogota trip "<origin>" "<destination>" [--time HH:MM] [--date YYYY-MM-DD] [--json]
bogota nearby <lat> <lon> [--radius M]
bogota route-stops <route>
bogota coverage
bogota resumen
```

Delegation: "how do I get there" / which bus to take → `trips-expert`; trunk stations and routes → `transmilenio-expert`; garbage → `recoleccion-expert`. Mixed questions → several in parallel.

Never invent data the tools do not return. Trips cover trunk, feeders, SITP zonal and TransMiCable with scheduled times from the official GTFS (no real time). Tool output keys are English; `notices` and `text` are Spanish, ready for the rider.
