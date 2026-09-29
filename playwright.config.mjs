import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    testMatch: '*.browser.spec.mjs',
    use: {baseURL:'http://127.0.0.1:4173', browserName:'chromium'},
    webServer: {command:'node scripts/serve.mjs', url:'http://127.0.0.1:4173', reuseExistingServer:!process.env.CI},
    reporter: process.env.CI ? 'github' : 'list'
});
