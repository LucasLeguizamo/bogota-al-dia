# Inventario de Fuentes de Datos

## Recolección de Residuos

### Macrorutas de Recolección - UAESP
- **URL**: https://datosabiertos.bogota.gov.co/dataset/macrorutas-de-recoleccion-bogota-d-c
- **API REST**: https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/serviciospublicos/aseobogota/MapServer/5
- **Formato**: ArcGIS REST / GeoJSON
- **Licencia**: CC-BY-SA-4.0
- **Responsable**: UAESP (Yency Lagos - Yency.lagos@uaesp.gov.co)
- **Frecuencia de actualización**: Anual
- **robots.txt**: Permite acceso al API (no hay restricción explícita para /arcgis/rest/)
- **Campos útiles**:
  - `IDMACRUT`: Código de macroruta
  - `IDFRECUE_`: Identificador de frecuencia (días de la semana)
  - `LOCALIDAD`: Código de localidad
  - `HORAINICIO1`: Hora inicio (formato HHMM como entero)
  - `HORAFIN1`: Hora fin (formato HHMM como entero)
  - `FECVIGDES`: Fecha de vigencia

### Centros de Atención al Usuario (CAU) - UAESP
- **URL**: https://datosabiertos.bogota.gov.co/dataset/centros-de-atencion-al-usuario-bogota-d-c
- **Licencia**: CC-BY-SA-4.0
- **Formato**: GeoJSON/REST
- **Descripción**: Oficinas de atención para quejas/reclamos del servicio de aseo

### Operadores de Aseo
Los 5 operadores de ASE (Áreas de Servicio Exclusivo):
1. Promoambiental Distrito
2. LIME (Limpieza Metropolitana)
3. Ciudad Limpia
4. Bogotá Limpia
5. Área Limpia

## TransMilenio / SITP

### Estaciones Troncales
- **URL**: https://datosabiertos.bogota.gov.co/dataset/estaciones-troncales-de-transmilenio
- **API REST**: https://gis.transmilenio.gov.co/arcgis/rest/services/Troncal/consulta_estaciones_troncales/MapServer/0
- **Formato**: ArcGIS REST / GeoJSON
- **Licencia**: CC-BY-SA-4.0
- **Responsable**: TransMilenio S.A. (david.monroy@transmilenio.gov.co)
- **Frecuencia**: Según necesidad
- **Campos útiles**:
  - `numero_estacion`: Código de estación
  - `nombre_estacion`: Nombre
  - `ubicacion_estacion`: Dirección
  - `troncal_estacion`: Corredor troncal
  - `latitud_estacion`, `longitud_estacion`: Coordenadas
  - `tipo_estacion`: Tipo (sencilla, intermedia, cabecera)
  - `biciestacion_estacion`: Si tiene biciparqueadero

### Rutas Troncales
- **URL**: https://datosabiertos.bogota.gov.co/dataset/informacion-general-rutas-componente-troncal-del-sitp
- **API REST**: https://gis.transmilenio.gov.co/arcgis/rest/services/Troncal/consulta_rutas_troncales/MapServer/0
- **Formato**: ArcGIS REST / GeoJSON
- **Licencia**: CC-BY-SA-4.0
- **Frecuencia**: Continua
- **Campos útiles**:
  - `route_name_ruta_troncal`: Código de ruta (ej: B23)
  - `nombre_ruta_troncal`: Nombre descriptivo
  - `origen_ruta_troncal`, `destino_ruta_troncal`: Terminales
  - `horario_lunes_viernes`, `horario_sabado`, `horario_domingo_festivo`
  - `estado_ruta_troncal`: OPERATIVA (→ `activa`)
  - `tipo_bus_ruta_troncal`: dominio TIPO_BUS 1 Articulado, 2 Biarticulado, 3 Dual, 4 Padrón, 5 Busetón
  - `longitud_comercial` / `longitud_ruta_troncal`: km; `st_length(shape)`: metros (EPSG:3116), respaldo de `longitud_km`
  - `tipo_operacion`: Normal, Refuerzo, Ciclovia (→ `normal`, `refuerzo`, `ciclovia`)

### GTFS (General Transit Feed Specification) — in use since 2026-10-25
- **URL**: `https://storage.googleapis.com/gtfs-estaticos/GTFS_YYYYMMDD.zip` (a new zip every day ~09:19 UTC; the bucket is publicly listable). Dataset page: https://datosabiertos.bogota.gov.co/dataset/especificacion-gtfs-general-transport-feed-specification-sitp
- **License**: CC-BY-SA-4.0 (CKAN dataset page). Feed contact: radicacion@transmilenio.gov.co
- **Verified content (GTFS_20261025.zip, 120 MB)**: 7 agencies (trunk, feeders, dual, urban zonal, complementary, special, TransMiCable), 1,045 routes, 8,308 stops (156 stations with child platforms "Calle 72 A - 2" = car A, door 2), 177,772 trips, 9.38 M rows in `stop_times.txt` (574 MB, not sorted by trip), `calendar_dates` with the 2026 holidays, `frequencies` only for TransMiCable.
- **Use**: `scripts/extract-transit.ts` → `data/transit/11001/network.json` (~2.9 MB). Consumed by `lib/trip.mjs` (`plan_trip`). Multi-city registry: `data/transit/sources.json`.

### Alertas de Servicio (PENDIENTE)

**Estado**: No hay API pública estructurada disponible.

**Canales oficiales identificados**:

| Canal | URL | Formato | Acceso programático |
|-------|-----|---------|---------------------|
| Web TransMilenio | transmilenio.gov.co/publicaciones | HTML | No permitido (robots.txt bloquea) |
| X @TransMilenio | x.com/TransMilenio | Posts | Requiere API X (de pago) |
| X @SectorMovilidad | x.com/SectorMovilidad | Posts | Requiere API X (de pago) |
| App TransMi | Google Play/App Store | Móvil | Sin API pública |
| GTFS-RT | No encontrado | - | - |

**Investigación realizada**:
1. datosabiertos.bogota.gov.co: Sin dataset de alertas en tiempo real
2. transmilenio.gov.co/robots.txt: Disallow para múltiples rutas
3. GTFS de TransMilenio: Solo datos estáticos (rutas, paradas), sin GTFS-RT

**Conclusión**: Las alertas deberán agregarse manualmente o cuando exista una API oficial.
La sección de alertas en el sitio está claramente marcada como "pendiente".

## Datos Geográficos de Referencia

### Localidades de Bogotá
- **URL**: https://datosabiertos.bogota.gov.co (buscar "localidades")
- **Uso**: Mapeo código → nombre de localidad

### Barrios
- **URL**: https://datosabiertos.bogota.gov.co (buscar "barrios")
- **Uso**: Geocodificación inversa para consultas por dirección

## Verificación robots.txt

| Dominio | Permite scraping | Notas |
|---------|-----------------|-------|
| datosabiertos.bogota.gov.co | Sí (con Crawl-Delay: 10) | Bloquea /api/ pero usamos datasets públicos |
| serviciosgis.catastrobogota.gov.co | Sin restricciones | API ArcGIS REST público |
| gis.transmilenio.gov.co | Sin restricciones | API ArcGIS REST público |
| transmilenio.gov.co | Verificar | Para alertas/noticias |

## Atribución Requerida

Todos los datos requieren atribución según CC-BY-SA-4.0:
- "Datos: UAESP / Alcaldía de Bogotá, bajo licencia CC-BY-SA-4.0"
- "Datos: TransMilenio S.A. / Alcaldía de Bogotá, bajo licencia CC-BY-SA-4.0"
