# Fuentes nacionales de datos abiertos para "Colombia al Día"

Investigación hecha el 2026-10-12. Cada endpoint se probó con `curl`/`urllib` (`$limit=2`, `count(*)` y agregados SoQL). Los metadatos salen de `https://www.datos.gov.co/api/views/<id>.json` (`rowsUpdatedAt`, licencia y la frecuencia declarada en `custom_fields`).

Patrón común de datos.gov.co (Socrata SODA 2.x):
- Datos: `https://www.datos.gov.co/resource/<id>.json?$limit=N&$where=...&$select=...`
- Metadatos: `https://www.datos.gov.co/api/views/<id>.json`
- Catálogo: `https://api.us.socrata.com/api/catalog/v1?domains=www.datos.gov.co&q=...`
- Todo lo verificado aquí tiene licencia **CC BY-SA 4.0**, salvo UNGRD, que es **CC BY 4.0**. Hay que atribuir la fuente, y CC BY-SA obliga a compartir bajo la misma licencia lo que se derive. Eso coincide con los datos del proyecto.
- Sin token, Socrata limita las peticiones por IP. Con un *app token* gratuito (header `X-App-Token`) el límite sube.
- La llave de unión entre fuentes es el **código DANE del municipio** (5 dígitos, DIVIPOLA). Varios datasets solo traen el nombre del municipio, que hay que normalizar (tildes, "BOGOTA, D.C." frente a "BOGOTÁ D.C.").

---

## Ranking (valor ciudadano / esfuerzo)

| # | Fuente | Entidad | ID / endpoint | Cobertura | Actualización real | Valor | Esfuerzo |
|---|---|---|---|---|---|---|---|
| 1 | DIVIPOLA municipios (base para todo) | DANE | `gdxc-w37w` | 1.122 municipios con DANE y lat/lon | 2025-01-24 | Muy alto (infraestructura) | Bajo |
| 2 | Festivos de Colombia | Ley 51/1983 (cálculo); API Nager.Date | `date.nager.at/api/v3/PublicHolidays/{año}/CO` | Nacional | Calculable para cualquier año | Muy alto | Bajo |
| 3 | TRM (dólar oficial) | Superfinanciera | `32sa-8pi3` | Nacional | 2026-10-09 (vigencia hasta 2026-10-13) | Alto | Bajo |
| 4 | Estaciones meteorológicas en tiempo real | IDEAM y terceros | `57sv-p2fu` | 635 estaciones con depto/municipio | **Hoy**, última observación 2026-10-12 14:47 | Muy alto | Medio |
| 5 | Prestadores y sedes de salud (REPS) | MinSalud | `c36g-9fc2` | 76.821 sedes con DANE de municipio | Corte REPS 2026-03-12 | Muy alto | Bajo-medio |
| 6 | Peajes INVÍAS (ubicación y tarifas) | INVÍAS | `68qj-5xux` | 179 peajes con coordenadas | 2026-09-19 | Alto | Bajo |
| 7 | Tarifas de peajes ANI (concesiones) | ANI | `7gj8-j6i3` | 129 peajes, 1.228 tarifas | 2026-09-02 (último cambio 2026-05-01) | Alto | Bajo-medio (sin coordenadas) |
| 8 | Establecimientos educativos | MinEducación | `cfw5-qzt5` | Nacional, DANE municipio y código DANE del colegio | 2026-09-03 (año 2025: 17.872 EE) | Alto | Bajo |
| 9 | Casas de Justicia y Centros de Convivencia | MinJusticia | `bmcc-69wd` | 158 sedes | 2026-10-05 | Alto | Bajo |
| 10 | Comisarías de Familia | MinJusticia | `7tuu-upb2` | 1.249 filas con DANE y coordenadas | 2026-07-09 | Alto | Bajo-medio |
| 11 | Emergencias y desastres | UNGRD | `2343-nuqp` | Nacional con DANE | 2026-09-22 (datos hasta 2025-12-31) | Medio-alto | Bajo |
| 12 | Centros Zonales ICBF | ICBF | `tkbc-zme7` | 218 centros con coordenadas | 2026-07-23 | Medio-alto | Bajo (lat/lon invertidos) |
| 13 | Precio máximo de medicamentos regulados | MinSalud (CNPMDM) | `nauz-qkjw` | Nacional | 2026-08-29 (vigencia hasta 2026-08-19) | Alto | Bajo |
| 14 | Precios de GNV por estación | MinEnergía (SICOM) | `he3q-86dn` | 92 municipios con DANE | Mensual, último 2026-09-01 | Medio | Bajo |
| 15 | Centros de conciliación y consultorios jurídicos gratuitos | MinJusticia | `7p9a-zd9k`, `4cym-4b76` | 435 y 189 sedes | 2026-07-08 y 2026-03-17 | Medio-alto | Bajo (sin DANE) |
| 16 | Normales climatológicas | IDEAM | `nsz2-kzcq` | Por estación y municipio | 2026-07-27 | Medio | Bajo |
| 17 | Calidad del aire (SISAIRE) | IDEAM | `g4t8-zkc3`, `kekd-7v7h` | Nacional con DANE | Dato horario hasta 2024-12-31 (no es tiempo real) | Medio | Medio |
| 18 | Puestos de votación (Divipole 2023) | Registraduría | `mv2e-prx5` | 12.922 puestos con coordenadas | 2023-10-11 (desactualizado) | Alto en elecciones | Medio |
| 19 | Oficinas FNA | Fondo Nacional del Ahorro | `h3sz-zqij` | 75 oficinas | 2026-09-29 | Bajo-medio | Bajo |
| 20 | Registro Nacional de Turismo (hoteles y agencias formales) | MinCIT | `thwd-ivmp` | 124.676 prestadores con DANE | Agosto 2026 | Medio | Bajo |

