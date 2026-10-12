# Investigación de fuentes de datos a nivel ciudad — Bogotá al Día → Colombia

Fecha de verificación: 2026-10-12. Todo lo marcado "verificado" se comprobó con `curl` (HTTP 200 y, cuando aplica, contenido inspeccionado). Lo que no se pudo comprobar dice **NO VERIFICADO**.

Leyenda de la matriz: **✓** API o archivo legible por máquina · **~** solo HTML/PDF/noticias (scraping o carga manual) o dato viejo/incompleto · **✗** no se encontró nada.

## 1. Matriz ciudad × tema

| Ciudad | Transporte GTFS estático | GTFS-RT / tiempo real | Pico y placa | Recolección de residuos | Reciclaje / puntos | Cortes programados (agua/luz) | Calidad del aire | Ciclovía / eventos |
|---|---|---|---|---|---|---|---|---|
| **Bogotá** | ✓ (diario, troncal + zonal + cable) | ✗ | ~ (HTML semanal en bogota.gov.co) | ✓ (macrorutas ArcGIS) | ✓ (contenedores, ECA, Punto Limpio) | ~ agua (HTML/noticias) · ✗ luz (Enel bloquea bots) | ✓ (IBOCA JSON horario, sin documentar) | ✓ (tramos ArcGIS IDRD) |
| **Medellín** | ✓ (Metro oficial 2025, el calendario venció) | ✗ | ~ (página oficial desactualizada) | ✓ (EMVARIAS macrorutas, Socrata) | ✓ (ECAs en MEData) | ✗ / NO VERIFICADO (EPM) | ~ (JSON de SIATA congelado desde 2024-09) | ✗ NO VERIFICADO |
| **Cali** | ~ (GTFS comunitario del MIO, vigencia 2017–2022) | ✗ | ✗ (solo noticias) | ~ (WFS con 18 microrutas rurales) | ✓ (WFS de bodegas de reciclaje) | ✗ NO VERIFICADO (Emcali) | ~ (CSV históricos, ICA de 2020) | ✗ |
| **Barranquilla** | ~ (GTFS comunitario de 2022 + paraderos en Socrata 2020) | ✗ | ~ (solo taxis y carga, según la prensa) | ✗ | ✗ | ✗ | ✗ NO VERIFICADO | ✗ |
| **Cartagena** | ~ (GTFS comunitario de 2023) + ✓ paraderos con horarios en Socrata 2025 | ✗ | ~ (decreto/HTML) | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Bucaramanga (AMB)** | ~ (GTFS comunitario de 2022) | ✗ | ~ | ~ (toneladas por microruta en Socrata; la "story" de rutas no es dato) | ~ (papeleras en Socrata) | ✗ | ✗ | ✗ |
| **Pereira** | ~ (GTFS + KML comunitarios de 2020; estaciones en Socrata 2023) | ✗ | ~ | ✗ | ✗ | ✗ | ~ (CARDER en Socrata, 2023) | ✗ |
| **Envigado / Piedecuesta / Palmira / El Carmen de Viboral** | ✗ | ✗ | ✗ | ✓ (rutas y frecuencias en Socrata) | ✗ | ✗ | ✗ | ✗ |
| **Copacabana (Ant.)** | ✗ | ✗ | ✓* (permisos/excepciones de placas en Socrata, no reglas) | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Ibagué, Sincelejo, Montería, Manizales** | ~ (GTFS comunitarios en ColombiaGTFS / Mobility Database) | ✗ | ✗ | ✗ | ✗ | ~ Ibagué (suspensiones IBAL, 2022) | ✗ | ✗ |

Conclusión general: **en Colombia no hay ningún feed GTFS-Realtime público.** El catálogo de Mobility Database (`files.mobilitydatabase.org/feeds_v2.csv`, filtrado por `CO`) solo lista feeds `gtfs` estáticos, y el único oficial y activo es el de Bogotá (mdb-3358).

---

## 2. Bogotá — detalle de fuentes

