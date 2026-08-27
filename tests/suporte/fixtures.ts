// Fixtures compartilhadas — login por papel e página autenticada.

import { test as base, expect } from '@playwright/test';
import { login } from './sessao.js';
import { SENHA_ADMIN, SENHA_PROF, SENHA_RESP } from './dados.js';

type Fixtures = {
  gestaoPage: import('@playwright/test').Page;
  profPage: import('@playwright/test').Page;
  respPage: import('@playwright/test').Page;
};

export const test = base.extend<Fixtures>({
  gestaoPage: async ({ page }, use) => {
    await login(page, 'gestao@escola.edu.br', SENHA_ADMIN);
    await expect(page).toHaveURL(/\/gestao/);
    await use(page);
  },
  profPage: async ({ page }, use) => {
    await login(page, 'prof1@escola.edu.br', SENHA_PROF);
    await expect(page).toHaveURL(/\/professor/);
    await use(page);
  },
  respPage: async ({ page }, use) => {
    await login(page, 'resp1@email.com', SENHA_RESP);
    await expect(page).toHaveURL(/\/responsavel/);
    await use(page);
  },
});

export { expect };
