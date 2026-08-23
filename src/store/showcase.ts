import { create } from 'zustand';
import type { ShowcaseEvent } from '@/api/types';

/**
 * O que os outros estão exibindo agora (briefing §21).
 *
 * Fica fora do TanStack Query porque não é dado do servidor que se busca: é
 * empurrado pelo WebSocket, vale por alguns segundos e não deve sobreviver a
 * uma recarga da tela.
 *
 * São duas coisas separadas de propósito. `avisos` é a fila de notificações
 * que aparecem sobre a tela atual; `aberto` é a exibição que o usuário
 * escolheu ver. Fechar o painel não faz o aviso voltar, e um aviso ignorado
 * some sozinho sem nunca abrir painel nenhum.
 */
const MAXIMO_DE_AVISOS = 3;

type ShowcaseState = {
  avisos: ShowcaseEvent[];
  aberto: ShowcaseEvent | null;

  receber: (evento: ShowcaseEvent) => void;
  dispensar: (id: string) => void;
  abrir: (evento: ShowcaseEvent) => void;
  fechar: () => void;
  limpar: () => void;
};

export const useShowcaseStore = create<ShowcaseState>((set) => ({
  avisos: [],
  aberto: null,

  receber: (evento) =>
    set((estado) => {
      // O mesmo evento pode chegar duas vezes se o socket reconectar no meio
      // do envio; a chave é o id da exibição, não o do item.
      if (estado.avisos.some((aviso) => aviso.id === evento.id)) {
        return estado;
      }

      // Numa cena movimentada vários jogadores exibem quase junto. Guardamos
      // os últimos e descartamos os mais antigos — empilhar dez avisos cobriria
      // a tela inteira, que é justamente o que não pode acontecer aqui.
      return { avisos: [...estado.avisos, evento].slice(-MAXIMO_DE_AVISOS) };
    }),

  dispensar: (id) => set((estado) => ({ avisos: estado.avisos.filter((aviso) => aviso.id !== id) })),

  // Abrir consome o aviso: o usuário já respondeu a ele.
  abrir: (evento) =>
    set((estado) => ({
      aberto: evento,
      avisos: estado.avisos.filter((aviso) => aviso.id !== evento.id),
    })),

  fechar: () => set({ aberto: null }),

  /** Usado no logout: o que a conta anterior recebeu não é da próxima. */
  limpar: () => set({ avisos: [], aberto: null }),
}));
