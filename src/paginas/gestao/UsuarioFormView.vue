<script setup lang="ts">
import { computed, onMounted, ref, watch, nextTick } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import { useGestaoUsuarios } from '@/composables/useGestaoUsuarios';
import { useOpcoesConfiguracao } from '@/composables/useOpcoesConfiguracao';
import { useFormSnapshot } from '@/composables/useFormSnapshot';
import { supabaseClient } from '@/servicos/supabase';
import {
  mensagemSucesso as criarMensagemSucesso,
  mensagemErroExplicita,
} from '@/utils/mensagemExplicita';
import CampoFormulario from '@/componentes/CampoFormulario.vue';
import Combobox from '@/componentes/Combobox.vue';
import type { OpcaoCombobox } from '@/componentes/Combobox.vue';
import GrupoCheckbox from '@/componentes/GrupoCheckbox.vue';
import type {
  PapelPerfil,
  StatusPerfil,
  AtribuicaoProfessor,
  VinculoResponsavel,
} from '@/tipos/database';
import type { OpcaoCheckbox } from '@/tipos/componentes';

const route = useRoute();
const router = useRouter();
const { buscarUsuarios, criarUsuario, atualizarUsuario, carregando, erro } = useGestaoUsuarios();
const { buscarOpcoes } = useOpcoesConfiguracao();

const modoEdicao = ref(false);
const usuarioId = ref<string | null>(null);

const nome = ref('');
const email = ref('');
const papel = ref<PapelPerfil>('professor');
const telefone = ref('');
const cargo = ref('');
const status = ref<StatusPerfil>('ativo');
const notificacoesAtivas = ref(true);
const acessoModulos = ref<string[]>([]);

const opcoesModulos = ref<OpcaoCheckbox[]>([]);

const papelOpcoes = computed<OpcaoCombobox[]>(() => [
  { valor: 'professor', rotulo: 'Professor' },
  { valor: 'responsavel', rotulo: 'Responsável' },
]);
const statusOpcoes = computed<OpcaoCombobox[]>(() => {
  const base: OpcaoCombobox[] = [
    { valor: 'ativo', rotulo: 'Ativo' },
    { valor: 'pendente', rotulo: 'Pendente' },
  ];
  if (papel.value !== 'gestao') base.push({ valor: 'inativo', rotulo: 'Inativo' });
  return base;
});

function chavesCatalogoModulo(): Set<string> {
  return new Set(opcoesModulos.value.map((o) => o.valor));
}

function filtrarModulosValidos(chaves: unknown): string[] {
  if (!Array.isArray(chaves)) return [];
  const validas = chavesCatalogoModulo();
  return chaves.filter((c): c is string => typeof c === 'string' && validas.has(c));
}

/** Padrão do formulário: todos os módulos existentes no catálogo. */
function moduloPadrao(): string[] {
  return opcoesModulos.value.map((o) => o.valor);
}

const atribuicoes = ref<(AtribuicaoProfessor & { turma_nome?: string })[]>([]);
const vinculos = ref<(VinculoResponsavel & { aluno_nome?: string })[]>([]);

const salvando = ref(false);
const mensagemSucesso = ref<string | null>(null);
const mensagemErro = ref<string | null>(null);
const mensagemToast = ref<string | null>(null);
const usuarioCriado = ref(false);
const codigoCriado = ref<string | null>(null);
const codigoCriadoCopiado = ref(false);
let timerCodigoCopiado: ReturnType<typeof setTimeout> | null = null;
let timerSucesso: ReturnType<typeof setTimeout> | null = null;
let timerErro: ReturnType<typeof setTimeout> | null = null;

let timeoutDraft: ReturnType<typeof setTimeout> | null = null;

// Snapshot para detecção de alterações.
const {
  isDirty: formDirty,
  reset: resetSnapshot,
  pausar: pausarSnapshot,
  pausado: snapshotPausado,
} = useFormSnapshot(() => ({
  nome: nome.value,
  email: email.value,
  papel: papel.value,
  telefone: telefone.value,
  cargo: cargo.value,
  notificacoesAtivas: notificacoesAtivas.value,
  acessoModulos: [...acessoModulos.value].sort(),
  status: status.value,
}));

function chaveDraft() {
  return modoEdicao.value && usuarioId.value
    ? `draft-usuario-${usuarioId.value}`
    : 'draft-usuario-novo';
}

