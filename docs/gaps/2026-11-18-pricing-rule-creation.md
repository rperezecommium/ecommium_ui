# Creación de reglas de Pricing: gap verificado

El usuario autorizó añadir Crear regla con drawer. Antes de implementar se
contrastó la referencia UI y el backend previamente autorizado para consulta.
No existe POST de reglas en BFF ni owner. Ambos exponen GET/PATCH/DELETE.
PriceTableRuleListUseCase agrupa precios existentes de la tabla mediante
price-table-rule.helper.ts: source/tradePolicy/channel/customerGroup/country.
ruleId es hash de esas dimensiones, no ID de una entidad persistida Rule.
PATCH actúa sobre precios del grupo; no crea una regla independiente.

Por tanto, no basta añadir una Server Action POST de reglas. Opciones evaluadas:
1. Mantener modelo y crear/asignar precios con condiciones (la agrupación aparece
   como consecuencia); etiquetar la acción según su efecto real.
2. Introducir reglas independientes: definir alcance, cálculo/condiciones,
   prioridad, vigencia, persistencia, contratos BFF/owner y proyección ReadIndex.

El usuario eligió mantener el modelo actual. Se implementó el enlace
«Crear precio con condiciones» en Rules y un AdminResourceDrawer que consume
POST /admin/prices, con permiso catalog.products.write. Crea un precio FIXED,
SPECIFIC para producto o variante en una tabla existente; Rules mantiene su
agrupación por dimensiones. No se introdujeron entidades Rule independientes.
Las condiciones vacías no restringen el precio; el importe se expresa sin
impuestos en unidad mínima y no se establece límite de vigencia.
No se implementó endpoint alternativo en Next.js.
La explicación anterior de que solo faltaba el formulario UI queda corregida.