### 2.1 GTFS SITP completo (troncal + zonal + TransMiCable) — ✓ VERIFICADO, la mejor fuente nueva
- **Publica:** TransMilenio S.A.
- **URL:** `https://storage.googleapis.com/gtfs-estaticos/GTFS_YYYYMMDD.zip`. Se publica uno nuevo **cada día** cerca de las 09:19 hora UTC. El bucket se puede listar públicamente: `https://storage.googleapis.com/storage/v1/b/gtfs-estaticos/o?prefix=GTFS_202610`. El último verificado es `GTFS_20261012.zip`. También está indexado en `datosabiertos-transmilenio.hub.arcgis.com` (búsqueda `q=gtfs`) y en Mobility Database (mdb-3358, `https://files.mobilitydatabase.org/mdb-3358/latest.zip`).
- **Formato:** GTFS estático, unos 115 MB comprimido y unos 630 MB descomprimido (`stop_times.txt` pesa 580 MB).
- **Licencia:** CC-BY-SA-4.0 (ficha CKAN `especificacion-gtfs-general-transport-feed-specification-sitp`).
- **Contenido verificado (feed del 2026-09-14):** 7 agencias. Por `agency_id`: 1 Troncal (113 rutas), 2 Alimentadores (162), 3 **Zonal-Urbano (719)**, 4 Complementario (6), 5 Especial (4), 6 Dual (31) y 7 TransMiCable (1). Tiene 8.300 paradas y trae `shapes`, `frequencies`, `fare_attributes` y `calendar_dates`. `feed_info` declara una vigencia de 20260101 a 20261231.
- **Valor ciudadano:** ¿qué ruta zonal pasa por mi paradero?, horarios y recorridos. Cubre el hueco de "SITP zonal" que tenemos hoy.
- **Esfuerzo:** medio. El archivo es grande: hay que hacer ingesta en streaming de `stop_times` (o descartarlo y usar solo `routes`, `stops`, `trips`, `shapes` y `frequencies`), cargar a diario o semanalmente y deduplicar.
- **robots:** es un bucket GCS público, sin robots.
- Nota: `docs/sources.md` dice "Pendiente verificar ZIP"; **ya quedó verificado**.

### 2.2 Rutas zonales SITP (ArcGIS) — ✓
- `https://gis.transmilenio.gov.co/arcgis/rest/services/Zonal/consulta_rutas_zonales/MapServer/0` (CKAN `ru`, actualizado 2025-07-14, CC-BY-SA-4.0). Datasets federados relacionados: "Paraderos Zonales del SITP" y "Rutas Zonales del SITP". Esfuerzo bajo, porque sigue el mismo patrón que los troncales que ya integramos.

### 2.3 Calidad del aire — IBOCA en tiempo (casi) real — ✓ VERIFICADO (endpoint sin documentar)
- **Publica:** Secretaría Distrital de Ambiente (SDA).
- **URL:** `http://iboca.ambientebogota.gov.co/iboca/service/allstations/true`. Responde JSON y también funciona por https. Lo encontré dentro del JS del visor (`mapEsri.js`). Otros endpoints del mismo visor: `/iboca/service/stationHistorical/{id}`, `/stationHistoricalHours/{id}`, `/meteorologicalVariables/{id}` y `/recomendationsRange/{rango}`.
- **Campos:** `nombre`, `latitud`, `longitud`, `pm25_concentracion`, `pm10_concentracion`, `O3_concentracion`, `pm25_iboca`, `iboca`, `rango_nombre` (Bajo/Moderado/…), `rango_color` y `pm25_fecha`. Cada estación trae además una imagen en base64 que conviene descartar.
- **Frescura:** horaria. Al consultar traía `2026-10-12 14:00:00` en 19 estaciones.
- **Licencia:** el endpoint no declara ninguna. El dataset hermano "Estaciones calidad del aire" de la SDA es **CC-BY-4.0**, así que hay que atribuir a la SDA y pedir confirmación.
- **Valor:** muy alto: "¿cómo está el aire hoy en mi localidad?" junto con las recomendaciones oficiales del IBOCA.
- **Esfuerzo:** bajo. El riesgo es que es una API no oficial y puede cambiar sin aviso. `robots.txt` de iboca devuelve 404, o sea que no hay restricciones declaradas.
- **Alternativa RMCAB:** `https://rmcab.ambientebogota.gov.co/ajax/getAllStations/` (verificado, 19 estaciones). Sirve como metadatos de estaciones y monitores (Envista ARM), pero `value` y `Lastvalue` venían en `null`. Los datos históricos se descargan por el formulario `/dynamicTabulars`, que requiere scraping.
- **Estaciones (geometría):** `https://mapas.ambientebogota.gov.co/server/rest/services/Calidad_aire/Estacion_calidad_aire/MapServer/0`, ArcGIS, CC-BY-4.0, actualizado 2025-06-05.

