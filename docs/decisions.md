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

**Evidencia**: Build exitoso, 307 páginas generadas en 1.08s.

## 2026-10-09: Fuentes de datos primarias

**Decisión**: Usar APIs REST de ArcGIS (catastrobogota.gov.co y gis.transmilenio.gov.co).

**Razón**:
- APIs públicas estables, formato JSON
- No requieren autenticación
- robots.txt no las bloquea
- Licencia CC-BY-SA-4.0 permite redistribución

**Evidencia**: 
- Estaciones: 152 registros extraídos
- Rutas: 128 registros extraídos
- Zonas recolección: 115 registros extraídos

## 2026-10-09: Frecuencias de recolección

**Decisión**: Mapear `IDFRECUE_` a días según patrones observados.

**Mapeo implementado**:
- 1: L-M-V
- 2: M-J-S
- 6: Todos los días

**Pendiente**: Códigos 8, 10, 11, 13 aparecen en datos pero sin mapeo confirmado.

## 2026-10-09: Formato de horarios

**Decisión**: Normalizar horarios a formato ISO (HH:MM).

**Razón**: La API devuelve enteros (1800 = 18:00, 400 = 04:00). Convertimos a string "18:00".

## 2026-10-09: MCP Server

**Decisión**: Documentar herramientas MCP en server.json como especificación, sin implementación activa de servidor.

**Razón**: El MCP server real requiere un backend activo. Para v1, documentamos las herramientas disponibles y exponemos los recursos como URLs de API estática.

## 2026-10-09: Sitemap

**Decisión**: Generar sitemap.xml manualmente como endpoint Astro.

**Razón**: El plugin @astrojs/sitemap falló con error de reduce(). La solución manual funciona y genera 307 URLs.

## 2026-10-09: Build output (dist/)

**Decisión**: No commitear dist/. Vercel hace build desde source.

**Razón**:
- Vercel detecta Astro automáticamente y ejecuta `pnpm run build`
- Commitear dist/ duplica archivos y complica diffs
- El workflow de actualización de datos solo commitea cambios en `data/`

## 2026-10-09: Códigos de frecuencia sin descripción oficial

**Decisión**: Etiquetar claramente los códigos sin descripción oficial.

**Evidencia**: La API de UAESP (metadata en MapServer/5) solo tiene labels numéricos (1, 2, 6, etc.) sin descripciones textuales. El diccionario de datos PDF existe pero no está accesible para parsing automático.

**Implementación**:
- Campo `frecuencia.oficial: boolean` en el schema y datos
- Códigos sin descripción muestran "Código X (sin descripción oficial)"
- UI muestra indicador ⚠ para frecuencias no oficiales

## 2026-10-09: Alertas de TransMilenio

**Decisión**: Sección marcada como "pendiente" sin datos fabricados.

**Investigación**:
- datosabiertos.bogota.gov.co: Sin dataset de alertas tiempo real
- transmilenio.gov.co: robots.txt bloquea scraping
- GTFS: Solo estático, sin GTFS-RT
- X API: Requiere suscripción de pago

**Implementación**: Página /alertas/ con:
- Mensaje claro de "sección pendiente"
- Enlaces a canales oficiales (X, web, app)
- Explicación técnica de por qué no hay datos
