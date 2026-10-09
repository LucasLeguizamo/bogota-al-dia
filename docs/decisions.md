# Log de Decisiones

## 2026-10-09: Stack tecnológico

**Decisión**: Usar Astro para generación de sitio estático con TypeScript.

**Razón**: 
- Genera HTML estático sin JS por defecto (requisito is-agentic)
- Soporte nativo para JSON como fuentes de datos
- Build simple, desplegable en Vercel/GitHub Pages
- Permite islands para interactividad opcional sin romper SSG

**Alternativas descartadas**:
- Next.js: Más complejo, hidratación JS por defecto
- 11ty: Menos ecosistema TypeScript
- Hugo: Más difícil integrar JSON schemas y generar OpenAPI

## 2026-10-09: Fuentes de datos primarias

**Decisión**: Usar APIs REST de ArcGIS (catastrobogota.gov.co y gis.transmilenio.gov.co).

**Razón**:
- APIs públicas estables, formato JSON
- No requieren autenticación
- robots.txt no las bloquea
- Licencia CC-BY-SA-4.0 permite redistribución

**Evidencia**: Respuestas exitosas de ambas APIs verificadas con curl.

## 2026-10-09: Esquema de frecuencias de recolección

**Decisión**: Mapear `IDFRECUE_` a días de la semana según convención UAESP.

**Pendiente**: Confirmar mapeo exacto. Valores observados: "6". Necesita más muestras.

## 2026-10-09: Formato de horarios

**Decisión**: Normalizar horarios a formato ISO (HH:MM).

**Razón**: La API devuelve enteros (1800 = 18:00, 400 = 04:00). Convertimos a string "18:00".

## 2026-10-09: MCP Server

**Decisión**: Implementar MCP server como endpoint Streamable HTTP en /mcp.

**Razón**: Cumple requisito is-agentic para API + MCP. Usamos @modelcontextprotocol/sdk.
