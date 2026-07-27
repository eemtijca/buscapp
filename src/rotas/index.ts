import { createRouter, createWebHistory } from 'vue-router';
import { supabaseClient, decodificarToken } from '@/servicos/supabase';
import LayoutPrincipal from '@/layouts/LayoutPrincipal.vue';
import LoginView from '@/paginas/auth/LoginView.vue';
import SolicitarRecuperacaoView from '@/paginas/auth/SolicitarRecuperacaoView.vue';
import RecuperarSenhaView from '@/paginas/auth/RecuperarSenhaView.vue';
import SolicitarCodigoView from '@/paginas/auth/SolicitarCodigoView.vue';
import RedefinirSenhaCodigoView from '@/paginas/auth/RedefinirSenhaCodigoView.vue';
import ProfessorHomeView from '@/paginas/professor/HomeView.vue';
import ProfessorFrequenciaView from '@/paginas/professor/FrequenciaView.vue';
import ProfessorAusenciaView from '@/paginas/professor/AusenciaView.vue';
import ProfessorOcorrenciaView from '@/paginas/professor/OcorrenciaView.vue';
import GestaoHomeView from '@/paginas/gestao/GestaoHomeView.vue';
import GestaoRankingView from '@/paginas/gestao/GestaoRankingView.vue';
import GestaoOcorrenciasView from '@/paginas/gestao/GestaoOcorrenciasView.vue';
import GestaoJustificativasView from '@/paginas/gestao/GestaoJustificativasView.vue';
import GestaoUsuariosView from '@/paginas/gestao/UsuariosView.vue';
import GestaoUsuarioFormView from '@/paginas/gestao/UsuarioFormView.vue';
import GestaoAlunosView from '@/paginas/gestao/AlunosView.vue';
import GestaoAlunoFormView from '@/paginas/gestao/AlunoFormView.vue';
import GestaoCodigosView from '@/paginas/gestao/CodigosView.vue';
import GestaoTurmasView from '@/paginas/gestao/TurmasView.vue';
import GestaoDisciplinasView from '@/paginas/gestao/DisciplinasView.vue';
import GestaoAtribuicoesView from '@/paginas/gestao/AtribuicoesView.vue';
import GestaoChatView from '@/paginas/gestao/GestaoChatView.vue';
import ResponsavelHomeView from '@/paginas/responsavel/HomeView.vue';
import ResponsavelAlertasView from '@/paginas/responsavel/AlertasView.vue';
import ResponsavelTermometroView from '@/paginas/responsavel/TermometroView.vue';
import ResponsavelJustificativaView from '@/paginas/responsavel/JustificativaView.vue';
import ResponsavelChatView from '@/paginas/responsavel/ChatView.vue';
import Status403View from '@/paginas/error/Status403View.vue';
import Status404View from '@/paginas/error/Status404View.vue';
import Status500View from '@/paginas/error/Status500View.vue';

declare module 'vue-router' {
  interface RouteMeta {
    requerAutenticacao?: boolean;
    papeisPermitidos?: string[];
  }
}

const homePorPapel: Record<string, string> = {
  professor: '/professor',
  gestao: '/gestao',
  responsavel: '/responsavel',
};

