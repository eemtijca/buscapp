# Portabilidade

O release é o artefato: a tag `vX.Y.Z` e a imagem publicada no GHCR são a fonte da verdade, e a plataforma de deploy é um adaptador.

## Alvo de deploy

- O workflow `implantacao.yml` lê a variável `DEPLOY_TARGET` do repositório; vazia ou `vercel` publica na Vercel.
- As migrações e o papel de runtime rodam no release, antes do deploy, no environment `release`, com backup confirmado.
- Para trocar de plataforma, adicione o job do novo alvo e ajuste a variável, sem mexer em tags, changelog ou migrações.

## Artefato

- `publicacao.yml` publica `ghcr.io/<repo>:<versão>` e `:<major>.<minor>` em releases estáveis; `latest` só em versão estável.
- Os rótulos OCI registram versão, revisão e origem da imagem.

## Perfil container

- O perfil container usa `WEB_DIST` com a SPA embutida e serve SPA e API na mesma origem.
- O perfil Vercel usa o preset Fastify com `WEB_DIST=/tmp/sem-spa`; o `vercel.json` mantém apenas Services e rewrites.
- Redis, S3 e o banco são externos e já são portáveis entre provedores.

## Banco de preview

- O preview usa banco, Redis e bucket isolados, com as variáveis de Preview na Vercel.
- Nunca aponte o preview para os recursos de produção: as migrações de release rodam apenas no ambiente de produção.

## Saída da Vercel

1. Provisionar a infraestrutura com os módulos Terraform existentes apontando `imagem_aplicacao` para a imagem do release.
2. Configurar as variáveis, o Redis e o bucket no novo host e cortar o DNS.
3. Manter as agendas no GitHub Actions e desligar as equivalentes do provedor.
4. Conferir `/api/saude`, login e um fluxo com SSE e anexo, mantendo os dois hosts por um período de rollback.
5. Definir `DEPLOY_TARGET` para o novo alvo e desativar o projeto na Vercel.

## Ensaio local

1. Gerar a imagem pela `publicacao.yml` (dispatch manual) ou com `docker build`.
2. Executar o contêiner com banco e Redis de ensaio e conferir `/api/saude`.
3. Rodar `npm run infra:floci` para exercitar o Terraform nos emuladores.

## Implantação pausada

A implantação na Vercel foi encerrada e as agendas e migrações vinculadas a ela estão desativadas. A publicação de imagem no GHCR segue ativa, por dispatch manual.

Para reativar a implantação:

1. recrie o projeto na plataforma escolhida e refaça o vínculo local (`vercel link` ou equivalente);
2. grave novamente `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `APP_URL` e os segredos de banco;
3. reative os workflows `Implantação`, `Migrações do banco` e a agenda de limpeza;
4. ajuste `DEPLOY_TARGET` para o novo alvo e rode um release de ensaio.
