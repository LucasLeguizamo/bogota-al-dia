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
  - `estado_ruta_troncal`: Activa/Suspendida
  - `tipo_operacion`: Corriente, Fácil, Súper Expreso

### GTFS (General Transit Feed Specification)
- **URL**: https://datosabiertos.bogota.gov.co/dataset/especificacion-gtfs-general-transport-feed-specification-sitp
- **Licencia**: CC-BY-SA-4.0
- **Frecuencia**: Mensual
- **Estado**: Pendiente verificar disponibilidad del archivo ZIP
- **Contenido esperado**: routes.txt, stops.txt, trips.txt, stop_times.txt, calendar.txt

### Alertas de Servicio
- **Fuente pendiente**: Buscar API de alertas en transmilenio.gov.co
- **Alternativa**: @TransMilenio en X (antes Twitter) - solo para monitoreo manual

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
