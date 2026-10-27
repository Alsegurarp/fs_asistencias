# Modelos de Zenit en PlantUML

- [Jerarquía de conceptos y entidades](01-jerarquia.puml): árbol general del proyecto, sus fronteras y las 32 tablas de negocio.
- [Entidades, relaciones y cardinalidades](02-relaciones.puml): modelo por dominio; distingue claves foráneas y referencias lógicas.

Fuentes: [migraciones V001–V009](../../backend/src/main/resources/db/migration/) y [contrato activo](../../contracts/openapi.yaml).

Los diagramas describen la implementación local E2/E3. La descarga con MFA corresponde a E4 y su portal a E5.

Sintaxis y renderizado verificados con PlantUML 1.2026.8. Las vistas SVG generadas están en `build/dbFlow/`; los `.puml` son las fuentes mantenidas.

`02-relaciones.puml` también está comprobado con PlantUML 1.2025.10, usado
por Plan UML 0.0.8. Conserva la orientación vertical predeterminada: forzar
`left to right direction` provoca `IllegalStateException` en Smetana con ese
grafo y esa versión. Las entidades, cardinalidades y relaciones se conservan.

La corrección se comprobó en SVG y PNG con ambas versiones, conservando
32 entidades y 52 relaciones. El [acta](../entrega-expediente-e2-e3.md#corrección-de-compatibilidad-de-02-relacionespuml)
registra la reproducción, el alcance y los límites de validación.
