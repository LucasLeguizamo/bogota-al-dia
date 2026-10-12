# Research: de Bogotá a toda Colombia

> 2026-10-12. Tres agentes en paralelo comprobaron cada fuente con peticiones reales. Lo que no pudieron confirmar está marcado como **NO VERIFICADO**.
> Detalle completo: [nacional](research/nacional.md) · [ciudades](research/ciudades.md) · [ecosistema, legal y escalabilidad](research/ecosistema.md)

## Conclusión

- Nadie cubre hoy el **día a día ciudadano de Colombia** con datos curados y servidos a la vez por web, API, MCP y CLI. Hay espacio real para el proyecto.
- El cuello de botella no es encontrar datos. Es **limpiarlos y normalizarlos por municipio** y **no publicar datos personales**.

## Ranking (valor ciudadano ÷ esfuerzo)

| # | Fuente | Cobertura | Responde | Licencia | Esfuerzo |
|---|---|---|---|---|---|
| 1 | **DIVIPOLA municipios** (DANE, `gdxc-w37w`) | 1.122 municipios | Llave común de todo | CC-BY-SA | Bajo |
| 2 | **GTFS SITP diario** (TransMilenio, `storage.googleapis.com/gtfs-estaticos/GTFS_YYYYMMDD.zip`) | Bogotá: 719 rutas zonales + troncal, alimentadores y cable; 8.300 paradas | Qué bus/ruta me sirve, paradas, horarios | CC-BY-SA según la ficha CKAN; el hub ArcGIS no declara licencia → **confirmar por escrito** | Medio (115 MB comprimido) |
| 3 | **Festivos** (calculados con la Ley 51/1983 + Pascua) | Nacional | ¿Mañana es festivo? | Código propio (dato legal) | Bajo |
| 4 | **UAESP `aseobogota`, capas 3, 4 y 8** | Bogotá: 11.167 contenedores, 10 CAU, operadores | Dónde reciclo, quién recoge en mi zona | CC-BY-SA | Bajo (mismo extractor) |
| 5 | **IBOCA**, calidad del aire cada hora (SDA) | Bogotá: 19 estaciones | ¿Puedo salir a correr hoy? | No declarada → pedirla | Bajo |
| 6 | **IDEAM, estaciones en tiempo real** (`57sv-p2fu`) | 635 estaciones, nacional | Lluvia, temperatura y nivel de ríos | CC-BY-SA | Medio (ventana de unas 12 h) |
| 7 | **Recolección EMVARIAS** (`3p5t-k2ce`) | Medellín, 136 macrorutas | Cuándo pasa la basura | CC-BY-SA | Medio (zona en texto) |
| 8 | **Peajes INVÍAS** (`68qj-5xux`) + **ANI** (`7gj8-j6i3`) | Nacional, 308 peajes | Cuánto cuesta el viaje | CC-BY-SA | Bajo |
| 9 | **TRM** (`32sa-8pi3`) | Nacional | Dólar hoy | CC-BY-SA | Bajo |
| 10 | **Sedes de salud REPS** (`c36g-9fc2`) | 76.821 sedes con código DANE | IPS cerca de mí | CC-BY-SA, **filtrar datos personales** | Medio |
| 11 | **Directorios de justicia**: Casas de Justicia, Comisarías, consultorios jurídicos, conciliación, ICBF | Nacional | A dónde acudo gratis | CC-BY-SA | Bajo-medio (limpieza) |
| 12 | **Ciclovía IDRD** (ArcGIS) | Bogotá, 16 tramos | ¿Hay ciclovía el domingo? | CC-BY-4.0 | Bajo |
| 13 | **Colegios MEN** (`cfw5-qzt5`) | Nacional | Colegios cerca de mí | CC-BY-SA | Medio |
| 14 | **GTFS Metro de Medellín 2025** | Metro, tranvía, Metroplús y cables | Rutas y horarios en Medellín | No declarada; el calendario venció | Medio |
| 15 | **Paraderos Transcaribe y Transmetro** | Cartagena / Barranquilla | Paraderos | CC-BY-SA | Bajo (datos viejos) |

## Lo que no existe como dato abierto (no inventar)

