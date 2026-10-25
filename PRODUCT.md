# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Dos audiencias con la misma prioridad, servidas con el mismo dato:

- **Personas en Bogotá** que necesitan resolver algo del día a día: qué días y a qué hora pasa el camión de la basura en su localidad, o qué estaciones, rutas y horarios tiene la red troncal de TransMilenio. Usan el sitio web, muchas veces desde el celular.
- **Agentes de IA y desarrolladores** que consultan esos datos de forma programática: API JSON, OpenAPI, servidor MCP (HTTP y stdio), CLI, plugin de Claude Code y `llms.txt`.

Ninguna audiencia es secundaria: cada capacidad debe existir para ambas.

## Product Purpose

Bogotá al Día reúne en un solo lugar datos públicos oficiales del Distrito que hoy están dispersos en varios portales, los normaliza y valida, y los sirve listos para personas y para agentes. Éxito: alguien (o un agente) obtiene una respuesta correcta y con fuente en segundos, sin instalar una app ni registrarse.

## Positioning

- **Todo en un lugar:** TransMilenio y recolección de residuos juntos, en vez de datosabiertos.bogota.gov.co, la app TransMi y UAESP por separado.
- **Listo para agentes:** fuente de datos de Bogotá con MCP, CLI, plugin y `llms.txt`.
- **Datos limpios y honestos:** normalizados, validados contra schemas, con la fuente, la licencia y la fecha de cada dataset; lo no oficial se marca como tal y nunca se inventa.
- **Simple y rápido:** HTML estático liviano, sin login y sin app, que funciona en cualquier celular.

## Operating Context

- Proyecto cívico personal y abierto, **sin afiliación oficial** con la Alcaldía, TransMilenio S.A. ni la UAESP. No debe presentarse como canal oficial.
- Los datos se extraen de APIs ArcGIS REST oficiales (gis.transmilenio.gov.co, serviciosgis.catastrobogota.gov.co) y de datosabiertos.bogota.gov.co, y se actualizan por GitHub Actions cada lunes. Solo se commitean cuando hay cambios reales.
- Desplegado en Vercel: bogota-al-dia.vercel.app.

## Capabilities and Constraints

- **Cómo llegar:** planeador de viajes sobre el GTFS oficial diario (troncal, alimentadores, SITP zonal, TransMiCable): opciones más rápida ↔ menos transbordos, vagón y puerta, festivos. Horarios programados, sin tiempo real (no existe GTFS-RT en Colombia). Base multi-ciudad por código DIVIPOLA.
- **TransMilenio:** 152 estaciones troncales (coordenadas, troncal, servicios) y 128 rutas troncales con horarios programados.
- **Recolección de residuos:** 115 macrorutas en 19 localidades, con frecuencia y horario. Una localidad tiene varias macrorutas y el dato no dice qué barrio corresponde a cada una. Varias frecuencias no tienen descripción oficial (`oficial: false`).
- **Alertas de servicio:** sección pendiente. No existe una API pública de alertas ni GTFS-RT; la página remite a los canales oficiales.
- **Stack:** Astro 4 SSG, sin JS por defecto (decisión en `docs/decisions.md`). Núcleo de consultas sin dependencias en `lib/bogota.mjs`, compartido por el MCP, el CLI y el plugin.
- **Terminología:** troncal, portal, estación, ruta troncal, localidad, macroruta, frecuencia.
- **Licencia de los datos:** CC-BY-SA-4.0. Toda vista debe atribuir la fuente.

## Brand Commitments

- Nombre: **Bogotá al Día**. Idioma: español de Colombia (`es-CO`).
- Voz: directa, útil y honesta sobre lo que no se sabe ("sin descripción oficial", "no hay datos").

## Evidence on Hand

- Datos reales en `data/` (estaciones, rutas, zonas, localidades) con fecha de generación y fuente.
- Inventario de fuentes en `docs/sources.md` y log de decisiones con evidencia en `docs/decisions.md`.
- No hay testimonios, métricas de uso, prensa ni respaldo oficial. No se deben inventar.

## Product Principles

1. **El mismo dato para personas y agentes.** Cada capacidad nueva llega a la web y a las vías para agentes (API, MCP, CLI y plugin) desde una sola fuente de verdad.
2. **Nunca inventar.** Si la fuente no lo dice, se muestra como desconocido o no oficial, con la fecha y la fuente visibles.
3. **La respuesta primero.** Lo que la persona vino a resolver (cuándo pasa la basura, qué ruta sirve) va antes que la explicación.
4. **Liviano en cualquier conexión.** Estático, sin JS innecesario, legible en un celular económico con datos móviles.
5. **No oficial, pero confiable.** Transparente sobre ser un proyecto independiente; la confianza se gana citando fuentes, no imitando al Distrito.

## Accessibility & Inclusion

Público general de toda la ciudad, incluidas personas mayores y con celulares de gama baja: HTML semántico, buen contraste y textos claros en español. No se ha fijado un estándar formal; WCAG 2.1 AA es la referencia práctica.
