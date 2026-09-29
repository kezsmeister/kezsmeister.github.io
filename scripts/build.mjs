import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml, renderBooks } from './render.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFile(resolve(root, file), 'utf8');
const args = process.argv.slice(2);
const check = args.includes('--check');
const outputIndex = args.indexOf('--out-dir');
if (args.some(arg => arg.startsWith('--') && !['--check', '--out-dir'].includes(arg))) throw new Error('Usage: node scripts/build.mjs [--check | --out-dir DIRECTORY]');
if (outputIndex !== -1 && (!args[outputIndex + 1] || check)) throw new Error('--out-dir needs a directory and cannot be combined with --check.');
const output = outputIndex === -1 ? root : resolve(root, args[outputIndex + 1]);
const site = JSON.parse(await read('data/site.json'));
const books = JSON.parse(await read('data/books.json'));
const layout = await read('src/layout.html');
if (!/^\d{4}-\d{2}-\d{2}$/.test(site.updated) || Number.isNaN(Date.parse(site.updated)) || new Date(site.updated).toISOString().slice(0, 10) !== site.updated) throw new Error('site.updated must be a valid YYYY-MM-DD date.');
if (!/^G-[A-Z\d]+$/.test(site.analyticsId)) throw new Error('Invalid analytics ID.');
const slugs = site.pages.map(page => page.slug);
if (new Set(slugs).size !== slugs.length || slugs.some(slug => !/^[a-z][a-z-]*$/.test(slug)) || site.navigation.some(slug => !slugs.includes(slug))) throw new Error('Invalid or duplicate page slug/navigation target.');
const updatedLabel = new Intl.DateTimeFormat('en', {month:'long', year:'numeric', timeZone:'UTC'}).format(new Date(site.updated));
const renderedBooks = renderBooks(books);
const files = new Map();
for (const page of site.pages) {
    const content = (await read(`src/pages/${page.slug}.html`)).replace('{{books}}', () => renderedBooks).trimEnd();
    const navigation = site.navigation.map(slug => `                <a href="${slug}.html"${slug === page.slug ? ' class="active" aria-current="page"' : ''}>${slug}</a>`).join('\n');
    const values = {
        ...Object.fromEntries(Object.entries(page).map(([key, value]) => [key, escapeHtml(value)])),
        name: escapeHtml(site.name), updated: site.updated, updatedLabel,
        analyticsId: site.analyticsId, navigation, content,
        scripts: page.slug === 'books' ? '    <script type="module" src="books.js"></script>' : ''
    };
    const html = layout.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        if (!(key in values)) throw new Error(`Unknown layout token: ${key}`);
        return values[key];
    });
    if (/\{\{\w+\}\}/.test(html)) throw new Error(`Unresolved template token in ${page.slug}`);
    files.set(`${page.slug}.html`, html.replace(/[ \t]+$/gm, ''));
}
files.set('ga.js', `window.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());\ngtag('config', ${JSON.stringify(site.analyticsId)});\n`);
files.set('.nojekyll', '');

if (!check) await mkdir(output, {recursive:true});
const stale = [];
for (const [name, content] of files) {
    if (check) {
        const actual = await read(name).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
        if (actual !== content) stale.push(name);
    } else await writeFile(resolve(output, name), content);
}
if (stale.length) throw new Error(`Generated files are stale: ${stale.join(', ')}. Run npm run build and commit the output.`);
if (!check && output !== root) {
    for (const asset of ['styles.css', 'books.js', 'favicon.svg', 'photo.webp']) await copyFile(resolve(root, asset), resolve(output, asset));
}
console.log(check ? 'Generated files match their sources.' : `Built ${site.pages.length} pages (${Object.values(books).flat().length} books).`);
