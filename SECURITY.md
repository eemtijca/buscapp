# Segurança

Reporte vulnerabilidades pelo GitHub, em issue privada ou security advisory. Nunca abra issue pública com dados sensíveis e nunca inclua dados reais de alunos, responsáveis ou professores.

## Como reportar

Inclua, quando possível:

- Descrição do problema e impacto potencial.
- Passos para reproduzir, com o menor exemplo possível.
- Versão ou commit afetado.
- Sugestão de correção, se houver.

O retorno é feito pelo próprio canal do GitHub. Vulnerabilidades confirmadas são corrigidas antes da divulgação pública.

## Compromissos

- Respostas de autenticação genéricas, sem enumeração de contas, com tempo equalizado.
- Senhas com scrypt e verificação única de hashes bcrypt legados, que são regravados no login.
- Sessões opacas e revogáveis; logout, inativação e redefinição de senha invalidam o acesso.
- Códigos de redefinição de 6 dígitos guardados apenas como HMAC, com expiração, uso único e bloqueio por tentativas.
- Isolamento por papel, módulo e escopo na API, com RLS como segunda barreira no banco.
- Anexos com autorização por criador ou aluno visível, download autenticado e limite de tamanho.
- Dependências e Actions atualizadas via Dependabot nos ecossistemas npm, GitHub Actions, Docker e devcontainers.

## Fora de escopo

- Engenharia social e ataques físicos.
- Negação de serviço volumétrica contra a infraestrutura de hospedagem.
- Vulnerabilidades em dependências já corrigidas em versões posteriores.

## Detalhes e lacunas conhecidas

O detalhamento dos controles, incluindo a ausência de token CSRF explícito, está em [docs/seguranca.md](docs/seguranca.md).
