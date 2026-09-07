import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

/**
 * Marcador de vida e mana (briefing §19).
 *
 * Guarda o que o jogador escolheu para a pastilha flutuante: qual ficha ela
 * acompanha, onde ela mora na tela e se ele mandou sumir com ela. As três
 * coisas sobrevivem ao fechar do app — o marcador é do jogador, não da sessão,
 * e reposicionar a pastilha a cada abertura seria um imposto diário.
 *
 * A escrita é solta (sem `await`): ninguém espera o disco para ver o número
 * novo, e uma gravação perdida custa, no pior caso, a pastilha voltar ao canto
 * de origem.
 */
const CHAVE = 'tormenta20.vitals.marcador';

export type PosicaoDoMarcador = { x: number; y: number };

type Guardado = {
  characterId: number | null;
  oculto: boolean;
  posicao: PosicaoDoMarcador | null;
};

type VitalsState = Guardado & {
  /** Falso até o armazenamento responder — antes disso nada é desenhado. */
  hidratado: boolean;

  hidratar: () => Promise<void>;
  escolher: (characterId: number) => void;
  ocultar: () => void;
  mostrar: () => void;
  guardarPosicao: (posicao: PosicaoDoMarcador) => void;
};

function gravar({ characterId, oculto, posicao }: Guardado) {
  void AsyncStorage.setItem(CHAVE, JSON.stringify({ characterId, oculto, posicao })).catch(() => {});
}

export const useVitalsStore = create<VitalsState>((set, get) => ({
  hidratado: false,
  characterId: null,
  oculto: false,
  posicao: null,

  hidratar: async () => {
    if (get().hidratado) return;

    try {
      const bruto = await AsyncStorage.getItem(CHAVE);
      const guardado = bruto ? (JSON.parse(bruto) as Partial<Guardado>) : null;

      set({
        hidratado: true,
        characterId: typeof guardado?.characterId === 'number' ? guardado.characterId : null,
        oculto: guardado?.oculto === true,
        posicao:
          guardado?.posicao && typeof guardado.posicao.x === 'number' && typeof guardado.posicao.y === 'number'
            ? guardado.posicao
            : null,
      });
    } catch {
      // Armazenamento indisponível ou conteúdo corrompido: o marcador nasce no
      // padrão em vez de deixar a área logada sem ele.
      set({ hidratado: true });
    }
  },

  escolher: (characterId) => {
    set({ characterId });
    gravar({ ...get(), characterId });
  },

  ocultar: () => {
    set({ oculto: true });
    gravar({ ...get(), oculto: true });
  },

  mostrar: () => {
    set({ oculto: false });
    gravar({ ...get(), oculto: false });
  },

  guardarPosicao: (posicao) => {
    set({ posicao });
    gravar({ ...get(), posicao });
  },
}));
