import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: { APP_ORIGIN_SUFFIXES: 'preview.example.com' },
    include: ['src/**/*.test.ts'],
    // As suítes usam o mesmo banco de desenvolvimento; execução serial evita corrida de dados.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
