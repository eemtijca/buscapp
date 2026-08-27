// Helpers de sessão UI — login/logout e infra de edge functions.

import { expect, type Page } from '@playwright/test';
import { spawn } from 'child_process';
import { SERVICE_KEY, URL_SUPABASE } from './dados.js';

let funcoesProcess: ReturnType<typeof spawn> | null = null;

/** Restaura senha de um usuário de seed via Admin API. */
export async function restaurarSenha(uid: string, senha: string): Promise<void> {
  try {
    await fetch(`${URL_SUPABASE}/auth/v1/admin/users/${uid}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ password: senha, email_confirm: true }),
    });
  } catch {
    /* ignorar */
  }
}

/** Garante que as edge functions estejam respondendo; sobe `supabase functions serve` se necessário. */
export async function garantirFuncoes(): Promise<void> {
  try {
    const res = await fetch(`${URL_SUPABASE}/functions/v1/solicitar-codigo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'health@check.com' }),
    });
    if (res.ok) return;
  } catch {
    /* not running */
  }

  funcoesProcess = spawn('npx', ['supabase', 'functions', 'serve'], {
    stdio: 'pipe',
    shell: true,
  });

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const res = await fetch(`${URL_SUPABASE}/functions/v1/solicitar-codigo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'health@check.com' }),
      });
      if (res.ok) return;
    } catch {
      /* still starting */
    }
  }
  throw new Error('Edge functions não iniciaram após 60s');
}

/** Finaliza o processo de funções se foi iniciado por este helper. */
export function encerrarFuncoes(): void {
  if (funcoesProcess) funcoesProcess.kill();
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
