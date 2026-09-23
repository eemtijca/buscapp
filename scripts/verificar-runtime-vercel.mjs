import { execFile } from 'node:child_process';
import { setTimeout as aguardar } from 'node:timers/promises';
import { promisify } from 'node:util';

const executar = promisify(execFile);
const container = `buscapp-vercel-smoke-${process.pid}`;
const base = 'http://127.0.0.1:3002';
const origemConfiavel = 'https://buscapp-fix.preview.example.com';

async function docker(args) {
  const { stdout, stderr } = await executar('docker', args, { maxBuffer: 10 * 1024 * 1024 });
  return `${stdout}${stderr}`;
}

async function aguardarApi() {
  for (let tentativa = 1; tentativa <= 60; tentativa += 1) {
    try {
      const resposta = await fetch(`${base}/api/saude`);
      if (resposta.ok) return;
    } catch {
      // O contêiner pode ainda estar iniciando durante as primeiras tentativas.
    }
    await aguardar(1_000);
  }
  throw new Error('A API no perfil Vercel não ficou disponível.');
}

async function exigirStatus(url, status, opcoes = {}) {
  const resposta = await fetch(url, opcoes);
  if (resposta.status !== status) {
    throw new Error(
      `${opcoes.method ?? 'GET'} ${url} retornou ${resposta.status}; esperado ${status}.`,
    );
  }
  return resposta;
}

try {
  await docker([
    'compose',
    'run',
    '-d',
    '--no-deps',
    '--name',
    container,
    '-p',
    '3002:3000',
    '-e',
    'WEB_DIST=/tmp/sem-spa',
    '-e',
    'APP_ORIGIN_SUFFIXES=preview.example.com',
    '--entrypoint',
    'node',
    'app',
    '--no-experimental-require-module',
    'dist/src/server.js',
  ]);

  await aguardarApi();
  await exigirStatus(`${base}/api/saude`, 200);

  const preflight = await exigirStatus(`${base}/api/auth/login`, 204, {
    method: 'OPTIONS',
    headers: {
      origin: origemConfiavel,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    },
  });
  if (
    preflight.headers.get('access-control-allow-origin') !== origemConfiavel ||
    preflight.headers.get('access-control-allow-credentials') !== 'true'
  ) {
    throw new Error('O preflight não liberou a origem confiável.');
  }

  await exigirStatus(`${base}/api/auth/login`, 401, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: origemConfiavel },
    body: JSON.stringify({ email: 'ninguem@escola.edu.br', senha: 'Errada1!' }),
  });
  await exigirStatus(`${base}/api/auth/login`, 403, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://outro.vercel.app' },
    body: JSON.stringify({ email: 'ninguem@escola.edu.br', senha: 'Errada1!' }),
  });

  const logs = await docker(['logs', container]);
  if (logs.includes('ERR_REQUIRE_ESM')) {
    throw new Error('A API carregou um módulo ESM pelo require CommonJS.');
  }

  console.log('Runtime Vercel sem SPA: OK');
} finally {
  await docker(['rm', '-f', container]).catch(() => undefined);
}
