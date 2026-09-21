# Segurança

Controles implementados, decisões e lacunas conhecidas. A política de reporte está em [../SECURITY.md](../SECURITY.md).

## Modelo de ameaça

O sistema é multiusuário e expõe três superfícies: autenticação, rotas autenticadas por papel e escopo, e anexos. Os ativos a proteger são os dados escolares dos alunos, as credenciais e sessões, os códigos de redefinição e os arquivos enviados.

As ameaças consideradas incluem enumeração de contas, força bruta de senhas e códigos, escalonamento de papel ou módulo, acesso cruzado a dados de outra escola ou turma, exposição de anexos e vazamento de segredos.

## Sessão e senhas

- Hash de senha com scrypt (`N=32768`, `r=8`, `p=1`, sal de 16 bytes e chave de 64 bytes) em `apps/api/src/nucleo/autenticacao/senhas.ts`, com verificação em tempo constante.
- Hashes bcrypt legados são verificados uma única vez com bcryptjs e regravados em scrypt no login.
- Login equaliza o tempo de resposta com um hash falso quando o email não existe e devolve mensagem genérica. Perfil inativo responde `403`.
- A senha forte exige mínimo de 8 caracteres com maiúscula, minúscula, dígito e símbolo, aplicada na redefinição. Senhas temporárias usam o gerador criptográfico e embaralhamento.
- A sessão é opaca: 32 bytes aleatórios no cookie, com o SHA-256 no banco. A validade é de 12 horas, ou 30 dias com `lembrar`.
- O cookie é `HttpOnly`, `SameSite` configurável (padrão `Lax`) e `Secure` por padrão em produção.
- Logout, inativação do perfil e redefinição de senha revogam as sessões. Não há rotação de token durante a sessão.

## Códigos de redefinição

- Código de 6 dígitos gerado com `randomInt` e guardado apenas como HMAC-SHA256 de `email:código` com `AUTH_PEPPER`, mínimo de 32 caracteres em produção.
- Um código ativo por email: gerar um novo revoga os anteriores. O consumo é atômico e comparações usam `timingSafeEqual`.
- Código inválido, expirado ou já usado devolve a mesma resposta. Após 5 tentativas (configurável), o email fica bloqueado por 15 minutos.
- `POST /api/auth/solicitar-codigo` responde sempre igual e não revela a existência da conta.

## Autorização

- Papel e módulo são verificados na API (`exigirPapel` e `exigirModulo`), com módulo fail-closed.
- O escopo é resolvido em `nucleo/autorizacao/escopo.ts`: gestão vê todos os alunos, professor vê as turmas em que tem atribuição ativa e responsável vê apenas os alunos vinculados.
- Leituras fora do escopo respondem `404`, evitando revelar existência.
- O chat impõe o horário protegido no servidor para o responsável.
- As políticas RLS no banco replicam as regras com o papel restrito `buscapp_api` e `app.usuario_id` por transação, funcionando como backstop. Ver [ADR-003](adr/003-rls-backstop.md).

## Requisições

