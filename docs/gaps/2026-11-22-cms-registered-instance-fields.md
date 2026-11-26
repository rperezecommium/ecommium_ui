# Campos editables de instancias registered

El contrato local cms-composition-boundary.schema.json no ofrece una declaración
por creador de campos editables para bodies registered (solo tipo + props). Sus
editorFields sirven para diseñar y no acreditan que el creador autorice editarlos
en Secciones. Secciones conserva estos módulos y no expone edición de props.

Propuesta pendiente de sincronización explícita con BFF/CMS: declaración opcional
por módulo de claves editables, validada contra el schema registrado y preservada
al copiar. Ausencia = ninguna clave editable. Excluir identidades, presentation,
stylesheet y estructura; admitir solo las propiedades expresamente soportadas
por cada bloque. Requiere acordar DTO/validación/versionado antes de implementar;
no añadir campos UI fuera del contrato ni fallback al diseñador.

Los módulos visuales ya disponen de contentSchema y bindings; este gap no bloquea
su formulario de campos asignados ni la configuración propia de la sección.
