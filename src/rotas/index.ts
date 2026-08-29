import { createRouter, createWebHistory } from 'vue-router';
import { supabaseClient, decodificarToken } from '@/servicos/supabase';
import { useAutenticacao } from '@/composables/useAutenticacao';
import { iniciarNavegacao, finalizarNavegacao } from '@/composables/useNavegacao';
import LayoutPrincipal from '@/layouts/LayoutPrincipal.vue';
import LoginView from '@/paginas/auth/LoginView.vue';

// Lazy load de todas as rotas (exceto layout e login para LCP)
const SolicitarCodigoView = () => import('@/paginas/auth/SolicitarCodigoView.vue');
const RedefinirSenhaCodigoView = () => import('@/paginas/auth/RedefinirSenhaCodigoView.vue');
const ProfessorHomeView = () => import('@/paginas/professor/HomeView.vue');
const ProfessorFrequenciaView = () => import('@/paginas/professor/FrequenciaView.vue');
const ProfessorAusenciaView = () => import('@/paginas/professor/AusenciaView.vue');
const ProfessorOcorrenciaView = () => import('@/paginas/professor/OcorrenciaView.vue');
const GestaoHomeView = () => import('@/paginas/gestao/GestaoHomeView.vue');
const GestaoRankingView = () => import('@/paginas/gestao/GestaoRankingView.vue');
const GestaoOcorrenciasView = () => import('@/paginas/gestao/GestaoOcorrenciasView.vue');
const GestaoInfrequenciasView = () => import('@/paginas/gestao/GestaoInfrequenciasView.vue');
const GestaoJustificativasView = () => import('@/paginas/gestao/GestaoJustificativasView.vue');
const GestaoUsuariosView = () => import('@/paginas/gestao/UsuariosView.vue');
const GestaoUsuarioFormView = () => import('@/paginas/gestao/UsuarioFormView.vue');
const GestaoAlunosView = () => import('@/paginas/gestao/AlunosView.vue');
const GestaoAlunoFormView = () => import('@/paginas/gestao/AlunoFormView.vue');
const GestaoCodigosView = () => import('@/paginas/gestao/CodigosView.vue');
const GestaoTurmasView = () => import('@/paginas/gestao/TurmasView.vue');
const AnosLetivosView = () => import('@/paginas/gestao/AnosLetivosView.vue');
const GestaoDisciplinasView = () => import('@/paginas/gestao/DisciplinasView.vue');
const GestaoAtribuicoesView = () => import('@/paginas/gestao/AtribuicoesView.vue');
const GestaoChatView = () => import('@/paginas/gestao/GestaoChatView.vue');
const GestaoConfiguracaoView = () => import('@/paginas/gestao/GestaoConfiguracaoView.vue');
const GestaoConfiguracaoOpcoesView = () =>
  import('@/paginas/gestao/GestaoConfiguracaoOpcoesView.vue');
const GestaoConfiguracaoTagsView = () => import('@/paginas/gestao/GestaoConfiguracaoTagsView.vue');
const GestaoConfiguracaoSistemaView = () =>
  import('@/paginas/gestao/GestaoConfiguracaoSistemaView.vue');
const GestaoConfiguracaoHorariosView = () =>
  import('@/paginas/gestao/GestaoConfiguracaoHorariosView.vue');
const ResponsavelHomeView = () => import('@/paginas/responsavel/HomeView.vue');
const ResponsavelAlertasView = () => import('@/paginas/responsavel/AlertasView.vue');
const ResponsavelTermometroView = () => import('@/paginas/responsavel/TermometroView.vue');
const ResponsavelJustificativaView = () => import('@/paginas/responsavel/JustificativaView.vue');
const ResponsavelChatView = () => import('@/paginas/responsavel/ChatView.vue');
const Status403View = () => import('@/paginas/error/Status403View.vue');
const Status404View = () => import('@/paginas/error/Status404View.vue');
const Status500View = () => import('@/paginas/error/Status500View.vue');
const StatusContaDesativadaView = () => import('@/paginas/error/StatusContaDesativadaView.vue');

declare module 'vue-router' {
  interface RouteMeta {
    requerAutenticacao?: boolean;
    papeisPermitidos?: string[];
    moduloPermitido?: string;
    titulo?: string;
  }
}