### 2.4 Ciclovía — ✓
- **Publica:** IDRD.
- **URL:** `https://visorsrv.idrd.gov.co/srv/rest/services/RecreacionDeporte/Ciclovia/MapServer/0` (ArcGIS 11.5, CC-BY-4.0, CKAN actualizado 2026-08-05).
- **Campos:** `NOMBRE_TRAMO`, `HORARIO` (p. ej. "7:00 a 14:00"), `ESTADO` ("Activa domingos y festivos"), `DIRECCION`, `NUMERO_DE_GUARDIANES`, `FECHA_ACTUALIZACION`. Son 16 tramos.
- **Valor:** saber si mañana hay ciclovía y por dónde pasa, combinado con el calendario de festivos.
- **Esfuerzo:** bajo.
- **Límite:** son tramos estáticos. Los cierres puntuales y eventos (Ciclovía nocturna, cambios) solo salen en `idrd.gov.co/ciclovia` en HTML, lo que exige scraping (`robots.txt` de idrd.gov.co es de Drupal estándar).

### 2.5 Residuos y reciclaje (UAESP, servicio `aseobogota`) — ✓
Base: `https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/serviciospublicos/aseobogota/MapServer/{capa}`

| Capa | Nombre | Registros | Campos clave |
|---|---|---|---|
| 5 | Macrorutas de Recolección (ya integrada) | 115 | IDMACRUT, IDFRECUE_, HORAINICIO1, HORAFIN1, LOCALIDAD |
| 7 | Macrorutas de Barrido | — | — |
| **8** | **Contenerización** | **11.167** | DIRECCION, CAPACIDAD, **APROVECHAB** (contenedor blanco o negro), CONCESIONARIO, FECHAINSTA |
| 10 | Cestas | — | — |
| **3** | **CAU (Centros de Atención al Usuario)** | **10** | OPSA, DIRECCION, TELEFONO, **HORARIO**, LOCALIDADES |
| 6 | Puntos críticos de arrojo clandestino | — | — |
| 4 | Área de Servicio Exclusivo (ASE) | — | permite mapear la dirección del ciudadano a su operador |

- **Licencia:** CC-BY-SA-4.0. La ficha CKAN del CAU se actualizó por última vez el 2022-05-17; la de macrorutas el 2026-05-11.
- **Reciclaje adicional:** "Estación de clasificación y aprovechamiento (ECA)" de la SDP, en GeoJSON/SHP/GPKG con fecha 2022-11-16 (puede estar desactualizado). "Gestión residuos Punto Limpio" de UAESP (2026-09-01) solo trae estadísticas en XLSX, **no** ubicaciones.
- **Esfuerzo:** bajo, porque es el mismo cliente ArcGIS que ya usamos.

### 2.6 Pico y placa Bogotá — ~ (no hay dataset)
- No hay dataset en datosabiertos.bogota.gov.co: la búsqueda "pico y placa" devuelve solo resultados que no tienen que ver.
- La fuente oficial es HTML semanal en bogota.gov.co, p. ej. `https://bogota.gov.co/mi-ciudad/movilidad/consulta-el-pico-y-placa-en-bogota-semana-del-16-al-22-de-febrero-2026` (200), más los decretos de la Secretaría Distrital de Movilidad. `robots.txt` de bogota.gov.co solo bloquea rutas internas de Drupal.
- **Regla vigente según la prensa (junio 2026, NO VERIFICADA contra el decreto):** particulares, de lunes a viernes, 6:00–21:00. Días impares circulan las placas terminadas en 1–5; días pares, las terminadas en 6–9 y 0. No aplica sábados ni festivos.
- Ojo: la propia Alcaldía advierte sobre páginas falsas de "pico y placa solidario", así que nunca hay que enlazar a terceros.

