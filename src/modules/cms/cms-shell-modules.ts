import type { CmsBlock, CmsBlockEditorField } from './cms-blocks';

/** Declarative shell configuration; customer/cart/catalog state stays in Storefront. */
const entries: Array<[string, string, Record<string, unknown>]> = [
  ['store.logo', 'Logo de tienda', {imageUrl:'/assets/brand/ecommium-logo.png', imageAlt:'Ecommium', label:'Ecommium', href:'/'}],
  ['commerce.search', 'Buscador', {placeholder:'Buscar productos'}],
  ['catalog.navigation', 'Navegación de catálogo', {dynamic:true, items:[]}],
  ['customer.account', 'Cuenta de cliente', {compact:true}],
  ['commerce.cart', 'Carrito', {compact:true}],
  ['store.market', 'Mercado e idioma', {countryLabel:'España', languageLabel:'Español'}],
  ['store.assurances', 'Servicios y confianza', {helpLabel:'Ayuda y contacto', returnsLabel:'Devolución fácil en 30 días', rating:'4.5/5'}],
  ['content.announcementBar', 'Barra de anuncio', {text:'¡Siempre el mejor precio online!'}],
  ['footer.navigation', 'Enlaces de footer', {title:'Información', items:[]}],
  ['footer.contact', 'Contacto', {title:'Contacto', text:''}],
  ['footer.payments', 'Métodos de pago', {label:'Métodos de pago', items:[]}],
  ['footer.social', 'Redes sociales', {label:'Redes sociales', items:[]}],
  ['footer.legal', 'Información legal', {text:'© Ecommium'}],
];
const labels: Record<string,string> = {imageUrl:'Imagen',imageAlt:'Texto alternativo',label:'Etiqueta',href:'Destino',placeholder:'Texto del buscador',dynamic:'Categorías del catálogo',items:'Elementos',compact:'Vista compacta',countryLabel:'Destino',languageLabel:'Idioma',helpLabel:'Ayuda',returnsLabel:'Devoluciones',rating:'Valoración',text:'Texto',title:'Título'};
export const cmsShellModuleDefinitions = entries.map(([type,label,props]) => ({
  type, label,
  editorFields: Object.entries(props).map(([key,value]):CmsBlockEditorField => ({key,label:labels[key]??key,type:typeof value==='boolean'?'boolean':Array.isArray(value)?'json':key==='imageUrl'||key==='href'?'url':key==='text'?'textarea':'text'})),
  create: ():CmsBlock => ({blockId:`cms-${crypto.randomUUID()}`,type,props:structuredClone(props)}),
}));
export const cmsShellModuleDefinition = (type:string) => cmsShellModuleDefinitions.find(item=>item.type===type);
export const isCmsShellModule = (type:string) => Boolean(cmsShellModuleDefinition(type));
