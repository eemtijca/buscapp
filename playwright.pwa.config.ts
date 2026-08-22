import { defineConfig, devices } from '@playwright/test';

/**
 * Configuração dedicada aos testes de PWA. Roda contra o build de produção
 * via `vite preview` (o service worker só existe no build, não no dev server).
 * Uso: npm run test:pwa
 */
export default defineConfig({
  testDir: './tests',
  testMatch: /pwa\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    headless: true,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
