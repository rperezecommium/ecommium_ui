import type {CSSProperties,ReactNode} from 'react';
import type {CmsBlockModulePlacement,CmsPresentation,CmsVisualBreakpoint,CmsScopedStyleSheet} from './index';

export type CmsCompositionLayout = {
 styleSheet?:CmsScopedStyleSheet;
 regions:Partial<Record<'header'|'main'|'footer',{areas:Array<{areaId:string;containerMode:'container'|'full-width';maxWidth?:string|null;columns:string[];columnSlots?:Array<{columnIndex:number;width:string;percentage:number}>;columnGap?:string|null;rowGap?:string|null;presentation?:CmsPresentation}>}>>;
};
export function CmsCompositionLayoutView<T extends {sectionId:string;placement?:CmsBlockModulePlacement}>({layout,sections,renderSection,viewport,moduleGap,columnGap,ownerId}:{ownerId?:string;layout:CmsCompositionLayout;sections:T[];renderSection:(section:T)=>ReactNode;viewport?:CmsVisualBreakpoint;moduleGap?:string;columnGap?:string}) {
 return <div className="storefrontCmsPageBlocks storefrontCmsPageLayout cmsCompositionLayout" data-cms-layout-viewport={viewport}>
  {(['header','main','footer'] as const).map(region=>{
   const areas=layout.regions[region]?.areas??[];
   return areas.length?<section data-cms-space-owner={ownerId} className="storefrontCmsPageRegion" data-cms-region={region} key={region}>{areas.map(area=>{
    const widths=area.columns.length?area.columns:['100%'];
    const columns=area.columnSlots?.length?area.columnSlots:widths.map((width,index)=>({columnIndex:index+1,width}));
    const style={columnGap:area.columnGap??columnGap,rowGap:area.rowGap??moduleGap,gridTemplateColumns:widths.map(width=>`minmax(0, ${width})`).join(' '),'--cms-layout-columns':widths.map(width=>`minmax(0, ${width})`).join(' ')} as CSSProperties;
    return <section key={area.areaId} data-cms-space-owner={ownerId} className="storefrontCmsPageArea" data-cms-area={area.areaId} data-container-mode={area.containerMode} style={area.containerMode==='container'&&area.maxWidth?{maxWidth:area.maxWidth}:undefined}>
     <div data-cms-space-owner={ownerId} className="storefrontCmsPageColumns" style={style}>{columns.map(column=><section data-cms-space-owner={ownerId} className="storefrontCmsPageColumn" data-cms-column={column.columnIndex} key={column.columnIndex} style={moduleGap?{gap:moduleGap}:undefined}>
      {sections.filter(section=>section.placement?.region===region&&section.placement.areaId===area.areaId&&section.placement.columnIndex===column.columnIndex).sort((a,b)=>(a.placement?.order??0)-(b.placement?.order??0)).map(section=>{
       const p=section.placement!;
       return <div data-cms-space-owner={ownerId} className="storefrontCmsPageModule" data-container-mode={p.containerMode??'inherit'} key={section.sectionId} style={{justifySelf:p.align&&p.align!=='stretch'?p.align:'stretch',width:p.width??undefined,...p.spacing}}>{renderSection(section)}</div>;
      })}
     </section>)}</div>
    </section>;
   })}</section>:null;
  })}
  {sections.some(section=>!section.placement)?<section className="storefrontCmsPageUnplaced">{sections.filter(section=>!section.placement).map(section=><div key={section.sectionId}>{renderSection(section)}</div>)}</section>:null}
 </div>;
}
