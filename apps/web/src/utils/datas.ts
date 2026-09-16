/** Data civil de hoje no fuso local em `yyyy-mm-dd`. */
export function hojeIso(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

/** Converte uma data ISO para `dd/mm/aaaa`, preservando o dia civil quando possível. */
export function formatarData(iso: string): string {
  if (!iso) return '';
  const partes = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (partes?.[1] && partes[2] && partes[3]) return `${partes[3]}/${partes[2]}/${partes[1]}`;
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** Separa data e horário de um timestamp ISO. */
export function formatarDataHorario(iso: string): { data: string; horario: string } {
  if (!iso) return { data: '', horario: '' };
  const partes = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (partes?.[1] && partes[2] && partes[3]) {
    return { data: `${partes[3]}/${partes[2]}/${partes[1]}`, horario: '' };
  }
  try {
    const data = new Date(iso);
    return {
      data: data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      horario: data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
  } catch {
    return { data: iso, horario: '' };
  }
}

/** Dias civis entre duas datas ISO (`yyyy-mm-dd`). */
export function diasEntre(inicio: string, fim: string): number {
  const a = new Date(`${inicio}T00:00:00`);
  const b = new Date(`${fim}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/** Iniciais do nome para avatares e rótulos compactos. */
export function iniciaisDoNome(nome: string): string {
  return nome
    .split(' ')
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase();
}
