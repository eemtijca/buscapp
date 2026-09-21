import { computed, ref, shallowRef, watch, type ComputedRef, type Ref } from 'vue';
import { api } from '@/servicos/api';
import { invalidarChave, invalidarTabela } from '@/servicos/cache';
import { Consultas } from '@/servicos/consultas';
import { useConsulta } from '@/composables/useConsulta';
import { avatarCor, safeDate } from '@/utils/chatUtils';
import { iniciaisDoNome } from '@/utils/datas';
import type { ContatoChat, MensagemChat } from '@/tipos/componentes';
import type { ConversaApi, MensagemApi } from '@/tipos/api';

/** Mesmo tamanho de página usado pela API para o cursor de mensagens. */
const LIMITE_MENSAGENS = 50;

function contatoDeConversa(conversa: ConversaApi, nomeContato: string): ContatoChat {
  const ultima = conversa.ultima_mensagem;
  return {
    conversaId: conversa.id,
    nomeContato,
    subtitulo: conversa.aluno?.nome
      ? conversa.aluno.nome +
        (conversa.turma?.nome_completo ? ' · ' + conversa.turma.nome_completo : '')
      : 'Coordenação Escolar',
    avatarIniciais: iniciaisDoNome(nomeContato),
    avatarCor: avatarCor(nomeContato),
    ultimaMensagem: ultima
      ? ultima.conteudo.replace(/\n/g, ' ').slice(0, 40)
      : 'Nenhuma mensagem ainda',
    ultimaData: ultima
      ? safeDate(ultima.created_at).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
        })
      : '',
    naoLidas: conversa.nao_lidas,
    ativa: conversa.ativa,
    iniciadaPelaGestao: conversa.iniciada_pela_gestao ?? false,
    alunoId: conversa.aluno?.id,
    turmaId: conversa.turma?.id,
  };
}

/** Contatos do chat conforme o papel: gestão vê todas as conversas; responsável vê os filhos. */
export function useContatosChat(
  papel: () => string,
  _usuarioId: () => string,
): {
  contatos: ComputedRef<ContatoChat[]>;
  pendente: Ref<boolean>;
  atualizando: Ref<boolean>;
  recarregar: () => Promise<void>;
} {
  const consultaConversas = useConsulta(() => Consultas.conversas());
  const consultaAlunos = useConsulta(() => ({
    ...Consultas.alunos(),
    habilitado: papel() === 'responsavel',
  }));

  const contatos = computed<ContatoChat[]>(() => {
    const conversas = consultaConversas.dados.value?.conversas ?? [];

    if (papel() === 'responsavel') {
      const filhos = consultaAlunos.dados.value?.alunos ?? [];
      const porAluno = new Map(conversas.map((conversa) => [conversa.aluno?.id, conversa]));
      const lista: ContatoChat[] = [];
      for (const filho of filhos) {
        const conversa = porAluno.get(filho.id);
        if (!conversa) continue;
        lista.push({
          conversaId: conversa.id,
          nomeContato: filho.nome,
          subtitulo: 'Coordenação Escolar',
          avatarIniciais: iniciaisDoNome(filho.nome),
          avatarCor: avatarCor(filho.nome),
          ultimaMensagem: conversa.ultima_mensagem
            ? conversa.ultima_mensagem.conteudo.replace(/\n/g, ' ').slice(0, 40)
            : 'Nenhuma mensagem ainda',
          ultimaData: conversa.ultima_mensagem
            ? safeDate(conversa.ultima_mensagem.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
              })
            : '',
          naoLidas: conversa.nao_lidas,
          ativa: true,
          alunoId: filho.id,
          turmaId: conversa.turma?.id,
        });
      }
      return lista;
    }

    return conversas.map((conversa) =>
      contatoDeConversa(conversa, conversa.responsavel?.nome ?? 'Responsável'),
    );
  });

  return {
    contatos,
    pendente: computed(() => consultaConversas.pendente.value && !consultaConversas.dados.value),
    atualizando: computed(
      () => consultaConversas.atualizando.value || consultaAlunos.atualizando.value,
    ),
    recarregar: () =>
      Promise.all([consultaConversas.recarregar(true), consultaAlunos.recarregar(true)]).then(
        () => undefined,
      ),
  };
}

/** Garante que cada filho do responsável tenha uma conversa aberta. */
export async function garantirConversasDosFilhos(alunoIds: string[]): Promise<void> {
  await Promise.all(
    alunoIds.map((alunoId) =>
      api('/api/conversas', { metodo: 'POST', corpo: { aluno_id: alunoId } }).catch(
        () => undefined,
      ),
    ),
  );
  invalidarChave('conversas');
  invalidarChave('notificacoes');
}

