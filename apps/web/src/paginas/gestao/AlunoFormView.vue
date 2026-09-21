<script setup lang="ts">
import { computed, onMounted, ref, watch, nextTick } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import {
  criarAluno,
  criarUsuario,
  atualizarAluno,
  useAlunos,
} from '@/composables/consultas/useGestaoUsuarios';
import { useOpcoes, useTurmas } from '@/composables/consultas/useCatalogos';
import { useFormSnapshot } from '@/composables/useFormSnapshot';
import { api, ErroApi } from '@/servicos/api';
import { hojeIso } from '@/utils/datas';
import type { UsuarioApi } from '@/tipos/api';
import {
  mensagemSucesso as criarMensagemSucesso,
  mensagemErroExplicita,
} from '@/utils/mensagemExplicita';
import CampoFormulario from '@/componentes/CampoFormulario.vue';
import Combobox from '@/componentes/Combobox.vue';
import type { OpcaoCombobox } from '@/componentes/Combobox.vue';
import GrupoCheckbox from '@/componentes/GrupoCheckbox.vue';
import ModalConfirmacao from '@/componentes/ModalConfirmacao.vue';
import type { Enturmacao, VinculoResponsavel } from '@/tipos/database';

interface EnturmacaoApi {
  id: string;
  aluno_id: string;
  turma_id: string;
  ano_letivo_id: string;
  status: string;
  data_matricula: string;
  data_encerramento: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  turma: { id: string; nome_completo: string };
}

interface VinculoApi {
  id: string;
  responsavel_id: string;
  aluno_id: string;
  tipo_relacao: string;
  contato_prioritario: boolean;
  ativo: boolean;
  created_at: string;
  responsavel_nome?: string | null;
}

const route = useRoute();
const router = useRouter();
const { turmas } = useTurmas(() => ({ ativo: 'true' }));
const { opcoes: opcoesDocumentos } = useOpcoes(() => 'documento');
const { opcoes: opcoesTipoVinculo } = useOpcoes(() => 'tipo_vinculo');
const { alunos: listaAlunos, recarregar: recarregarAlunos } = useAlunos();

const modoEdicao = ref(false);
const alunoId = ref<string | null>(null);

const nome = ref('');
const matricula = ref('');
const codigoInep = ref('');
const dataNascimento = ref('');
const dataMatricula = ref('');
const observacoes = ref('');
const status = ref('ativo');
const turmaId = ref('');

const transporteEscolar = ref(false);
const alimentacaoDiferenciada = ref(false);
const necessidadesEspeciais = ref(false);
const documentosRecebidos = ref<string[]>([]);

const vinculoTipo = ref<'existente' | 'novo'>('existente');
const responsavelEmail = ref('');
const responsavelNome = ref('');
const responsavelTelefone = ref('');
const tipoVinculo = ref('outro');

const responsaveisOpcoes = ref<OpcaoCombobox[]>([]);
const carregandoResponsaveis = ref(false);
let debounceResp: ReturnType<typeof setTimeout> | null = null;

const turmaOpcoes = computed<OpcaoCombobox[]>(() =>
  turmas.value.map((t) => ({ valor: t.id, rotulo: t.nome_completo })),
);
const tipoVinculoOpcoes = computed<OpcaoCombobox[]>(() =>
  opcoesTipoVinculo.value.map((o) => ({ valor: o.valor, rotulo: o.rotulo, icone: o.icone })),
);
const statusOpcoes = computed<OpcaoCombobox[]>(() => [
  { valor: 'ativo', rotulo: 'Ativo' },
  { valor: 'egresso', rotulo: 'Egresso' },
  { valor: 'transferido', rotulo: 'Transferido' },
  { valor: 'inativo', rotulo: 'Inativo' },
]);

/** Busca de responsáveis para o combobox; consulta direta, sem retenção no cache. */
async function buscarResponsaveisApi(termo?: string): Promise<UsuarioApi[]> {
  const { usuarios } = await api<{ usuarios: UsuarioApi[] }>('/api/usuarios', {
    parametros: { papel: 'responsavel', busca: termo || undefined },
  });
  return usuarios;
}

async function buscarResponsaveis(termo: string) {
  if (debounceResp) clearTimeout(debounceResp);
  debounceResp = setTimeout(async () => {
    carregandoResponsaveis.value = true;
    try {
      const usuarios = await buscarResponsaveisApi(termo);
      // Limita a 30 para não sobrecarregar o combobox
      responsaveisOpcoes.value = usuarios
        .slice(0, 30)
        .map((u) => ({
          valor: u.email ?? '',
          rotulo: u.nome,
          descricao: u.email ?? '',
        }))
        .filter((o) => o.valor);
    } finally {
      carregandoResponsaveis.value = false;
    }
  }, 300);
}

