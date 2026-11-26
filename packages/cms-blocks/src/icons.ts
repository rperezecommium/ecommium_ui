import { Star, Heart, Check, CircleCheck, Info, TriangleAlert, ShoppingCart, ShoppingBag, Store, Package, Truck, CreditCard, ShieldCheck, RefreshCw, Gift, Tag, Percent, User, Users, Mail, Phone, MapPin, Clock, Calendar, Search, Menu, House, ArrowRight, ArrowLeft, ChevronDown, Plus, X, Settings, Image, Leaf, Bike } from "lucide-react";

export const cmsIconCatalog = [
  { value: "lucide:star", label: "Estrella", Icon: Star },
  { value: "lucide:heart", label: "Corazón", Icon: Heart },
  { value: "lucide:check", label: "Confirmación", Icon: Check },
  { value: "lucide:circle-check", label: "Éxito", Icon: CircleCheck },
  { value: "lucide:info", label: "Información", Icon: Info },
  { value: "lucide:triangle-alert", label: "Aviso", Icon: TriangleAlert },
  { value: "lucide:shopping-cart", label: "Carrito", Icon: ShoppingCart },
  { value: "lucide:shopping-bag", label: "Bolsa de compra", Icon: ShoppingBag },
  { value: "lucide:store", label: "Tienda", Icon: Store },
  { value: "lucide:package", label: "Paquete", Icon: Package },
  { value: "lucide:truck", label: "Envío", Icon: Truck },
  { value: "lucide:credit-card", label: "Pago", Icon: CreditCard },
  { value: "lucide:shield-check", label: "Seguridad", Icon: ShieldCheck },
  { value: "lucide:refresh-cw", label: "Devoluciones", Icon: RefreshCw },
  { value: "lucide:gift", label: "Regalo", Icon: Gift },
  { value: "lucide:tag", label: "Etiqueta", Icon: Tag },
  { value: "lucide:percent", label: "Descuento", Icon: Percent },
  { value: "lucide:user", label: "Usuario", Icon: User },
  { value: "lucide:users", label: "Clientes", Icon: Users },
  { value: "lucide:mail", label: "Correo", Icon: Mail },
  { value: "lucide:phone", label: "Teléfono", Icon: Phone },
  { value: "lucide:map-pin", label: "Ubicación", Icon: MapPin },
  { value: "lucide:clock", label: "Horario", Icon: Clock },
  { value: "lucide:calendar", label: "Calendario", Icon: Calendar },
  { value: "lucide:search", label: "Buscar", Icon: Search },
  { value: "lucide:menu", label: "Menú", Icon: Menu },
  { value: "lucide:home", label: "Inicio", Icon: House },
  { value: "lucide:arrow-right", label: "Flecha derecha", Icon: ArrowRight },
  { value: "lucide:arrow-left", label: "Flecha izquierda", Icon: ArrowLeft },
  { value: "lucide:chevron-down", label: "Desplegar", Icon: ChevronDown },
  { value: "lucide:plus", label: "Añadir", Icon: Plus },
  { value: "lucide:x", label: "Cerrar", Icon: X },
  { value: "lucide:settings", label: "Ajustes", Icon: Settings },
  { value: "lucide:image", label: "Imagen", Icon: Image },
  { value: "lucide:leaf", label: "Sostenibilidad", Icon: Leaf },
  { value: "lucide:bike", label: "Bicicleta", Icon: Bike },
] as const;

export function findCmsIcon(value: string | undefined) {
  return cmsIconCatalog.find(icon => icon.value === value);
}
