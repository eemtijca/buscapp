# Operação

Runbooks e resolução de problemas. Para configuração, ver [ambiente.md](ambiente.md); para publicação, ver [deploy.md](deploy.md).

## Ambiente local

### Subir e derrubar o Compose

```bash
npm run compose:up     # build e start do app e do PostgreSQL, com migrações no start
npm run compose:down   # derruba os containers
docker compose logs -f app
```

O app fica em `http://localhost:3000` e o PostgreSQL em `localhost:5433`. O volume `uploads` guarda os anexos no driver de disco.

### Resetar o banco e os uploads

```bash
docker compose down -v
npm run compose:up
npm run seed -w @buscapp/api
```

O `-v` remove os volumes `pgdata` e `uploads`. Nunca use `-v` em ambiente com dados reais.

### Migrações

```bash
npm run db:migrate        # aplica no MIGRATE_DATABASE_URL
npm run test:db           # valida o schema aplicado no Compose
```

No container, as migrações rodam no entrypoint. Em produção, o workflow `migracoes.yml` aplica e define a senha do papel. Ver [banco.md](banco.md).

### Seed

```bash
npm run seed -w @buscapp/api
```

Cria usuários e fixtures de desenvolvimento, de forma idempotente. O entrypoint do Compose executa o seed quando `SEED=true`.

## Códigos de redefinição

1. O usuário solicita na tela de login; a gestão recebe uma notificação, sem saber se o email existe.
2. A gestão gera um código de 6 dígitos em `POST /api/codigos/perfil/:perfilId`. O valor em claro é exibido uma única vez; o banco guarda apenas o HMAC.
3. O usuário define a nova senha em `POST /api/auth/redefinir-senha`. O código pode ser revogado a qualquer momento e expira por `configuracoes_sistema.minutos_validade_codigo` (padrão 60).
4. Após `max_tentativas_codigo` erros (padrão 5), o email fica bloqueado por `minutos_bloqueio_codigo` (padrão 15).
5. `POST /api/codigos/limpar` remove códigos usados, expirados e revogados; a janela de retenção configurada não é aplicada automaticamente.

## Anexos

- Driver `disco`: os arquivos ficam em `UPLOAD_DIR`. No Compose, o volume `uploads` precisa existir.
- Driver `s3`: confira endpoint, região, bucket e credenciais. No Supabase Storage, use chaves S3 habilitadas no painel e bucket com underscore no nome, para as URLs pré-assinadas usarem o formato path-style.
- O envio clássico é `multipart/form-data` em `POST /api/anexos`, com limite de 10 MB e tipos JPEG, PNG, WEBP e PDF.
- O envio direto usa `POST /api/anexos/upload` para obter a URL pré-assinada, envia o arquivo ao provedor e confirma em `POST /api/anexos/confirmar`, que valida chave, tamanho e tipo antes de registrar. O limite é `UPLOAD_DIRETO_MAX_BYTES` (padrão 20 MB).
- O download é autenticado e transmitido em streaming.
- A expiração e o expurgo de anexos são declarativos: `expurgo_em` e `dias_expurgo_anexos` existem, mas não há rotina agendada que os aplique. A remoção ocorre pela ação do usuário ou da gestão.

## Notificações

As notificações são criadas por triggers de banco (mensagem e ocorrência) e pelos serviços da aplicação (códigos, justificativas e demais fluxos). A leitura e a remoção são restritas ao destinatário. Não há envio de e-mail nem push.

## Auditoria

A tabela `auditoria` recebe os eventos de geração, revogação, uso e limpeza de códigos, além da virada de ano letivo. Não existem registros de auditoria para login, alunos, usuários, uploads e demais operações, e não há endpoint de leitura da auditoria pela interface. A consulta é feita diretamente no banco.

## Saúde e logs

- `GET /api/saude` responde `{ status: 'ok', hora }` e serve como liveness; não consulta o banco.
- Os logs usam o logger do Fastify, com nível `info` em produção e `debug` em desenvolvimento. Não há configuração de `redact`.
- O entrypoint não imprime a `DATABASE_URL`.
- O indicador de conexão do frontend consulta `/api/saude` a cada 30 segundos.

## Backup

Não existe backup automático nem endpoint de exportação. A durabilidade depende do provedor do PostgreSQL e dos volumes do Compose. Em bancos gerenciados, configure a política de backup do provedor. Antes de operações destrutivas, faça um dump manual com `pg_dump`.

## Resolução de problemas

| Sintoma                                  | Causa provável e ação                                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Aplicação não inicia                     | Variável inválida ou ausente. A mensagem do Zod indica o campo, com atenção a `AUTH_PEPPER` e `DATABASE_URL`. |
| Erro de conexão com o banco              | `DATABASE_URL` incorreta ou banco indisponível. Em serverless, use o pooler de transação.                     |
| Migração acusa checksum divergente       | Uma migração aplicada foi editada. Crie uma migração corretiva, sem alterar o histórico.                      |
| Papel `buscapp_api` sem permissão        | A senha do papel não foi aplicada. Rode `node infra/docker/role.mjs` com `APP_DB_PASSWORD`.                   |
| Usuário não recebe notificação de código | Verifique se existe gestão ativa e se a notificação foi marcada como lida.                                    |
| Código não funciona                      | Confira validade, bloqueio por tentativas e gere um novo, que revoga o anterior.                              |
| Anexo de disco não aparece               | Confira `UPLOAD_DIR` e o volume `uploads`; no S3, endpoint, bucket e credenciais.                             |
| Login falha com mensagem genérica        | Credenciais incorretas, conta inativa ou perfil pendente sem ativação.                                        |
| SSE desconecta com frequência            | Verifique proxy e o limite de duração da função no provedor serverless; o EventSource reconecta sozinho.      |
| Testes E2E falham no login               | Banco sem seed ou senhas de seed divergentes. Rode o seed e confira `SEED_SENHA_*`.                           |
| Testes da API falham por conexão         | PostgreSQL do Compose fora do ar ou variáveis de teste ausentes. Suba o Compose e rode `npm run test:db`.     |