function aoBuscarResponsavel(termo: string) {
  void buscarResponsaveis(termo);
}

const salvando = ref(false);
const mensagemSucesso = ref<string | null>(null);
const mensagemErro = ref<string | null>(null);
const confirmarSalvar = ref(false);
const confirmarCancelar = ref(false);
const confirmarAnonimizacao = ref(false);
const exportandoDados = ref(false);
const anonimizandoDados = ref(false);
const rotaPendente = ref<((v?: boolean) => void) | null>(null);
let timerSucesso: ReturnType<typeof setTimeout> | null = null;

function confirmarDescarte() {
  confirmarCancelar.value = false;
  const next = rotaPendente.value;
  if (next) {
    rotaPendente.value = null;
    next();
  } else {
    router.push('/gestao/alunos');
  }
}

function cancelarDescarte() {
  confirmarCancelar.value = false;
  const next = rotaPendente.value;
  if (next) {
    rotaPendente.value = null;
    next(false);
  }
}
let timerErro: ReturnType<typeof setTimeout> | null = null;

// Snapshot para detecção de alterações.
const {
  isDirty: formDirty,
  reset: resetSnapshot,
  pausado: snapshotPausado,
  pausar: pausarSnapshot,
} = useFormSnapshot(() => ({
  nome: nome.value,
  matricula: matricula.value,
  codigoInep: codigoInep.value,
  dataNascimento: dataNascimento.value,
  dataMatricula: dataMatricula.value,
  observacoes: observacoes.value,
  transporteEscolar: String(transporteEscolar.value),
  alimentacaoDiferenciada: String(alimentacaoDiferenciada.value),
  necessidadesEspeciais: String(necessidadesEspeciais.value),
  documentosRecebidos: [...documentosRecebidos.value].sort().join(','),
  status: status.value,
}));

const enturmacaoAtual = ref<Enturmacao | null>(null);
const turmaAtualNome = ref('');

const alterarEnturmacao = ref(false);
const novaTurmaId = ref('');
const novaDataMatricula = ref('');

const vinculos = ref<
  (VinculoResponsavel & { responsavel_nome?: string; responsavel_email?: string })[]
>([]);
const adicionarResponsavel = ref(false);
const novoRespTipo = ref<'existente' | 'novo'>('existente');
const novoRespEmail = ref('');
const novoRespNome = ref('');
const novoRespTelefone = ref('');
const novoTipoVinculo = ref('outro');

const contadorObservacoes = computed(() => observacoes.value.length);

let timeoutDraft: ReturnType<typeof setTimeout> | null = null;

function chaveDraft() {
  return modoEdicao.value && alunoId.value ? `draft-aluno-${alunoId.value}` : 'draft-aluno-novo';
}

function salvarDraft() {
  if (timeoutDraft) clearTimeout(timeoutDraft);
  timeoutDraft = setTimeout(() => {
    try {
      sessionStorage.setItem(
        chaveDraft(),
        JSON.stringify({
          nome: nome.value,
          matricula: matricula.value,
          codigoInep: codigoInep.value,
          dataNascimento: dataNascimento.value,
          dataMatricula: dataMatricula.value,
          observacoes: observacoes.value,
          transporteEscolar: transporteEscolar.value,
          alimentacaoDiferenciada: alimentacaoDiferenciada.value,
          necessidadesEspeciais: necessidadesEspeciais.value,
          documentosRecebidos: documentosRecebidos.value,
          turmaId: turmaId.value,
        }),
      );
    } catch {
      /* ignorar */
    }
  }, 500);
}

function limparDraft() {
  try {
    sessionStorage.removeItem(chaveDraft());
    sessionStorage.removeItem('draft-aluno-novo');
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
    confirmarCancelar.value = true;
    rotaPendente.value = next;
    return;
  }
  next();
});

watch(
  [
    nome,
    matricula,
    codigoInep,
    observacoes,
    documentosRecebidos,
    transporteEscolar,
    alimentacaoDiferenciada,
    necessidadesEspeciais,
    status,
  ],
  () => {
    if (!snapshotPausado.value) salvarDraft();
  },
  { deep: true },
);

function hoje() {
  return hojeIso();
}

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

/** Exporta o pacote de dados do titular em JSON (direito de acesso da LGPD). */
async function exportarDadosTitular() {
  if (!alunoId.value) return;
  exportandoDados.value = true;
  try {
    const dados = await api<Record<string, unknown>>(`/api/lgpd/alunos/${alunoId.value}/exportar`);
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dados-aluno-${alunoId.value}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    mostrarSucesso('Exportação gerada.');
  } catch (falha) {
    mostrarErro(
      falha instanceof ErroApi ? falha.message : 'Não foi possível exportar os dados do aluno.',
    );
  } finally {
    exportandoDados.value = false;
  }
}

