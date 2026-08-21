import { create } from 'zustand';

/**
 * Estado da sessão de jogo em andamento (não confundir com sessão de login).
 *
 * Guarda o que é da mesa e não vale a pena persistir: a campanha aberta no
 * Painel do Mestre e o estado da conexão de tempo real, usado para mostrar o
 * indicador "reconectando" quando o WebSocket cai.
 */
export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline';

type SessionState = {
  activeCampaignId: number | null;
  realtimeStatus: RealtimeStatus;
  lastEventAt: number | null;

  setActiveCampaign: (id: number | null) => void;
  setRealtimeStatus: (status: RealtimeStatus) => void;
  markEventReceived: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  activeCampaignId: null,
  realtimeStatus: 'idle',
  lastEventAt: null,

  setActiveCampaign: (id) => set({ activeCampaignId: id }),
  setRealtimeStatus: (status) => set({ realtimeStatus: status }),
  markEventReceived: () => set({ lastEventAt: Date.now() }),
}));
