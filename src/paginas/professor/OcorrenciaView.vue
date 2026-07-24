<script setup lang="ts">
import { computed, onMounted, ref, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useAutenticacao } from '@/composables/useAutenticacao';
import { useMonitoramento } from '@/composables/useMonitoramento';
import CampoFormulario from '@/componentes/CampoFormulario.vue';
import GrupoCheckbox from '@/componentes/GrupoCheckbox.vue';
import CartaoSelecao from '@/componentes/CartaoSelecao.vue';
import type { AlunoFrequencia } from '@/tipos/componentes';
import { TAGS_COMPORTAMENTO } from '@/tipos/componentes';

const router = useRouter();
const { usuario } = useAutenticacao();
const { buscarAlunosParaFrequencia, registrarOcorrenciaGrave, carregando } = useMonitoramento();

const alunos = ref<AlunoFrequencia[]>([]);
const alunoId = ref('');
const tipos = ref<string[]>(['grave']);
const tags = ref<string[]>([]);
const descricao = ref('');
const exigePresenca = ref(false);
const notificarCoordenacao = ref(true);
const notificarResponsavel = ref(false);
const mensagemSucesso = ref<string | null>(null);
const mensagemErro = ref<string | null>(null);

const opcoesTipo = [
  { valor: 'grave', rotulo: 'Ocorrência grave', icone: 'exclamation-triangle' },
  { valor: 'suspensao', rotulo: 'Suspensão', icone: 'shield-exclamation' },
];

const opcoesTags = Object.entries(TAGS_COMPORTAMENTO).map(([valor, info]) => ({
  valor,
  rotulo: info.rotulo,
  icone: info.icone,
}));

const rotuloTipo = computed(() => {
  if (tipos.value.includes('suspensao')) return 'suspensão';
  if (tipos.value.includes('grave')) return 'ocorrência grave';
  return 'ocorrência';
});

const descricaoSugerida = computed(() => {
  if (!tags.value.length) return '';
  const nomes = tags.value.map((t) => opcoesTags.find((o) => o.valor === t)?.rotulo ?? t);
  return `Relato de ${rotuloTipo.value}: ${nomes.join(', ')}. `;
});

const contadorDescricao = computed(() => descricao.value.length);

function aplicarTags() {
  if (!descricao.value.startsWith('Relato de')) {
    descricao.value = descricaoSugerida.value;
  } else {
    const resto = descricao.value.split('. ').slice(1).join('. ');
    descricao.value = descricaoSugerida.value + resto;
  }
}