/** Anonimiza os dados pessoais e remove os anexos; ação irreversível. */
async function anonimizarDados() {
  if (!alunoId.value) return;
  confirmarAnonimizacao.value = false;
  anonimizandoDados.value = true;
  try {
    await api(`/api/lgpd/alunos/${alunoId.value}/anonimizar`, {
      metodo: 'POST',
      corpo: { confirmar: true },
    });
    await router.push('/gestao/alunos');
  } catch (falha) {
    mostrarErro(
      falha instanceof ErroApi ? falha.message : 'Não foi possível anonimizar os dados do aluno.',
    );
  } finally {
    anonimizandoDados.value = false;
  }
}

async function carregarEnturmacao() {
  if (!alunoId.value) return;
  try {
    const { enturmacoes } = await api<{ enturmacoes: EnturmacaoApi[] }>('/api/enturmacoes', {
      parametros: { aluno_id: alunoId.value, status: 'matriculado' },
    });
    const atual = enturmacoes[0];
    if (atual) {
      enturmacaoAtual.value = {
        id: atual.id,
        aluno_id: atual.aluno_id,
        turma_id: atual.turma_id,
        ano_letivo_id: atual.ano_letivo_id,
        status: atual.status,
        data_matricula: atual.data_matricula,
        data_encerramento: atual.data_encerramento,
        observacoes: atual.observacoes,
        created_at: atual.created_at,
        updated_at: atual.updated_at,
      };
      turmaAtualNome.value = atual.turma?.nome_completo ?? '';
    } else {
      enturmacaoAtual.value = null;
      turmaAtualNome.value = '';
    }
  } catch (e) {
    console.error('[AlunoFormView] Erro ao carregar enturmação:', e);
  }
}

async function carregarVinculos() {
  if (!alunoId.value) return;
  try {
    const { vinculos: vinculosApi } = await api<{ vinculos: VinculoApi[] }>('/api/vinculos', {
      parametros: { aluno_id: alunoId.value, ativo: 'true' },
    });
    const responsaveis = await buscarResponsaveisApi();
    const responsavelPorId = new Map(responsaveis.map((r) => [r.id, r]));
    vinculos.value = vinculosApi.map((v) => {
      const responsavel = responsavelPorId.get(v.responsavel_id);
      return {
        id: v.id,
        responsavel_id: v.responsavel_id,
        aluno_id: v.aluno_id,
        tipo_relacao: v.tipo_relacao,
        contato_prioritario: v.contato_prioritario,
        ativo: v.ativo,
        created_at: v.created_at,
        updated_at: v.created_at,
        responsavel_nome: v.responsavel_nome ?? responsavel?.nome ?? '—',
        responsavel_email: responsavel?.email ?? '—',
      };
    });
  } catch (e) {
    console.error('[AlunoFormView] Erro ao carregar vínculos:', e);
  }
}

async function salvarAlterarEnturmacao() {
  if (!novaTurmaId.value || !novaDataMatricula.value || !alunoId.value) {
    mostrarErro('Selecione a turma e a data de matrícula.');
    return;
  }
  salvando.value = true;
  try {
    // O servidor reutiliza a linha do ano letivo (unicidade de aluno e ano) ou
    // encerra a matrícula anterior e cria a nova — tudo em transação.
    await api('/api/enturmacoes', {
      metodo: 'POST',
      corpo: {
        aluno_id: alunoId.value,
        turma_id: novaTurmaId.value,
        data_matricula: novaDataMatricula.value,
      },
    });
    alterarEnturmacao.value = false;
    await carregarEnturmacao();
    mostrarSucesso('Enturmação alterada com sucesso.');
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao alterar enturmação.';
    console.error('[AlunoFormView] Erro ao alterar enturmação:', msg);
    mostrarErro(msg);
  } finally {
    salvando.value = false;
  }
}

async function salvarNovoResponsavel() {
  if (!alunoId.value) return;
  salvando.value = true;
  try {
    let responsavelId: string | null = null;
    if (novoRespTipo.value === 'existente') {
      const email = novoRespEmail.value.trim();
      if (!email) {
        mostrarErro('Informe o e-mail do responsável.');
        return;
      }
      const usuarios = await buscarResponsaveisApi(email);
      const encontrado = usuarios.find(
        (u) => (u.email ?? '').toLowerCase() === email.toLowerCase(),
      );
      if (!encontrado) {
        mostrarErro('Nenhum usuário encontrado com esse e-mail.');
        return;
      }
      responsavelId = encontrado.id;
    } else {
      if (!novoRespNome.value.trim() || !novoRespEmail.value.trim()) {
        mostrarErro('Nome e e-mail são obrigatórios.');
        return;
      }
      const criado = await criarUsuario({
        nome: novoRespNome.value.trim(),
        email: novoRespEmail.value.trim(),
        papel: 'responsavel',
        telefone: novoRespTelefone.value.trim() || undefined,
      });
      if (!criado.id) {
        mostrarErro('Falha ao criar responsável.');
        return;
      }
      responsavelId = criado.id;
    }

    await api('/api/vinculos', {
      metodo: 'POST',
      corpo: {
        responsavel_id: responsavelId,
        aluno_id: alunoId.value,
        tipo_relacao: novoTipoVinculo.value,
        contato_prioritario: vinculos.value.length === 0,
      },
    });

    adicionarResponsavel.value = false;
    novoRespEmail.value = '';
    novoRespNome.value = '';
    novoRespTelefone.value = '';
    novoTipoVinculo.value = 'outro';
    await carregarVinculos();
    mostrarSucesso('Responsável vinculado com sucesso.');
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao vincular responsável.';
    console.error('[AlunoFormView] Erro ao vincular responsável:', msg);
    mostrarErro(msg);
  } finally {
    salvando.value = false;
  }
}

