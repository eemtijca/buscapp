import { defineConfig, devices } from '@playwright/test';

import dotenv from 'dotenv';
dotenv.config();

/**
 * Configuração dedicada aos testes de PWA. Roda contra o build de produção
 * via `vite preview` (o service worker só existe no build, não no dev server).
 * A API roda em paralelo para os testes de dados offline.
 * Uso: npm run test:pwa
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /pwa.*\.spec\.ts/,
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
  webServer: [
    {
      command: 'APP_ORIGINS=http://localhost:4173 npm run dev:api',
      url: 'http://localhost:3001/api/saude',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run preview -w @buscapp/web -- --port 4173 --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
