import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../books.js', import.meta.url), 'utf8');
const primary = 'https://publisher.example/cover.jpg';
const backup = 'https://covers.openlibrary.org/b/isbn/123-L.jpg';
const google = 'https://books.google.com/books/content?vid=ISBN:123';

function browser(images = []) {
    let now = 0;
    let nextTimer = 0;
    const timers = new Map();
    const observers = [];
    const document = {
        readyState: 'loading',
        querySelectorAll: selector => selector === '.book-cover[data-cover-sources]' ? images : [],
        addEventListener() {},
        removeEventListener() {},
    };
    const context = vm.createContext({
        document,
        setTimeout(fn, delay) {
            const id = ++nextTimer;
            timers.set(id, { fn, at: now + delay });
            return id;
        },
        clearTimeout: id => timers.delete(id),
        IntersectionObserver: class {
            constructor(callback, options) {
                this.callback = callback;
                this.options = options;
                this.observed = new Set();
                observers.push(this);
            }
            observe(img) { this.observed.add(img); }
            unobserve(img) { this.observed.delete(img); }
            disconnect() { this.observed.clear(); }
            intersect(img, isIntersecting = true) {
                this.callback([{ target: img, isIntersecting }]);
            }
        },
    });
    // Execute the real browser module against controlled image/observer/timer
    // boundaries. Each context gets fresh module state and its own document.
    vm.runInContext(source.replace(/^export\s+/gm, '') + `
        globalThis.coverApi = {
            load: loadBookCover,
            init: initBookCovers,
        };
    `, context);
    return {
        ...context.coverApi,
        document,
        observers,
        timers,
        advance(ms) {
            const end = now + ms;
            while (true) {
                const due = [...timers.entries()]
                    .filter(([, timer]) => timer.at <= end)
                    .sort((a, b) => a[1].at - b[1].at)[0];
                if (!due) break;
                now = due[1].at;
                timers.delete(due[0]);
                due[1].fn();
            }
            now = end;
        },
    };
}

function cover(sources = [primary, backup]) {
    let src = sources[0] || '';
    const classes = new Set(['book-cover']);
    return {
        dataset: { coverSources: JSON.stringify(sources) },
        classList: {
            add: (...names) => names.forEach(name => classes.add(name)),
            remove: (...names) => names.forEach(name => classes.delete(name)),
            contains: name => classes.has(name),
        },
        loading: 'lazy',
        complete: false,
        naturalWidth: 0,
        naturalHeight: 0,
        onload: null,
        onerror: null,
        closed: false,
        requests: [],
        get src() { return src; },
        set src(value) {
            src = value;
            this.requests.push(value);
            this.complete = false;
            this.naturalWidth = this.naturalHeight = 0;
        },
        getAttribute(name) { return name === 'src' ? src : null; },
        closest(selector) { return selector === 'details:not([open])' && this.closed ? {} : null; },
        succeed(width = 160, height = 240) {
            this.complete = true;
            this.naturalWidth = width;
            this.naturalHeight = height;
            this.onload?.call(this);
        },
        fail() {
            this.complete = true;
            this.naturalWidth = this.naturalHeight = 0;
            this.onerror?.call(this);
        },
    };
}

test('accepts a final cover response that takes longer than five seconds', () => {
    const img = cover();
    const env = browser();
    env.load(img, [primary, backup]);
    env.advance(5000);
    assert.equal(img.src, backup);
    env.advance(6000);
    img.succeed();
    assert.equal(img.classList.contains('loaded'), true);
    assert.equal(img.classList.contains('is-unavailable'), false);
});

test('retries failed sources in order without restarting the native primary request', () => {
    const third = 'https://publisher.example/third.jpg';
    const img = cover([primary, backup, third]);
    const env = browser();
    env.load(img, [primary, backup, third]);
    assert.deepEqual(img.requests, []);
    assert.equal(img.loading, 'eager');
    img.fail();
    assert.equal(img.src, backup);
    img.fail();
    assert.equal(img.src, third);
    img.succeed();
    assert.deepEqual(img.requests, [backup, third]);
    assert.equal(img.classList.contains('loaded'), true);
    assert.equal(env.timers.size, 0);
});