### 2.7 Cortes de agua (EAAB) — ~ / NO VERIFICADO
- No hay dataset de suspensiones programadas. Lo que publica la EAAB en CKAN es infraestructura de red (sectores e hidrantes), con licencia **CC-BY-NC-ND-4.0**. Ojo: es una licencia **incompatible** con nuestro CC-BY-SA para obras derivadas.
- La URL "suspensiones-programadas" del portal WebSphere (`acueducto.com.co/wps/portal/...`) redirige a una página genérica de atención; no encontré listado estructurado ni PDF. Los listados diarios aparecen en prensa y en redes de la EAAB. `robots.txt` responde 404.
- **Recomendación:** integrar por ahora "sector hidráulico de mi dirección", que es posible pero tiene licencia NC-ND, y dejar los cortes como **pendiente** o con carga manual a partir de comunicados oficiales.

### 2.8 Cortes de luz (Enel Colombia) — ✗
- `https://www.enel.com.co/es/personas/mantenimientos-programados.html` devuelve **403** o la página "Pardon Our Interruption" de **Imperva**, el antibot. `robots.txt` dice `Allow: /`, pero la protección antibot hace que el scraping no sea viable ni apropiado.
- No hay dataset abierto. Lo más cercano es nacional: Superservicios, "Información de suspensión del servicio" (`datos.gov.co`, id `cqs7-ti4m`, CC-BY-SA-4.0, filas actualizadas al 2025-09-12). Es histórico agregado (empresa, fecha, duración, usuarios) y no sirve como aviso de cortes futuros.

---

## 3. Medellín / Valle de Aburrá

### 3.1 GTFS Metro de Medellín (oficial) — ✓ VERIFICADO, con salvedades
- **Publica:** Metro de Medellín, en su portal ArcGIS Hub `https://datosabiertos-metrodemedellin.opendata.arcgis.com/` (búsqueda: `/api/search/v1/collections/all/items?q=GTFS`).
- **Descarga (2025):** `https://www.arcgis.com/sharing/rest/content/items/929fbd2dbfbf493ab44935577e8fbff6/data`, ZIP de 2,5 MB (`GTFS-Metro_de_Medellin_2025.zip`). También hay versiones 2017, 2019, 2022 y 2024.
- **Rutas:** Líneas A y B (metro), Tranvía T-A, **Metroplús 1, 2 y O** (buses) y los cables J, K, H, M, L y P. Son 12 rutas en total.
- **Problemas:** los archivos vienen **dentro de una subcarpeta** `GTFS-2025/`, lo que no cumple la especificación, así que hay que re-empaquetarlos. Además, `calendar.txt` **vence el 20251231**: hoy el feed está vencido, aunque sirve para geometría y frecuencias. El campo de licencia está vacío: **sin licencia declarada**.
- **Otros recursos verificados del Hub:** "Rutas Alimentadoras", "Paradas Alimentadoras", "Estaciones Sistema Metro" y "Líneas Sistema Metro" (Feature Services vía utility.arcgis.com, modificados 2026-07-02), "Afluencia Metro 2019–2026" y "Tarifas rutas integradas".
- **Esfuerzo:** medio, por el re-empaquetado y la extensión del calendario, que hay que marcar como "estimado".

### 3.2 EMVARIAS — macrorutas de recolección — ✓ VERIFICADO
- `datos.gov.co`, id **`3p5t-k2ce`** "MACRORUTAS DE RECOLECCIÓN Y TRANSPORTE", publicado por Empresas Varias de Medellín. Licencia CC-BY-SA-4.0. Filas actualizadas al 2025-03-25; son 136.
- **API:** `https://www.datos.gov.co/resource/3p5t-k2ce.json` (Socrata/SODA).
- **Campos:** `macroruta_c_digo`, `localidad_comunas_o_similares` (descripción textual de la zona, p. ej. "Norte: Calle 99 desde Río Medellín hasta Cra 42B."), una columna por día de la semana (`l`, `m`, `w`, `j`, `v`, `s`, `d`, con "X" o "N/A"), `hora_de_incio` y `hora_de_finalizaci_n`.
- **Valor:** alto. **Esfuerzo:** medio, porque no trae geometría: hay que geocodificar de texto a comuna/barrio o hacer la búsqueda por comuna.
- También existe "MACRORUTAS BARRIDO Y LIMPIEZA" (`eu64-xhsa`).

