# Bogotá al Día → Colombia: ecosistema, marco legal, arquitectura y tiempo real

Investigación del 2026-10-12. Todo lo marcado **[verificado]** se comprobó con peticiones reales (curl a la API, API de GitHub, catálogo de Socrata o de la Mobility Database) en esa fecha. Lo marcado **[sin verificar]** viene de búsquedas web o de memoria y hay que confirmarlo antes de tomar una decisión.

---

## 1. Ecosistema existente

### 1.1 Tabla resumen

| Proyecto | Qué cubre | Licencia | ¿Mantenido? | ¿Reusar o contribuir? |
|---|---|---|---|---|
| **api-colombia.com** ([Mteheran/api-colombia](https://github.com/Mteheran/api-colombia)) | REST: departamentos, 1123 "ciudades", turismo, presidentes, aeropuertos, radios, resguardos | MIT (código). Los datos no declaran licencia | Sí: 359★, último push 2026-09-10, 2 issues abiertos **[verificado]** | **No como fuente.** `City` no expone el código DIVIPOLA, y muchos municipios vienen con `population`/`postalCode` en `null` (p. ej. Puerto Nare) **[verificado]**. Sirve como referencia de UX de API. Se podría contribuir un campo `divipola`. |
| **DIVIPOLA en datos.gov.co** (`gdxc-w37w`, DANE) | 1103 municipios, 18 áreas no municipalizadas, 1 isla (= 1122 filas), con lat/lon | CC-BY-SA-4.0, atribución "DANE", actualizado 2026-09-24 **[verificado]** | Oficial | **Usar como llave maestra.** Un solo JSON de ~150 KB. |
| **crexative/colombia-mcp-server** (npm `@crexative/colombia-mcp-server`) | MCP de 15 tools encima de api-colombia (regiones, turismo, presidentes…) | MIT | 5★, último push 2025-12-16: estancado **[verificado]** | No. No es cívico del día a día y hereda los huecos de api-colombia. |
| **manuelcastiblan/colombia-datos-mcp** | MCP en Python, 19 tools: catálogo datos.gov.co, SECOP, crimen, DIVIPOLA y MGN con geometría. Tiene una sección "antes de citar una cifra" | MIT | Muy nuevo: 0★, push 2026-10-09 **[verificado]** | **Es el aliado más cercano.** Se enfoca en análisis (SECOP, crimen); nosotros en el día a día. Conviene enlazarlo, no duplicarlo. Si alguien pide "contratos de mi municipio", lo remitimos allá. |
| **reines-dev/colombia-opendata-mcp**, **alcastaro/colombian-open-data-mcp**, **pipeworx-io/mcp-datos-co**, **BOTOOM/146-datos-abiertos-mcp** | Envoltorios genéricos de Socrata para datos.gov.co: search, metadata, query SoQL | MIT / Apache-2.0 | 0–1★; varios sin cambios desde marzo **[verificado]** | No. Son genéricos: el agente tiene que saber qué dataset y qué columnas pedir. Nuestro valor está en el dato curado y normalizado. |
| **cyanheads/socrata-mcp-server** | MCP genérico para cualquier portal Socrata (sirve para datos.gov.co) | Apache-2.0 | Activo, push 2026-10-04 **[verificado]** | Se puede **recomendar como complemento** para preguntas "long tail" que no curamos. |
| **npstorey/civic-ai-tools** | MCP cívico para NYC Open Data y Data Commons, con "record packages" verificables | MIT | Activo (41★) | Inspiración de diseño (procedencia, reproducibilidad). No cubre Colombia. |
| **codespar/mcp-dev-latam** | MCP de comercio LATAM (Pix, NF-e, banca…) | MIT | 273★ | Fuera de alcance. |
| **kevyder/banrepco_mcp** | MCP del Banco de la República (TRM, tasas) | MPL-2.0 | Activo (push 2026-10-11) | Complementario. No hace falta duplicar la TRM. |
| **Angelthebestone/Normativa-colombiana-MCP**, **matematicsolutions/co-eli-mcp** | Normativa y jurisprudencia | MIT / Apache | Nuevos | Fuera de alcance; se pueden enlazar. |
| **JGaldo-beep/migracion-citas-cli** | CLI y MCP para monitorear citas de Migración Colombia | MIT | 2026-08 | Ojo: automatiza un portal transaccional. **No replicar ese patrón.** |
| **ColombiaInfo/ColombiaGTFS** | GTFS comunitarios: MIO Cali (vigencia 2017–2021), Metro Medellín ("frequencies y stop_times necesitan corrección"), buses intermunicipales | CC-BY-SA-4.0 | Push 2026-09-23, 11★ **[verificado]** | Útil como semilla; los datos no están al día. Contribuir solo si una ciudad no tiene feed oficial. |
| **omtu-unibague/gtfs-ibague** | GTFS de Ibagué, presentado como "oficial" (observatorio de la Universidad de Ibagué) | Sin licencia en el repo | Push 2026-05-22; "active" en la Mobility Database **[verificado]** | Candidato para la segunda ciudad con transporte. Hay que pedirles una licencia explícita. |
| **juandbc/festivos-colombia** (JS), **MauricioRobayo/colombian-holidays** (JS) | Festivos por año (Ley Emiliani) | MIT | Ambos activos (2026-09/10) **[verificado]** | **Reusar la lógica**, o vendorizar la tabla, en lugar de recalcular festivos: es dato cívico diario y aplica igual en todo el país. Ojo: `lib/` no tiene dependencias, así que conviene generar `data/co/festivos.json` en build. |
| **MauricioRobayo/pyphoy** | Pico y placa (Python, último push 2021) | MIT | Abandonado | No. Pico y placa cambia por decreto local; habría que curarlo nosotros, ciudad por ciudad. |
| **Mteheran/opensource-colombia** | Lista curada de proyectos open source colombianos | — | Activo (2026-08) | **Pedir que nos incluyan**: da visibilidad sin costo. |
| **Mobility Database** (MobilityData) | Catálogo mundial de GTFS y GTFS-RT | Catálogo abierto | Activo | **Fuente para descubrir feeds** y lugar para **registrar** los que encontremos. Para Colombia lista solo 7 feeds estáticos y 0 GTFS-RT **[verificado]**. |
| **Google Maps / Moovit** | Rutas de transporte en Bogotá y otras ciudades | Propietario | — | No son reutilizables: sus términos prohíben extraer datos. Solo sirven de comparación de cobertura **[sin verificar en detalle]**. |

### 1.2 Conclusión del ecosistema

- No existe un "Bogotá al Día nacional". Los MCP colombianos que hay son (a) envoltorios genéricos de Socrata, (b) temáticos de análisis (SECOP, crimen, finanzas) o (c) turísticos. Ninguno cubre el día a día ciudadano (basura, transporte, festivos, trámites, puntos de atención) con datos curados, ni ofrece a la vez web y MCP y CLI.
- **No reconstruir**: los wrappers de Socrata, SECOP y la TRM. Basta enlazarlos en `llms.txt` o en una sección "otros servidores MCP útiles".
- **Reusar**: el DIVIPOLA del DANE como llave, los festivos (MIT) y los GTFS listados en la Mobility Database.
- **Contribuir**: registrar en la Mobility Database los feeds que encontremos y proponer el campo `divipola` a api-colombia.

---

## 2. Marco legal y ética

### 2.1 Qué dice cada norma (resumen práctico)

- **Ley 1712 de 2014 (Transparencia y acceso a la información pública).** El art. 6 define los *datos abiertos* como datos que las entidades ponen a disposición "de forma libre y sin restricciones, con el fin de que terceros puedan reutilizarlos y crear servicios derivados". El art. 11 obliga a publicar información mínima en formatos abiertos. Los arts. 18 y 19 fijan las **excepciones**: información clasificada (intimidad, datos personales) y reservada (defensa, seguridad, etc.). La reglamentan el Decreto 1081 de 2015 y la Resolución MinTIC 1519 de 2020 (Anexo 4, datos abiertos). **Implicación:** reutilizar datos abiertos y hacer servicios derivados es exactamente el uso que la ley busca. No hace falta pedir permiso.
- **Ley 1581 de 2012 (Habeas data) y Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015).** Aplica a *cualquier* tratamiento de datos de personas naturales identificadas o identificables. El art. 10 exime de autorización a los "datos de naturaleza pública", pero los principios del art. 4 siguen aplicando: **finalidad**, **libertad**, **circulación restringida** y **seguridad**. Re-publicar y cruzar datos públicos de personas con otra finalidad puede violarlos. Los datos sensibles (art. 5: salud, orientación, biométricos, datos de menores, etc.) tienen protección reforzada.
- **Ley 1273 de 2009 (delitos informáticos).** Art. 269A, *acceso abusivo a un sistema informático*: entrar o mantenerse en un sistema "contra la voluntad de quien tiene el derecho legítimo de excluirlo". Art. 269F, *violación de datos personales*: compilar u obtener datos personales sin estar facultado y en provecho propio o ajeno. **Implicación:** nunca usar APIs privadas obtenidas por ingeniería inversa, ni saltarse logins o captchas, ni recopilar bases de datos de personas.
- **Derecho de autor (Ley 23 de 1982 y Decisión Andina 351).** Las *compilaciones* de datos pueden estar protegidas por la selección y la disposición. Lo que habilita la reutilización es la licencia del dataset, no la Ley 1712. Por eso la licencia de cada fuente tiene que quedar registrada.

### 2.2 Licencias en datos.gov.co (verificado sobre los 8417 datasets del catálogo Socrata)

| Licencia | Datasets |
|---|---|
| CC BY-SA 4.0 | **8319 (98,8 %)** |
| CC BY 4.0 | 29 |
| Sin licencia declarada | 27 |
| **CC BY-ND 4.0 (sin derivadas)** | **22** |
| Dominio público / CC0 | 17 |
| Otras (OGL PEI, CC BY-NC-SA 3.0) | 3 |

Qué implica cada caso:
- **CC BY-SA 4.0**, el caso normal: hay que (1) atribuir a la entidad productora, (2) enlazar la licencia, (3) **indicar si hubo cambios** ("normalizado por Bogotá al Día"), y (4) **publicar las derivadas bajo CC BY-SA 4.0** o una licencia compatible. El repo ya cumple con `data/` en CC-BY-SA-4.0 y el código en MIT, que es correcto porque código y datos son obras separadas. No se pueden mezclar datos SA con datos NC o ND en un mismo archivo derivado.
- **CC BY-ND**: se puede redistribuir **solo sin modificar**. Normalizar o recortar el dataset ya es una obra derivada. Esos datasets se excluyen, o se enlazan sin transformarlos.
- **Sin licencia o NC**: no se ingieren. Se enlazan, o se escribe a la entidad pidiendo una licencia abierta (la Resolución 1519/2020 les exige tenerla).
- **Servidores ArcGIS municipales y distritales.** El software de Esri no fija condiciones de uso propias: mandan las de la entidad. Por ejemplo, IDECA o Catastro Bogotá usó CC BY 4.0 en su instructivo de 2019, pero su "Política de derechos de autor" menciona restricciones al uso comercial **[sin verificar la versión vigente]**. Los ítems "GTFS Estáticos" del hub de TransMilenio **no tienen `licenseInfo`** **[verificado vía la API del Hub]**. Por eso la licencia se registra **por capa o por ítem**, no por dominio. Si falta, se marca `licencia: "no declarada"` y se pide por escrito.
- **robots.txt** **[verificado]**:
  - `datosabiertos.bogota.gov.co` tiene `Disallow: /api/` y `Crawl-Delay: 10`. Si algún extractor usa la API CKAN de ese portal, hay que pasar a las URLs de descarga de recursos, o pedir permiso.
  - `www.datos.gov.co` tiene `Crawl-delay: 1`. La API SODA (`/resource/`) está pensada para consumo programático; conviene usar un App Token.
  - `gis.transmilenio.gov.co` y `serviciosgis.catastrobogota.gov.co` no tienen robots.txt (404).

### 2.3 Lista concreta: hacer y no hacer

**Hacer**
1. Ingerir solo fuentes **oficiales y abiertas** con licencia explícita (CC BY, CC BY-SA, CC0 o dominio público), y registrar la licencia **por dataset** en el registro de fuentes.
2. Atribuir en cada vista, en cada respuesta de API o MCP y en `llms.txt`: entidad, nombre del dataset, URL, licencia, fecha de extracción y la nota "modificado/normalizado".
3. Mantener `data/` en CC-BY-SA-4.0. Si algún día se mezclan fuentes CC BY con CC BY-SA, el resultado sale en BY-SA.
4. Identificarse en las peticiones: `User-Agent: BogotaAlDia/1.x (+https://bogota-al-dia.vercel.app; contacto)`. Hoy los extractores no ponen User-Agent **[verificado: grep en `scripts/`]**.
5. Ser cortés con los servidores: paginar según `maxRecordCount`, hacer las peticiones en serie con pausas, respetar `Crawl-delay`, extraer con poca frecuencia (semanal o diaria) y cachear.
6. Publicar un aviso visible de que el proyecto no es oficial y un canal para que una entidad pida correcciones o el retiro de datos.
7. Para datos con personas (por ejemplo funcionarios de un punto de atención), publicar solo el **cargo y el canal institucional**, nunca nombres ni contactos personales.

**No hacer**
1. **No** publicar ni cruzar datos de personas naturales: nombres o cédulas de contratistas de SECOP, beneficiarios de subsidios, víctimas, comparendos con placa o nombre, RUES de personas naturales, censos electorales, etc. Aunque estén "públicos" en datos.gov.co, re-publicarlos con otra finalidad choca con los principios de la Ley 1581 y, si se compilan, roza el art. 269F de la Ley 1273.
2. **No** usar APIs privadas obtenidas por ingeniería inversa. Ejemplo real: un repo comunitario consume "el API de TransMilenio obtenido por ingeniería inversa" para tener buses en vivo **[verificado en su README]**. Riesgo del art. 269A y de los términos de uso de la app.
3. **No** saltarse logins, captchas ni límites de tasa, ni hacer scraping de portales transaccionales: citas, consulta de puesto de votación (Registraduría), SIMIT por cédula o placa.
4. **No** ingerir datasets CC BY-ND, NC o sin licencia como datos derivados.
5. **No** presentar el sitio como un canal oficial ni usar logos de entidades.
6. **No** guardar datos de los usuarios del MCP o la API: ni consultas con direcciones ni ubicaciones. Si en el futuro hay "mi dirección → mi ruta de basura", la geocodificación se hace en el cliente o sin persistir nada.
7. **No** inferir datos que la fuente no dice (va en la línea del principio "nunca inventar" del producto).

---

## 3. Arquitectura para pasar de 1 ciudad a ~1100 municipios (mínima y YAGNI)

### 3.1 Principio

La cobertura va a ser **muy dispersa**: unas pocas ciudades con datos ricos (Bogotá, Medellín, Cali, Barranquilla, Bucaramanga, Ibagué…) y un **piso nacional** que aplica a todos los municipios (DIVIPOLA, festivos, quizá puntos de atención nacionales). El diseño tiene que funcionar con 1 ciudad rica y 1121 municipios casi vacíos sin generar 1100 archivos vacíos.

### 3.2 Hacer AHORA (cambios pequeños, sin romper nada)

1. **La llave es el código DIVIPOLA de 5 dígitos, como string.** Bogotá es `"11001"`. Se agrega `data/co/municipios.json` generado desde `gdxc-w37w` con `{ codigo, nombre, departamento, cod_dpto, tipo, lat, lon }` (1122 filas, unos 150 KB). Ojo: el dataset trae coordenadas con coma decimal ("-75,58") **[verificado]**, así que hay que normalizarlas. Las localidades de Bogotá siguen siendo una subdivisión dentro de 11001.
2. **El sobre de cada dataset declara su municipio**: se agrega `municipio: "11001"` (o `ambito: "nacional"`) al sobre `{ generado, fuente, licencia, total, … }` que ya existe. Por ahora **no se mueven archivos**.
3. **Registro de fuentes, un JSON por fuente**, en `sources/<id>.json`. `resumen()` y `docs/sources.md` se generan a partir de él:
   ```json
   {
     "id": "bogota-transmilenio-estaciones",
     "municipio": "11001",
     "dominio": "transporte",
     "entidad": "TransMilenio S.A.",
     "url": "https://gis.transmilenio.gov.co/arcgis/rest/services/Troncal/consulta_estaciones_troncales/MapServer/0",
     "tipo": "arcgis-featureserver",
     "licencia": "CC-BY-SA-4.0",
     "licencia_url": "…",
     "cadencia": "semanal",
     "extractor": "scripts/extract-estaciones.ts",
     "salida": "data/transmilenio/estaciones.json",
     "schema": "schemas/estacion.json",
     "estado": "activa"
   }
   ```
   `tipo` permite tener extractores genéricos más adelante: `arcgis-featureserver`, `socrata`, `ckan`, `gtfs`, `manual`. Con eso, agregar una ciudad que usa ArcGIS o Socrata es casi solo escribir un JSON.
4. **Generalizar las tools MCP por dominio, no por ciudad.** Se agrega un parámetro opcional `municipio` (código DIVIPOLA o nombre) con **default `"11001"`**, así los clientes actuales no se rompen. Se agregan dos tools, `municipios` y `cobertura`:
   - `municipios({ query })` resuelve "Medellín", "medellin" o "05001" a un código y responde qué hay disponible ahí.
   - `cobertura({ municipio })` lista los datasets que existen para ese municipio, con fuente y licencia. Así el agente no adivina: si no hay dato, lo dice. Encaja con el principio "nunca inventar".
   - Para el resto, nombres por dominio: `transporte_estaciones`, `transporte_rutas`, `recoleccion`, `festivos`… Los nombres actuales (`estaciones_transmilenio`, etc.) se mantienen como alias un tiempo.
   - **Regla:** tools ≈ dominios (unas 8–15), nunca dominio × municipio. El municipio siempre es un parámetro.
5. **User-Agent identificable** en los extractores y **revisión de licencia** de cada capa ArcGIS que ya se usa.

### 3.3 Hacer DESPUÉS (cuando llegue la 2.ª ciudad o el 2.º dominio nacional)

- **Mover a `data/<divipola>/<dominio>/<dataset>.json`**, más `data/co/` para lo nacional. `load()` ya cachea por archivo, así que la carga queda perezosa por municipio sin cambios en `lib/`, salvo construir la ruta.
- **Un solo workflow con matriz** generada desde `sources/*.json`, con un cron **diario** que solo ejecuta las fuentes "vencidas" según su `cadencia`. Así un fallo de una fuente no tumba las demás. Límites de GitHub Actions **[según la documentación de GitHub; no verificado hoy]**:
  - En repos públicos los minutos son gratis e ilimitados en runners estándar.
  - Cada job dura como máximo 6 h; una matriz admite hasta 256 jobs.
  - El cron puede atrasarse en horas pico.
  - **Los workflows programados se desactivan solos tras 60 días sin actividad en el repo.** Como solo se commitea cuando hay cambios, un periodo de datos estables podría apagarlo. Hace falta un keepalive, por ejemplo un commit mensual de `data/estado.json` con la última verificación, que además sirve como dato de frescura.
- **Páginas estáticas por municipio solo si tienen datos.** Los 1100 municipios pueden tener una página "piso" (festivos más "no tenemos datos locales aún"), lo que da unas 1100–3000 páginas: trivial para Astro. Vercel **[verificado en /docs/limits, 2026-09-16]**: build de 45 min como máximo, sin límite de archivos de salida (se avisa que con más de 100 000 se alargan los builds), límite de 15 000 archivos solo para subidas por CLI, 100 deployments al día en Hobby. **Ojo:** Hobby es para uso no comercial. Un proyecto cívico personal cabe ahí. Si se agrega ancho de banda masivo de agentes, hay que vigilar el uso justo de transferencia.
- **Tamaño.** Hoy `data/` pesa 276 KB y `dist/` 4 MB con 620 archivos **[verificado]**. El riesgo grande es **GTFS**: el GTFS oficial de Bogotá pesa unos 117 MB comprimido y `stop_times.txt` ocupa 549 MB descomprimido **[verificado]**. **Nunca** se commitea crudo: GitHub bloquea archivos de más de 100 MB y recomienda repos de menos de 1 GB. Se preprocesa en el workflow a JSON compactos y útiles (paradas, rutas, frecuencias o primeras y últimas salidas por ruta) de unos pocos MB, y se descarta el resto. Si una ciudad supera unos 50 MB de JSON útil, se pasa a Vercel Blob, Cloudflare R2 o GitHub Releases como artefacto y el MCP lo carga bajo demanda. **No antes.**
- **Función MCP en Vercel.** Hoy `readFileSync` lee `data/` empaquetado con la función. El límite de bundle es de 250 MB descomprimido, de sobra mientras `data/` siga en MB. Si crece, la función hace `fetch` del JSON estático del propio sitio (`/api/...json`), que ya está cacheado en el CDN.

### 3.4 NO hacer (YAGNI)

- No montar una base de datos (Postgres, Neon, Supabase). Un sitio estático con JSON escala a este volumen.
- No crear un servidor MCP por ciudad, ni tools por ciudad.
- No crear "plantillas vacías" para 1100 municipios con datos fingidos.
- No hacer un extractor genérico "universal" antes de tener 3 fuentes del mismo `tipo`.

---

## 4. Tiempo real

### 4.1 Lo verificado

- **Mobility Database: 0 feeds GTFS-RT para Colombia** **[verificado: `feeds_v2.csv`, filtro `country_code=CO`]**. Los 7 feeds estáticos que lista son:
  - SIMUR Bogotá: activo, con URL a `storage.googleapis.com/gtfs-estaticos/GTFS-2026-04-29.zip`.
  - Ibagué: activo.
  - MIO Cali: inactivo.
  - Metro Sabanas (Sincelejo): inactivo o deprecado.
- **Hallazgo fuerte: TransMilenio publica el GTFS estático oficial completo, a diario.**
  - Está en el bucket público `gs://gtfs-estaticos` (330 objetos; el más reciente es `GTFS_20261012.zip`).
  - El hub oficial `datosabiertos-transmilenio.hub.arcgis.com` lo enlaza (ítems "GTFS Estáticos AAAA-MM-DD").
  - Agencias incluidas: Troncal, Alimentadores, Dual, **Zonal-Urbano, Zonal-Complementario**…
  - `feed_info`: publisher Transmilenio S.A., vigencia 2026-01-01 a 2026-12-31.
  - Incluye `frequencies.txt` y `fare_attributes.txt`.
  - Esto **resuelve la limitación "no incluye SITP zonal"** del producto.
  - Pendiente: los ítems del Hub no declaran licencia, hay que pedirla a TransMilenio. `http://www.simur.gov.co/gtfs` ya devuelve 404, pero la URL del bucket funciona.
- **Bogotá en vivo**: TransMiApp ("Ubica tu bus") tiene posiciones en tiempo real (GNSS), pero **no hay feed público**. La única vía conocida es la ingeniería inversa, que está descartada (ver 2.3).
- **Medellín**: no se encontró GTFS oficial ni RT. El GTFS comunitario de ColombiaInfo tiene errores reconocidos.
- **Otros feeds "vivos" que no son de transporte** (para otras búsquedas):
  - SIATA (Medellín y Valle de Aburrá) publica JSON abiertos, por ejemplo `siata.gov.co/EntregaData1/Datos_SIATA_Aire_pm25.json` (200 OK, 18 MB) **[verificado]**. Hay que revisar su licencia.
  - datos.gov.co tiene datasets de calidad de aire "en tiempo real" de algunas autoridades ambientales, con actualización irregular **[verificado vía catálogo]**.

### 4.2 Qué es realista

1. **Ya (alto valor, sin tiempo real):**
   - Ingerir el GTFS estático diario de TransMilenio, filtrado a paradas, rutas zonales y troncales, horarios y frecuencias, con una cadencia semanal o diaria en Actions.
   - Responder "qué rutas pasan por esta parada" y "a qué hora sale la primera y la última", dejando claro que es la **programación**, no la llegada en vivo.
2. **Alertas:** se mantienen como "pendiente" y se enlazan los canales oficiales. Opción legal: **pedir formalmente a TransMilenio un feed GTFS-RT** (Service Alerts / TripUpdates) por derecho de petición, apoyándose en la Ley 1712, art. 11 y en la Resolución 1519. Si lo publican, se consume con una función serverless más caché de CDN de unos 30 s. No se guarda nada.
3. **Calidad del aire** (SIATA o RMCAB) es el "tiempo real" más alcanzable hoy. Le corresponde a la capa de datos de otro agente.
4. **No** construir infraestructura de tiempo real (Kafka, Redis, colas) para nada de esto.

---

## Fuentes consultadas

- API api-colombia: `https://api-colombia.com/api/v1/City`, `/Department/3`. Repo: https://github.com/Mteheran/api-colombia
- Catálogo Socrata de datos.gov.co: `https://api.us.socrata.com/api/catalog/v1?domains=www.datos.gov.co`. DIVIPOLA: `https://www.datos.gov.co/resource/gdxc-w37w.json`
- Mobility Database: https://files.mobilitydatabase.org/feeds_v2.csv
- GTFS de TransMilenio: https://storage.googleapis.com/storage/v1/b/gtfs-estaticos/o y https://datosabiertos-transmilenio.hub.arcgis.com
- Repos de GitHub citados arriba (metadatos vía api.github.com)
- Límites de Vercel: https://vercel.com/docs/limits
- IDECA y Catastro: [Política de derechos de autor de Catastro Bogotá](https://www.catastrobogota.gov.co/sites/default/files/archivos/planeacion/Pol%C3%ADtica%20de%20derechos%20de%20autor%20CATASTRO%20BOGOT%C3%81.pdf)
- [Licencia abierta de la Superfinanciera (ejemplo de entidad)](https://www.superfinanciera.gov.co/publicaciones/10116019/licencia-abierta-y-condiciones-de-uso-para-datos-abiertos/)
- [TUMI: GTFS Metro Medellín](https://hub.tumidata.org/dataset/gtfs_metro_medellin_medelln)
- [Noticias Caracol: TransMilenio en tiempo real](https://www.noticiascaracol.com/bogota/como-ver-las-rutas-de-transmilenio-y-sitp-en-tiempo-real-so35)
- [BuseTA, el repo que usa ingeniería inversa](https://github.com/NicolasR2/visualizador-red-buses-bogota-tiempo-real)
