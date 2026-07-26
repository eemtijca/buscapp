export function safeDate(iso: string | null | undefined): Date {
  if (!iso) return new Date();
  const d = new Date(iso);
  return isNaN(d.getTime()) ? new Date() : d;
}

const CORES_AVATAR = [
  '#008241', '#1a73e8', '#d93025', '#f9ab00', '#129eaf',
  '#9334e6', '#e8710a', '#0d652d', '#1967d2', '#c5221f',
];

export function avatarIniciais(nome: string): string {
  return nome
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export function avatarCor(nome: string): string {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) {
    hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CORES_AVATAR[Math.abs(hash) % CORES_AVATAR.length] ?? '#008241';
}

export function timestampRelativo(iso: string): string {
  if (!iso) return '';
  const agora = new Date();
  const data = safeDate(iso);
  const diff = agora.getTime() - data.getTime();
  const diffMin = Math.floor(diff / 60000);
  const diffHoras = Math.floor(diff / 3600000);
  const diffDias = Math.floor(diff / 86400000);

  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin}min`;
  if (diffHoras < 6) return `${diffHoras}h`;

  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const ontem = new Date(hoje.getTime() - 86400000);
  const dataSemHora = new Date(data.getFullYear(), data.getMonth(), data.getDate());

  if (dataSemHora.getTime() === hoje.getTime()) {
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  if (dataSemHora.getTime() === ontem.getTime()) return 'Ontem';
  if (diffDias < 7) {
    return data.toLocaleDateString('pt-BR', { weekday: 'short' });
  }
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function truncarPreview(texto: string, max = 40): string {
  if (!texto) return '';
  const limpo = texto.replace(/\n/g, ' ');
  if (limpo.length <= max) return limpo;
  return limpo.slice(0, max).trimEnd() + '…';
}

export function formatarHorario(iso: string): string {
  if (!iso) return '';
  try {
    return safeDate(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function formatarData(iso: string): { data: string; horario: string } {
  if (!iso) return { data: '', horario: '' };
  try {
    const d = new Date(iso);
    return {
      data: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      horario: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
  } catch {
    return { data: iso, horario: '' };
  }
}

export function rotuloDataSeparador(iso: string): string {
  if (!iso) return '';
  const agora = new Date();
  const data = safeDate(iso);
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const ontem = new Date(hoje.getTime() - 86400000);
  const dataSemHora = new Date(data.getFullYear(), data.getMonth(), data.getDate());

  if (dataSemHora.getTime() === hoje.getTime()) return 'Hoje';
  if (dataSemHora.getTime() === ontem.getTime()) return 'Ontem';
  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export interface GrupoMensagem {
  rotulo: string;
  mensagens: import('@/tipos/componentes').MensagemChat[];
}

export function agruparPorData(mensagens: import('@/tipos/componentes').MensagemChat[]): GrupoMensagem[] {
  const grupos: GrupoMensagem[] = [];
  let rotuloAtual = '';

  for (const msg of mensagens) {
    const rotulo = rotuloDataSeparador(msg.dataIso);
    if (rotulo !== rotuloAtual) {
      rotuloAtual = rotulo;
      grupos.push({ rotulo, mensagens: [] });
    }
    grupos[grupos.length - 1]!.mensagens.push(msg);
  }

  return grupos;
}

export interface InfoAutor {
  nome: string;
  tipo: 'responsavel' | 'gestao' | 'professor';
}

export function mapearMensagemParaChat(
  msg: { id: string; conversa_id: string; remetente_id: string; conteudo: string; is_system_message: boolean; lida_em: string | null; created_at: string },
  autores: Map<string, InfoAutor>,
  userId: string,
): import('@/tipos/componentes').MensagemChat {
  const autor = autores.get(msg.remetente_id);
  const fmt = formatarData(msg.created_at);
  return {
    id: msg.id,
    conversaId: msg.conversa_id,
    remetenteId: msg.remetente_id,
    autor: autor?.tipo ?? 'gestao',
    nomeAutor: autor?.nome ?? 'Desconhecido',
    texto: msg.conteudo,
    horario: fmt.horario,
    data: fmt.data,
    dataIso: msg.created_at,
    isSistema: msg.is_system_message,
    minha: msg.remetente_id === userId,
    lida: msg.lida_em !== null,
  };
}