Revisados pero no recomendados (o solo como complemento): cuadrantes de Policía `jwvi-unqh` (sin actualizar desde 2020), RUPS `4qkq-csdn` (2021), tarifas de energía publicadas en Superservicios `4is2-3nif` (2024-05), IPS por nivel de atención `s2ru-bqt6` (2022), sedes educativas georreferenciadas `x5ay-984n` (solo 2019), puntos de atención financiera `vkbt-desu` (agregado estadístico), oficinas de Cancillería `cnh8-i5yd` (casi todas en el exterior), actores RUNT (CDA, CEA) `epfm-5fhb`.

**NO VERIFICADO / no encontrado como API abierta:**
- **Precios de gasolina y ACPM (combustibles líquidos):** datos.gov.co no tiene un dataset de precios al público. Los de MinEnergía (`fbht-2fzd`, `339g-zjac`) son volúmenes despachados, no precios. Los precios de referencia por ciudad se publican como PDF o Excel en MinEnergía/CREG/UPME. NO VERIFICADO.
- **Puestos de votación de las elecciones de 2026:** no están en datos.gov.co. El último Divipole georreferenciado es el de 2023.
- **Trámites SUIT / GOV.CO a nivel nacional:** no hay un dataset nacional. Solo existen inventarios sueltos de algunas alcaldías. NO VERIFICADO como API.
- **Notarías (directorio nacional SNR):** no está en datos.gov.co. Solo hay archivos de transparencia de notarías individuales. NO VERIFICADO.
- **Alertas IDEAM (pronóstico y alertas hidrometeorológicas) y alertas UNGRD en tiempo real:** no hay dataset Socrata. NO VERIFICADO.
- **Tarifas de acueducto y aseo del SUI por municipio:** no hay dataset nacional vigente. NO VERIFICADO.

---

## Detalle por fuente

### 1. DIVIPOLA – Códigos de municipios (DANE)
- **Endpoint:** `https://www.datos.gov.co/resource/gdxc-w37w.json`. Relacionados: departamentos `vcjz-niiq` y centros poblados `xaxy-8nri`.
- **Formato:** JSON/CSV (SODA). **Licencia:** CC BY-SA 4.0. **Frecuencia declarada:** semestral. **Última actualización real:** 2025-01-24.
- **Cobertura:** 1.122 registros (municipios, ANM y distritos).
- **Campos:** `cod_dpto, dpto, cod_mpio, nom_mpio, tipo_municipio, longitud, latitud`.
- **Valor:** es la tabla maestra para ubicar al usuario ("estoy en Pasto" → `52001`) y unir todas las demás fuentes.
- **Esfuerzo:** bajo. Se puede incluir como semilla estática en el repo. Ojo: lat/lon vienen como texto con **coma decimal** (`"-75,581775"`).

