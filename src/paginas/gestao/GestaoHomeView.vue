<script setup lang="ts">
import { useAutenticacao } from '@/composables/useAutenticacao';
import CartaoNavegacao from '@/componentes/CartaoNavegacao.vue';

const { usuario } = useAutenticacao();
const nomeGestor = usuario.value?.nome || 'Gestor';
</script>

<template>
  <div class="container py-4 py-md-5" style="max-width: 800px">
    <div class="text-center mb-4 mb-md-5">
      <span
        class="d-inline-flex align-items-center justify-content-center rounded-circle bg-success-subtle text-success mb-3"
        style="width: 64px; height: 64px; font-size: 1.75rem"
      >
        <i class="bi bi-shield-lock" aria-hidden="true"></i>
      </span>
      <h1 class="h4 fw-bold mb-1">Painel confidencial</h1>
      <p class="text-body-secondary small mb-0">
        Bem-vindo(a), {{ nomeGestor }}. Monitore e priorize ações contra a evasão escolar.
      </p>
    </div>

    <div class="row g-3 justify-content-center">
      <div class="col-12 col-md-6 col-lg-4">
        <CartaoNavegacao
          icone="bar-chart"
          titulo="Ranking de risco"
          descricao="Visualize alunos ordenados do caso mais crítico ao mais leve."
          rota="/gestao/ranking"
          cor="success"
        />
      </div>
      <div class="col-12 col-md-6 col-lg-4">
        <CartaoNavegacao
          icone="shield-exclamation"
          titulo="Ocorrências graves"
          descricao="Centralize suspensões, bloqueios de retorno e documentos."
          rota="/gestao/ocorrencias"
          cor="success"
        />
      </div>
      <div class="col-12 col-md-6 col-lg-4">
        <CartaoNavegacao
          icone="calendar-x"
          titulo="Infrequências"
          descricao="Registre faltas pontuais ou realize a chamada de qualquer turma."
          rota="/gestao/infrequencias"
          cor="success"
        />
      </div>
      <div class="col-12 col-md-6 col-lg-4">
        <CartaoNavegacao
          icone="clipboard-check"
          titulo="Justificativas"
          descricao="Valide ou recuse justificativas enviadas pelos responsáveis."
          rota="/gestao/justificativas"
          cor="success"
        />
      </div>
      <div class="col-12 col-md-6 col-lg-4">
        <CartaoNavegacao
          icone="people"
          titulo="Usuários"
          descricao="Gerencie professores, responsáveis e perfis de acesso."
          rota="/gestao/usuarios"
          cor="success"
        />
      </div>
      <div class="col-12 col-md-6 col-lg-4">
        <CartaoNavegacao
          icone="book"
          titulo="Alunos"
          descricao="Cadastre e acompanhe alunos e suas turmas."
          rota="/gestao/alunos"
          cor="success"
        />
      </div>
      <div class="col-12 col-md-6 col-lg-4">
        <CartaoNavegacao
          icone="key"
          titulo="Códigos"
          descricao="Gerencie códigos de redefinição de senha."
          rota="/gestao/codigos"
          cor="success"
        />
      </div>
      <div class="col-12 col-md-6 col-lg-4">
        <CartaoNavegacao
          icone="book"
          titulo="Turmas"
          descricao="Cadastre e gerencie as turmas da escola."
          rota="/gestao/turmas"
          cor="success"
        />
      </div>
      <div class="col-12 col-md-6 col-lg-4">
        <CartaoNavegacao
          icone="calendar3"
          titulo="Anos letivos"
          descricao="Gerencie anos letivos e realize a virada do ano."
          rota="/gestao/anos-letivos"
          cor="success"
        />
      </div>
      <div class="col-12 col-md-6 col-lg-4">
        <CartaoNavegacao
          icone="bookmark-star"
          titulo="Disciplinas"
          descricao="Cadastre as disciplinas oferecidas pela escola."
          rota="/gestao/disciplinas"
          cor="success"
        />
      </div>
      <div class="col-12 col-md-6 col-lg-4">
        <CartaoNavegacao
          icone="people"
          titulo="Atribuições"
          descricao="Gerencie a alocação de professores em turmas."
          rota="/gestao/atribuicoes"
          cor="success"
        />
      </div>
      <div class="col-12 col-md-6 col-lg-4">
        <CartaoNavegacao
          icone="chat-dots"
          titulo="Chat com pais"
          descricao="Converse com responsáveis sobre alunos monitorados."
          rota="/gestao/chat"
          cor="success"
        />
      </div>
      <div class="col-12 col-md-6 col-lg-4">
        <CartaoNavegacao
          icone="gear"
          titulo="Configurações"
          descricao="Gerencie módulos, permissões, períodos e demais opções do sistema."
          rota="/gestao/configuracao"
          cor="success"
        />
      </div>
    </div>
  </div>
</template>