function salvarDraft() {
  if (usuarioCriado.value) return;
  if (timeoutDraft) clearTimeout(timeoutDraft);
  timeoutDraft = setTimeout(() => {
    try {
      sessionStorage.setItem(
        chaveDraft(),
        JSON.stringify({
          nome: nome.value,
          email: email.value,
          papel: papel.value,
          telefone: telefone.value,
          cargo: cargo.value,
          notificacoesAtivas: notificacoesAtivas.value,
          acessoModulos: acessoModulos.value,
        }),
      );
    } catch {
      /* armazenamento cheio ou indisponível */
    }
  }, 500);
}

function limparDraft() {
  try {
    sessionStorage.removeItem(chaveDraft());
    sessionStorage.removeItem('draft-usuario-novo');
    if (timeoutDraft) {
      clearTimeout(timeoutDraft);
      timeoutDraft = null;
    }
  } catch {
    /* ignorar */
  }
}

onBeforeRouteLeave((_to, _from, next) => {
  if (formDirty.value && !salvando.value) {
    const confirmar = window.confirm('Há alterações não salvas. Deseja realmente sair?');
    if (!confirmar) return next(false);
  }
  next();
});

watch(
  [nome, email, telefone, cargo, notificacoesAtivas, acessoModulos, papel, status],
  () => {
    if (!usuarioCriado.value && !snapshotPausado.value) salvarDraft();
  },
  { deep: true },
);

function mostrarErro(msg: string) {
  if (timerErro) clearTimeout(timerErro);
  mensagemErro.value = msg;
  timerErro = setTimeout(() => (mensagemErro.value = null), 6000);
}

function mostrarSucesso(msg: string) {
  if (timerSucesso) clearTimeout(timerSucesso);
  mensagemSucesso.value = msg;
  timerSucesso = setTimeout(() => (mensagemSucesso.value = null), 6000);
}

