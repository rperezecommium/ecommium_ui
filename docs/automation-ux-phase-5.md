# Automatización UX — Fase 5: confianza de ejecución

## Objetivo

Reducir la incertidumbre antes de activar una regla y facilitar la respuesta ante una ejecución que no termina bien.

## Experiencia incorporada

- El detalle de una regla explica en lenguaje normal qué sucederá cuando llegue el evento.
- Antes de activar, se muestran tres comprobaciones: acciones configuradas, servicio listo para procesar y plantillas de email activas cuando correspondan.
- Activar continúa siendo una decisión manual. La confirmación explica si hay algo pendiente; no bloquea una capacidad que ya existía.
- El detalle de una ejecución transforma el estado técnico en una explicación breve: finalizada, en curso, omitida o con atención necesaria.
- Si falla un email, se indica el siguiente paso y se enlaza a Comunicaciones. El reintento conserva su comportamiento y solo se ofrece para `FAILED` o `DLQ`.

## Resultado esperado

Una persona puede responder tres preguntas sin interpretar JSON ni estados internos: qué hará la regla, si parece preparada para activarse y qué hacer cuando una ejecución falla.
