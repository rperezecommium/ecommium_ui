import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv from 'ajv';
test('publication recovery is an explicit revision-bound command and accepts no content payload',()=>{
 const schema=JSON.parse(fs.readFileSync('docs/contracts/cms-composition-boundary.schema.json','utf8'));
 const validate=new Ajv({allErrors:true}).compile({definitions:schema.definitions,$ref:'#/definitions/publishRequest'});
 const command={contractVersion:1,operation:'PUBLISH',operationId:'00000000-0000-4000-8000-000000000001',expectedRevision:'current',versionId:'previous',restorePublished:true};
 assert.equal(validate(command),true,JSON.stringify(validate.errors));
 for(const value of [{...command,restorePublished:false},{...command,document:{}},{...command,expectedRevision:''},{...command,operation:'DELETE'}])assert.equal(validate(value),false);
});
