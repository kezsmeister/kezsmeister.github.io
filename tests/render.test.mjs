import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBooks, renderBooks } from '../scripts/render.mjs';

const book = {title:'Example', author:'A. Writer', color:'#5c4033', isbns:['9781529155853']};

test('rejects duplicate title and author within the same reading year', () => {
    assert.throws(() => validateBooks({2026:[book,{...book,title:' example '}]}), /duplicate/i);
});
test('permits rereading the same book in another year', () => {
    assert.doesNotThrow(() => validateBooks({2025:[book],2026:[{...book,reread:true}]}));
});
test('rejects missing authors and malformed cover URLs before generating a page', () => {
    assert.throws(() => validateBooks({2026:[{...book,author:''}]}), /author/i);
    assert.throws(() => validateBooks({2026:[{...book,directCover:'javascript:alert(1)'}]}), /cover/i);
});
test('rejects covers that the site content security policy would block', () => {
    assert.throws(() => validateBooks({2026:[{...book,directCover:'https://example.com/cover.jpg'}]}), /cover/i);
});
test('escapes book metadata into visible text, not executable markup', () => {
    const html = renderBooks({2026:[{...book,title:'<script>& "Book"',author:'A & B'}]});
    assert.ok(html.includes('&lt;script&gt;&amp; &quot;Book&quot;'));
    assert.ok(html.includes('A &amp; B'));
    assert.ok(!html.includes('<script>'));
});
test('uses real image URLs for no-JavaScript readers and no image for text-only books', () => {
    const html = renderBooks({2026:[book,{title:'Rare book',author:'Another Writer',color:'#5c4033',noImage:true}]});
    assert.ok(html.includes('src="https://books.google.com/books/content?vid=ISBN:9781529155853&amp;'));
    assert.equal((html.match(/<img /g)||[]).length,1);
    assert.ok(html.includes('Rare book'));
});
