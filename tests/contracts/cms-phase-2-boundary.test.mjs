import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
const require = createRequire(import.meta.url);
const Ajv = require("ajv");
const schema = JSON.parse(
  readFileSync(
    new URL(
      "../../docs/contracts/cms-composition-boundary.schema.json",
      import.meta.url,
    ),
  ),
);
const compile = (name) =>
  new Ajv({ allErrors: true }).compile({
    definitions: schema.definitions,
    $ref: `#/definitions/${name}`,
  });
test("MODULE archive requires CAS and rejects document, authority and visible revision", () => {
  const validate = compile("moduleArchive");
  const command = {
    contractVersion: 1,
    resourceKind: "MODULE",
    expectedRevision: "opaque",
  };
  assert.equal(validate(command), true);
  for (const key of Object.keys(command)) {
    const invalid = { ...command };
    delete invalid[key];
    assert.equal(validate(invalid), false);
  }
  for (const extra of [
    { document: {} },
    { organizationId: "other" },
    { revision: 2 },
    { operationId: "extra" },
  ])
    assert.equal(validate({ ...command, ...extra }), false);
});
test("MODULE receipt exposes canonical state for visual and registered pieces", () => {
  const validate = compile("moduleReceipt");
  const document = {
    instanceId: "i",
    name: "FAQ",
    body: {
      kind: "registered",
      type: "accordion",
      props: { heading: "FAQ", items: [{ title: "Q", content: "A" }] },
    },
  };
  const receipt = {
    contractVersion: 1,
    resourceKind: "MODULE",
    resourceId: "r",
    revisionToken: "opaque",
    context: { organizationId: "o", shopId: "s" },
    document,
    status: "DRAFT",
  };
  for (const status of ["DRAFT", "ARCHIVED"])
    assert.equal(validate({ ...receipt, status }), true);
  for (const status of [undefined, "ACTIVE", "PUBLISHED"])
    assert.equal(validate({ ...receipt, status }), false);
});
test("ARIA reference syntax is closed; existence remains a semantic owner check", () => {
  const validate = compile("visualProps");
  assert.equal(
    validate({
      ariaLabelledBy: "title subtitle",
      ariaDescribedBy: "description",
    }),
    true,
  );
  for (const value of ["", " title", "title ", "title\nother", "title  other"])
    assert.equal(validate({ ariaLabelledBy: value }), false);
  assert.equal(validate({ id: "arbitrary-dom-id" }), false);
  assert.equal(validate({ onClick: "code" }), false);
});

test('inherited design and declared registered fields remain closed and scoped to their type',()=>{
 const moduleShape=compile('module');
 const piece={instanceId:'cms-search',name:'Search',editableFields:['placeholder'],designSettings:{base:{moduleGap:'16px'},mobile:{maxWidth:'100%'}},body:{kind:'registered',type:'commerce.search',props:{placeholder:'Buscar'}}};
 assert.equal(moduleShape(piece),true);
 for(const invalid of [{...piece,editableFields:['customerId']},{...piece,editableFields:['presentation']},{...piece,designSettings:{base:{moduleGap:'url(javascript:x)'}}},{...piece,designSettings:{desktop:{position:'fixed'}}}])assert.equal(moduleShape(invalid),false);
 const pageShape=compile('composition');
 assert.equal(pageShape({compositionSchemaVersion:1,sections:[],plpModules:[{placement:'beforeList',target:{listingKind:'CATEGORY',categorySlug:'bike-brakes'},module:{instanceId:'cms-intro',name:'Intro',body:{kind:'registered',type:'plp.categoryIntro',props:{title:'Bike Brakes'}}}}]}),true);
});
