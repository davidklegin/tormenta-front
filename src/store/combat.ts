import { create } from 'zustand';
import type { CombatTurnEvent } from '@/api/types';

/**
 * Os avisos de turno que chegaram para ESTE jogador.
 *
 * Fora do TanStack Query pelo mesmo motivo do showcase: não é dado que se
 * busca, é empurrado pelo socket e vale por alguns segundos.
 *
 * São dois estados separados de propósito. `alerta` é a vez dele agora — a
 * tela inteira pisca. `aviso` é "você é o próximo", uma faixa que não
 * interrompe nada. Se os dois compartilhassem um slot, o aviso de preparação
 * apagaria o alerta da vez em mesas rápidas, que é justamente onde o alerta
 * mais importa.
 */
type CombatAlertState = {
  alerta: CombatTurnEvent | null;
  aviso: CombatTurnEvent | null;

  receber: (evento: CombatTurnEvent) => void;
  dispensarAlerta: () => void;
  dispensarAviso: () => void;
  limpar: () => void;
};

export const useCombatAlertStore = create<CombatAlertState>((set) => ({
  alerta: null,
  aviso: null,

  receber: (evento) =>
    set(() =>
      evento.kind === 'current'
        ? // Chegou a vez: o aviso de preparação cumpriu o papel e sai de cena.
          { alerta: evento, aviso: null }
        : { aviso: evento }
    ),

  dispensarAlerta: () => set({ alerta: null }),
  dispensarAviso: () => set({ aviso: null }),

  /** Usado no logout: o turno da conta anterior não é da próxima. */
  limpar: () => set({ alerta: null, aviso: null }),
}));
