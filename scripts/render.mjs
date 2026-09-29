// Keep these origins aligned with img-src in src/layout.html.
const coverOrigins = new Set([
    'https://books.google.com', 'https://covers.openlibrary.org',
    'https://cdn.penguin.co.uk', 'https://cup-us.imgix.net',
    'https://atlantic-books.co.uk', 'https://media.wiley.com',
    'https://static.wixstatic.com', 'https://benbellabooks.com'
]);

export function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}

export function validateBooks(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Books must be grouped by year.');
    for (const [year, books] of Object.entries(data)) {
        if (!/^\d{4}$/.test(year) || !Array.isArray(books)) throw new Error(`Invalid reading year: ${year}`);
        const seen = new Set();
        for (const book of books) {
            for (const field of ['title', 'author']) {
                if (typeof book?.[field] !== 'string' || !book[field].trim()) throw new Error(`${year}: book ${field} is required.`);
            }
            const key = [book.title, book.author].map(s => s.trim().normalize('NFKC').toLowerCase()).join('\0');
            if (seen.has(key)) throw new Error(`${year}: duplicate book ${book.title}`);
            seen.add(key);
            if (!/^#[a-f\d]{6}$/i.test(book.color)) throw new Error(`${book.title}: invalid fallback color.`);
            if (book.isbns !== undefined && (!Array.isArray(book.isbns) || book.isbns.some(isbn => typeof isbn !== 'string' || !/^(\d{9}[\dX]|\d{13})$/.test(isbn)))) {
                throw new Error(`${book.title}: invalid ISBN.`);
            }
            if (book.directCover) {
                let cover;
                try { cover = new URL(book.directCover); } catch { throw new Error(`${book.title}: invalid cover URL.`); }
                if (!coverOrigins.has(cover.origin) || cover.username || cover.password) throw new Error(`${book.title}: cover origin is not allowed by the content security policy.`);
            }
            if (!book.noImage && !book.directCover && !book.isbns?.length) throw new Error(`${book.title}: provide a cover source or noImage: true.`);
        }
    }
}

function coverUrls(book) {
    if (book.noImage) return [];
    const urls = book.directCover ? [book.directCover] : [];
    for (const isbn of book.isbns || []) urls.push(`https://books.google.com/books/content?vid=ISBN:${isbn}&printsec=frontcover&img=1&zoom=1`);
    for (const isbn of book.isbns || []) urls.push(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`);
    return [...new Set(urls)];
}

function renderBook(book) {
    const sources = coverUrls(book);
    const image = sources.length ? `<img class="book-cover" src="${escapeHtml(sources[0])}" data-cover-sources="${escapeHtml(JSON.stringify(sources))}" alt="" width="200" height="300" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : '';
    return `<div class="book-card">
    <div class="book-cover-wrapper" style="background-color: ${book.color}">
        ${image}
        <div class="book-cover-fallback" aria-hidden="true">${escapeHtml(book.title)}</div>
    </div>
    <div class="book-info">
        <div class="book-title">${escapeHtml(book.title)}</div>
        <div class="book-author">${escapeHtml(book.author)}</div>
        ${book.reread ? '<div class="book-reread">re-read</div>' : ''}
    </div>
</div>`;
}

export function renderBooks(data) {
    validateBooks(data);
    const years = Object.keys(data).sort((a, b) => Number(b) - Number(a));
    return years.map((year, index) => `<details class="year-section" data-year="${year}"${index === 0 ? ' open' : ''}>
    <summary class="year-toggle">
        <h2 class="year-label">${year}</h2>
        <svg class="toggle-icon" aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </summary>
    <div class="books-grid">
${data[year].map(renderBook).join('\n')}
    </div>
</details>`).join('\n');
}
