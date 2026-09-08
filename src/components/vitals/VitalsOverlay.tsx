import { useEffect, useMemo, useState } from 'react';
import { useCharacters } from '@/hooks/useCharacters';
import { useVitalsStore } from '@/store/vitals';
import { VitalsPill } from './VitalsPill';
import { VitalsSheet } from './VitalsSheet';

/**
 * Marcador de vida e mana, montado uma vez na área logada (briefing §19).
 *
 * O jogador passa a sessão fora da aba Combate — no grimório procurando a
 * magia, nas anotações, no palco da mesa — e é justamente aí que o mestre
 * anuncia o dano. A pastilha existe para que PV e PM estejam à vista em
 * qualquer tela, e o painel dela para que subtrair a mana da magia não custe
 * três toques de navegação e a perda do lugar onde ele estava.
 *
 * Fica irmão da pilha de telas, como os outros overlays: nenhuma rota precisa
 * saber que ele existe, e trocar de tela não o desmonta.
 */

/**
 * De quanto em quanto tempo a pastilha reconfere os números com o servidor.
 *
 * O dano quase sempre chega de fora — é o mestre que aplica —, e o evento de
 * PV só é transmitido no canal da campanha, que só está assinado nas telas da
 * mesa. Fora delas, esta é a rede que impede a pastilha de mostrar um número
 * velho. O React Query pausa o intervalo quando a janela perde o foco, então
 * o app em segundo plano não fica batendo na API.
 */
const INTERVALO_DE_CONFERENCIA = 20_000;

export function VitalsOverlay({
  /** Quanto do rodapé está ocupado na tela em que a pastilha aparece. */
  folgaDoRodape,
}: {
  folgaDoRodape?: number;
} = {}) {
  const hidratado = useVitalsStore((estado) => estado.hidratado);
  const hidratar = useVitalsStore((estado) => estado.hidratar);
  const characterId = useVitalsStore((estado) => estado.characterId);
  const oculto = useVitalsStore((estado) => estado.oculto);
  const escolher = useVitalsStore((estado) => estado.escolher);

  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    void hidratar();
  }, [hidratar]);

  // A lista das fichas do jogador já traz PV e PM prontos, e é a mesma chave de
  // cache que a aba Personagens usa: manter o marcador nela evita uma segunda
  // consulta e faz as duas telas concordarem sempre.
  const fichas = useCharacters({ refetchInterval: INTERVALO_DE_CONFERENCIA, enabled: hidratado && !oculto });

  const minhas = useMemo(() => fichas.data ?? [], [fichas.data]);

  const escolhida = useMemo(() => {
    const marcada = minhas.find((ficha) => ficha.id === characterId);
    if (marcada) return marcada;

    // Sem escolha guardada (ou com a ficha apagada), o marcador assume a de
    // movimento mais recente: é a que o jogador está usando na mesa, e assim
    // ele não precisa configurar nada para ver o marcador funcionando.
    return [...minhas].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))[0] ?? null;
  }, [minhas, characterId]);

  useEffect(() => {
    if (escolhida && escolhida.id !== characterId) {
      escolher(escolhida.id);
    }
  }, [escolhida, characterId, escolher]);

  if (!hidratado || oculto || !escolhida) {
    return null;
  }

  return (
    <>
      <VitalsPill ficha={escolhida} folgaDoRodape={folgaDoRodape} onPress={() => setAberto(true)} />

      <VitalsSheet
        characterId={escolhida.id}
        fichas={minhas}
        visible={aberto}
        onClose={() => setAberto(false)}
      />
    </>
  );
}