### 2. Festivos
- **Opción A (recomendada):** calcularlos localmente con la Ley 51 de 1983 (Ley Emiliani: festivos fijos, festivos trasladables al lunes y fechas móviles según la Pascua). Así no se depende de nadie.
- **Opción B:** `https://date.nager.at/api/v3/PublicHolidays/2026/CO`. Probado: HTTP 200, también responde para 2027. Licencia MIT, sin llave.
- **Caveat importante:** para 2026, Nager devuelve **19** festivos e incluye "2026-07-13 Día de la Virgen de Chiquinquirá", que no forma parte del listado de la Ley 51/1983 (18 festivos). Hay que verificarlo contra la normativa vigente antes de usarlo. No hay dataset oficial de festivos en datos.gov.co.
- **Valor:** muy alto ("¿mañana es festivo?", "¿hay pico y placa?", "¿abren las entidades?"). **Esfuerzo:** bajo.

### 3. TRM – Tasa de Cambio Representativa del Mercado
- **Endpoint:** `https://www.datos.gov.co/resource/32sa-8pi3.json?$order=vigenciadesde DESC&$limit=1`
- **Licencia:** CC BY-SA 4.0. **Frecuencia:** diaria. **Última actualización real:** 2026-10-09. El último registro vale 3.194,44 COP, vigente del 2026-10-10 al 2026-10-13, porque cubre el fin de semana y el festivo.
- **Campos:** `valor, unidad, vigenciadesde, vigenciahasta`. 8.365 filas históricas.
- **Valor:** "¿a cómo está el dólar hoy?". **Esfuerzo:** bajo.

### 4. Datos de estaciones IDEAM y terceros (tiempo real)
- **Endpoint:** `https://www.datos.gov.co/resource/57sv-p2fu.json`
- **Licencia:** CC BY-SA 4.0. **Frecuencia:** diaria (en la práctica, cada pocos minutos). **Última observación real:** 2026-10-12T14:47 (hoy).
- **Particularidad:** es una **ventana móvil de unas 12 horas** (mínimo 02:55, máximo 14:47 en la prueba, 157 mil filas). Para tener histórico hay que guardar los datos uno mismo. Para series largas existen datasets por variable: `sbwg-7ju4` (temperatura, 93 M filas), `s54a-sgyg` (precipitación, el `count(*)` dio *timeout*), `62tk-nxj5` (presión), `sgfv-3yp8` (velocidad del viento) y `kiw7-v9ta` (dirección del viento).
- **Cobertura:** 635 estaciones con `departamento` y `municipio` (por nombre, sin DANE) y lat/lon.
- **Campos:** `codigoestacion, codigosensor, fechaobservacion, valorobservado, nombreestacion, departamento, municipio, zonahidrografica, latitud, longitud, descripcionsensor, unidadmedida, entidad`. Hay 20 tipos de sensor: precipitación cada 10 min, temperatura a 2 m, humedad, nivel de río, viento, presión, entre otros.
- **Valor:** "¿está lloviendo en mi municipio?", "temperatura ahora", nivel de ríos (útil como señal temprana de crecientes). **Esfuerzo:** medio, porque hay que asignar cada estación al municipio más cercano y filtrar siempre por fecha y sensor.

