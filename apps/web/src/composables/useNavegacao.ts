// Estado global de navegação para o overlay de carregamento.
import { ref } from 'vue';
import type { RouteLocationNormalized } from 'vue-router';

export const isNavigating = ref(false);
export const destinoTitulo = ref('');

const mapaTitulos: Record<string, string> = {
  login: 'Login',
  'solicitar-codigo': 'Solicitar código',
  'redefinir-senha-codigo': 'Redefinir senha',
  professor: 'Professor',
  'professor-frequencia': 'Frequência',
  'professor-ausencia': 'Ausência',
  'professor-ocorrencia': 'Ocorrência',
  gestao: 'Gestão',
  'gestao-ranking': 'Ranking',
  'gestao-ocorrencias': 'Ocorrências',
  'gestao-infrequencias': 'Infrequências',
  'gestao-justificativas': 'Justificativas',
  'gestao-usuarios': 'Usuários',
  'gestao-usuarios-novo': 'Novo usuário',
  'gestao-usuarios-editar': 'Editar usuário',
  'gestao-alunos': 'Alunos',
  'gestao-alunos-novo': 'Novo aluno',
  'gestao-alunos-editar': 'Editar aluno',
  'gestao-codigos': 'Códigos',
  'gestao-turmas': 'Turmas',
  'gestao-anos-letivos': 'Anos letivos',
  'gestao-disciplinas': 'Disciplinas',
  'gestao-atribuicoes': 'Atribuições',
  'gestao-chat': 'Chat da gestão',
  'gestao-configuracao': 'Configurações',
  'gestao-configuracao-opcoes': 'Opções de configuração',
  'gestao-configuracao-tags': 'Tags de comportamento',
  'gestao-configuracao-sistema': 'Configurações do sistema',
  'gestao-configuracao-horarios': 'Horários letivos',
  responsavel: 'Responsável',
  'responsavel-alertas': 'Alertas',
  'responsavel-termometro': 'Termômetro',
  'responsavel-justificativa': 'Justificativa',
  'responsavel-chat': 'Chat',
  '403': 'Acesso negado',
  '404': 'Página não encontrada',
  '500': 'Erro interno',
  'conta-desativada': 'Conta desativada',
};

export function tituloParaRota(to: RouteLocationNormalized): string {
  const metaTitulo = (to.meta as Record<string, unknown>).titulo as string | undefined;
  if (metaTitulo) return metaTitulo;
  const nome = to.name as string | undefined;
  if (nome && mapaTitulos[nome]) return mapaTitulos[nome];
  // Fallback: último segmento do path.
  const seg = to.path.split('/').filter(Boolean).pop();
  if (seg) return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
  return 'conteúdo';
}

export function iniciarNavegacao(to: RouteLocationNormalized): void {
  destinoTitulo.value = tituloParaRota(to);
  isNavigating.value = true;
}

export function finalizarNavegacao(): void {
  // Pequeno delay para evitar flicker em navegações rápidas.
  setTimeout(() => {
    isNavigating.value = false;
  }, 250);
}
