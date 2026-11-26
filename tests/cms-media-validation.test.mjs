import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTs } from './helpers/load-ts.mjs';

test('CMS builder rejects invalid images before collection lookup or write', async () => {
  let calls = 0;
  const unexpected = () => { calls++; throw new Error('Unexpected BFF call'); };
  const actions = loadTs('src/modules/cms/cms-admin-actions.ts', {
    'next/cache': { revalidatePath() {} },
    'next/navigation': { redirect: unexpected },
    '../catalogo/media-admin': { listMediaCollections: unexpected, createMediaCollection: unexpected, addMediaCollectionItems: unexpected },
    '../../shared/config/admin-context': { getAdminContext: async () => ({ organizationId: 'org', shopId: 'shop', locale: 'es-ES' }) },
    './cms-admin': {},
  });
  for (const file of [new File(['bad'], 'broken.png', { type: 'image/png' }), new File(['<svg/>'], 'active.svg', { type: 'image/svg+xml' })]) {
    const form = new FormData(); form.set('file', file);
    const result = await actions.uploadCmsBuilderMediaAction(form);
    assert.equal(result.ok, false);
    assert.ok(result.message);
  }
  assert.equal(calls, 0);
});
