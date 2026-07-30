<script setup lang="ts">
import { onMounted, ref, watch, nextTick } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import { useGestaoUsuarios } from '@/composables/useGestaoUsuarios';
import { useOpcoesConfiguracao } from '@/composables/useOpcoesConfiguracao';
import { supabaseClient } from '@/servicos/supabase';
import CampoFormulario from '@/componentes/CampoFormulario.vue';
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
const acessoModulos = ref<string[]>(['frequencia']);
const permissoes = ref<string[]>([]);

const opcoesModulos = ref<OpcaoCheckbox[]>([]);
const opcoesPermissoes = ref<OpcaoCheckbox[]>([]);

const atribuicoes = ref<(AtribuicaoProfessor & { turma_nome?: string })[]>([]);
const vinculos = ref<(VinculoResponsavel & { aluno_nome?: string })[]>([]);

const salvando = ref(false);
const formDirty = ref(false);
const mensagemSucesso = ref<string | null>(null);
const mensagemErro = ref<string | null>(null);
const mensagemToast = ref<string | null>(null);
const usuarioCriado = ref(false);
const codigoCriado = ref<string | null>(null);

let timeoutDraft: ReturnType<typeof setTimeout> | null = null;

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
          permissoes: permissoes.value,
        }),
      );
    } catch {
      /* storage cheio ou indisponível */
    }
  }, 500);
}

function limparDraft() {
  try {
    sessionStorage.removeItem(chaveDraft());
    sessionStorage.removeItem('draft-usuario-novo');
  } catch {
    /* ignorar */
  }
}

onBeforeRouteLeave((_to, _from, next) => {
  if (formDirty.value && !salvando.value && !usuarioCriado.value) {
    const confirmar = window.confirm('Há alterações não salvas. Deseja realmente sair?');
    if (!confirmar) return next(false);
  }
  next();
});

watch(
  [nome, email, telefone, cargo, notificacoesAtivas, acessoModulos, permissoes, papel],
  () => {
    if (!formDirty.value && !usuarioCriado.value) formDirty.value = true;
    if (!usuarioCriado.value) salvarDraft();
  },
  { deep: true },
);

function mostrarErro(msg: string) {
  mensagemErro.value = msg;
  setTimeout(() => (mensagemErro.value = null), 4000);
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
}

onMounted(async () => {
  opcoesModulos.value = await buscarOpcoes('modulo');
  opcoesPermissoes.value = await buscarOpcoes('permissao');
  const id = route.params.id as string | undefined;
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
      mostrarErro('Usuário não encontrado.');
      return;
    }
    const { data: perfil } = await supabaseClient
      .from('perfis')
      .select('notificacoes_ativas, acesso_modulos, permissoes')
      .eq('id', id)
      .single();
    if (perfil) {
      notificacoesAtivas.value = perfil.notificacoes_ativas;
      acessoModulos.value = perfil.acesso_modulos?.length ? perfil.acesso_modulos : ['frequencia'];
      permissoes.value = perfil.permissoes ?? [];
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
      if (parsed.acessoModulos) acessoModulos.value = parsed.acessoModulos;
      if (parsed.permissoes) permissoes.value = parsed.permissoes;
    }
  } catch {
    /* ignorar dados corrompidos */
  }
});

async function salvar() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (!nome.value.trim()) {
    mostrarErro('O campo nome é obrigatório.');
    return;
  }
  if (!email.value.trim()) {
    mostrarErro('O campo e-mail é obrigatório.');
    return;
  }
  salvando.value = true;
  try {
    const dadosExtras = {
      notificacoes_ativas: notificacoesAtivas.value,
      acesso_modulos: acessoModulos.value,
      permissoes: permissoes.value,
    };
    if (modoEdicao.value && usuarioId.value) {
      const ok = await atualizarUsuario(usuarioId.value, {
        nome: nome.value.trim(),
        telefone: telefone.value.trim() || undefined,
        cargo: cargo.value.trim() || undefined,
        status: status.value,
        ...dadosExtras,
      } as Parameters<typeof atualizarUsuario>[1] & typeof dadosExtras);
      if (ok) {
        limparDraft();
        mensagemSucesso.value = 'Alterações salvas com sucesso.';
        await nextTick();
        requestAnimationFrame(() => {
          document
            .querySelector('.alert-success')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        setTimeout(() => (mensagemSucesso.value = null), 4000);
      } else {
        mostrarErro(erro.value || 'Falha ao atualizar usuário.');
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
        usuarioCriado.value = true;
        codigoCriado.value = codigo;
        if (codigo) {
          mensagemSucesso.value = 'Usuário criado com sucesso! Código gerado automaticamente.';
        } else {
          mensagemSucesso.value =
            'Usuário criado com sucesso! A senha inicial deve ser redefinida via código.';
        }
      } else {
        mostrarErro(erro.value || 'Falha ao criar usuário.');
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

    <div v-if="mensagemSucesso" class="alert alert-success py-2 small mb-3" role="status">
      <i class="bi bi-check-circle me-1" aria-hidden="true"></i>
      {{ mensagemSucesso }}
    </div>
    <div v-if="mensagemErro" class="alert alert-danger py-2 small mb-3" role="alert">
      <i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>
      {{ mensagemErro }}
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
        <code
          class="d-inline-block fs-1 fw-bold font-monospace text-success bg-body-tertiary px-3 py-2 rounded user-select-all mb-3"
          style="letter-spacing: 0.15em"
        >
          {{ codigoCriado }}
        </code>
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
            <select
              id="campoPapel"
              v-model="papel"
              class="form-select form-select-sm"
              :disabled="modoEdicao"
            >
              <option value="professor">Professor</option>
              <option value="responsavel">Responsável</option>
            </select>
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
            <label for="campoStatus" class="form-label small fw-medium">Status</label>
            <select id="campoStatus" v-model="status" class="form-select form-select-sm">
              <option value="ativo">Ativo</option>
              <option value="pendente">Pendente</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
        </div>
      </div>

      <div v-if="papel === 'professor'" class="card border mb-3">
        <div class="card-header bg-body-tertiary py-2">
          <span class="fw-medium small">Módulos de acesso</span>
        </div>
        <div class="card-body">
          <CampoFormulario
            id="acessoModulos"
            label="Módulos disponíveis para este professor"
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

      <div v-if="papel === 'professor'" class="card border mb-3">
        <div class="card-header bg-body-tertiary py-2">
          <span class="fw-medium small">Permissões</span>
        </div>
        <div class="card-body">
          <CampoFormulario
            id="permissoes"
            label="Permissões especiais"
            dica="Conceda permissões adicionais a este professor"
          >
            <GrupoCheckbox
              nome="permissao"
              :opcoes="opcoesPermissoes"
              :modelo="permissoes"
              :colunas="2"
              @update:modelo="permissoes = $event"
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
        <router-link to="/gestao/usuarios" class="btn btn-sm btn-outline-secondary"
          >Cancelar</router-link
        >
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