onMounted(async () => {
  pausarSnapshot(true);
  // Pré-carrega responsáveis para o combobox de seleção existente
  void buscarResponsaveis('');
  const id = route.params.id as string | undefined;
  if (id) {
    modoEdicao.value = true;
    alunoId.value = id;
    dataMatricula.value = hoje();
    if (!listaAlunos.value.length) await recarregarAlunos();
    const aluno = listaAlunos.value.find((a) => a.id === id);
    if (aluno) {
      nome.value = aluno.nome;
      matricula.value = aluno.matricula;
      status.value = aluno.status;
      dataNascimento.value = aluno.data_nascimento ?? '';
      codigoInep.value = aluno.codigo_inep ?? '';
      if (aluno.data_matricula) dataMatricula.value = aluno.data_matricula.slice(0, 10);
      observacoes.value = aluno.observacoes ?? '';
      transporteEscolar.value = aluno.transporte_escolar;
      alimentacaoDiferenciada.value = aluno.alimentacao_diferenciada;
      necessidadesEspeciais.value = aluno.necessidades_especiais;
      documentosRecebidos.value = [...aluno.documentos_recebidos];
    }
    await Promise.all([carregarEnturmacao(), carregarVinculos()]);
  } else {
    dataMatricula.value = hoje();
  }

  try {
    const dadosSalvos = sessionStorage.getItem(chaveDraft());
    if (dadosSalvos) {
      const parsed = JSON.parse(dadosSalvos);
      if (parsed.nome) nome.value = parsed.nome;
      if (parsed.matricula) matricula.value = parsed.matricula;
      if (parsed.codigoInep) codigoInep.value = parsed.codigoInep;
      if (parsed.dataNascimento) dataNascimento.value = parsed.dataNascimento;
      if (parsed.dataMatricula) dataMatricula.value = parsed.dataMatricula;
      if (parsed.observacoes) observacoes.value = parsed.observacoes;
      if (typeof parsed.transporteEscolar === 'boolean')
        transporteEscolar.value = parsed.transporteEscolar;
      if (typeof parsed.alimentacaoDiferenciada === 'boolean')
        alimentacaoDiferenciada.value = parsed.alimentacaoDiferenciada;
      if (typeof parsed.necessidadesEspeciais === 'boolean')
        necessidadesEspeciais.value = parsed.necessidadesEspeciais;
      if (parsed.documentosRecebidos) documentosRecebidos.value = parsed.documentosRecebidos;
      if (parsed.turmaId) turmaId.value = parsed.turmaId;
    }
  } catch {
    /* ignorar dados corrompidos */
  }
  await nextTick();
  resetSnapshot();
  pausarSnapshot(false);
});

function solicitarSalvar() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (!nome.value.trim()) {
    mostrarErro(
      mensagemErroExplicita(
        'Aluno',
        nome.value || 'sem nome',
        'salvar',
        'O campo nome é obrigatório.',
      ),
    );
    return;
  }
  if (!matricula.value.trim()) {
    mostrarErro(
      mensagemErroExplicita('Aluno', nome.value, 'salvar', 'O campo matrícula é obrigatório.'),
    );
    return;
  }
  confirmarSalvar.value = true;
}

