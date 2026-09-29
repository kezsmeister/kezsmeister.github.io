import test from 'node:test';
import assert from 'node:assert/strict';
import { auditLinks } from '../scripts/check.mjs';

test('reports broken local pages and fragment targets', () => {
    const pages = new Map([['index.html','<a href="missing.html">Missing</a><a href="about.html#missing">Anchor</a>'],['about.html','<main id="main"></main>']]);
    assert.equal(auditLinks(pages,new Set(pages.keys())).length,2);
});
test('accepts existing local assets, fragment links, and external destinations', () => {
    const pages = new Map([['index.html','<a href="#main">Skip</a><main id="main"><img src="photo.webp"><a href="https://example.com/">Web</a></main>']]);
    assert.deepEqual(auditLinks(pages,new Set(['index.html','photo.webp'])),[]);
});
