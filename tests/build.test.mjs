import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

async function fixture(t) {
    const root = await mkdtemp(join(tmpdir(), 'personal-site-test-'));
    t.after(() => rm(root, {recursive:true,force:true}));
    for (const directory of ['scripts','data','src']) await cp(new URL(`../${directory}`, import.meta.url),join(root,directory),{recursive:true});
    return {root, run: (...args) => spawnSync(process.execPath,[join(root,'scripts/build.mjs'),...args],{encoding:'utf8'})};
}

test('build preserves dollar signs in book titles literally', async t => {
    const {root,run}=await fixture(t);
    const path=join(root,'data/books.json');
    const data=JSON.parse(await readFile(path,'utf8'));
    data['2026'][0].title='Money $$$';
    await writeFile(path,JSON.stringify(data));
    const result=run();
    assert.equal(result.status,0,result.stderr);
    const html=await readFile(join(root,'books.html'),'utf8');
    assert.ok(html.includes('class="book-title">Money $$$</'));
});

test('build check rejects data edits until generated HTML is updated', async t => {
    const {root,run}=await fixture(t);
    assert.equal(run().status,0);
    assert.equal(run('--check').status,0);
    const path=join(root,'data/books.json');
    const data=JSON.parse(await readFile(path,'utf8'));
    data['2026'][0].title='Updated title';
    await writeFile(path,JSON.stringify(data));
    const result=run('--check');
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/stale: books.html/);
    assert.equal(run().status,0);
    assert.equal(run('--check').status,0);
});