/** Detalhe da conversa aberta, com mensagens normalizadas para o painel. */
export function useConversaDetalhe(
  conversaId: () => string | null,
  usuarioId: () => string | undefined,
): {
  contato: ComputedRef<ContatoChat | null>;
  mensagens: ComputedRef<MensagemChat[]>;
  pendente: Ref<boolean>;
  temAnteriores: Ref<boolean>;
  carregandoAnteriores: Ref<boolean>;
  carregarAnteriores: () => Promise<void>;
  recarregar: () => Promise<void>;
} {
  const consultaConversas = useConsulta(() => Consultas.conversas());
  const consultaMensagens = useConsulta(() => ({
    ...Consultas.mensagens(conversaId() ?? ''),
    habilitado: Boolean(conversaId()),
  }));

  // Mensagens anteriores carregadas por cursor ficam fora do cache, acumuladas localmente.
  const anteriores = shallowRef<MensagemApi[]>([]);
  const carregandoAnteriores = ref(false);
  const temAnteriores = ref(true);

  watch(conversaId, () => {
    anteriores.value = [];
    temAnteriores.value = true;
  });

  async function carregarAnteriores(): Promise<void> {
    const id = conversaId();
    if (!id || carregandoAnteriores.value) return;

    const carregadas = [...anteriores.value, ...(consultaMensagens.dados.value?.mensagens ?? [])];
    const maisAntiga = carregadas[0];
    if (!maisAntiga) {
      temAnteriores.value = false;
      return;
    }

    carregandoAnteriores.value = true;
    try {
      const resposta = await api<{ mensagens: MensagemApi[] }>(`/api/conversas/${id}/mensagens`, {
        parametros: { limite: LIMITE_MENSAGENS, cursor: maisAntiga.id },
      });
      anteriores.value = [...resposta.mensagens, ...anteriores.value];
      if (resposta.mensagens.length < LIMITE_MENSAGENS) temAnteriores.value = false;
    } catch (erro) {
      console.error('[useChat] Erro ao carregar mensagens anteriores:', erro);
    } finally {
      carregandoAnteriores.value = false;
    }
  }

  const contato = computed<ContatoChat | null>(() => {
    const id = conversaId();
    if (!id) return null;
    const conversa = (consultaConversas.dados.value?.conversas ?? []).find(
      (registro) => registro.id === id,
    );
    if (!conversa) return null;
    return contatoDeConversa(conversa, conversa.responsavel?.nome ?? 'Responsável');
  });

  const mensagens = computed<MensagemChat[]>(() =>
    [...anteriores.value, ...(consultaMensagens.dados.value?.mensagens ?? [])].map(
      (mensagem: MensagemApi) => {
        const data = safeDate(mensagem.created_at);
        const autor = mensagem.autor;
        return {
          id: mensagem.id,
          conversaId: mensagem.conversa_id,
          remetenteId: mensagem.remetente_id,
          autor: autor?.papel ?? 'gestao',
          nomeAutor: autor?.nome ?? (mensagem.is_system_message ? 'Sistema' : 'Equipe escolar'),
          texto: mensagem.conteudo,
          horario: data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          data: data.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          }),
          dataIso: mensagem.created_at,
          isSistema: mensagem.is_system_message,
          minha: mensagem.remetente_id === usuarioId(),
          lida: mensagem.lida_em !== null,
        };
      },
    ),
  );

  return {
    contato,
    mensagens,
    pendente: computed(() => consultaMensagens.pendente.value),
    temAnteriores,
    carregandoAnteriores,
    carregarAnteriores,
    recarregar: () =>
      Promise.all([consultaConversas.recarregar(true), consultaMensagens.recarregar(true)]).then(
        () => undefined,
      ),
  };
}

export async function enviarMensagem(conversaId: string, conteudo: string): Promise<boolean> {
  try {
    await api(`/api/conversas/${conversaId}/mensagens`, {
      metodo: 'POST',
      corpo: { conteudo, client_request_id: crypto.randomUUID() },
    });
    invalidarTabela('mensagens', { conversa_id: conversaId }, false);
    invalidarChave('conversas', false);
    return true;
  } catch (erro) {
    console.error('[useChat] Erro ao enviar mensagem:', erro);
    return false;
  }
}

export async function marcarMensagensComoLidas(conversaId: string): Promise<void> {
  try {
    await api(`/api/conversas/${conversaId}/lidas`, { metodo: 'PATCH' });
    invalidarChave('conversas', false);
  } catch (erro) {
    console.error('[useChat] Erro ao marcar mensagens como lidas:', erro);
  }
}

export async function ocultarConversa(conversaId: string): Promise<boolean> {
  try {
    await api(`/api/conversas/${conversaId}`, {
      metodo: 'PATCH',
      corpo: { ativa: false },
    });
    invalidarChave('conversas', false);
    return true;
  } catch (erro) {
    console.error('[useChat] Erro ao ocultar conversa:', erro);
    return false;
  }
}

/** Abre (ou recupera) a conversa de um aluno para a gestão. */
export async function abrirConversaDoAluno(alunoId: string): Promise<string | null> {
  try {
    const { conversa } = await api<{ conversa: ConversaApi }>('/api/conversas', {
      metodo: 'POST',
      corpo: { aluno_id: alunoId },
    });
    invalidarChave('conversas', false);
    return conversa.id;
  } catch (erro) {
    console.error('[useChat] Erro ao abrir conversa:', erro);
    return null;
  }
}
