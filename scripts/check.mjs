import { readFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

export function auditLinks(pages, files) {
    const errors = [];
    for (const [name, html] of pages) {
        for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
            const value = match[1].replaceAll('&amp;', '&');
            const target = new URL(value, `https://site.invalid/${name}`);
            if (target.origin !== 'https://site.invalid') continue;
            const file = decodeURIComponent(target.pathname.slice(1)) || 'index.html';
            if (!files.has(file)) errors.push(`${name}: missing target ${value}`);
            else if (target.hash && pages.has(file)) {
                const ids = new Set([...pages.get(file).matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
                if (!ids.has(decodeURIComponent(target.hash.slice(1)))) errors.push(`${name}: missing fragment ${value}`);
            }
        }
    }
    return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const files = new Set(await readdir(root));
    const pages = new Map(await Promise.all([...files].filter(name => name.endsWith('.html')).map(async name => [name, await readFile(resolve(root, name), 'utf8')])));
    const errors = auditLinks(pages, files);
    for (const file of ['books.js', 'ga.js', ...((await readdir(resolve(root, 'scripts'))).filter(name => name.endsWith('.mjs')).map(name => `scripts/${name}`))]) {
        try { execFileSync(process.execPath, ['--check', resolve(root, file)], {stdio:'pipe'}); }
        catch (error) { errors.push(`${file}: ${error.stderr?.toString() || error.message}`); }
    }
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(`Internal links, fragments and JavaScript syntax checked across ${pages.size} pages.`);
}
