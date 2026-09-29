import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');

test('reading list is present in HTML before any JavaScript runs', async () => {
    const html = await read('books.html');
    assert.match(html, /class="book-title">1873</);
    assert.match(html, /class="book-author">Liaquat Ahamed</);
    assert.match(html, /class="book-title">SPQR</);
    const books = JSON.parse(await read('data/books.json'));
    assert.equal((html.match(/class="book-card"/g) || []).length, Object.values(books).flat().length);
});

test('book years and essays use native controls that work without scripts', async () => {
    const books = await read('books.html');
    const writings = await read('writings.html');
    assert.equal((books.match(/<details\b/g) || []).length, 4);
    assert.equal((books.match(/<summary\b/g) || []).length, 4);
    assert.match(books, /<details[^>]*data-year="2026"[^>]*open/);
    assert.equal((writings.match(/<details\b[^>]*\bopen/g) || []).length, 2);
    assert.match(writings, /id="best-investment-advice"/);
    assert.match(writings, /id="on-homeschooling"/);
});

function luminance(hex) {
    const rgb = hex.match(/[a-f\d]{2}/gi).map(x => parseInt(x, 16) / 255)
        .map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

test('muted text meets normal-text contrast against the page background', async () => {
    const css = await read('styles.css');
    const muted = css.match(/--color-text-muted:\s*(#[a-f\d]{6})/i)[1];
    const background = css.match(/--color-bg:\s*(#[a-f\d]{6})/i)[1];
    const contrast = (luminance(background) + 0.05) / (luminance(muted) + 0.05);
    assert.ok(contrast >= 4.5, `Contrast is ${contrast.toFixed(2)}:1`);
});