### 5. REPS – Registro Especial de Prestadores y Sedes de Servicios de Salud
- **Endpoint:** `https://www.datos.gov.co/resource/c36g-9fc2.json?municipiosede=11001`
- **Licencia:** CC BY-SA 4.0. **Frecuencia declarada:** anual. **Última actualización real:** 2026-04-17, con corte REPS del 2026-03-12.
- **Cobertura:** 76.821 sedes con `municipiosede` (DANE de 5 dígitos).
- **Campos:** `codigoprestador, nombreprestador, codigohabilitacionsede, nombresede, naturalezajuridica, ese, municipiosede, municipiosededesc, direcci_nsede, t_lefonosede, email_sede, claseprestador` (IPS, profesional independiente, transporte especial, objeto social diferente).
- **Valor:** "¿dónde hay una IPS o un hospital público (ESE) en mi municipio?". **Esfuerzo:** bajo a medio. No trae coordenadas ni servicios habilitados (urgencias, etc.).
- **Privacidad:** incluye a **profesionales independientes** con `tipoid=CC` y `numeroidentificacion`, que es su cédula, además de su email y teléfono personal. Recomendación: **filtrar por `claseprestador` = IPS / `naturalezajuridica`** y **no exponer** `numeroidentificacion` ni los datos de personas naturales.

### 6. Peajes INVÍAS
- **Endpoint:** `https://www.datos.gov.co/resource/68qj-5xux.json`
- **Licencia:** CC BY-SA 4.0. **Frecuencia:** anual. **Última actualización real:** 2026-09-19.
- **Cobertura:** 179 peajes, con `point` GeoJSON y lat/lon.
- **Campos:** `nombre_peaje, ubicaci_n, sector, sentido, categoria_i … categoria_ix` y categorías especiales, `telefono_peaje, administrador, territorial, url_foto` (ficha PDF).
- **Valor:** "¿cuánto cuesta el peaje en la vía a X?", con mapa. **Esfuerzo:** bajo.

### 7. Tarifas de Peajes ANI
- **Endpoint:** `https://www.datos.gov.co/resource/7gj8-j6i3.json?peaje=ALVARADO`
- **Licencia:** CC BY-SA 4.0. **Última actualización real:** 2026-09-02. El último cambio de tarifa registrado es del 2026-05-01. Cubre 129 peajes y 1.228 tarifas.
- **Campos:** `idpeaje, peaje, ultimofechacambiopeaje, idcategoriatarifa, valor`. **Sin coordenadas ni municipio**, así que hay que georreferenciar a mano o cruzar con `8yi9-t44c` (tráfico ANI).
- **Valor:** junto con INVÍAS cubre casi toda la red de peajes del país. **Esfuerzo:** bajo a medio.

### 8. Establecimientos educativos (MEN)
- **Endpoint:** `https://www.datos.gov.co/resource/cfw5-qzt5.json?a_o=2025&cod_dane_municipio=05001`
- **Licencia:** CC BY-SA 4.0. **Frecuencia:** anual. **Última actualización real:** 2026-09-03. Último año disponible: 2025, con 17.872 establecimientos.
- **Campos:** `codigo_dane` (del colegio), `nombre_establecimiento, sector` (OFICIAL / NO_OFICIAL), `calendario, direccion, barrio_vereda, telefono, email, web, total_matricula, cantidad_sedes, cod_dane_municipio`. También trae `rector` (nombre de persona; mejor no destacarlo).
- **Caveats:** el dataset de **sedes con coordenadas** (`x5ay-984n`) solo llega a 2019. Además, el año 2023 tiene 416.716 filas, lo que hace pensar en filas duplicadas: siempre hay que filtrar por `a_o`.
- **Valor:** "colegios públicos en mi municipio". **Esfuerzo:** bajo.

### 9. Casas de Justicia y Centros de Convivencia Ciudadana
- **Endpoint:** `https://www.datos.gov.co/resource/bmcc-69wd.json`
- **Licencia:** CC BY-SA 4.0. **Última actualización real:** 2026-10-05. 158 sedes.
- **Campos:** `departamento, municipio, casa_de_justicia, direcci_n, numero_fijo, correos_institucionales, horario_de_atencion`. Sin DANE (hay que unir por nombre).
- **Valor:** dónde recibir orientación jurídica gratuita, conciliar, ir a la comisaría o la inspección. **Esfuerzo:** bajo.

