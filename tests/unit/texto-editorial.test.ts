// Guarda editorial: reprova travessões, aspas curvas, setas e plural com
// parênteses em código, documentação e configuração.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

// Pastas e arquivos fora do escopo da varredura.
const FORA_DO_ESCOPO = new Set([
  "node_modules",
  ".next",
  ".git",
  "generated",
  "dist",
  "coverage",
  "uploads",
  "playwright-report",
  "test-results",
  ".playwright",
]);

const ARQUIVOS_IGNORADOS = new Set([
  "package-lock.json",
  "devcontainer-lock.json",
  "tsconfig.tsbuildinfo",
]);

// Arquivos sem extensão que entram na varredura em qualquer pasta.
const ARQUIVOS_RAIZ = new Set(["Dockerfile"]);

const EXTENSOES = new Set([
  ".ts",
  ".tsx",
  ".vue",
  ".mjs",
  ".js",
  ".css",
  ".md",
  ".json",
  ".yml",
  ".yaml",
  ".sql",
  ".prisma",
  ".sh",
  ".html",
  ".example",
]);

interface Regra {
  nome: string;
  regex: RegExp;
}

const REGRAS: Regra[] = [
  {
    nome: "travessão, meia-risca, reticências, aspas curvas, setas ou aspas angulares",
    regex: /[\u2026\u2014\u2013\u201C\u201D\u2018\u2019\u2192\u00AB\u00BB]/,
  },
  {
    nome: "entidades de aspas tipográficas",
    regex: /&ldquo;|&rdquo;|&lsquo;|&rsquo;|&mdash;|&ndash;/,
  },
  { nome: "segunda pessoa explícita", regex: /\bvocês?\b/i },
  {
    nome: "pluralização com parênteses",
    regex:
      /\b(?:aluno|professor|professora|responsável|usuário|falta|ausência|ocorrência|registro|sessão|turma|aula|disciplina|vínculo|anexo|notificação|justificativa|comportamento|referência|tentativa|ausente|pendente|justificad[ao]|registrad[ao]|revogad[ao]|encerrad[ao])\((?:a|as|s|ões|is|eis)\)/i,
  },
];

async function listarArquivos(diretorio: string): Promise<string[]> {
  const entradas = await readdir(diretorio, { withFileTypes: true });
  const saida: string[] = [];
  for (const entrada of entradas) {
    if (FORA_DO_ESCOPO.has(entrada.name) || ARQUIVOS_IGNORADOS.has(entrada.name)) continue;
    const completo = path.join(diretorio, entrada.name);
    if (entrada.isDirectory()) {
      saida.push(...(await listarArquivos(completo)));
    } else if (EXTENSOES.has(path.extname(entrada.name)) || ARQUIVOS_RAIZ.has(entrada.name)) {
      saida.push(completo);
    }
  }
  return saida;
}

describe("convenção editorial do repositório", () => {
  it("não contém travessões nem padrões proibidos", async () => {
    const arquivos = (await listarArquivos(RAIZ)).filter(
      (arquivo) => !arquivo.includes("texto-editorial.test.ts"),
    );
    expect(arquivos.length).toBeGreaterThan(50);
    const problemas: string[] = [];
    for (const arquivo of arquivos) {
      const linhas = (await readFile(arquivo, "utf8")).split("\n");
      for (const regra of REGRAS) {
        linhas.forEach((linha, indice) => {
          if (regra.regex.test(linha)) {
            problemas.push(
              `${path.relative(RAIZ, arquivo)}:${indice + 1} [${regra.nome}] ${linha.trim().slice(0, 120)}`,
            );
          }
        });
      }
    }
    expect(problemas, `Padrões proibidos encontrados:\n${problemas.join("\n")}`).toEqual([]);
  });
});