function redirecionarSeDesabilitado() {
  if (import.meta.env.VITE_RECUPERACAO_SENHA_HABILITADA === 'false') {
    return { name: 'login' };
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'login',
      meta: { requerAutenticacao: false },
      component: LoginView,
    },
    {
      path: '/solicitar-recuperacao',
      name: 'solicitar-recuperacao',
      meta: { requerAutenticacao: false },
      beforeEnter: redirecionarSeDesabilitado,
      component: SolicitarRecuperacaoView,
    },
    {
      path: '/recuperar-senha',
      name: 'recuperar-senha',
      meta: { requerAutenticacao: false },
      beforeEnter: redirecionarSeDesabilitado,
      component: RecuperarSenhaView,
    },
    {
      path: '/solicitar-codigo',
      name: 'solicitar-codigo',
      meta: { requerAutenticacao: false },
      component: SolicitarCodigoView,
    },
    {
      path: '/redefinir-senha-codigo',
      name: 'redefinir-senha-codigo',
      meta: { requerAutenticacao: false },
      component: RedefinirSenhaCodigoView,
    },
    {
      path: '/professor',
      component: LayoutPrincipal,
      children: [
        {
          path: '',
          name: 'professor',
          meta: { requerAutenticacao: true, papeisPermitidos: ['professor'] },
          component: ProfessorHomeView,
        },
        {
          path: 'frequencia',
          name: 'professor-frequencia',
          meta: { requerAutenticacao: true, papeisPermitidos: ['professor'] },
          component: ProfessorFrequenciaView,
        },
        {
          path: 'ausencia',
          name: 'professor-ausencia',
          meta: { requerAutenticacao: true, papeisPermitidos: ['professor'] },
          component: ProfessorAusenciaView,
        },
        {
          path: 'ocorrencia',
          name: 'professor-ocorrencia',
          meta: { requerAutenticacao: true, papeisPermitidos: ['professor'] },
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
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'] },
          component: GestaoHomeView,
        },
        {
          path: 'ranking',
          name: 'gestao-ranking',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'] },
          component: GestaoRankingView,
        },
        {
          path: 'ocorrencias',
          name: 'gestao-ocorrencias',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'] },
          component: GestaoOcorrenciasView,
        },
        {
          path: 'justificativas',
          name: 'gestao-justificativas',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'] },
          component: GestaoJustificativasView,
        },
        {
          path: 'usuarios',
          name: 'gestao-usuarios',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'] },
          component: GestaoUsuariosView,
        },
        {
          path: 'usuarios/novo',
          name: 'gestao-usuarios-novo',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'] },
          component: GestaoUsuarioFormView,
        },
        {
          path: 'usuarios/:id',
          name: 'gestao-usuarios-editar',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'] },
          component: GestaoUsuarioFormView,
        },
        {
          path: 'alunos',
          name: 'gestao-alunos',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'] },
          component: GestaoAlunosView,
        },
        {
          path: 'alunos/novo',
          name: 'gestao-alunos-novo',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'] },
          component: GestaoAlunoFormView,
        },
        {
          path: 'alunos/:id',
          name: 'gestao-alunos-editar',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'] },
          component: GestaoAlunoFormView,
        },
        {
          path: 'codigos',
          name: 'gestao-codigos',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'] },
          component: GestaoCodigosView,
        },
        {
          path: 'turmas',
          name: 'gestao-turmas',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'] },
          component: GestaoTurmasView,
        },
        {
          path: 'disciplinas',
          name: 'gestao-disciplinas',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'] },
          component: GestaoDisciplinasView,
        },
        {
          path: 'atribuicoes',
          name: 'gestao-atribuicoes',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'] },
          component: GestaoAtribuicoesView,
        },
        {
          path: 'chat',
          name: 'gestao-chat',
          meta: { requerAutenticacao: true, papeisPermitidos: ['gestao'] },
          component: GestaoChatView,
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
          meta: { requerAutenticacao: true, papeisPermitidos: ['responsavel'] },
          component: ResponsavelHomeView,
        },
        {
          path: 'alertas',
          name: 'responsavel-alertas',
          meta: { requerAutenticacao: true, papeisPermitidos: ['responsavel'] },
          component: ResponsavelAlertasView,
        },
        {
          path: 'termometro',
          name: 'responsavel-termometro',
          meta: { requerAutenticacao: true, papeisPermitidos: ['responsavel'] },
          component: ResponsavelTermometroView,
        },
        {
          path: 'justificativa',
          name: 'responsavel-justificativa',
          meta: { requerAutenticacao: true, papeisPermitidos: ['responsavel'] },
          component: ResponsavelJustificativaView,
        },
        {
          path: 'chat',
          name: 'responsavel-chat',
          meta: { requerAutenticacao: true, papeisPermitidos: ['responsavel'] },
          component: ResponsavelChatView,
        },
      ],
    },
    {
      path: '/403',
      name: '403',
      component: Status403View,
    },
    {
      path: '/500',
      name: '500',
      component: Status500View,
    },
    {
      path: '/:pathMatch(.*)*',
      name: '404',
      component: Status404View,
    },
  ],
});

router.beforeEach(async (to, _from) => {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  let perfilPapel: string | null = null;

  if (session) {
    // Lê o papel DIRETAMENTE do JWT via jwt-decode
    // sem consultar o banco de dados (Custom Access Token Hook)
    const claims = decodificarToken(session.access_token);
    perfilPapel = (claims?.papel as string) ?? null;
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

    const papeisPermitidos = to.meta.papeisPermitidos;

    if (papeisPermitidos) {
      if (!perfilPapel) {
        return { name: 'login' };
      }
      if (!papeisPermitidos.includes(perfilPapel)) {
        return { name: '403', query: { destino: homePorPapel[perfilPapel] ?? '/' } };
      }
    }
  }
});

export default router;
