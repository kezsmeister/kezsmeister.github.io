# Zhalgas Serimbetov's personal website

A static GitHub Pages site. Visitors need no framework or JavaScript to read books and essays or open sections. Node builds the HTML; the only browser enhancement retries book covers near the viewport.

## Edit the site

Use Node.js 22 or newer (CI uses Node 24).

```sh
npm ci
npm run build
npm run check
npm run serve
```

Open http://127.0.0.1:4173. Generated HTML is committed so GitHub Pages can continue publishing from `main` without a hosting change.

- **Books:** edit `data/books.json`. Years are reading years; add a book to the relevant array. `title`, `author`, and a six-digit fallback `color` are required. Supply `isbns`, `directCover`, or `noImage: true`. Use `reread: true` when appropriate. Duplicate title/author pairs within one year are rejected; rereads across years are valid.
- **Page content:** edit `src/pages/*.html`. The Books fragment uses `{{books}}` for the generated reading list.
- **Navigation, metadata, analytics ID and update date:** edit `data/site.json`. Set `updated` to the content update date in `YYYY-MM-DD` form.
- **Shared page structure:** edit `src/layout.html`.
- **Appearance:** edit `styles.css`.

After editing source content, run `npm run build` and commit the source changes together with generated root HTML and `ga.js`. `npm run check` rejects stale generated files. Do not edit generated files directly.

New image providers must be allowed in both `scripts/render.mjs` and the shared layout's image content security policy. Existing HTTPS cover sources are preserved. Titles and authors are HTML-escaped by the renderer.

## Verification and publishing

`npm run check` validates book data, regenerated output, internal links/fragments, JavaScript syntax, color contrast, and cover-loader regressions.

```sh
npx playwright install chromium
npm run test:browser
```

Browser checks cover disabled JavaScript, keyboard interactions, collapsed accessibility content, rapid toggles, and phone layout. They block external image/font/analytics requests to avoid third-party availability making CI flaky. Manual previews can use `?nojs=1` to omit scripts locally; this query has no special behavior on the live site.

The **Check site** workflow runs on pushes and pull requests. Publish changes by working on a branch and waiting for this check before merging into `main`; the existing GitHub Pages deployment then publishes the generated files. Repository administrators can additionally make **Check site / check** a required branch check. Direct pushes to `main` still trigger Pages independently, so use the branch/check/merge flow.

`node scripts/build.mjs --out-dir dist` creates a standalone directory containing only public pages and assets when needed.