async function confirmar() {
  if (!usuario.value || !alunoId.value) {
    mensagemErro.value = 'Selecione um aluno.';
    return;
  }
  if (!tipos.value.length) {
    mensagemErro.value = 'Selecione o tipo de ocorrência.';
    return;
  }
  if (descricao.value.trim().length < 10) {
    mensagemErro.value = 'Descreva a ocorrência com pelo menos 10 caracteres.';
    return;
  }
  const ok = await registrarOcorrenciaGrave(
    alunoId.value,
    usuario.value.id,
    descricao.value.trim(),
    tipos.value,
    exigePresenca.value,
    tags.value,
    notificarCoordenacao.value,
    notificarResponsavel.value,
  );
  if (ok) {
    mensagemSucesso.value = 'Ocorrência registrada com sucesso!';
    alunoId.value = '';
    descricao.value = '';
    tags.value = [];
    notificarCoordenacao.value = true;
    notificarResponsavel.value = false;
    exigePresenca.value = false;
    await nextTick();
    requestAnimationFrame(() => {
      document
        .querySelector('.alert-success')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    setTimeout(() => (mensagemSucesso.value = null), 4000);
  } else {
    mensagemErro.value = 'Falha ao registrar ocorrência. Tente novamente.';
  }
}

onMounted(async () => {
  alunos.value = await buscarAlunosParaFrequencia();
});
</script>

<template>
  <div class="container py-4" style="max-width: 800px">
    <div class="d-flex gap-2 mb-3">
      <router-link to="/professor" class="btn btn-sm btn-outline-success">
        <i class="bi bi-house me-1" aria-hidden="true"></i>
        Início
      </router-link>
      <button type="button" class="btn btn-sm btn-outline-secondary" @click="router.back()">
        <i class="bi bi-arrow-left me-1" aria-hidden="true"></i>
        Voltar
      </button>
    </div>

    <h1 class="h5 fw-bold mb-3">
      <i class="bi bi-exclamation-triangle text-success me-2" aria-hidden="true"></i>
      Registrar ocorrência grave
    </h1>

    <div class="alert alert-warning d-flex align-items-start gap-2 small py-2 mb-3" role="note">
      <i class="bi bi-shield-exclamation mt-1" aria-hidden="true"></i>
      <span
        >Use apenas para comportamentos extremos que ameacem a permanência do aluno na escola.</span
      >
    </div>

    <div v-if="mensagemSucesso" class="alert alert-success py-2 small mb-3" role="status">
      <i class="bi bi-check-circle me-1" aria-hidden="true"></i>
      {{ mensagemSucesso }}
    </div>
    <div v-if="mensagemErro" class="alert alert-danger py-2 small mb-3" role="alert">
      <i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>
      {{ mensagemErro }}
    </div>

    <div class="card border">
      <div class="card-body">
        <CampoFormulario id="alunoSelect" label="Aluno" :obrigatorio="true">
          <select
            id="alunoSelect"
            v-model="alunoId"
            class="form-select form-select-sm"
            :disabled="!alunos.length"
          >
            <option value="" disabled>Selecione um aluno</option>
            <option v-for="a in alunos" :key="a.id" :value="a.id">
              {{ a.nome }} — {{ a.turma || 'Sem turma' }}
            </option>
          </select>
        </CampoFormulario>

        <CampoFormulario id="tipoOcorrencia" label="Tipo de ocorrência" :obrigatorio="true">
          <div class="d-flex gap-2">
            <CartaoSelecao
              v-for="op in opcoesTipo"
              :key="op.valor"
              :selecionado="tipos.includes(op.valor)"
              :variante="op.valor === 'suspensao' ? 'danger' : 'warning'"
              @click="
                tipos = tipos.includes(op.valor)
                  ? tipos.filter((t) => t !== op.valor)
                  : [...tipos, op.valor]
              "
            >
              <i :class="`bi bi-${op.icone} me-1`" aria-hidden="true"></i>
              {{ op.rotulo }}
            </CartaoSelecao>
          </div>
        </CampoFormulario>

        <CampoFormulario
          id="tagsComportamento"
          label="Tags de comportamento (preenchimento rápido)"
          dica="Selecione para compor a descrição automaticamente"
        >
          <GrupoCheckbox
            nome="tag"
            :opcoes="opcoesTags"
            :modelo="tags"
            :colunas="2"
            @update:modelo="
              (v) => {
                tags = v;
                aplicarTags();
              }
            "
          />
        </CampoFormulario>

        <CampoFormulario
          id="descricaoText"
          label="Descrição"
          :obrigatorio="true"
          :maxlength="1000"
          :contador="contadorDescricao"
        >
          <textarea
            id="descricaoText"
            v-model="descricao"
            class="form-control form-control-sm"
            :class="{ 'is-invalid': mensagemErro && descricao.trim().length < 10 }"
            rows="4"
            placeholder="Descreva objetivamente o comportamento. Mínimo 10 caracteres."
            maxlength="1000"
          ></textarea>
        </CampoFormulario>

        <div class="mb-3">
          <label class="form-label small fw-medium">Notificações</label>
          <div class="d-flex gap-3 flex-wrap">
            <div class="form-check">
              <input
                id="notifCoordenacao"
                v-model="notificarCoordenacao"
                type="checkbox"
                class="form-check-input"
              />
              <label for="notifCoordenacao" class="form-check-label small">
                <i class="bi bi-megaphone me-1" aria-hidden="true"></i>
                Notificar coordenação
              </label>
            </div>
            <div class="form-check">
              <input
                id="notifResponsavel"
                v-model="notificarResponsavel"
                type="checkbox"
                class="form-check-input"
              />
              <label for="notifResponsavel" class="form-check-label small">
                <i class="bi bi-person-badge me-1" aria-hidden="true"></i>
                Notificar responsável
              </label>
            </div>
            <div class="form-check">
              <input
                id="exigePresenca"
                v-model="exigePresenca"
                type="checkbox"
                class="form-check-input"
              />
              <label for="exigePresenca" class="form-check-label small">
                <i class="bi bi-house-door me-1" aria-hidden="true"></i>
                Exigir presença do responsável na escola
              </label>
            </div>
          </div>
        </div>

        <div class="d-flex gap-2 justify-content-end">
          <button type="button" class="btn btn-sm btn-outline-secondary" @click="router.back()">
            Cancelar
          </button>
          <button
            type="button"
            class="btn btn-sm btn-success"
            :disabled="carregando || !alunoId"
            @click="confirmar"
          >
            <span
              v-if="carregando"
              class="spinner-border spinner-border-sm me-1"
              role="status"
            ></span>
            <i v-else class="bi bi-exclamation-octagon me-1" aria-hidden="true"></i>
            Registrar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