### 10. Comisarías de Familia
- **Endpoint:** `https://www.datos.gov.co/resource/7tuu-upb2.json`
- **Licencia:** CC BY-SA 4.0. **Última actualización real:** 2026-07-09. 1.249 filas.
- **Campos:** `c_digo_dane_municipio` (sin el cero inicial: `5088`, que debería ser `05088`), `nombre_comisaria, direcci_n_comisara, telefono_de_contacto, horario_de_atenci_n` y coordenadas (en formato extraño, como `6307490`, que hay que limpiar).
- **Valor:** atención por violencia intrafamiliar. Información crítica y sensible al tiempo. **Esfuerzo:** bajo a medio (hay que normalizar el DANE y las coordenadas).

### 11. Emergencias UNGRD V2
- **Endpoint:** `https://www.datos.gov.co/resource/2343-nuqp.json`. Versiones anteriores: `rgre-6ak4` (2023-2024), `4t8v-ywmw` (2020) y `4fd8-ptcr` (2019).
- **Licencia:** CC BY 4.0. **Última actualización real:** 2026-09-22, pero los **datos cubren 2025-01-01 a 2025-12-31**. No es tiempo real.
- **Campos (61):** `fecha, departamento, municipio, evento, codificaci_n_segun_divipola` (DANE), `muertos, heridos, personas, familias, viv_destru, viv_aver` y ayudas entregadas.
- **Eventos más frecuentes:** incendio forestal (5.958), movimiento en masa (2.546), inundación (1.442), vendaval (1.152).
- **Valor:** perfil de riesgo histórico del municipio ("¿mi municipio se inunda?"). **Esfuerzo:** bajo.

### 12. Centros Zonales ICBF
- **Endpoint:** `https://www.datos.gov.co/resource/tkbc-zme7.json`
- **Licencia:** CC BY-SA 4.0. **Última actualización real:** 2026-07-23. 218 centros.
- **Campos:** `departamento, municipio, direccion, barrio, telefono, horario, regional, nombre_centro_zonal`, coordenadas.
- **Caveat:** `latitud_gd` y `longitud_gd` vienen **invertidas** (longitud = -4,22 y latitud = -69,94 en Leticia).
- **Valor:** protección infantil, trámites de familia, primera infancia. **Esfuerzo:** bajo.

### 13. Precio máximo de venta de medicamentos
- **Endpoint:** `https://www.datos.gov.co/resource/nauz-qkjw.json?$where=upper(medicamento) like '%25ACETAMINOFEN%25'`
- **Licencia:** CC BY-SA 4.0. **Frecuencia:** mensual. **Última actualización real:** 2026-08-29. La vigencia más reciente empieza el 2026-08-19. 38.998 filas.
- **Campos:** `cum, medicamento, mercado_relevante, precio_maximo_de_venta_transaccion_final_comercial, circular_cnpmdm, fecha_de_inicio_vigencia_…`
- **Valor:** "¿me están cobrando de más por este medicamento?". **Esfuerzo:** bajo (la búsqueda por nombre se hace con texto libre). Complemento: CUM vigentes del INVIMA en `i7cb-raxc`.

### 14. Precios promedio de GNV (gas natural vehicular)
- **Endpoint:** `https://www.datos.gov.co/resource/he3q-86dn.json`
- **Licencia:** CC BY-SA 4.0. **Frecuencia declarada:** diaria. En la práctica el precio publicado es mensual: el último `fecha_precio` es "2026-9-01" (formato sin cero inicial, cuidado al ordenar).
- **Cobertura:** 92 municipios con `codigo_municipio_dane`, por estación (`nombre_comercial_eds`).
- **Valor:** medio (solo GNV, no gasolina ni ACPM). **Esfuerzo:** bajo.

### 15. Centros de conciliación y consultorios jurídicos
- **Conciliación:** `7p9a-zd9k`. 435 centros, actualizado el 2026-07-08 (trimestral). Campos: `clase_centro, nombre, ciudad, departamento, correo_centro, direcci_n_centro, tel_fono_centro`.
- **Consultorios jurídicos universitarios (gratuitos):** `4cym-4b76`. 189 consultorios, actualizado el 2026-03-17. Campos: `universidad, telefono_celular, direccion, ciudad, departamento, horario…` (algunos valores dicen "Null" o "N/A" como texto).
- **Valor:** asesoría legal gratuita. **Esfuerzo:** bajo (unir por nombre de ciudad).