for (const [width, height] of [[1, 1], [128, 170], [128, 184], [128, 102]]) {
    test(`rejects a placeholder of ${width} by ${height} and tries the next source`, () => {
        const img = cover([google, backup]);
        const env = browser();
        env.load(img, [google, backup]);
        img.succeed(width, height);
        assert.equal(img.src, backup);
        assert.equal(img.classList.contains('loaded'), false);
        img.succeed();
        assert.equal(img.classList.contains('loaded'), true);
    });
}

test('uses an already completed valid primary cover without requesting it again', () => {
    const img = cover();
    img.succeed();
    const env = browser();
    env.load(img, [primary, backup]);
    assert.equal(img.classList.contains('loaded'), true);
    assert.deepEqual(img.requests, []);
    assert.equal(env.timers.size, 0);
});

test('does not activate retries until an image approaches the viewport', () => {
    const img = cover();
    const env = browser([img]);
    env.init(env.document);
    env.advance(20000);
    assert.deepEqual(img.requests, []);
    assert.equal(env.timers.size, 0);
    assert.equal(img.loading, 'lazy');
    assert.equal(env.observers.length, 1);
    env.observers[0].intersect(img, false);
    env.advance(20000);
    assert.deepEqual(img.requests, []);
    env.observers[0].intersect(img);
    env.advance(5000);
    assert.deepEqual(img.requests, [backup]);
});

test('keeps covers in closed details inactive until their section is visible', () => {
    const img = cover();
    img.closed = true;
    const env = browser([img]);
    env.init(env.document);
    assert.equal(env.observers.length, 1);
    env.observers[0].intersect(img);
    env.advance(10000);
    assert.equal(img.loading, 'lazy');
    assert.deepEqual(img.requests, []);
    img.closed = false;
    env.observers[0].intersect(img);
    env.advance(5000);
    assert.deepEqual(img.requests, [backup]);
});

test('repeated initialization and activation do not create competing retries', () => {
    const img = cover();
    const env = browser([img]);
    env.init(env.document);
    env.init(env.document);
    assert.equal(env.observers.length, 1);
    env.observers[0].intersect(img);
    env.observers[0].intersect(img);
    env.load(img, [primary, backup]);
    env.advance(5000);
    assert.deepEqual(img.requests, [backup]);
    img.succeed();
    env.load(img, [primary, backup]);
    assert.deepEqual(img.requests, [backup]);
    assert.equal(img.classList.contains('loaded'), true);
});

test('stale handlers from a timed-out source cannot finish or advance its replacement', () => {
    const img = cover([primary, backup, google]);
    const env = browser();
    env.load(img, [primary, backup, google]);
    const oldLoad = img.onload;
    const oldError = img.onerror;
    env.advance(5000);
    oldLoad?.call(img);
    oldError?.call(img);
    assert.equal(img.src, backup);
    assert.equal(img.classList.contains('loaded'), false);
    img.succeed();
    assert.equal(img.classList.contains('loaded'), true);
    env.advance(10000);
    assert.equal(img.src, backup);
});

test('permanent failures leave the text fallback visible', () => {
    const img = cover([primary]);
    const env = browser();
    env.load(img, [primary]);
    img.fail();
    assert.equal(img.classList.contains('is-unavailable'), true);
    assert.equal(img.classList.contains('loaded'), false);
    assert.equal(img.classList.contains('is-loading'), false);
    assert.equal(env.timers.size, 0);
});

test('initialization preserves a cover that was already activated directly', () => {
    const img = cover();
    const env = browser([img]);
    env.load(img, [primary, backup]);
    img.succeed();
    env.init(env.document);
    assert.equal(img.classList.contains('loaded'), true);
    assert.equal(img.classList.contains('is-loading'), false);
    assert.equal(env.observers.length, 0);
});
