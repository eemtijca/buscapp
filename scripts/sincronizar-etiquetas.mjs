// Sincroniza as etiquetas do GitHub com o catálogo em .github/labels.json.
// Requer o GitHub CLI autenticado (gh auth status) e execução na raiz do repositório.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const catalogo = JSON.parse(readFileSync(path.join(RAIZ, ".github", "labels.json"), "utf8"));

function executarGh(argumentos) {
  return execFileSync("gh", argumentos, { cwd: RAIZ, encoding: "utf8" });
}

const existentes = new Set(
  JSON.parse(executarGh(["label", "list", "--limit", "200", "--json", "name"])).map(
    (etiqueta) => etiqueta.name,
  ),
);

let criadas = 0;
let atualizadas = 0;
for (const etiqueta of catalogo.etiquetas) {
  executarGh([
    "label",
    "create",
    etiqueta.nome,
    "--color",
    etiqueta.cor,
    "--description",
    etiqueta.descricao,
    "--force",
  ]);
  if (existentes.has(etiqueta.nome)) {
    atualizadas += 1;
  } else {
    criadas += 1;
  }
}

console.log(`Etiquetas sincronizadas: ${criadas} criadas e ${atualizadas} atualizadas.`);
