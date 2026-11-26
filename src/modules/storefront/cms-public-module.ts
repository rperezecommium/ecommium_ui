import Ajv from 'ajv';
import schema from '../../../docs/contracts/cms-composition-boundary.schema.json';
import type {CmsIndependentModule} from '../cms/cms-independent-module-types';
const validate=new Ajv({allErrors:true}).compile({definitions:schema.definitions,$ref:'#/definitions/module'});
export function parseCmsPublicModule(value:unknown):CmsIndependentModule {
 if(!validate(value))throw Error('El módulo público no cumple el contrato CMS.');
 return value as CmsIndependentModule;
}
