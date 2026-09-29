const initializedCovers = new WeakSet();
const activatedCovers = new WeakSet();

function coverSources(img) {
    try {
        const sources = JSON.parse(img.dataset.coverSources);
        return Array.isArray(sources)
            ? sources.filter(source => typeof source === 'string' && source.length > 0)
            : [];
    } catch {
        return [];
    }
}

function isGooglePlaceholder(img, url) {
    if (!url.includes('books.google.com')) return false;
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    // Google Books returns these two known placeholders with a successful status.
    return (width === 128 && (height === 170 || height === 184))
        || (width > 0 && height / width < 1.2);
}

function isValidCover(img, url) {
    return img.naturalWidth > 50 && img.naturalHeight > 50
        && !isGooglePlaceholder(img, url);
}

export function loadBookCover(img, sources = coverSources(img)) {
    if (activatedCovers.has(img)) return;
    activatedCovers.add(img);
    img.classList.add('is-loading');
    img.loading = 'eager';

    function finish(loaded) {
        img.onload = null;
        img.onerror = null;
        img.classList.remove('is-loading');
        img.classList.add(loaded ? 'loaded' : 'is-unavailable');
    }

    function trySource(index) {
        if (index >= sources.length) {
            finish(false);
            return;
        }
        const url = sources[index];
        let settled = false;
        let timer;

        function settle(loaded) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (loaded) finish(true);
            else trySource(index + 1);
        }

        img.onload = () => settle(isValidCover(img, url));
        img.onerror = () => settle(false);

        // Only abandon a stalled request when another candidate exists. The
        // final source can still succeed on a slow connection after five seconds.
        if (index < sources.length - 1) {
            timer = setTimeout(() => settle(false), 5000);
        }

        if (img.getAttribute('src') === url) {
            // Reuse the native request, including a result already in the cache.
            if (img.complete) settle(isValidCover(img, url));
        } else {
            img.src = url;
        }
    }

    trySource(0);
}

export function initBookCovers(root = document) {
    // Native lazy images remain usable when IntersectionObserver is unavailable.
    if (typeof IntersectionObserver === 'undefined') return;
    const pending = new Set();
    root.querySelectorAll('.book-cover[data-cover-sources]').forEach(img => {
        if (initializedCovers.has(img) || activatedCovers.has(img)) return;
        initializedCovers.add(img);
        img.classList.add('is-loading');
        pending.add(img);
    });
    if (pending.size === 0) return;

    const observer = new IntersectionObserver(entries => {
        entries.forEach(({ target: img, isIntersecting }) => {
            if (!isIntersecting || img.closest('details:not([open])')) return;
            if (!pending.delete(img)) return;
            observer.unobserve(img);
            loadBookCover(img);
        });
        if (pending.size === 0) observer.disconnect();
    }, { rootMargin: '200px' });

    pending.forEach(img => observer.observe(img));
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => initBookCovers(), { once: true });
    } else {
        initBookCovers();
    }
}
