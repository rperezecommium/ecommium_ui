import Ajv from 'ajv';
import schema from '../../../docs/contracts/cms-composition-boundary.schema.json';
import type { CmsBlock } from './cms-blocks';
import { CMS_SECTION_BLOCK, shellSection } from './cms-shell-composition';
const validate = new Ajv({allErrors:true}).compile({definitions:schema.definitions,$ref:'#/definitions/section'});
const validateDesign=new Ajv({allErrors:true}).compile({definitions:schema.definitions,$ref:'#/definitions/designSettings'});
export function assertShellDesignSettings(value:unknown) {if(!validateDesign(value))throw Error('Los ajustes básicos no cumplen el contrato CMS.');}
export function assertShellCompositionBlocks(blocks:CmsBlock[]) {
  if(!Array.isArray(blocks)||blocks.length>24||Buffer.byteLength(JSON.stringify(blocks),'utf8')>1048576) throw Error('Composición fuera de los límites.');
  for(const block of blocks) {
    if(block.type!==CMS_SECTION_BLOCK||!validate(shellSection(block))) throw Error('La sección no cumple el contrato CMS.');
  }
}
