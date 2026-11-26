import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
test('long product saves can use a separate deadline without changing ordinary BFF reads',async()=>{
 const timeouts=[],signals=[];
 const context={exports:{},require:()=>({createBffHeaders:()=>new Headers()}),Headers,URL,console,AbortSignal:{timeout:ms=>{timeouts.push(ms);return {ms}},any:signals=>({signals})},fetch:async(_url,options)=>{signals.push(options.signal);return new Response('{}',{status:200})}};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/shared/bff/request-client.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 const read=await context.exports.requestBffAt('http://bff.test','/read');
 const save=await context.exports.requestBffAt('http://bff.test','/save',{timeoutMs:60000});
 assert.equal(read.ok,true);assert.equal(save.ok,true);
 assert.deepEqual(timeouts,[15000,60000]);assert.equal(signals[0].ms,15000);assert.equal(signals[1].ms,60000);
});
