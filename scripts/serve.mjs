import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4173);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp'};
createServer(async (request, response) => {
    try {
        const url = new URL(request.url, `http://127.0.0.1:${port}`);
        const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
        if (!path.startsWith(root + sep) || !types[extname(path)]) {
            response.writeHead(404); response.end('Not found'); return;
        }
        let body = await readFile(path);
        // Local preview aid only; CI also checks with JavaScript disabled in the browser.
        if (url.searchParams.has('nojs') && extname(path) === '.html') body = body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
        response.writeHead(200, {'Content-Type':types[extname(path)], 'Cache-Control':'no-store'});
        response.end(body);
    } catch {
        response.writeHead(404); response.end('Not found');
    }
}).listen(port, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${port}`));
