import { test, expect } from '@playwright/test';

// Keep CI independent of image providers, fonts and analytics.
test.beforeEach(async ({ context }) => {
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
});

test('book years remain readable and keyboard-operable with JavaScript disabled', async ({ browser }) => {
    const context = await browser.newContext({javaScriptEnabled:false});
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/books.html');
    await expect(page.locator('[data-year="2026"] .book-title', {hasText:'SPQR'})).toBeVisible();
    const oldYear = page.locator('[data-year="2025"]');
    await expect(oldYear.locator('.books-grid')).toBeHidden();
    await oldYear.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(oldYear.locator('.book-title').first()).toBeVisible();
    await page.keyboard.press('Space');
    await expect(oldYear.locator('.books-grid')).toBeHidden();
    await context.close();
});

test('collapsed books and essays are absent from accessibility navigation', async ({page}) => {
    await page.goto('/books.html');
    expect(await page.locator('main').ariaSnapshot()).not.toContain('Andrew Ross Sorkin');
    await page.goto('/writings.html');
    const essay = page.locator('#best-investment-advice');
    await expect(essay.locator('.essay-body')).toBeVisible();
    await essay.locator('summary').click();
    await expect(essay.locator('.essay-body')).toBeHidden();
    expect(await page.locator('main').ariaSnapshot()).not.toContain('The smartest investment advice is simple');
});

test('rapid toggles leave no invisible expanded area', async ({page}) => {
    await page.goto('/books.html');
    const year = page.locator('[data-year="2025"]');
    const summary = year.locator('summary');
    for (let i=0;i<4;i++) await summary.click();
    await expect(year).not.toHaveAttribute('open', '');
    await expect(year.locator('.books-grid')).toBeHidden();
    const gap = await year.evaluate(el => el.getBoundingClientRect().height - el.querySelector('summary').getBoundingClientRect().height);
    expect(gap).toBeLessThan(2);
});

test('book labels stay readable without horizontal overflow on a phone', async ({page}) => {
    await page.setViewportSize({width:375,height:812});
    await page.goto('/books.html');
    const metrics = await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,author:parseFloat(getComputedStyle(document.querySelector('.book-author')).fontSize),title:parseFloat(getComputedStyle(document.querySelector('.book-title')).fontSize)}));
    expect(metrics.scroll).toBeLessThanOrEqual(metrics.width);
    expect(metrics.author).toBeGreaterThanOrEqual(13);
    expect(metrics.title).toBeGreaterThanOrEqual(16);
});

test('essays remain visible without JavaScript', async ({browser}) => {
    const context=await browser.newContext({javaScriptEnabled:false});
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const page=await context.newPage();
    await page.goto('http://127.0.0.1:4173/writings.html');
    await expect(page.locator('#on-homeschooling .essay-body')).toBeVisible();
    await context.close();
});
