<script setup lang="ts">
import CartaoNavegacao from '@/componentes/CartaoNavegacao.vue';

const categorias = [
  {
    icone: 'ui-checks',
    titulo: 'Módulos',
    descricao: 'Módulos disponíveis para professores',
    rota: '/gestao/configuracao/modulo',
    cor: 'success' as const,
  },
  {
    icone: 'file-earmark-text',
    titulo: 'Documentos',
    descricao: 'Tipos de documento dos alunos',
    rota: '/gestao/configuracao/documento',
    cor: 'success' as const,
  },
  {
    icone: 'calendar-event',
    titulo: 'Períodos',
    descricao: 'Períodos letivos e horários',
    rota: '/gestao/configuracao/periodo',
    cor: 'success' as const,
  },
  {
    icone: 'heart-pulse',
    titulo: 'Motivos de Ausência',
    descricao: 'Razões para ausência de alunos',
    rota: '/gestao/configuracao/motivo_ausencia',
    cor: 'success' as const,
  },
  {
    icone: 'exclamation-triangle',
    titulo: 'Tipos de Ocorrência',
    descricao: 'Classificação de ocorrências',
    rota: '/gestao/configuracao/tipo_ocorrencia',
    cor: 'success' as const,
  },
  {
    icone: 'people',
    titulo: 'Vínculos',
    descricao: 'Tipos de relação responsável/aluno',
    rota: '/gestao/configuracao/tipo_vinculo',
    cor: 'success' as const,
  },
  {
    icone: 'person-badge',
    titulo: 'Papéis de Atribuição',
    descricao: 'Papéis na atribuição de professores',
    rota: '/gestao/configuracao/papel_atribuicao',
    cor: 'success' as const,
  },
  {
    icone: 'book',
    titulo: 'Séries',
    descricao: 'Séries/anos disponíveis',
    rota: '/gestao/configuracao/serie_turma',
    cor: 'success' as const,
  },
  {
    icone: 'fonts',
    titulo: 'Letras de Turma',
    descricao: 'Letras para nomeação de turmas',
    rota: '/gestao/configuracao/letra_turma',
    cor: 'success' as const,
  },
  {
    icone: 'tags',
    titulo: 'Tags de Comportamento',
    descricao: 'Catálogo de tags comportamentais',
    rota: '/gestao/configuracao/tags',
    cor: 'success' as const,
  },
  {
    icone: 'gear',
    titulo: 'Sistema',
    descricao: 'Limites, prazos e nome da escola',
    rota: '/gestao/configuracao/sistema',
    cor: 'success' as const,
  },
  {
    icone: 'clock',
    titulo: 'Horários Letivos',
    descricao: 'Janelas de atendimento do chat',
    rota: '/gestao/configuracao/horarios',
    cor: 'success' as const,
  },
];
</script>

<template>
  <div class="container py-4 py-md-5" style="max-width: 800px">
    <router-link to="/gestao" class="btn btn-sm btn-outline-success">
      <i class="bi bi-arrow-left me-1" aria-hidden="true"></i>
      Voltar ao início
    </router-link>

    <div class="text-center mb-4 mb-md-5">
      <span
        class="d-inline-flex align-items-center justify-content-center rounded-circle bg-success-subtle text-success mb-3"
        style="width: 64px; height: 64px; font-size: 1.75rem"
      >
        <i class="bi bi-gear" aria-hidden="true"></i>
      </span>
      <h1 class="h4 fw-bold mb-1">Configurações</h1>
      <p class="text-body-secondary small mb-0">
        Gerencie todas as opções configuráveis do sistema.
      </p>
    </div>

    <div class="row g-3 justify-content-center">
      <div v-for="cat in categorias" :key="cat.rota" class="col-12 col-md-6 col-lg-4">
        <CartaoNavegacao
          :icone="cat.icone"
          :titulo="cat.titulo"
          :descricao="cat.descricao"
          :rota="cat.rota"
          :cor="cat.cor"
        />
      </div>
    </div>
  </div>
</template>
