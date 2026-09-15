// Helpers de sessão UI — login/logout e restauração de senha via banco.

import { expect, type Page } from '@playwright/test';
import { executar } from './banco.js';
import { gerarHashSenha } from './senhas.js';

/** Restaura a senha de um usuário de seed direto em `perfis` (sem Auth externo). */
export async function restaurarSenha(perfilId: string, senha: string): Promise<void> {
  const hash = await gerarHashSenha(senha);
  await executar(
    'update public.perfis set senha_hash = $1, senha_alterada_em = now() where id = $2',
    [hash, perfilId],
  );
}

/** Login via UI e aguarda redirecionamento por papel. */
export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/');
  await page.waitForSelector('button[type="submit"]');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForURL(/\/gestao|\/professor|\/responsavel/, { timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1000);
}

/** Logout via dropdown. */
export async function logout(page: Page): Promise<void> {
  await page.locator('button[data-bs-toggle="dropdown"]').click();
  await page.locator('.dropdown-menu').getByText('Sair da conta').click();
  await expect(page).toHaveURL('/');
}