| Tema | Situación | Qué hacer |
|---|---|---|
| Pico y placa | Solo decretos y HTML, en todas las ciudades | Tabla de reglas con `vigencia`, `fuente_url` y `verificado_en`, evaluada por una función pura + festivos. Sin regla vigente → responder "sin regla vigente" ([detalle](research/ciudades.md)) |
| Tiempo real de buses | Ningún GTFS-RT en Colombia | Horarios programados. Pedir el feed a TransMilenio por derecho de petición. **No** usar la API de TransMiApp obtenida por ingeniería inversa |
| Cortes de luz (Enel) | Página con antibot (403) | Fuera de alcance |
| Cortes de agua (EAAB) | Sin listado estructurado; licencia NC-ND en los datos de red | Fuera de alcance |
| Precios de gasolina y ACPM, notarías, trámites SUIT, alertas IDEAM/UNGRD en vivo, tarifas de acueducto y aseo, puestos de votación 2026 | Sin API abierta o desactualizado | Revisar cada trimestre |

## Reglas legales

- **CC-BY-SA** (98,8 % de datos.gov.co): atribuir a la entidad, enlazar la licencia, decir "normalizado por Bogotá al Día" y publicar lo derivado también en BY-SA. No mezclar con datos NC o ND en un mismo archivo.
- **Ley 1581 (habeas data):** no publicar ni cruzar datos de personas aunque estén en portales públicos (SECOP con cédulas, comparendos, profesionales en REPS).
- **Ley 1273:** no usar APIs obtenidas por ingeniería inversa ni hacer scraping de portales con login.
- **robots.txt:** `datosabiertos.bogota.gov.co` prohíbe `/api/` y pide 10 s entre peticiones. Agregar un User-Agent identificable a los extractores.

## Arquitectura para escalar (cambio mínimo)

**Ahora:**
1. `data/co/municipios.json` desde DIVIPOLA, y un normalizador de nombre de municipio a código DANE (la mayoría de los directorios trae solo el nombre).
2. Campo `municipio` (código DANE, Bogotá = `11001`) en el encabezado de cada dataset.
3. Registro de fuentes `sources/<id>.json`: url, entidad, licencia por capa, cadencia, extractor y tipo (`arcgis` | `socrata` | `gtfs` | `calculado`).
4. Herramientas MCP **por dominio** con un `municipio` opcional (por defecto `11001`), más `municipios()` y `cobertura()`. Unas 8 a 15 herramientas en total, nunca dominio × ciudad.

**Cuando llegue la 2.ª ciudad:**
- `data/<divipola>/<dominio>/`.
- Un solo workflow diario que corra solo las fuentes vencidas, más un commit keepalive (GitHub desactiva el cron tras 60 días sin actividad).
- El GTFS se preprocesa en el workflow y nunca se commitea crudo (límite de 100 MB por archivo).

**No hacer:** base de datos, un MCP por ciudad, páginas vacías para 1.100 municipios ni infraestructura de tiempo real.

**Reutilizar en vez de rehacer:** festivos (`colombian-holidays`, MIT), [ColombiaGTFS](https://github.com/ColombiaInfo/ColombiaGTFS) como semilla de geometría de unas 20 ciudades, y enlazar MCP temáticos que ya existen (p. ej. `colombia-datos-mcp` para SECOP).

## Hoja de ruta propuesta

| Fase | Entrega | Por qué primero |
|---|---|---|
| 1 | DIVIPOLA + `municipio` + registro de fuentes + festivos | Base para todo; poco esfuerzo |
| 2 | GTFS SITP (paradas, rutas zonales, horarios) + capas UAESP + ciclovía | Completa Bogotá; elimina el "no incluye SITP zonal" |
| 3 | IBOCA + IDEAM | Primeros datos "de hoy" |
| 4 | Peajes, TRM, directorios de justicia y salud (filtrados) | Primeros datos nacionales para los 1.122 municipios |
| 5 | Medellín (EMVARIAS + Metro) | Segunda ciudad; valida el esquema multi-municipio |
| — | Pico y placa como tabla de reglas | Cuando haya alguien que la mantenga |

**Pendiente con personas reales:** pedir licencia por escrito a TransMilenio (`radicacion@transmilenio.gov.co`), a la SDA (IBOCA) y al Metro de Medellín.
