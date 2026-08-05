#!/bin/bash
# ============================================================================
# Suíte de Testes do Banco de Dados — BuscApp
# Executa os testes SQL via Docker (contorno para limitação do CLI)
# ============================================================================

set -o pipefail

echo "=== Suíte de Testes do Banco de Dados ==="
echo ""

CONTAINER=$(docker ps --filter "name=supabase_db" --format "{{.Names}}" 2>/dev/null | head -1)
if [ -z "$CONTAINER" ]; then
  echo "ERRO: Container do Supabase não encontrado. Execute 'npx supabase start' primeiro."
  exit 1
fi

echo "Container: $CONTAINER"
echo ""

# Executa os testes dentro de uma transação que sempre faz ROLLBACK
# Filtra apenas as linhas com NOTICE e ERROR para saída limpa
docker exec -i "$CONTAINER" psql -U postgres -f - 2>&1 < supabase/tests/0001_validacao_completa.sql | \
  grep -E "(NOTICE:|ERROR:)" | \
  sed 's/psql:<stdin>:[0-9]*: //'

echo ""
echo "=== Testes concluídos ==="
echo "(Todos os dados de teste foram descartados pelo ROLLBACK)"