- CORS com credenciais restrito a `APP_URL` e `APP_ORIGINS`.
- Não há token CSRF explícito nem verificação de `Origin` ou `Referer`. A proteção atual é o cookie `SameSite=Lax` combinado com CORS restrito. `COOKIE_SAMESITE=none` remove essa proteção principal e exige `Secure`.
- Não há limitação de tentativas por IP nas rotas de autenticação. A única mitigação de força bruta é o bloqueio por email no fluxo de código.
- Não há cabeçalhos de segurança adicionais (CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options` e `Referrer-Policy`). As respostas recebem apenas os cabeçalhos funcionais.
- `TRUST_PROXY` controla o uso de `X-Forwarded-For` para o IP real do cliente, necessário atrás de proxy.

## Dados e arquivos

- Uploads aceitam JPEG, PNG, WEBP e PDF, com limite de 10 MB no multipart e de `UPLOAD_DIRETO_MAX_BYTES` (padrão 20 MB) no envio direto.
- O tipo declarado é validado contra a lista permitida, sem inspeção de bytes mágicos. Não há antivírus nem remoção de metadados no servidor.
- No envio direto, a chave é prefixada pelo id do usuário e a confirmação exige essa correspondência, além de conferir tamanho e tipo no provedor.
- O download de anexo é autenticado e autorizado por criador, gestão ou aluno visível; nenhum caminho de armazenamento é exposto na URL.
- Chaves de armazenamento são normalizadas, e o driver de disco valida que o caminho permanece dentro do diretório base.

## Auditoria e logs

- A tabela `auditoria` registra geração, revogação, uso e limpeza de códigos, além da virada de ano letivo. Não há registro de login, de operações sobre alunos e usuários ou de uploads.
- O logger do Fastify não possui `redact`. O erro interno é registrado por completo e a resposta ao cliente usa mensagem genérica.
- Segredos não são impressos pelo entrypoint, e as variáveis ficam fora do repositório.

## Segredos

- `AUTH_PEPPER` deve ter no mínimo 32 caracteres aleatórios e nunca ser reutilizada entre ambientes.
- `APP_DB_PASSWORD` define a senha do papel de runtime em cada ambiente.
- Chaves S3 e strings de conexão ficam apenas no ambiente do provedor.

## Lacunas conhecidas

1. Sem CSRF explícito e sem cabeçalhos de segurança.
2. Sem limite de tentativas por IP na autenticação.
3. Upload sem inspeção de conteúdo e sem varredura.
4. Auditoria parcial, sem leitura pela interface.
5. Sessão sem rotação de token e sem limite de sessões simultâneas. A expiração por inatividade é de 2 horas, com teto de 12 horas (ou 30 dias com `lembrar`), e o usuário pode listar e revogar as outras sessões.

## Controles adicionados

- **Rate limiting:** `@fastify/rate-limit` com store no Postgres, nas rotas de login (10/min, contando só falhas), solicitação de código (3/5 min), redefinição de senha (5/15 min) e upload de anexos (20/h).
- **Cabeçalhos:** CSP, `nosniff`, `Referrer-Policy`, `X-Frame-Options` e HSTS, além da verificação de `Origin` em métodos mutáveis.
- **Uploads:** validação de bytes mágicos, `ContentLength` na URL pré-assinada e download com `attachment`, sandbox e `nosniff`.
- **Auditoria:** login, falhas de login, logout, revogação de sessões, CRUD de usuários e alunos, anexos (criação, remoção e download), expurgo e anonimização, com `ip_origem`.
- **LGPD:** exportação e anonimização de dados do titular, restritas à gestão e auditadas.
- **Retenção:** expurgo agendado de anexos, códigos, sessões encerradas e contadores de rate limiting.
- **Sessão expirada no cliente:** requisições autenticadas que recebem 401 recarregam a SPA no login com `?destino=` (aceito apenas se for caminho interno), voltando à rota de origem após autenticar. O cliente HTTP usa timeout de 15 s, repetição com backoff apenas em GET (até 3 tentativas) e não repete métodos com efeito.
- **Metadados de imagem:** no envio, imagens são regravadas no servidor com `sharp` (orientação aplicada, lado máximo de 1600 px) e sem EXIF, removendo geolocalização e dados de câmera. Em falha, o original é mantido e o caso é registrado no log.

## Resposta a incidentes

1. Gire `AUTH_PEPPER` e reinicie a API, o que invalida códigos pendentes. As sessões existentes seguem válidas até expirar ou serem revogadas.
2. Revogue sessões inativando o perfil ou redefinindo a senha da conta afetada.
3. Gire credenciais de banco e de storage e atualize as variáveis.
4. Revogue códigos ativos e limpe tentativas pendentes.
5. Registre o ocorrido e reporte pelo canal do [../SECURITY.md](../SECURITY.md).