### 3.3 MEData (portal de la Alcaldía) — ✓ (API DKAN)
- `https://medata.gov.co/api/1/search?fulltext=residuos`: es Drupal + DKAN 2 y devuelve JSON. Encontré "ECAS Estaciones de Clasificación y Aprovechamiento" (CSV/JSON, 01-02-2025). "aire", "pico" y "ciclovia" dieron 0 resultados o error en esta API.
- La página oficial de pico y placa (`medellin.gov.co/es/secretaria-de-movilidad/pico-y-placa/`, 200) **sigue mostrando la rotación de 2024 (Decreto 0592 de 2024)**. Es un ejemplo claro de por qué la tabla de reglas necesita una fecha de verificación.

### 3.4 SIATA — calidad del aire — ~ (congelado)
- `https://siata.gov.co/EntregaData1/Datos_SIATA_Aire_AQ_pm25_Last.json` responde 200 con formato tipo OpenAQ (525 mediciones), pero el **Last-Modified es 2024-09-05**: está congelado desde hace más de 2 años. `Datos_SIATA_Aire_pm25.json` tiene Last-Modified 2024-08-31.
- El portal de descarga actual (`/descarga_siata/...`) pide login. robots.txt responde 404.
- **Conclusión:** no hay fuente abierta y actual verificada para el aire de Medellín. Alternativas sin verificar: OpenAQ v3 (requiere API key) y el AMVA. **NO VERIFICADO.**

### 3.5 Pico y placa Medellín (2.º semestre 2026, según la prensa; decreto NO VERIFICADO)
Particulares (último dígito) y motos (primer dígito), de 5:00 a 20:00, desde el 3 de agosto de 2026 hasta finales de enero de 2027: lunes 5 y 8, martes 1 y 4, miércoles 0 y 2, jueves 3 y 6, viernes 7 y 9.

---

## 4. Cali
- **GTFS MIO:** no hay feed oficial. El comunitario `ColombiaInfo/ColombiaGTFS/Cali - Mio/GTFS-MIO.zip` (Mobility Database mdb-3356, `inactive`, `is_official=False`) cubre de 2017-08-14 a 2022-01-01: **vencido**.
- **Portal `datos.cali.gov.co`:** es CKAN, con API `/api/3/action/package_search` verificada.
  - **Aire:** el "Índice de Calidad del Aire - ICA" es un CSV con recurso de 2020-11-03 (viejo); también hay CSV históricos por estación (2013–2021). Licencia cc-by-sa. Sirve para histórico, no para tiempo real.
  - **Residuos:** el GeoServer IDESC (`https://ws-idesc.cali.gov.co/geoserver/dapm/ows`, WFS, GeoJSON con `outputFormat=application/json`) es verificable. La capa `dapm:pgirs_pspa_rtt_tpe_rutas` tiene **solo 18 microrutas rurales**. `dapm:pgirs_mtrs_apr_bodegas_reciclaje` es útil para el tema reciclaje. Hay además `pgirs_mtrs_apr_microrutas_recicladores_urbano`. No encontré horarios de recolección urbana.
- **Pico y placa / ciclovía:** 0 resultados en el portal.