async function salvar() {
  confirmarSalvar.value = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (!nome.value.trim()) {
    mostrarErro(
      mensagemErroExplicita(
        'Aluno',
        nome.value || 'sem nome',
        'salvar',
        'O campo nome é obrigatório.',
      ),
    );
    return;
  }
  if (!matricula.value.trim()) {
    mostrarErro(
      mensagemErroExplicita('Aluno', nome.value, 'salvar', 'O campo matrícula é obrigatório.'),
    );
    return;
  }
  salvando.value = true;
  try {
    const dadosExtras = {
      codigo_inep: codigoInep.value.trim() || undefined,
      data_nascimento: dataNascimento.value || undefined,
      data_matricula: dataMatricula.value || undefined,
      observacoes: observacoes.value.trim() || undefined,
      transporte_escolar: transporteEscolar.value,
      alimentacao_diferenciada: alimentacaoDiferenciada.value,
      necessidades_especiais: necessidadesEspeciais.value,
      documentos_recebidos: documentosRecebidos.value,
    } as Record<string, unknown>;

    if (modoEdicao.value && alunoId.value) {
      const ok = await atualizarAluno(alunoId.value, {
        nome: nome.value.trim(),
        matricula: matricula.value.trim(),
        status: status.value,
        ...dadosExtras,
      } as Parameters<typeof atualizarAluno>[1] & typeof dadosExtras);
      if (ok) {
        limparDraft();
        resetSnapshot();
        pausarSnapshot(false);
        mostrarSucesso(criarMensagemSucesso('Aluno', nome.value, 'atualizado'));
        await nextTick();
        requestAnimationFrame(() => {
          document
            .querySelector('.alert-success')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      } else {
        mostrarErro(
          mensagemErroExplicita('Aluno', nome.value, 'atualizar', 'Falha ao atualizar aluno.'),
        );
      }
    } else {
      const id = await criarAluno({
        nome: nome.value.trim(),
        matricula: matricula.value.trim(),
        data_nascimento: dataNascimento.value || undefined,
        observacoes: observacoes.value.trim() || undefined,
        turma_id: turmaId.value || undefined,
        ...(vinculoTipo.value === 'existente'
          ? { responsavel_email: responsavelEmail.value.trim() || undefined }
          : {
              responsavel_nome: responsavelNome.value.trim() || undefined,
              responsavel_email: responsavelEmail.value.trim() || undefined,
              responsavel_telefone: responsavelTelefone.value.trim() || undefined,
              tipo_vinculo: tipoVinculo.value,
            }),
      });
      if (id) {
        const updates: Record<string, unknown> = {};
        if (codigoInep.value.trim()) updates.codigo_inep = codigoInep.value.trim();
        if (dataMatricula.value) updates.data_matricula = dataMatricula.value;
        updates.transporte_escolar = transporteEscolar.value;
        updates.alimentacao_diferenciada = alimentacaoDiferenciada.value;
        updates.necessidades_especiais = necessidadesEspeciais.value;
        updates.documentos_recebidos = documentosRecebidos.value;
        if (Object.keys(updates).length) {
          await atualizarAluno(
            id,
            updates as Parameters<typeof atualizarAluno>[1] & typeof updates,
          );
        }
        limparDraft();
        resetSnapshot();
        pausarSnapshot(false);
        mostrarSucesso(criarMensagemSucesso('Aluno', nome.value, 'criado'));
        await nextTick();
        requestAnimationFrame(() => {
          document
            .querySelector('.alert-success')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      } else {
        mostrarErro(mensagemErroExplicita('Aluno', nome.value, 'criar', 'Falha ao criar aluno.'));
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
      {{ modoEdicao ? 'Editar aluno' : 'Novo aluno' }}
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

    <form @submit.prevent="solicitarSalvar">
      <div class="card border mb-3">
        <div class="card-header bg-body-tertiary py-2">
          <span class="fw-medium small">Dados do aluno</span>
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

          <CampoFormulario id="campoMatricula" label="Matrícula" :obrigatorio="true">
            <input
              id="campoMatricula"
              v-model="matricula"
              type="text"
              class="form-control form-control-sm"
              required
              autocomplete="off"
            />
          </CampoFormulario>

          <CampoFormulario id="campoCodigoInep" label="Código INEP">
            <input
              id="campoCodigoInep"
              v-model="codigoInep"
              type="text"
              class="form-control form-control-sm"
              autocomplete="off"
            />
          </CampoFormulario>

          <CampoFormulario id="campoDataNasc" label="Data de nascimento">
            <input
              id="campoDataNasc"
              v-model="dataNascimento"
              type="date"
              class="form-control form-control-sm"
              autocomplete="off"
            />
          </CampoFormulario>

          <CampoFormulario id="campoDataMatricula" label="Data de matrícula">
            <input
              id="campoDataMatricula"
              v-model="dataMatricula"
              type="date"
              class="form-control form-control-sm"
              autocomplete="off"
            />
          </CampoFormulario>

          <CampoFormulario
            id="campoObservacoes"
            label="Observações"
            :maxlength="1000"
            :contador="contadorObservacoes"
          >
            <textarea
              id="campoObservacoes"
              v-model="observacoes"
              class="form-control form-control-sm"
              rows="2"
              maxlength="1000"
              autocomplete="off"
            ></textarea>
          </CampoFormulario>
        </div>
      </div>

      <div class="card border mb-3">
        <div class="card-header bg-body-tertiary py-2">
          <span class="fw-medium small">Documentos recebidos</span>
        </div>
        <div class="card-body">
          <CampoFormulario
            id="documentos"
            label="Marque os documentos já entregues pelo aluno"
            dica="Apenas para controle interno da secretaria"
          >
            <GrupoCheckbox
              nome="doc"
              :opcoes="opcoesDocumentos"
              :modelo="documentosRecebidos"
              :colunas="2"
              @update:modelo="documentosRecebidos = $event"
            />
          </CampoFormulario>
        </div>
      </div>

      <div class="card border mb-3">
        <div class="card-header bg-body-tertiary py-2">
          <span class="fw-medium small">Indicadores</span>
        </div>
        <div class="card-body">
          <div class="d-flex gap-4 flex-wrap">
            <div class="form-check">
              <input
                id="campoTransporte"
                v-model="transporteEscolar"
                type="checkbox"
                class="form-check-input"
              />
              <label class="form-check-label small fw-medium" for="campoTransporte">
                <i class="bi bi-bus-front me-1" aria-hidden="true"></i>
                Transporte escolar
              </label>
            </div>
            <div class="form-check">
              <input
                id="campoAlimentacao"
                v-model="alimentacaoDiferenciada"
                type="checkbox"
                class="form-check-input"
              />
              <label class="form-check-label small fw-medium" for="campoAlimentacao">
                <i class="bi bi-cup-hot me-1" aria-hidden="true"></i>
                Alimentação diferenciada
              </label>
            </div>
            <div class="form-check">
              <input
                id="campoNecessidades"
                v-model="necessidadesEspeciais"
                type="checkbox"
                class="form-check-input"
              />
              <label class="form-check-label small fw-medium" for="campoNecessidades">
                <i class="bi bi-universal-access me-1" aria-hidden="true"></i>
                Necessidades especiais
              </label>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!modoEdicao" class="card border mb-3">
        <div class="card-header bg-body-tertiary py-2">
          <span class="fw-medium small">Enturmação</span>
        </div>
        <div class="card-body">
          <CampoFormulario id="campoTurma" label="Turma">
            <Combobox
              id="campoTurma"
              v-model="turmaId"
              :opcoes="turmaOpcoes"
              placeholder="Selecione uma turma"
              tamanho="sm"
            />
          </CampoFormulario>
        </div>
      </div>

      <div v-if="!modoEdicao" class="card border mb-3">
        <div class="card-header bg-body-tertiary py-2">
          <span class="fw-medium small">Vínculo com responsável</span>
        </div>
        <div class="card-body">
          <div class="mb-3">
            <div class="btn-group btn-group-sm" role="group" aria-label="Tipo de vínculo">
              <input
                v-model="vinculoTipo"
                type="radio"
                class="btn-check"
                name="vinculoTipo"
                id="vinculoExistente"
                value="existente"
                autocomplete="off"
              />
              <label class="btn btn-outline-secondary" for="vinculoExistente"
                >Selecionar existente</label
              >
              <input
                v-model="vinculoTipo"
                type="radio"
                class="btn-check"
                name="vinculoTipo"
                id="vinculoNovo"
                value="novo"
                autocomplete="off"
              />
              <label class="btn btn-outline-secondary" for="vinculoNovo">Criar novo</label>
            </div>
          </div>

          <CampoFormulario id="campoRespEmail" label="E-mail do responsável">
            <Combobox
              v-if="vinculoTipo === 'existente'"
              id="campoRespEmail"
              v-model="responsavelEmail"
              :opcoes="responsaveisOpcoes"
              placeholder="Busque por nome ou e-mail"
              :carregando="carregandoResponsaveis"
              tamanho="sm"
              @buscar="aoBuscarResponsavel"
            />
            <input
              v-else
              id="campoRespEmail"
              v-model="responsavelEmail"
              type="email"
              class="form-control form-control-sm"
              autocomplete="off"
            />
          </CampoFormulario>

          <template v-if="vinculoTipo === 'novo'">
            <CampoFormulario id="campoRespNome" label="Nome do responsável">
              <input
                id="campoRespNome"
                v-model="responsavelNome"
                type="text"
                class="form-control form-control-sm"
                autocomplete="off"
              />
            </CampoFormulario>
            <CampoFormulario id="campoRespTelefone" label="Telefone">
              <input
                id="campoRespTelefone"
                v-model="responsavelTelefone"
                type="text"
                class="form-control form-control-sm"
                autocomplete="off"
              />
            </CampoFormulario>
            <CampoFormulario id="campoTipoVinculo" label="Tipo de vínculo">
              <Combobox
                id="campoTipoVinculo"
                v-model="tipoVinculo"
                :opcoes="tipoVinculoOpcoes"
                placeholder="Selecione o vínculo"
                tamanho="sm"
              />
            </CampoFormulario>
          </template>
        </div>
      </div>

      <div v-if="modoEdicao" class="card border mb-3">
        <div class="card-header bg-body-tertiary py-2">
          <span class="fw-medium small">Status</span>
        </div>
        <div class="card-body">
          <CampoFormulario id="campoStatusAluno" label="Status">
            <Combobox
              id="campoStatusAluno"
              v-model="status"
              :opcoes="statusOpcoes"
              placeholder="Selecione o status"
              tamanho="sm"
            />
          </CampoFormulario>
        </div>
      </div>

      <div v-if="modoEdicao" class="card border mb-3">
        <div class="card-header bg-body-tertiary py-2">
          <span class="fw-medium small">Enturmação atual</span>
        </div>
        <div class="card-body">
          <p v-if="enturmacaoAtual" class="mb-2 small">
            <span class="fw-medium">Turma:</span> {{ turmaAtualNome }}
            <br />
            <span class="fw-medium">Matrícula em:</span>
            {{ new Date(enturmacaoAtual.data_matricula).toLocaleDateString('pt-BR') }}
          </p>
          <p v-else class="mb-2 small text-body-secondary">Aluno não enturmado.</p>

          <button
            v-if="!alterarEnturmacao"
            type="button"
            class="btn btn-sm btn-outline-success"
            @click="alterarEnturmacao = true"
          >
            <i class="bi bi-arrow-left-right me-1" aria-hidden="true"></i>
            Alterar enturmação
          </button>

          <div v-if="alterarEnturmacao" class="border rounded p-3 mt-2 bg-body-tertiary">
            <CampoFormulario id="campoNovaTurma" label="Nova turma">
              <Combobox
                id="campoNovaTurma"
                v-model="novaTurmaId"
                :opcoes="turmaOpcoes"
                placeholder="Selecione uma turma"
                tamanho="sm"
              />
            </CampoFormulario>
            <CampoFormulario id="campoNovaDataMat" label="Data matrícula">
              <input
                id="campoNovaDataMat"
                v-model="novaDataMatricula"
                type="date"
                class="form-control form-control-sm"
                autocomplete="off"
              />
            </CampoFormulario>
            <div class="d-flex gap-2 justify-content-end">
              <button
                type="button"
                class="btn btn-sm btn-success"
                :disabled="salvando"
                @click="salvarAlterarEnturmacao"
              >
                <span
                  v-if="salvando"
                  class="spinner-border spinner-border-sm me-1"
                  role="status"
                  aria-hidden="true"
                ></span>
                <i v-else class="bi bi-check-lg me-1" aria-hidden="true"></i>
                Salvar
              </button>
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary"
                @click="alterarEnturmacao = false"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="modoEdicao" class="card border mb-3">
        <div class="card-header bg-body-tertiary py-2">
          <span class="fw-medium small">Responsáveis vinculados</span>
        </div>
        <div class="card-body">
          <div
            v-if="vinculos.length === 0 && !adicionarResponsavel"
            class="text-body-secondary small mb-2"
          >
            Nenhum responsável vinculado.
          </div>

          <div
            v-for="v in vinculos"
            :key="v.id"
            class="border rounded p-2 mb-2 small bg-body-tertiary"
          >
            <div class="fw-medium">{{ v.responsavel_nome }}</div>
            <div class="text-body-secondary">{{ v.responsavel_email }}</div>
            <div class="d-flex gap-2 mt-1">
              <span class="badge text-bg-secondary">{{ v.tipo_relacao }}</span>
              <span v-if="v.contato_prioritario" class="badge text-bg-warning"
                >Contato prioritário</span
              >
            </div>
          </div>

          <button
            v-if="!adicionarResponsavel"
            type="button"
            class="btn btn-sm btn-outline-success"
            @click="adicionarResponsavel = true"
          >
            <i class="bi bi-person-plus me-1" aria-hidden="true"></i>
            Adicionar responsável
          </button>

          <div v-if="adicionarResponsavel" class="border rounded p-3 mt-2 bg-body-tertiary">
            <div class="mb-3">
              <div class="btn-group btn-group-sm" role="group" aria-label="Tipo de responsável">
                <input
                  v-model="novoRespTipo"
                  type="radio"
                  class="btn-check"
                  name="novoRespTipo"
                  id="novoRespExistente"
                  value="existente"
                  autocomplete="off"
                />
                <label class="btn btn-outline-secondary" for="novoRespExistente">Existente</label>
                <input
                  v-model="novoRespTipo"
                  type="radio"
                  class="btn-check"
                  name="novoRespTipo"
                  id="novoRespNovo"
                  value="novo"
                  autocomplete="off"
                />
                <label class="btn btn-outline-secondary" for="novoRespNovo">Criar novo</label>
              </div>
            </div>

            <CampoFormulario id="campoNovoRespEmail" label="E-mail do responsável">
              <Combobox
                v-if="novoRespTipo === 'existente'"
                id="campoNovoRespEmail"
                v-model="novoRespEmail"
                :opcoes="responsaveisOpcoes"
                placeholder="Busque por nome ou e-mail"
                :carregando="carregandoResponsaveis"
                tamanho="sm"
                @buscar="aoBuscarResponsavel"
              />
              <input
                v-else
                id="campoNovoRespEmail"
                v-model="novoRespEmail"
                type="email"
                class="form-control form-control-sm"
                autocomplete="off"
              />
            </CampoFormulario>

            <template v-if="novoRespTipo === 'novo'">
              <CampoFormulario id="campoNovoRespNome" label="Nome">
                <input
                  id="campoNovoRespNome"
                  v-model="novoRespNome"
                  type="text"
                  class="form-control form-control-sm"
                  autocomplete="off"
                />
              </CampoFormulario>
              <CampoFormulario id="campoNovoRespTelefone" label="Telefone">
                <input
                  id="campoNovoRespTelefone"
                  v-model="novoRespTelefone"
                  type="text"
                  class="form-control form-control-sm"
                  autocomplete="off"
                />
              </CampoFormulario>
              <CampoFormulario id="campoNovoTipoVinculo" label="Tipo de vínculo">
                <Combobox
                  id="campoNovoTipoVinculo"
                  v-model="novoTipoVinculo"
                  :opcoes="tipoVinculoOpcoes"
                  placeholder="Selecione o vínculo"
                  tamanho="sm"
                />
              </CampoFormulario>
            </template>

            <div class="d-flex gap-2 justify-content-end">
              <button
                type="button"
                class="btn btn-sm btn-success"
                :disabled="salvando"
                @click="salvarNovoResponsavel"
              >
                <span
                  v-if="salvando"
                  class="spinner-border spinner-border-sm me-1"
                  role="status"
                  aria-hidden="true"
                ></span>
                <i v-else class="bi bi-check-lg me-1" aria-hidden="true"></i>
                Vincular
              </button>
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary"
                @click="adicionarResponsavel = false"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="d-flex flex-wrap gap-2 justify-content-between align-items-center">
        <div v-if="modoEdicao && alunoId" class="d-flex flex-wrap gap-2">
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            :disabled="exportandoDados"
            @click="exportarDadosTitular"
          >
            <span
              v-if="exportandoDados"
              class="spinner-border spinner-border-sm me-1"
              role="status"
              aria-hidden="true"
            ></span>
            <i v-else class="bi bi-download me-1" aria-hidden="true"></i>
            Exportar dados
          </button>
          <button
            type="button"
            class="btn btn-sm btn-outline-danger"
            @click="confirmarAnonimizacao = true"
          >
            <i class="bi bi-person-x me-1" aria-hidden="true"></i>
            Anonimizar dados
          </button>
        </div>
        <div class="d-flex gap-2 ms-auto">
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            :disabled="salvando"
            @click="formDirty ? (confirmarCancelar = true) : router.push('/gestao/alunos')"
          >
            Cancelar
          </button>
          <button type="submit" class="btn btn-sm btn-success" :disabled="salvando">
            <span
              v-if="salvando"
              class="spinner-border spinner-border-sm me-1"
              role="status"
              aria-hidden="true"
            ></span>
            <i v-else class="bi bi-check-lg me-1" aria-hidden="true"></i>
            {{ modoEdicao ? 'Salvar alterações' : 'Criar aluno' }}
          </button>
        </div>
      </div>
    </form>
    <ModalConfirmacao
      :visivel="confirmarAnonimizacao"
      titulo="Anonimizar dados do aluno"
      mensagem="Esta ação é irreversível: os dados pessoais serão anonimizados e os anexos removidos, mantendo apenas as frequências para estatística. Deseja continuar?"
      rotulo-confirmar="Anonimizar"
      icone="person-x"
      variante="danger"
      @confirmar="anonimizarDados"
      @cancelar="confirmarAnonimizacao = false"
    />
    <ModalConfirmacao
      :visivel="confirmarSalvar"
      titulo="Salvar aluno"
      :mensagem="`Deseja salvar ${modoEdicao ? 'as alterações do' : 'o novo'} aluno?`"
      rotulo-confirmar="Salvar"
      icone="person-check"
      variante="success"
      @confirmar="salvar"
      @cancelar="confirmarSalvar = false"
    />
    <ModalConfirmacao
      :visivel="confirmarCancelar"
      titulo="Descartar alterações?"
      mensagem="Há alterações não salvas que serão perdidas. Deseja realmente sair?"
      rotulo-confirmar="Descartar"
      icone="exclamation-triangle"
      variante="danger"
      @confirmar="confirmarDescarte"
      @cancelar="cancelarDescarte"
    />
  </div>
</template>