### 16. Normales climatológicas (IDEAM)
- `nsz2-kzcq`. Actualizado el 2026-07-27, 16.761 filas. Valores mensuales (`ene`…`dic`, `anual`) por estación, parámetro y periodo (1961-1990, 1981-2010, etc.).
- **Valor:** "¿cuál es la temporada de lluvias en mi municipio?". **Esfuerzo:** bajo.

### 17. Calidad del aire (IDEAM / SISAIRE)
- **Horario:** `g4t8-zkc3` (32,8 M filas, DANE de municipio). El dato más reciente es del **2024-12-31**, así que no sirve para el "hoy".
- **Anual:** `kekd-7v7h` (promedios, excedencias de norma y percentiles por estación y año). Actualizado el 2026-01-26.
- **Valor:** medio, porque es histórico. Para el tiempo real habría que ir a cada autoridad ambiental (SIATA, RMCAB, etc.). La API de SISAIRE en tiempo real queda NO VERIFICADA. **Esfuerzo:** medio.

### 18. Puestos de votación – Divipole 2023
- **Endpoint:** `https://www.datos.gov.co/resource/mv2e-prx5.json`. 12.922 puestos con dirección y lat/lon. Actualizado por última vez el 2023-10-11. Sin DANE, solo nombres.
- **Caveat:** corresponde a las elecciones territoriales de 2023. Para 2026 (Congreso y Presidencia) no hay dataset abierto: NO VERIFICADO. La consulta de "dónde voto" por cédula **queda fuera de alcance** porque requiere datos personales.
- **Valor:** alto cerca de una elección, pero el dato está viejo. **Esfuerzo:** medio.

### 19. Oficinas del Fondo Nacional del Ahorro
- `h3sz-zqij`. 75 oficinas, actualizado el 2026-09-29 (mensual). Incluye horario y lat/lon, pero la **longitud viene sin signo** (`74.11646` en vez de `-74.11646`). Valor bajo a medio.

### 20. Registro Nacional de Turismo
- `thwd-ivmp`. 124.676 prestadores (periodo agosto 2026) con `cod_mun` DANE, categoría (hoteles, agencias, guías), estado (ACTIVO) y habitaciones.
- **Valor:** "¿este hotel o agencia está formalizado?". Trae teléfonos y correos de personas naturales: exponer solo los establecimientos. **Esfuerzo:** bajo.

---

## Caveats transversales
1. **Fecha de actualización vs. fecha del dato:** `rowsUpdatedAt` no garantiza datos recientes. Ejemplos: UNGRD se actualizó en 2026 con datos de 2025, y calidad del aire en 2026 con datos hasta 2024. En las respuestas conviene mostrar siempre la fecha real del dato.
2. **Calidad de los datos:** hay coordenadas invertidas (ICBF), longitudes sin signo (FNA), coma decimal (DIVIPOLA), códigos DANE sin cero inicial (Comisarías), fechas sin cero ("2026-9-01" en GNV) y valores "Null" escritos como texto. Hace falta una capa de normalización por fuente.
3. **Pocos datasets traen DANE.** La mayoría de los directorios usan nombres de municipio, así que se necesita un normalizador nombre → DANE apoyado en DIVIPOLA.
4. **Datos personales:** REPS y RNT incluyen cédulas, teléfonos y correos de personas naturales. Hay que filtrarlos antes de exponerlos por MCP o API.
5. **Huecos importantes para la vida diaria:** precios de gasolina y ACPM, puestos de votación 2026, notarías, trámites SUIT y alertas en tiempo real no tienen una API abierta verificada. Habría que hacer *scraping* de PDF o Excel oficiales o dejarlo fuera.
6. **Rendimiento:** los datasets de IDEAM tienen decenas de millones de filas, y un `count(*)` sin filtro dio *timeout*. Siempre hay que filtrar con `$where` por fecha y estación.