const homePorPapel: Record<string, string> = {
  professor: '/professor',
  gestao: '/gestao',
  responsavel: '/responsavel',
};

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'login',
      meta: { requerAutenticacao: false, titulo: 'Login' },
      component: LoginView,
    },
    {
      path: '/solicitar-codigo',
      name: 'solicitar-codigo',
      meta: { requerAutenticacao: false, titulo: 'Solicitar código' },
      component: SolicitarCodigoView,
    },
    {
      path: '/redefinir-senha-codigo',
      name: 'redefinir-senha-codigo',
      meta: { requerAutenticacao: false, titulo: 'Redefinir senha' },
      component: RedefinirSenhaCodigoView,
    },
    {
      path: '/professor',
      component: LayoutPrincipal,
      children: [
        {
          path: '',
          name: 'professor',
          meta: { requerAutenticacao: true, papeisPermitidos: ['professor'], titulo: 'Professor' },
          component: ProfessorHomeView,
        },
        {
          path: 'frequencia',
          name: 'professor-frequencia',
          meta: {
            requerAutenticacao: true,
            papeisPermitidos: ['professor'],
            moduloPermitido: 'frequencia',
            titulo: 'Frequência',
          },
          component: ProfessorFrequenciaView,
        },
        {
          path: 'ausencia',
          name: 'professor-ausencia',
          meta: {
            requerAutenticacao: true,
            papeisPermitidos: ['professor'],
            moduloPermitido: 'frequencia',
            titulo: 'Ausência',
          },
          component: ProfessorAusenciaView,
        },
        {
          path: 'ocorrencia',
          name: 'professor-ocorrencia',
          meta: {
            requerAutenticacao: true,
            papeisPermitidos: ['professor'],
            moduloPermitido: 'ocorrencias',
            titulo: 'Ocorrência',
          },
          component: ProfessorOcorrenciaView,
        },
      ],
    },
    {
      path: '/gestao',
      component: LayoutPrincipal,
      children: [
        {
          path: '',
          name: 'gestao',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'], titulo: 'Gestão' },
          component: GestaoHomeView,
        },
        {
          path: 'ranking',
          name: 'gestao-ranking',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'], titulo: 'Ranking' },
          component: GestaoRankingView,
        },
        {
          path: 'ocorrencias',
          name: 'gestao-ocorrencias',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'], titulo: 'Ocorrências' },
          component: GestaoOcorrenciasView,
        },
        {
          path: 'infrequencias',
          name: 'gestao-infrequencias',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'], titulo: 'Infrequências' },
          component: GestaoInfrequenciasView,
        },
        {
          path: 'justificativas',
          name: 'gestao-justificativas',
          meta: {
            requerAutenticacao: true,
            papeisPermitidos: ['gestao'],
            titulo: 'Justificativas',
          },
          component: GestaoJustificativasView,
        },
        {
          path: 'usuarios',
          name: 'gestao-usuarios',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'], titulo: 'Usuários' },
          component: GestaoUsuariosView,
        },
        {
          path: 'usuarios/novo',
          name: 'gestao-usuarios-novo',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'], titulo: 'Novo usuário' },
          component: GestaoUsuarioFormView,
        },
        {
          path: 'usuarios/:id',
          name: 'gestao-usuarios-editar',
          meta: {
            requerAutenticacao: true,
            papeisPermitidos: ['gestao'],
            titulo: 'Editar usuário',
          },
          component: GestaoUsuarioFormView,
        },
        {
          path: 'alunos',
          name: 'gestao-alunos',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'], titulo: 'Alunos' },
          component: GestaoAlunosView,
        },
        {
          path: 'alunos/novo',
          name: 'gestao-alunos-novo',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'], titulo: 'Novo aluno' },
          component: GestaoAlunoFormView,
        },
        {
          path: 'alunos/:id',
          name: 'gestao-alunos-editar',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'], titulo: 'Editar aluno' },
          component: GestaoAlunoFormView,
        },
        {
          path: 'codigos',
          name: 'gestao-codigos',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'], titulo: 'Códigos' },
          component: GestaoCodigosView,
        },
        {
          path: 'turmas',
          name: 'gestao-turmas',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'], titulo: 'Turmas' },
          component: GestaoTurmasView,
        },
        {
          path: 'anos-letivos',
          name: 'gestao-anos-letivos',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'], titulo: 'Anos letivos' },
          component: AnosLetivosView,
        },
        {
          path: 'disciplinas',
          name: 'gestao-disciplinas',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'], titulo: 'Disciplinas' },
          component: GestaoDisciplinasView,
        },
        {
          path: 'atribuicoes',
          name: 'gestao-atribuicoes',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'], titulo: 'Atribuições' },
          component: GestaoAtribuicoesView,
        },
        {
          path: 'chat',
          name: 'gestao-chat',
          meta: {
            requerAutenticacao: true,
            papeisPermitidos: ['gestao'],
            titulo: 'Chat da gestão',
          },
          component: GestaoChatView,
        },
        {
          path: 'configuracao',
          name: 'gestao-configuracao',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'], titulo: 'Configurações' },
          component: GestaoConfiguracaoView,
        },
        {
          path: 'configuracao/:tipo',
          name: 'gestao-configuracao-opcoes',
          meta: {
            requerAutenticacao: true,
            papeisPermitidos: ['gestao'],
            titulo: 'Opções de configuração',
          },
          component: GestaoConfiguracaoOpcoesView,
        },
        {
          path: 'configuracao/tags',
          name: 'gestao-configuracao-tags',
          meta: {
            requerAutenticacao: true,
            papeisPermitidos: ['gestao'],
            titulo: 'Tags de comportamento',
          },
          component: GestaoConfiguracaoTagsView,
        },
        {
          path: 'configuracao/sistema',
          name: 'gestao-configuracao-sistema',
          meta: {
            requerAutenticacao: true,
            papeisPermitidos: ['gestao'],
            titulo: 'Configurações do sistema',
          },
          component: GestaoConfiguracaoSistemaView,
        },
        {
          path: 'configuracao/horarios',
          name: 'gestao-configuracao-horarios',
          meta: {
            requerAutenticacao: true,
            papeisPermitidos: ['gestao'],
            titulo: 'Horários letivos',
          },
          component: GestaoConfiguracaoHorariosView,
        },
      ],
    },
    {
      path: '/responsavel',
      component: LayoutPrincipal,
      children: [
        {
          path: '',
          name: 'responsavel',
          meta: {
            requerAutenticacao: true,
            papeisPermitidos: ['responsavel'],
            titulo: 'Responsável',
          },
          component: ResponsavelHomeView,
        },
        {
          path: 'alertas',
          name: 'responsavel-alertas',
          meta: {
            requerAutenticacao: true,
            papeisPermitidos: ['responsavel'],
            moduloPermitido: 'alertas',
            titulo: 'Alertas',
          },
          component: ResponsavelAlertasView,
        },
        {
          path: 'termometro',
          name: 'responsavel-termometro',
          meta: {
            requerAutenticacao: true,
            papeisPermitidos: ['responsavel'],
            moduloPermitido: 'termometro',
            titulo: 'Termômetro',
          },
          component: ResponsavelTermometroView,
        },
        {
          path: 'justificativa',
          name: 'responsavel-justificativa',
          meta: {
            requerAutenticacao: true,
            papeisPermitidos: ['responsavel'],
            moduloPermitido: 'justificativa',
            titulo: 'Justificativa',
          },
          component: ResponsavelJustificativaView,
        },
        {
          path: 'chat',
          name: 'responsavel-chat',
          meta: {
            requerAutenticacao: true,
            papeisPermitidos: ['responsavel'],
            moduloPermitido: 'chat',
            titulo: 'Chat',
          },
          component: ResponsavelChatView,
        },
      ],
    },
    {
      path: '/403',
      name: '403',
      meta: { titulo: 'Acesso negado' },
      component: Status403View,
    },
    {
      path: '/conta-desativada',
      name: 'conta-desativada',
      meta: { titulo: 'Conta desativada' },
      component: StatusContaDesativadaView,
    },
    {
      path: '/500',
      name: '500',
      meta: { titulo: 'Erro interno' },
      component: Status500View,
    },
    {
      path: '/:pathMatch(.*)*',
      name: '404',
      meta: { titulo: 'Página não encontrada' },
      component: Status404View,
    },
  ],
});

