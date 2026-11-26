import {adminOnlyOrigin} from "../src/shared/config/admin-deployment-profile.mjs";
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync(new URL('../src/shared/config/deployment-routing.ts',import.meta.url),'utf8');
const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URL,process,require:()=>({adminOnlyOrigin})});
const {deploymentSurface}=exports;
const env={NODE_ENV:'production',ECOMMIUM_UI_ROUTING_MODE:'SEPARATED_V1',ECOMMIUM_UI_STOREFRONT_ORIGIN:'https://shop.example.test',ECOMMIUM_UI_ADMIN_ORIGIN:'https://admin.example.test',ECOMMIUM_STOREFRONT_BFF_BASE_URL:'https://api.example.test/api/v1',ECOMMIUM_ADMIN_BFF_BASE_URL:'https://admin-api.example.test/api/v1'};
test('separated hosts expose only their surface',()=>{
 assert.equal(deploymentSurface('shop.example.test','/',env),'allow');
 assert.equal(deploymentSurface('shop.example.test','/admin',env),'reject');
 assert.equal(deploymentSurface('shop.example.test','/auth/login',env),'reject');
 assert.equal(deploymentSurface('shop.example.test','/%61dmin',env),'reject');
 assert.equal(deploymentSurface('shop.example.test','/%2561dmin',env),'reject');
 assert.equal(deploymentSurface('admin.example.test','/',env),'admin-root');
 assert.equal(deploymentSurface('admin.example.test','/admin/catalogo',env),'allow');
 assert.equal(deploymentSurface('admin.example.test','/pdp/product',env),'reject');
 assert.equal(deploymentSurface('shop.example.test','/api/admin/session/state',env),'reject');
 assert.equal(deploymentSurface('admin.example.test','/api/v1/storefront/consent/policy',env),'reject');
 assert.equal(deploymentSurface('admin.example.test','/api/admin/session/state',env),'allow');
});
test('unknown or ambiguous host cannot fall back to configured tenant',()=>{
 for(const host of [null,'other.example.test','shop.example.test,admin.example.test','shop.example.test@attacker.test'])assert.equal(deploymentSurface(host,'/',env),'reject');
});
test('bad runtime configuration and API/web collisions fail closed',()=>{
 for(const patch of [{ECOMMIUM_UI_ROUTING_MODE:'UNKNOWN'},{ECOMMIUM_UI_ADMIN_ORIGIN:env.ECOMMIUM_UI_STOREFRONT_ORIGIN},{ECOMMIUM_UI_ADMIN_ORIGIN:'https://admin.example.test/path'},{ECOMMIUM_UI_STOREFRONT_ORIGIN:'http://shop.example.test'},{ECOMMIUM_ADMIN_BFF_BASE_URL:'https://admin.example.test/api/v1'}])assert.throws(()=>deploymentSurface('shop.example.test','/',{...env,...patch}));
});
test('native Cloud Run probe is independent of public Host',()=>assert.equal(deploymentSurface('127.0.0.1:8080','/api/health',env),'allow'));
test('legacy local profile is preserved',()=>assert.equal(deploymentSurface('localhost:5173','/admin',{}),'legacy'));

const adminEnv={NODE_ENV:'production',ECOMMIUM_UI_SURFACE:'ADMIN',ECOMMIUM_UI_ADMIN_ORIGIN:'https://admin.example.test',ECOMMIUM_ADMIN_BFF_BASE_URL:'https://admin-api.example.test/api/v1',ECOMMIUM_UI_ADMIN_SESSION_SECRET:'k'.repeat(48)};
test('Admin starts before a tenant while exposing only its own surface',()=>{
 assert.equal(exports.adminOnlyOrigin(adminEnv).origin,adminEnv.ECOMMIUM_UI_ADMIN_ORIGIN);
 for(const path of ['/admin/installation','/auth/login','/admin/configuracion/contexto','/api/admin/session/state'])assert.equal(deploymentSurface('admin.example.test',path,adminEnv),'allow');
 for(const path of ['/pdp/example','/','/api/v1/storefront/consent/policy','/%70dp/example','/admin/%2e%2e/pdp/example'])assert.equal(deploymentSurface('admin.example.test',path,adminEnv),path==='/'?'admin-root':'reject');
 for(const host of [null,'foreign.example.test','admin.example.test:444','admin.example.test,foreign.example.test'])assert.equal(deploymentSurface(host,'/admin/installation',adminEnv),'reject');
});
test('Admin profile rejects incomplete configuration, unsafe API and mixed deployment modes',()=>{
 for(const patch of [{ECOMMIUM_UI_SURFACE:'UNKNOWN'},{ECOMMIUM_UI_ADMIN_ORIGIN:'http://admin.example.test'},{ECOMMIUM_ADMIN_BFF_BASE_URL:'http://admin-api.example.test/api/v1'},{ECOMMIUM_ADMIN_BFF_BASE_URL:'https://user:secret@admin-api.example.test/api/v1'},{ECOMMIUM_ADMIN_BFF_BASE_URL:'https://admin.example.test/api/v1'},{ECOMMIUM_UI_ADMIN_SESSION_SECRET:''},{ECOMMIUM_ADMIN_BFF_TOKEN:'forbidden'},{ECOMMIUM_UI_ROUTING_MODE:'SEPARATED_V1'}])assert.throws(()=>exports.adminOnlyOrigin({...adminEnv,...patch}));
});
test('Admin plaintext transport is limited to both loopback endpoints and the exact port',()=>{
 const local={...adminEnv,ECOMMIUM_UI_ADMIN_ORIGIN:'http://127.0.0.1:4001',ECOMMIUM_ADMIN_BFF_BASE_URL:'http://127.0.0.1:4002/api/v1'};
 assert.equal(deploymentSurface('127.0.0.1:4001','/admin/installation',local),'allow');assert.equal(deploymentSurface('127.0.0.1:4003','/admin/installation',local),'reject');
 assert.throws(()=>exports.adminOnlyOrigin({...local,ECOMMIUM_ADMIN_BFF_BASE_URL:'http://192.168.64.4:4002/api/v1'}));
});
