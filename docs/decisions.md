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

## 2026-10-12: Validación de datos contra schemas (`pnpm validate`)

**Decisión**: `scripts/validate-data.ts` (ajv 2020-12 + ajv-formats) valida cada registro de `estaciones.json`, `rutas.json` y `zonas.json` contra su schema. Los schemas describen **un registro**; los archivos son un sobre `{ generado, total, ..., <arreglo> }`, así que se valida cada elemento del arreglo y además: `total` = longitud del arreglo, `generado` es fecha válida, `id` único. Sale con código 1 listando errores legibles (`[índice] id/ruta: mensaje`). El workflow corre `pnpm validate` después de extraer y antes del commit.

**Evidencia**: la primera corrida falló con `[73] ruta-G45: id duplicado` (ver abajo). Tras la corrección: estaciones 152 ✓, rutas 128 ✓, zonas 115 ✓. Prueba negativa (estado inválido, `nombre` faltante, fecha mal formada) → 3 errores, exit 1.

## 2026-10-12: Timestamps estables (idempotencia del workflow)

**Problema**: `generado` y `ultima_actualizacion` se regeneraban en cada corrida, así que `git diff data/` siempre daba cambios y el workflow commiteaba semanalmente aunque la fuente no cambiara.

**Decisión**: los extractores escriben con `writeJsonStable` (`scripts/stable-output.ts`): cada registro conserva su `ultima_actualizacion` previa si (ignorando ese campo) es idéntico al registro con el mismo `id` en el archivo anterior, y `generado` se conserva si el resto del archivo no cambió. Se eligió esto sobre filtrar el diff en el workflow porque además deja `ultima_actualizacion` con significado real (fecha del último cambio del registro) y hace idempotente la corrida local. Forma de los registros sin cambios.

**Evidencia**: `pnpm run extract` dos veces seguidas → la segunda corrida produce `diff -r` vacío respecto a la primera. En la primera, `estaciones.json`, `zonas.json`, `localidades.json` y los CSV quedaron byte a byte iguales a lo commiteado; solo cambió `rutas.*`, por las correcciones reales de abajo.

## 2026-10-12: Rutas — `longitud_km`, estado e ids duplicados

**`longitud_km` (bug de unidades)**: el extractor dividía `longitud_comercial` entre 1000 asumiendo metros. La capa `consulta_rutas_troncales/MapServer/0` ya publica kilómetros: p. ej. J23A `longitud_comercial=10.64`, `longitud_ruta_troncal=10.6446`, `st_length(shape)=10644.6` (m, EPSG:3116). Resultado previo: valores 0–0.04 km; ahora 4.48–42.2 km.
- Se usa `longitud_comercial`; si falta o es inverosímil (> 100 km) se usa `longitud_ruta_troncal` del mismo registro. Caso real: "L81 Ref CL72" trae `longitud_comercial=1252` (error de captura), `longitud_ruta_troncal=12.5296`, geometría 12 529.6 m → 12.53 km.
- **12 rutas sin dato en la fuente** (ambos campos `null`): M83, H83, K10, L10, B26, F26, MP85, MP85CV, J74, B74, F63, Z63. Inicialmente quedaron en `0`; resuelto en la entrada siguiente (respaldo con la geometría oficial).

**Estado**: la fuente publica `estado_ruta_troncal='OPERATIVA'` en las 128 rutas; `normalizeEstado` solo reconocía "activ" y las marcaba todas `programada`. Ahora `operativ` → `activa` (128/128).

**Ids duplicados**: G45 viene dos veces (objectid 15 y 41, un registro por sentido, 4.97 km y 4.48 km). Cuando un código se repite, `id = ruta-<codigo>-<objectid>` (`ruta-G45-15`, `ruta-G45-41`); el resto de ids no cambia. El orden ahora desempata por `id` para ser determinista.

**Pendientes de `tipo_bus` y `tipo_operacion`**: resueltos en la entrada siguiente.

## 2026-10-12: Rutas — enums alineados con la fuente, longitud por geometría y páginas de códigos repetidos

**`tipo_bus`**: se mapea con el dominio oficial `TIPO_BUS` de la capa (`codedValues` en `MapServer/0?f=json`): 1 `articulado`, 2 `biarticulado`, 3 `dual`, 4 `padron`, 5 `buseton`. El schema añade `dual`, `buseton` y `desconocido`. Para las rutas sin dato (`tipo_bus_ruta_troncal = null`: F63 y Z63) se usa `desconocido` en vez de asumir `articulado`. Se eligió `desconocido` en lugar de `null` porque mantiene el tipo `string` del campo y no rompe a quien lo muestre o compare (página de ruta, CLI, MCP).
- Antes: biarticulado 70, articulado 35, padron 23.
- Después: biarticulado 70, articulado 33, dual 23, desconocido 2. `padron` (código 4) y `buseton` (código 5) no aparecen hoy en la capa.

**`tipo_operacion`**: la capa publica texto libre: Normal (112), Refuerzo (8), Ciclovia (8). El enum pasa de `corriente|facil|super_expreso|expreso` (ninguno existía en la fuente) a `normal|refuerzo|ciclovia|desconocido`. El extractor usa el slug del texto de la fuente (sin tildes, snake_case); si viene vacío pone `desconocido`; si aparece un valor nuevo se publica como slug y `pnpm validate` falla, para que el enum se revise de forma explícita.
- Antes: corriente 128. Después: normal 112, refuerzo 8, ciclovia 8.
- `src/`: no había filtros por estos valores; la página de ruta los muestra tal cual. Se actualizaron `src/pages/llms-full.txt.ts` y `docs/sources.md`.

**`longitud_km`, respaldo final**: orden de prioridad `longitud_comercial` → `longitud_ruta_troncal` → `st_length(shape)` / 1000. Este último es la longitud de la geometría oficial de la misma capa, en metros (EPSG:3116, `xyUnits` en metros). Todos se redondean a 2 decimales y se descartan los valores ≤ 0 o > 100 km. Las 12 rutas sin longitud en atributos ya tienen valor: B26 28.27, B74 17.13, F26 26.89, F63 11.72, H83 14.02, J74 17.97, K10 18.42, L10 16.19, M83 14.65, MP85 21.02, MP85CV 21.52, Z63 11.64. Rutas con `longitud_km = 0`: antes 12, después 0. Nota: la longitud geométrica puede diferir un poco de la comercial (en H17: comercial 29.877 frente a geométrica 30.96).

**Páginas de códigos repetidos (G45)**: `src/lib/rutas.ts` exporta `rutaSlug(ruta)`, que devuelve el `codigo`, salvo cuando el código se repite en los datos; en ese caso usa el `id` sin el prefijo `ruta-` (`G45-15`, `G45-41`). Lo usan `transmilenio/rutas/[codigo].astro`, `api/transmilenio/rutas/[codigo].json.ts`, los enlaces de `transmilenio/rutas/index.astro` y `transmilenio/index.astro`, y `sitemap.xml.ts`. Las URLs de los demás códigos no cambian.
- Evidencia: en HEAD, `astro build` reportaba "308 page(s) built", pero G45 se generaba dos veces y una sobrescribía a la otra (307 HTML reales, 127 JSON de rutas). Ahora: "308 page(s) built", 308 HTML reales y 128 JSON; existen `dist/transmilenio/rutas/G45-15/`, `G45-41/`, `dist/api/transmilenio/rutas/G45-15.json` y `G45-41.json`, y el índice y el sitemap enlazan ambas.
- Nota: el CLI/MCP (`rutas({codigo:'G45'})`) ya devolvía ambos registros porque filtra por código; no se tocó `lib/`.
