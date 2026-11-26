export type CmsDesignValues = Partial<Record<'maxWidth'|'moduleGap'|'columnGap'|'color'|'backgroundColor', string>>;
export type CmsDesignSettings = Partial<Record<'base'|'desktop'|'tablet'|'mobile', CmsDesignValues>>;
export type CmsResolvedDesign = Record<'desktop'|'tablet'|'mobile', CmsDesignValues>;
export const emptyCmsDesign: CmsResolvedDesign = {desktop:{},tablet:{},mobile:{}};

/** Resolve each viewport independently: a child's base overrides a parent's mobile. */
export function resolveCmsDesignSettings(parent: CmsResolvedDesign = emptyCmsDesign, local: CmsDesignSettings = {}): CmsResolvedDesign {
  return {
    desktop: {...parent.desktop,...local.base,...local.desktop},
    tablet: {...parent.tablet,...local.base,...local.desktop,...local.tablet},
    mobile: {...parent.mobile,...local.base,...local.desktop,...local.tablet,...local.mobile},
  };
}
export function cmsDesignPresentation(values: CmsResolvedDesign) {
  const styles = (value: CmsDesignValues) => Object.fromEntries(Object.entries({
    maxWidth:value.maxWidth,gap:value.moduleGap,columnGap:value.columnGap,color:value.color,backgroundColor:value.backgroundColor,
  }).filter(([,value])=>value!==undefined)) as Record<string,string>;
  return {base:styles(values.desktop),desktop:styles(values.desktop),tablet:styles(values.tablet),mobile:styles(values.mobile)};
}
export function cmsDesignFromTokens(tokens?: {maxWidth?:string;defaultModuleGap?:string;defaultColumnGap?:string;colors?:Record<string,string>}): CmsResolvedDesign {
  const safeLength=(value:unknown)=>typeof value==='string'&&/^(?:none|0|[0-9]{1,4}(?:\.[0-9]{1,2})?(?:px|rem|em|%|vw))$/.test(value)?value:undefined;
  const safeColor=(value:unknown)=>typeof value==='string'&&/^(?:#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|transparent|currentColor)$/.test(value)?value:undefined;
  const base=Object.fromEntries(Object.entries({maxWidth:safeLength(tokens?.maxWidth),moduleGap:safeLength(tokens?.defaultModuleGap),columnGap:safeLength(tokens?.defaultColumnGap),color:safeColor(tokens?.colors?.foreground),backgroundColor:safeColor(tokens?.colors?.background)}).filter(([,value])=>value!==undefined));
  return resolveCmsDesignSettings(emptyCmsDesign,{base});
}
