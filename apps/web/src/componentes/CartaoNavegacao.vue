<script setup lang="ts">
defineProps<{
  icone: string;
  titulo: string;
  descricao: string;
  rota: string;
  cor?: string;
}>();
</script>

<template>
  <router-link
    :to="rota"
    class="card card-nav text-decoration-none h-100"
    :class="cor ? 'card-nav--' + cor : ''"
  >
    <div class="card-body card-nav-body">
      <span
        class="d-inline-flex align-items-center justify-content-center rounded-circle card-nav-icon"
        :class="'bg-' + (cor || 'primary') + '-subtle text-' + (cor || 'primary')"
      >
        <i :class="'bi bi-' + icone" aria-hidden="true"></i>
      </span>
      <div class="card-nav-text">
        <h3 class="card-nav-title">{{ titulo }}</h3>
        <p class="card-nav-desc">{{ descricao }}</p>
      </div>
    </div>
  </router-link>
</template>

<style scoped>
.card-nav {
  border-radius: 12px;
  border: 1px solid var(--bs-border-color);
  transition:
    border-color 0.2s,
    background-color 0.2s,
    transform 0.15s;
  cursor: pointer;
}

.card-nav:hover {
  border-color: var(--bs-primary);
  background-color: var(--bs-primary-bg-subtle);
}

.card-nav:active {
  transform: scale(0.98);
}

.card-nav-body {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
}

.card-nav-icon {
  width: 48px;
  height: 48px;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.card-nav-text {
  min-width: 0;
  text-align: left;
}

.card-nav-title {
  font-size: 0.95rem;
  font-weight: 600;
  margin-bottom: 0.15rem;
  color: var(--bs-body-color);
}

.card-nav-desc {
  font-size: 0.8rem;
  color: var(--bs-secondary-color);
  margin-bottom: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (min-width: 768px) {
  .card-nav-body {
    flex-direction: column;
    justify-content: center;
    text-align: center;
    gap: 0;
    padding: 1.25rem 1rem;
  }

  .card-nav-icon {
    width: 56px;
    height: 56px;
    font-size: 1.5rem;
    margin-bottom: 0.75rem;
  }

  .card-nav-text {
    text-align: center;
  }

  .card-nav-title {
    font-size: 1rem;
  }
}
</style>