router.beforeEach(async (to, _from) => {
  iniciarNavegacao(to);
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  let perfilPapel: string | null = null;
  let perfilStatus: string | null = null;
  let perfilModulos: string[] = [];

  if (session) {
    // Lê o papel das claims do JWT emitidas pelo Custom Access Token Hook.
    const claims = decodificarToken(session.access_token);
    perfilPapel = (claims?.papel as string) ?? null;

    // Consulta status e módulos do perfil para as validações da rota.
    const { data } = await supabaseClient
      .from('perfis')
      .select('status, acesso_modulos')
      .eq('id', session.user.id)
      .single();
    perfilStatus = (data as { status?: string } | null)?.status ?? null;
    perfilModulos = (data as { acesso_modulos?: string[] } | null)?.acesso_modulos ?? [];
  }

  // Conta desativada permanece apenas na tela própria.
  if (session && perfilStatus === 'inativo' && to.name !== 'conta-desativada') {
    return { name: 'conta-desativada' };
  }

  if (session && to.path === '/') {
    const destino = perfilPapel ? homePorPapel[perfilPapel] : '/';
    if (destino !== to.path) {
      return destino;
    }
    return;
  }

  if (to.meta?.requerAutenticacao) {
    if (!session) {
      return { name: 'login' };
    }

    const { garantirUsuario } = useAutenticacao();
    // Views montam com usuario já pronto; evita telas que não carregam nem inscrevem realtime.
    await garantirUsuario();

    const papeisPermitidos = to.meta.papeisPermitidos;

    if (papeisPermitidos) {
      if (!perfilPapel) {
        return { name: 'login' };
      }
      if (!papeisPermitidos.includes(perfilPapel)) {
        return { name: '403', query: { destino: homePorPapel[perfilPapel] ?? '/' } };
      }
    }

    // Módulos de acesso com fail-closed: lista vazia nega rotas com moduloPermitido.
    const moduloPermitido = to.meta?.moduloPermitido;
    if (moduloPermitido && perfilPapel) {
      if (!perfilModulos.includes(moduloPermitido)) {
        return {
          path: homePorPapel[perfilPapel] ?? '/',
          query: { moduloNegado: moduloPermitido },
        };
      }
    }
  }
});

router.afterEach(() => {
  finalizarNavegacao();
});

router.onError(() => {
  finalizarNavegacao();
});

export default router;