async function copiarCodigoCriado() {
  if (!codigoCriado.value) return;
  try {
    await navigator.clipboard.writeText(codigoCriado.value);
  } catch {
    const el = document.createElement('textarea');
    el.value = codigoCriado.value;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
  mensagemToast.value = 'Código copiado!';
  setTimeout(() => (mensagemToast.value = null), 2000);
  codigoCriadoCopiado.value = true;
  if (timerCodigoCopiado) clearTimeout(timerCodigoCopiado);
  timerCodigoCopiado = setTimeout(() => (codigoCriadoCopiado.value = false), 1500);
}

onMounted(async () => {
  pausarSnapshot(true);
  opcoesModulos.value = await buscarOpcoes('modulo');
  const id = route.params.id as string | undefined;
  if (!id) {
    acessoModulos.value = moduloPadrao();
  }
  if (id) {
    modoEdicao.value = true;
    usuarioId.value = id;
    const usuarios = await buscarUsuarios();
    const usuario = usuarios.find((u) => u.id === id);
    if (usuario) {
      nome.value = usuario.nome;
      email.value = usuario.email ?? '';
      papel.value = usuario.papel;
      telefone.value = usuario.telefone ?? '';
      cargo.value = usuario.cargo ?? '';
      status.value = usuario.status;
    } else {
      mostrarErro(mensagemErroExplicita('Usuário', id, 'carregar', 'Usuário não encontrado.'));
      pausarSnapshot(false);
      resetSnapshot();
      return;
    }
    const { data: perfil } = await supabaseClient
      .from('perfis')
      .select('notificacoes_ativas, acesso_modulos')
      .eq('id', id)
      .single();
    if (perfil) {
      notificacoesAtivas.value = perfil.notificacoes_ativas;
      const salvas = filtrarModulosValidos(perfil.acesso_modulos);
      acessoModulos.value = salvas.length ? salvas : moduloPadrao();
    }
    if (usuario.papel === 'professor') {
      const { data: atribs } = await supabaseClient
        .from('atribuicoes_professores')
        .select('*, turmas!atribuicoes_professores_turma_id_fkey(nome_completo)')
        .eq('professor_id', id)
        .order('created_at', { ascending: false });
      if (atribs) {
        atribuicoes.value = atribs.map((a: Record<string, unknown>) => ({
          ...a,
          turma_nome: (a.turmas as Record<string, string> | null)?.nome_completo ?? '—',
        })) as (AtribuicaoProfessor & { turma_nome?: string })[];
      }
    }
    if (usuario.papel === 'responsavel') {
      const { data: vincs } = await supabaseClient
        .from('vinculos_responsaveis')
        .select('*, alunos!vinculos_responsaveis_aluno_id_fkey(nome)')
        .eq('responsavel_id', id)
        .eq('ativo', true)
        .order('created_at', { ascending: false });
      if (vincs) {
        vinculos.value = vincs.map((v: Record<string, unknown>) => ({
          ...v,
          aluno_nome: (v.alunos as Record<string, string> | null)?.nome ?? '—',
        })) as (VinculoResponsavel & { aluno_nome?: string })[];
      }
    }
  }

  try {
    const dadosSalvos = sessionStorage.getItem(chaveDraft());
    if (dadosSalvos) {
      const parsed = JSON.parse(dadosSalvos);
      if (parsed.nome) nome.value = parsed.nome;
      if (parsed.email) email.value = parsed.email;
      if (parsed.papel) papel.value = parsed.papel;
      if (parsed.telefone) telefone.value = parsed.telefone ?? '';
      if (parsed.cargo) cargo.value = parsed.cargo ?? '';
      if (typeof parsed.notificacoesAtivas === 'boolean')
        notificacoesAtivas.value = parsed.notificacoesAtivas;
      if (Array.isArray(parsed.acessoModulos))
        acessoModulos.value = filtrarModulosValidos(parsed.acessoModulos);
    }
  } catch {
    /* ignorar dados corrompidos */
  }
  await nextTick();
  resetSnapshot();
  pausarSnapshot(false);
});

async function salvar() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (!nome.value.trim()) {
    mostrarErro(
      mensagemErroExplicita(
        'Usuário',
        nome.value || 'sem nome',
        'salvar',
        'O campo nome é obrigatório.',
      ),
    );
    return;
  }
  if (!email.value.trim()) {
    mostrarErro(
      mensagemErroExplicita('Usuário', nome.value, 'salvar', 'O campo e-mail é obrigatório.'),
    );
    return;
  }
  salvando.value = true;
  try {
    // Envia acesso_modulos para qualquer papel com chaves validadas pelo catálogo.
    const dadosExtras: Record<string, unknown> = {
      notificacoes_ativas: notificacoesAtivas.value,
      acesso_modulos: filtrarModulosValidos(acessoModulos.value),
    };
    if (modoEdicao.value && usuarioId.value) {
      // Perfis de papel gestao permanecem sempre ativos no salvamento.
      const statusFinal: StatusPerfil = papel.value === 'gestao' ? 'ativo' : status.value;
      const ok = await atualizarUsuario(usuarioId.value, {
        nome: nome.value.trim(),
        telefone: telefone.value.trim() || undefined,
        cargo: cargo.value.trim() || undefined,
        status: statusFinal,
        ...dadosExtras,
      } as Parameters<typeof atualizarUsuario>[1] & typeof dadosExtras);
      if (ok) {
        limparDraft();
        resetSnapshot();
        pausarSnapshot(false);
        mostrarSucesso(criarMensagemSucesso('Usuário', nome.value, 'atualizado'));
        await nextTick();
        requestAnimationFrame(() => {
          document
            .querySelector('.alert-success')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      } else {
        mostrarErro(
          mensagemErroExplicita(
            'Usuário',
            nome.value,
            'atualizar',
            erro.value || 'Falha ao atualizar usuário.',
          ),
        );
      }
    } else {
      const { id, codigo } = await criarUsuario({
        nome: nome.value.trim(),
        email: email.value.trim(),
        papel: papel.value,
        telefone: telefone.value.trim() || undefined,
        cargo: cargo.value.trim() || undefined,
      });
      if (id) {
        await supabaseClient.from('perfis').update(dadosExtras).eq('id', id);
        limparDraft();
        resetSnapshot();
        pausarSnapshot(false);
        usuarioCriado.value = true;
        codigoCriado.value = codigo;
        if (codigo) {
          mostrarSucesso(
            criarMensagemSucesso('Usuário', nome.value, 'criado') +
              ' Código gerado automaticamente.',
          );
        } else {
          mostrarSucesso(
            criarMensagemSucesso('Usuário', nome.value, 'criado') +
              ' A senha inicial deve ser redefinida via código.',
          );
        }
      } else {
        mostrarErro(
          mensagemErroExplicita(
            'Usuário',
            nome.value,
            'criar',
            erro.value || 'Falha ao criar usuário.',
          ),
        );
      }
    }
  } finally {
    salvando.value = false;
  }
}
</script>

<template>
  <div class="container py-4" style="max-width: 960px">
    <router-link to="/gestao" class="btn btn-sm btn-outline-success me-2 mb-3">
      <i class="bi bi-house me-1" aria-hidden="true"></i>
      Início
    </router-link>
    <button type="button" class="btn btn-sm btn-outline-secondary mb-3" @click="router.back()">
      <i class="bi bi-arrow-left me-1" aria-hidden="true"></i>
      Voltar
    </button>

    <h1 class="h5 fw-bold mb-3">
      <i
        :class="'bi bi-' + (modoEdicao ? 'pencil' : 'person-plus') + ' text-primary me-2'"
        aria-hidden="true"
      ></i>
      {{ modoEdicao ? 'Editar usuário' : 'Novo usuário' }}
    </h1>

    <div
      v-if="mensagemSucesso"
      class="alert alert-success alert-dismissible fade show py-2 small mb-3 pe-5"
      role="status"
    >
      <i class="bi bi-check-circle me-1" aria-hidden="true"></i>
      {{ mensagemSucesso }}
      <button
        type="button"
        class="btn-close position-absolute top-50 end-0 translate-middle-y me-2 p-2"
        style="font-size: 0.7rem"
        aria-label="Fechar"
        @click="mensagemSucesso = null"
      ></button>
    </div>
    <div
      v-if="mensagemErro"
      class="alert alert-danger alert-dismissible fade show py-2 small mb-3 pe-5"
      role="alert"
    >
      <i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>
      {{ mensagemErro }}
      <button
        type="button"
        class="btn-close position-absolute top-50 end-0 translate-middle-y me-2 p-2"
        style="font-size: 0.7rem"
        aria-label="Fechar"
        @click="mensagemErro = null"
      ></button>
    </div>

    <div
      v-if="mensagemToast"
      class="position-fixed bottom-0 start-50 translate-middle-x mb-4"
      style="z-index: 1060"
    >
      <div class="bg-dark text-white small px-3 py-2 rounded-pill shadow">
        <i class="bi bi-check-circle me-1" aria-hidden="true"></i>
        {{ mensagemToast }}
      </div>
    </div>

    <div v-if="usuarioCriado" class="text-center py-4">
      <span
        class="d-inline-flex align-items-center justify-content-center rounded-circle bg-success-subtle text-success mb-3"
        style="width: 72px; height: 72px; font-size: 2rem"
      >
        <i class="bi bi-check-lg" aria-hidden="true"></i>
      </span>
      <p class="mb-3">{{ mensagemSucesso }}</p>

      <template v-if="codigoCriado">
        <p class="small text-body-secondary mb-2">
          Compartilhe o código com {{ nome }} para redefinir a senha.
        </p>
        <div class="position-relative d-inline-block mb-3">
          <code
            class="d-inline-block fs-1 fw-bold font-monospace text-primary bg-body-tertiary px-3 py-2 rounded user-select-all"
            role="button"
            tabindex="0"
            title="Clique para copiar"
            style="letter-spacing: 0.15em; cursor: pointer"
            @click="copiarCodigoCriado"
            @keydown.enter="copiarCodigoCriado"
          >
            {{ codigoCriado }}
          </code>
          <span
            v-if="codigoCriadoCopiado"
            class="position-absolute top-0 end-0 translate-middle badge rounded-pill text-bg-success small"
          >
            <i class="bi bi-check2 me-1" aria-hidden="true"></i>Copiado
          </span>
        </div>
        <div class="d-flex gap-2 justify-content-center mb-3">
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            @click="copiarCodigoCriado"
          >
            <i class="bi bi-clipboard me-1" aria-hidden="true"></i>
            Copiar
          </button>
        </div>
      </template>
      <template v-else>
        <p class="small text-body-secondary mb-3">
          Acesse a tela de códigos para gerar um código de acesso.
        </p>
        <router-link to="/gestao/codigos" class="btn btn-success btn-sm mb-3">
          <i class="bi bi-key me-1" aria-hidden="true"></i>
          Ir para códigos
        </router-link>
      </template>

      <div>
        <router-link to="/gestao/usuarios" class="btn btn-outline-secondary">
          <i class="bi bi-arrow-left me-1" aria-hidden="true"></i>
          Voltar para lista
        </router-link>
      </div>
    </div>

    <form v-else @submit.prevent="salvar">
      <div class="card border mb-3">
        <div class="card-header bg-body-tertiary py-2">
          <span class="fw-medium small">Dados do usuário</span>
        </div>
        <div class="card-body">
          <CampoFormulario id="campoNome" label="Nome" :obrigatorio="true">
            <input
              id="campoNome"
              v-model="nome"
              type="text"
              class="form-control form-control-sm"
              required
              autocomplete="off"
            />
          </CampoFormulario>

          <CampoFormulario id="campoEmail" label="E-mail" :obrigatorio="true">
            <input
              id="campoEmail"
              v-model="email"
              type="email"
              class="form-control form-control-sm"
              :disabled="modoEdicao"
              required
              autocomplete="off"
            />
          </CampoFormulario>

          <CampoFormulario id="campoPapel" label="Papel" :obrigatorio="true">
            <Combobox
              id="campoPapel"
              v-model="papel"
              :opcoes="papelOpcoes"
              placeholder="Selecione o papel"
              tamanho="sm"
              :desabilitado="modoEdicao"
            />
          </CampoFormulario>

          <CampoFormulario id="campoTelefone" label="Telefone">
            <input
              id="campoTelefone"
              v-model="telefone"
              type="text"
              class="form-control form-control-sm"
              autocomplete="off"
            />
          </CampoFormulario>

          <CampoFormulario v-if="papel === 'professor'" id="campoCargo" label="Cargo">
            <input
              id="campoCargo"
              v-model="cargo"
              type="text"
              class="form-control form-control-sm"
              autocomplete="off"
            />
          </CampoFormulario>

          <div class="mb-0">
            <div class="form-check">
              <input
                id="campoNotificacoes"
                v-model="notificacoesAtivas"
                type="checkbox"
                class="form-check-input"
              />
              <label class="form-check-label small fw-medium" for="campoNotificacoes"
                >Notificações ativas</label
              >
            </div>
          </div>

          <div v-if="modoEdicao" class="mt-3 mb-0">
            <CampoFormulario id="campoStatus" label="Status">
              <Combobox
                id="campoStatus"
                v-model="status"
                :opcoes="statusOpcoes"
                placeholder="Selecione o status"
                tamanho="sm"
                :desabilitado="papel === 'gestao'"
              />
            </CampoFormulario>
          </div>
        </div>
      </div>

      <div class="card border mb-3">
        <div class="card-header bg-body-tertiary py-2">
          <span class="fw-medium small">Módulos de acesso</span>
        </div>
        <div class="card-body">
          <CampoFormulario
            id="acessoModulos"
            label="Módulos disponíveis para este usuário"
            dica="Marque quais módulos o usuário poderá acessar"
          >
            <GrupoCheckbox
              nome="modulo"
              :opcoes="opcoesModulos"
              :modelo="acessoModulos"
              :colunas="2"
              @update:modelo="acessoModulos = $event"
            />
          </CampoFormulario>
        </div>
      </div>

      <div
        v-if="modoEdicao && papel === 'professor' && atribuicoes.length"
        class="card border mb-3"
      >
        <div class="card-header bg-body-tertiary py-2">
          <span class="fw-medium small">Atribuições</span>
        </div>
        <div class="card-body">
          <div
            v-for="a in atribuicoes"
            :key="a.id"
            class="border rounded p-2 mb-2 small bg-body-tertiary"
          >
            <div class="fw-medium">{{ a.turma_nome }}</div>
            <div class="d-flex gap-2 mt-1">
              <span
                class="badge"
                :class="a.papel === 'titular' ? 'text-bg-primary' : 'text-bg-info'"
              >
                {{ a.papel === 'titular' ? 'Titular' : 'Substituto' }}
              </span>
              <span v-if="a.ativo" class="badge text-bg-success">Ativo</span>
              <span v-else class="badge text-bg-secondary">Inativo</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="modoEdicao && papel === 'responsavel' && vinculos.length" class="card border mb-3">
        <div class="card-header bg-body-tertiary py-2">
          <span class="fw-medium small">Vínculos</span>
        </div>
        <div class="card-body">
          <div
            v-for="v in vinculos"
            :key="v.id"
            class="border rounded p-2 mb-2 small bg-body-tertiary"
          >
            <div class="fw-medium">{{ v.aluno_nome }}</div>
            <div class="d-flex gap-2 mt-1">
              <span class="badge text-bg-secondary">{{ v.tipo_relacao }}</span>
              <span v-if="v.contato_prioritario" class="badge text-bg-warning"
                >Contato prioritário</span
              >
            </div>
          </div>
        </div>
      </div>

      <div class="d-flex gap-2 justify-content-end">
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          :disabled="salvando || carregando"
          @click="router.push('/gestao/usuarios')"
        >
          Cancelar
        </button>
        <button type="submit" class="btn btn-sm btn-success" :disabled="salvando || carregando">
          <span
            v-if="salvando"
            class="spinner-border spinner-border-sm me-1"
            role="status"
            aria-hidden="true"
          ></span>
          <i v-else class="bi bi-check-lg me-1" aria-hidden="true"></i>
          {{ modoEdicao ? 'Salvar alterações' : 'Criar usuário' }}
        </button>
      </div>
    </form>
  </div>
</template>