## 5. Costa y otras ciudades
- **Cartagena — Transcaribe:** `datos.gov.co` id **`nemj-z89t`**, "Paraderos del SITM Transcaribe" (CC-BY-SA-4.0, 2025-12-15, 948 filas). Trae ruta, tipo y **horarios** de primera y última salida para lunes a viernes, sábado y domingo/festivo. Es casi GTFS "a mano" y **de esfuerzo bajo**. También hay un GTFS comunitario de 2023.
- **Barranquilla — Transmetro:** `datos.gov.co` id **`hxy3-94yh`**, "Paraderos del Sistema" (928 filas, secuencia por ruta con coordenadas, CC-BY-SA-4.0), pero **de 2020-09-28**. GTFS comunitario de 2022-05. `transmetro.gov.co` no respondió y `barranquilla.gov.co/transparencia/datos-abiertos` devolvió 403.
- **Bucaramanga — Metrolínea:** en `datos.gov.co` solo hay activos de información (2020). GTFS comunitario de 2022-02. Sobre residuos hay toneladas por microruta (`g275-3zkr`, 2025-12) y una "story" de rutas que no es dato estructurado.
- **Pereira — Megabús:** GTFS y KML comunitarios (2020-08). En `datos.gov.co` están "Estaciones SIT Pereira" (`w6sc-6cef`, 2023) y rutas sueltas como Socrata maps (2021).
- **Municipios con rutas de aseo en Socrata (buen patrón replicable):** Envigado (`jj4i-2cgc`, con barrio, días, franja y horario), Piedecuesta (`xhge-x3v2`), Palmira (`494j-k65z`), El Carmen de Viboral (`5ynt-xcuf`, 2026-07), Serviciudad (`tzmp-pd3h`, 2026-06).
- **GTFS comunitarios:** el repositorio `https://github.com/ColombiaInfo/ColombiaGTFS` tiene licencia **CC-BY-SA-4.0** y su último commit es del 2026-09-23. Cubre Armenia, Barranquilla, Bucaramanga, Cali, Cartagena, Manizales, Medellín, Montería, Pasto (solo KMZ), Pereira, Popayán, Santa Marta, Sincelejo, Valledupar y otras. La mayoría tiene fechas de 2018 a 2023, así que son útiles como semilla de geometría y paraderos, **no como horarios confiables**.

---

## 6. Cómo modelar el pico y placa con honestidad

Ninguna ciudad grande publica las reglas como dato. Solo existen decretos, en PDF o HTML, y notas de prensa. El único dataset relacionado, de Copacabana (`kvf9-pwe6`), lista **permisos de placas exentas**, no las reglas. Propuesta:

```
pico_y_placa_reglas (
  ciudad, tipo_vehiculo,            -- particular | moto | taxi | carga
  vigencia_desde, vigencia_hasta,   -- del decreto
  modo,                             -- 'dia_semana' | 'par_impar' | 'rotacion_taxi'
  dia_semana NULL, paridad_dia NULL,
  digitos  int[],                   -- [5,8]
  posicion_digito,                  -- 'ultimo' | 'primero' (motos Medellín)
  hora_inicio, hora_fin,            -- puede haber 2 franjas (Cartagena)
  aplica_festivos bool, aplica_sabados bool,
  exenciones text[],                -- eléctricos/híbridos, gas, etc.
  fuente_url, fuente_tipo,          -- 'decreto' | 'pagina_oficial' | 'prensa'
  verificado_en date, verificado_por
)
```

- Una función pura `restringido(ciudad, placa, tipo, fecha_hora)` evalúa las reglas junto con el calendario de festivos nacional.
- En la API y el MCP siempre se devuelve `fuente_url`, `verificado_en` y una advertencia ("confirme en la Secretaría de Movilidad"). Si la fecha cae fuera de `vigencia_hasta`, se responde "sin regla vigente conocida" en lugar de adivinar.
- Para el mantenimiento: es carga manual (un PR por decreto) cada semestre en Medellín y Cali, y cuando cambie el decreto en Bogotá. Se puede detectar el cambio monitoreando el hash del HTML oficial, sin hacer scraping de contenido.

## 7. Notas de licencia y riesgo
- Bogotá (CKAN y ArcGIS) usa en su mayoría CC-BY-SA-4.0 o CC-BY-4.0, que son compatibles.
- EAAB usa **CC-BY-NC-ND-4.0**: no es compatible para redistribuir derivados.
- El GTFS del Metro de Medellín y el IBOCA no declaran licencia; conviene escribir a los publicadores (TransMilenio: `radicacion@transmilenio.gov.co`, según `feed_info`).
- Los endpoints sin documentar (IBOCA, RMCAB `/ajax`) pueden romperse sin aviso. Hay que cachear los datos, mostrar su fecha y degradar sin fallar.
