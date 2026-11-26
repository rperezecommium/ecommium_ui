import type { CmsBlock } from './cms-blocks';
import type { CmsSectionDocument } from './cms-independent-section-types';
import { remapSection } from './cms-section-tree';

export const CMS_SECTION_BLOCK = 'cms.section';
/** A library insertion is an independent copy, placed in the existing shell layout. */
export function insertShellLibrarySection(document:CmsSectionDocument,kind:'HEADER'|'FOOTER',areaId:string,order:number):CmsBlock {
  if(!areaId)throw Error('Selecciona un área válida para la sección.');
  const copy=remapSection(document);
  delete copy.placement;
  return {blockId:`cms-${crypto.randomUUID()}`,type:CMS_SECTION_BLOCK,placement:{region:kind==='HEADER'?'header':'footer',areaId,columnIndex:1,order},props:{contractVersion:1,document:copy}};
}
export function shellSection(block:CmsBlock):CmsSectionDocument {
  if(block.type!==CMS_SECTION_BLOCK||block.props.contractVersion!==1||!block.props.document) throw Error('Sección de cabecera/pie no válida.');
  return block.props.document as CmsSectionDocument;
}
