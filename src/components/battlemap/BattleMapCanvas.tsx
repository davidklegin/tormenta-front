import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme';
import type { BattleMapState, BattleMapToken, FogRegion } from '@/api/types';
import { MapToken } from './MapToken';
import {
  celulasDaArea,
  celulasDaNevoa,
  distanciaEmMetros,
  formatarDistancia,
  METROS_POR_QUADRADO,
  nomeDaCelula,
  nomeDaColuna,
  nomeDaLinha,
  retanguloComoPoligono,
  type Celula,
} from './geometry';



/** O que o dedo faz ao tocar o tabuleiro. */
export type ModoDoTabuleiro = 'navegar' | 'medir' | 'nevoa' | 'area';

type Props = {
  battleMap: BattleMapState;
  /** Fichas desta pessoa — definem quais peças ela arrasta. */
  minhasFichas: number[];
  ehMestre: boolean;
  modo: ModoDoTabuleiro;
  tokenSelecionado: number | null;
  onSelecionarToken: (tokenId: number | null) => void;
  onMoverToken: (tokenId: number, x: number, y: number) => void;
  onPintarNevoa?: (regiao: FogRegion) => void;
  onMarcarArea?: (celula: Celula, direcaoEmGraus: number | null, alcance: number | null) => void;
  /** Tocar uma área já marcada a apaga — é como se desfaz o que se marcou. */
  onRemoverArea?: (efeitoId: string) => void;
  /** Muda de valor quando a barra pede o mapa de volta ao centro. */
  pedidoDeCentralizar?: number;
  /**
   * Tabuleiro de olhar, não de mexer — a tela de TV.
   *
   * Pan e zoom continuam: alguém precisa poder aproximar o canto do salão na
   * tela grande. O que sai é a seleção e o arrasto de peça, que ali só
   * produziriam movimentos que ninguém pediu.
   */
  somenteLeitura?: boolean;
};

const ZOOM_MINIMO = 0.35;
const ZOOM_MAXIMO = 3;

/**
 * Quanto o quadrado abre maior do que o estritamente necessário para o mapa
 * caber na tela.
 *
 * O enquadramento automático espremia o tabuleiro até a última borda entrar, e
 * o que sobrava era um quadrado de meio centímetro: a mesa lia a grade, mas não
 * a peça dentro dela. Quinze por cento a mais resolvem a leitura e custam uma
 * fatia estreita das bordas, que volta com um arrastar de dedo — e o mapa
 * continua centrado, então o que sai de vista é metade disso de cada lado.
 *
 * Vale só onde há mão: na tela da TV ninguém vai arrastar o mapa de volta, e
 * ali o que sair da borda fica perdido para a mesa inteira.
 */
const AMPLIACAO_DA_GRADE = 1.15;

/**
 * O tabuleiro desenhado.
 *
 * Tudo o que o mapa mostra é *célula*, não pixel: a névoa cobre quadrados, a
 * bola de fogo pega quadrados, a régua conta quadrados. É como as regras da
 * mesa falam — "você está dentro da área?" é sempre uma pergunta sobre o
 * quadrado onde a peça está —, e tem o efeito colateral de dispensar uma
 * biblioteca de desenho vetorial: retângulo de célula, o React Native desenha.
 */
export function BattleMapCanvas({
  battleMap,
  minhasFichas,
  ehMestre,
  modo,
  tokenSelecionado,
  onSelecionarToken,
  onMoverToken,
  onPintarNevoa,
  onMarcarArea,
  onRemoverArea,
  pedidoDeCentralizar = 0,
  somenteLeitura = false,
}: Props) {
  const { colors, isDark } = useTheme();

  const grid = battleMap.grid;
  const lado = grid?.scale ?? 50;
  const colunas = grid?.width ?? 20;
  const linhas = grid?.height ?? 15;
  const larguraMapa = colunas * lado;
  const alturaMapa = linhas * lado;

  /**
   * Até onde o enquadramento automático pode ampliar.
   *
   * Na TV o mapa preenche a tela: um tabuleiro pequeno projetado a três metros
   * de distância, com metade da tela em volta vazia, não serve para nada. Nas
   * telas de trabalho o teto fica em 1 — ampliar sozinho um mapa de dez
   * quadrados deixaria o mestre com quatro quadrados à vista ao abrir, e ele
   * está ali para ver a cena inteira.
   */
  const zoomDeAbertura = somenteLeitura ? ZOOM_MAXIMO : AMPLIACAO_DA_GRADE;

  /** Ver `AMPLIACAO_DA_GRADE`: a TV continua enquadrando o mapa inteiro. */
  const ampliacao = somenteLeitura ? 1 : AMPLIACAO_DA_GRADE;

  const escala = useSharedValue(1);
  const escalaSalva = useSharedValue(1);
  const deslocX = useSharedValue(0);
  const deslocY = useSharedValue(0);
  const deslocSalvoX = useSharedValue(0);
  const deslocSalvoY = useSharedValue(0);

  // Quem está sendo arrastado, e para onde. Vive em shared values porque o
  // arrasto inteiro acontece no worklet — a peça acompanha o dedo sem passar
  // pelo React, e só o "soltar" volta para a thread de JS.
  const idArrastado = useSharedValue(-1);
  const arrastoX = useSharedValue(0);
  const arrastoY = useSharedValue(0);

  // Onde o dedo pousou, gravado no primeiro contato. O `onStart` do Pan só
  // chega depois de alguns pixels de movimento e já traz a translação zerada,
  // então lá não há mais como saber de onde o gesto partiu.
  const toqueX = useSharedValue(0);
  const toqueY = useSharedValue(0);

  // As peças que esta pessoa pode mover, no formato que o worklet consegue
  // ler. É a tabela do acerto-e-erro do toque: dado o quadrado sob o dedo,
  // qual peça está ali.
  const pecasArrastaveis = useSharedValue<{ id: number; x: number; y: number; size: number }[]>([]);

  const [regua, setRegua] = useState<{ de: Celula; para: Celula } | null>(null);
  const [cantoDaNevoa, setCantoDaNevoa] = useState<Celula | null>(null);

  /**
   * Trocar de ferramenta limpa o que a anterior deixou desenhado.
   *
   * A régua sobrevive ao soltar o dedo de propósito — a mesa mede e depois lê
   * o número. Mas ela sobrevivia também à troca de ferramenta: o traço dourado
   * e a distância ficavam atravessados no mapa durante todo o combate, e a
   * única forma de tirá-los era voltar para Medir e medir outra coisa. O mesmo
   * valia para o canto de névoa começado e abandonado.
   */
  useEffect(() => {
    setRegua(null);
    setCantoDaNevoa(null);
  }, [modo]);

  /**
   * Atualiza o ponto "para" da régua sem trocar o "de".
   *
   * Precisa ser uma função separada porque `runOnJS` não pode serializar uma
   * função de callback do React (a forma `setRegua(atual => ...)`) — funções
   * não atravessam a ponte worklet→JS. Passando apenas o objeto {x, y}, o
   * worklet consegue serializar o argumento e a atualização acontece.
   */
  const atualizarReguaPara = useCallback((para: Celula) => {
    setRegua((atual) => (atual ? { de: atual.de, para } : atual));
  }, []);

  // Quantos quadrados a peça já andou, enquanto o dedo ainda está na tela. É a
  // pergunta que a mesa faz em voz alta no meio do movimento — "dá pra chegar
  // nele?" — e responder só depois de soltar chega tarde.
  const [passosDoArrasto, setPassosDoArrasto] = useState<number | null>(null);

  const janela = useRef({ largura: 0, altura: 0 });

  // Os callbacks vindos da tela mudam de identidade a cada render — as
  // mutations do React Query não são estáveis. Se um gesto depender deles, o
  // GestureDetector recebe um objeto novo no meio do arrasto e o cancela sem
  // erro nenhum. Por isso os gestos leem daqui, e não das props.
  const acoes = useRef({ onMarcarArea, onMoverToken, onRemoverArea });

  // O que já está marcado no chão, para o gesto saber o que há sob o dedo sem
  // depender de props que mudam de identidade a cada render.
  const cenario = useRef({ efeitos: battleMap.area_effects, colunas, linhas });

  useEffect(() => {
    acoes.current = { onMarcarArea, onMoverToken, onRemoverArea };
    cenario.current = { efeitos: battleMap.area_effects, colunas, linhas };
  });

  const podeMover = useCallback(
    (token: BattleMapToken) => {
      if (somenteLeitura) return false;
      if (ehMestre) return true;
      if (token.entity_type !== 'player_character') return false;

      return token.entity_id !== null && minhasFichas.includes(token.entity_id);
    },
    [ehMestre, minhasFichas, somenteLeitura]
  );

  useEffect(() => {
    pecasArrastaveis.value = battleMap.tokens
      .filter(podeMover)
      .map((token) => ({
        id: token.id,
        x: token.position.x,
        y: token.position.y,
        size: token.size,
      }));
  }, [battleMap.tokens, podeMover, pecasArrastaveis]);

  const soltarPeca = useCallback(
    (tokenId: number, deslocPixelX: number, deslocPixelY: number) => {
      const peca = battleMap.tokens.find((t) => t.id === tokenId);
      if (!peca) return;

      acoes.current.onMoverToken(
        tokenId,
        Math.round(peca.position.x + deslocPixelX / lado),
        Math.round(peca.position.y + deslocPixelY / lado)
      );
    },
    [battleMap.tokens, lado]
  );

  const enquadrar = useCallback(
    (evento: LayoutChangeEvent) => {
      const { width, height } = evento.nativeEvent.layout;

      janela.current = { largura: width, altura: height };

      if (width <= 0 || larguraMapa <= 0) return;

      // Abre com o mapa à vista, e um pouco maior que o exato — ver
      // `AMPLIACAO_DA_GRADE`. Entrar no tabuleiro com o zoom em 1 mostraria um
      // canto do salão e deixaria a mesa procurando as peças; entrar com o
      // enquadramento exato mostra o salão inteiro e nenhuma peça legível.
      const cabe = Math.min(width / larguraMapa, height / alturaMapa) * ampliacao;
      const inicial = Math.min(zoomDeAbertura, Math.max(ZOOM_MINIMO, cabe));

      escala.value = inicial;
      escalaSalva.value = inicial;
      deslocX.value = (width - larguraMapa * inicial) / 2;
      deslocY.value = (height - alturaMapa * inicial) / 2;
      deslocSalvoX.value = deslocX.value;
      deslocSalvoY.value = deslocY.value;
    },
    [
      larguraMapa, alturaMapa, zoomDeAbertura, ampliacao,
      escala, escalaSalva, deslocX, deslocY, deslocSalvoX, deslocSalvoY,
    ]
  );

  /**
   * O mapa de volta ao centro, enquadrado.
   *
   * Sem esta saída, quem arrastasse o tabuleiro para fora da tela ficaria com
   * um retângulo vazio e nenhuma pista de para que lado voltar.
   */
  useEffect(() => {
    if (pedidoDeCentralizar === 0) return;

    const { largura, altura } = janela.current;
    if (largura <= 0 || larguraMapa <= 0) return;

    const cabe = Math.min(largura / larguraMapa, altura / alturaMapa) * ampliacao;
    const proxima = Math.min(zoomDeAbertura, Math.max(ZOOM_MINIMO, cabe));
    const centroX = (largura - larguraMapa * proxima) / 2;
    const centroY = (altura - alturaMapa * proxima) / 2;

    escala.value = withTiming(proxima, { duration: 220 });
    deslocX.value = withTiming(centroX, { duration: 220 });
    deslocY.value = withTiming(centroY, { duration: 220 });

    escalaSalva.value = proxima;
    deslocSalvoX.value = centroX;
    deslocSalvoY.value = centroY;
  }, [
    pedidoDeCentralizar, larguraMapa, alturaMapa, zoomDeAbertura, ampliacao,
    escala, escalaSalva, deslocX, deslocY, deslocSalvoX, deslocSalvoY,
  ]);

  /** Converte um toque na tela para o quadrado sob ele. */
  const celulaDoToque = useCallback(
    (telaX: number, telaY: number): Celula => ({
      x: Math.floor((telaX - deslocX.value) / escala.value / lado),
      y: Math.floor((telaY - deslocY.value) / escala.value / lado),
    }),
    [deslocX, deslocY, escala, lado]
  );

  const tocarNoTabuleiro = useCallback(
    (telaX: number, telaY: number) => {
      const celula = celulaDoToque(telaX, telaY);

      const foraDoMapa = celula.x < 0 || celula.y < 0 || celula.x >= colunas || celula.y >= linhas;
      if (foraDoMapa) return;

      // Na TV o toque não faz nada: o gesto que resta é arrastar e aproximar.
      if (somenteLeitura) return;

      // O modo Área não passa por aqui: o toque dele é resolvido no fim do
      // Pan (ver `fecharArea`), porque Tap e Pan simultâneos se atropelam.
      if (modo === 'area') return;

      if (modo === 'nevoa') {
        // Dois toques fecham um retângulo: no celular, desenhar polígono com
        // vértices é um gesto que não se acerta com o polegar.
        if (cantoDaNevoa === null) {
          setCantoDaNevoa(celula);
        } else {
          onPintarNevoa?.(retanguloComoPoligono(cantoDaNevoa, celula));
          setCantoDaNevoa(null);
        }

        return;
      }

      if (modo === 'medir') {
        setRegua((atual) =>
          atual === null || atual.para !== null ? { de: celula, para: celula } : atual
        );

        return;
      }

      // Modo navegar. Tocar numa peça a seleciona (ou a solta, se já estava
      // selecionada); tocar no chão com uma peça na mão a manda para lá.
      const sobODedo = battleMap.tokens.find(
        (peca) =>
          celula.x >= peca.position.x &&
          celula.x < peca.position.x + peca.size &&
          celula.y >= peca.position.y &&
          celula.y < peca.position.y + peca.size
      );

      if (sobODedo) {
        onSelecionarToken(tokenSelecionado === sobODedo.id ? null : sobODedo.id);

        return;
      }

      if (tokenSelecionado !== null) {
        // Só anda a peça que esta pessoa comanda. Sem esta guarda, o jogador
        // seleciona o dragão do mestre, toca no chão e a única resposta é um
        // 403 que a tela não mostra: a peça fica parada sem explicação.
        const naMao = battleMap.tokens.find((peca) => peca.id === tokenSelecionado);

        if (naMao && podeMover(naMao)) {
          onMoverToken(tokenSelecionado, celula.x, celula.y);
        }

        onSelecionarToken(null);
      }
    },
    [
      celulaDoToque,
      colunas,
      linhas,
      modo,
      somenteLeitura,
      battleMap.tokens,
      battleMap.area_effects,
      cantoDaNevoa,
      tokenSelecionado,
      podeMover,
      onMarcarArea,
      onPintarNevoa,
      onMoverToken,
      onSelecionarToken,
    ]
  );

  /**
   * Arrastar — a peça ou o mapa, decidido no primeiro toque.
   *
   * Um gesto só, aqui no tabuleiro, em vez de um gesto por peça aninhado
   * dentro deste. Gestos aninhados dentro de um container com `scale` não
   * recebem a translação certa no React Native Web: o `translationX` chega
   * zero e a peça nunca sai do lugar, sem erro nenhum. Com o gesto único, o
   * tabuleiro descobre pela conta do quadrado quem está sob o dedo, e a
   * mesma matemática vale em todas as plataformas.
   */
  const arrastar = useMemo(
    () =>
      Gesture.Pan()
        .averageTouches(true)
        .onTouchesDown((evento) => {
          const dedo = evento.allTouches[0];

          if (dedo) {
            toqueX.value = dedo.x;
            toqueY.value = dedo.y;
          }
        })
        .onStart(() => {
          // O acerto é medido de onde o dedo pousou. Num quadrado de 25px na
          // tela, começar a contar três pixels adiante já joga o resultado
          // para o quadrado vizinho.
          const celulaX = (toqueX.value - deslocX.value) / escala.value / lado;
          const celulaY = (toqueY.value - deslocY.value) / escala.value / lado;

          const sobODedo = pecasArrastaveis.value.find(
            (peca) =>
              celulaX >= peca.x &&
              celulaX < peca.x + peca.size &&
              celulaY >= peca.y &&
              celulaY < peca.y + peca.size
          );

          idArrastado.value = sobODedo ? sobODedo.id : -1;
        })
        .onUpdate((evento) => {
          if (idArrastado.value >= 0) {
            // O gesto mede a tela; a peça vive no mapa. Sem desfazer o zoom, com
            // o mapa afastado a peça correria muito mais do que o dedo.
            arrastoX.value = evento.translationX / escala.value;
            arrastoY.value = evento.translationY / escala.value;

            runOnJS(setPassosDoArrasto)(
              Math.abs(Math.round(arrastoX.value / lado)) +
                Math.abs(Math.round(arrastoY.value / lado))
            );

            return;
          }

          deslocX.value = deslocSalvoX.value + evento.translationX;
          deslocY.value = deslocSalvoY.value + evento.translationY;
        })
        .onEnd(() => {
          if (idArrastado.value >= 0) {
            runOnJS(soltarPeca)(idArrastado.value, arrastoX.value, arrastoY.value);

            return;
          }

          deslocSalvoX.value = deslocX.value;
          deslocSalvoY.value = deslocY.value;
        })
        .onFinalize(() => {
          // O deslocamento zera aqui, e não no onEnd: quem desenha a peça no
          // lugar novo é o estado otimista da mutação. Zerar antes disso a
          // faria piscar no lugar antigo por um quadro.
          idArrastado.value = -1;
          arrastoX.value = 0;
          arrastoY.value = 0;
          runOnJS(setPassosDoArrasto)(null);
        }),
    [
      deslocX, deslocY, deslocSalvoX, deslocSalvoY, escala, lado,
      idArrastado, arrastoX, arrastoY, toqueX, toqueY, pecasArrastaveis, soltarPeca,
    ]
  );

  const pinca = useMemo(
    () =>
      Gesture.Pinch()
        .onUpdate((evento) => {
          escala.value = Math.min(
            ZOOM_MAXIMO,
            Math.max(ZOOM_MINIMO, escalaSalva.value * evento.scale)
          );
        })
        .onEnd(() => {
          escalaSalva.value = escala.value;
        }),
    [escala, escalaSalva]
  );

  /**
   * Fecha a área desenhada por arrasto.
   *
   * Arrastar do conjurador até o alvo é o gesto que a mesa já faz com o dedo
   * na mesa de verdade, e é o único jeito de dar direção a um cone ou a uma
   * linha — sem ela, os dois sempre apontariam para o mesmo lado e não
   * serviriam para nada.
   */
  const fecharArea = useCallback(() => {
    setRegua((atual) => {
      if (!atual) return null;

      const dx = atual.para.x - atual.de.x;
      const dy = atual.para.y - atual.de.y;
      const alcance = Math.abs(dx) + Math.abs(dy);

      if (alcance > 0) {
        const graus = (Math.atan2(dy, dx) * 180) / Math.PI;
        acoes.current.onMarcarArea?.(atual.de, graus, alcance);

        return null;
      }

      // Dedo parado: ou apaga o que está embaixo, ou marca ali a forma
      // escolhida na barra. Sem isto, um toque no modo Área não fazia nada, e
      // apagar uma área só era possível pelo painel do tabuleiro — longe do
      // dedo que acabou de marcá-la.
      const { efeitos, colunas: largura, linhas: altura } = cenario.current;

      // De trás para frente: com duas sobrepostas, sai a de cima, que é a que
      // a pessoa está vendo e apontando.
      for (let i = efeitos.length - 1; i >= 0; i--) {
        const efeito = efeitos[i];
        if (efeito === undefined) continue;

        const pega = celulasDaArea(efeito, largura, altura).some(
          (c) => c.x === atual.de.x && c.y === atual.de.y
        );

        if (pega) {
          acoes.current.onRemoverArea?.(efeito.id);

          return null;
        }
      }

      acoes.current.onMarcarArea?.(atual.de, null, null);

      return null;
    });
  }, []);

  const reguaGesto = useMemo(
    () =>
      Gesture.Pan()
        .averageTouches(true)
        // A origem é gravada no primeiro contato, e não no `onStart`: o Pan só
        // começa depois de alguns pixels de movimento, e um dedo parado —
        // justamente o gesto de apagar uma área — nunca chegaria lá.
        .onTouchesDown((evento) => {
          // Dois dedos é pinça de zoom, não medida nem marcação: descarta o
          // que houver começado, senão soltar a pinça marcaria uma área.
          if (evento.allTouches.length > 1) {
            runOnJS(setRegua)(null);

            return;
          }

          const primeiro = evento.allTouches[0];
          if (!primeiro) return;

          const de = {
            x: Math.floor((primeiro.x - deslocX.value) / escala.value / lado),
            y: Math.floor((primeiro.y - deslocY.value) / escala.value / lado),
          };
          runOnJS(setRegua)({ de, para: de });
        })
        .onUpdate((evento) => {
          const para = {
            x: Math.floor((evento.x - deslocX.value) / escala.value / lado),
            y: Math.floor((evento.y - deslocY.value) / escala.value / lado),
          };
          runOnJS(setRegua)((atual: { de: Celula; para: Celula } | null) =>
            atual ? { de: atual.de, para } : atual
          );
        })
        // `onFinalize`, e não `onEnd`: o toque sem arrasto termina o gesto como
        // falha, e `onEnd` não dispara nesse caminho.
        .onFinalize(() => {
          if (modo === 'area') {
            runOnJS(fecharArea)();
          }
        }),
    [modo, deslocX, deslocY, escala, lado, fecharArea, atualizarReguaPara]
  );

  const toque = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(250)
        .onEnd((evento) => {
          runOnJS(tocarNoTabuleiro)(evento.x, evento.y);
        }),
    [tocarNoTabuleiro]
  );

  const gestos = useMemo(
    () =>
      // Medir e Área trabalham com o mesmo gesto de esticar uma linha, e o
      // toque fica de fora dos dois: em Simultaneous com o Pan, o Tap engolia
      // o arrasto e nenhuma das duas ferramentas respondia.
      modo === 'medir' || modo === 'area'
        ? Gesture.Simultaneous(pinca, reguaGesto)
        : Gesture.Simultaneous(pinca, arrastar, toque),
    [modo, pinca, reguaGesto, arrastar, toque]
  );

  const estiloDoMundo = useAnimatedStyle(() => ({
    transform: [
      { translateX: deslocX.value },
      { translateY: deslocY.value },
      { scale: escala.value },
    ],
  }));

  const celulasCobertas = useMemo(
    () => celulasDaNevoa(battleMap.fog_regions, colunas, linhas),
    [battleMap.fog_regions, colunas, linhas]
  );

  const areas = useMemo(
    () =>
      battleMap.area_effects.map((efeito) => ({
        efeito,
        celulas: celulasDaArea(efeito, colunas, linhas),
      })),
    [battleMap.area_effects, colunas, linhas]
  );

  if (!battleMap.id || grid === null) {
    return (
      <View style={[styles.vazio, { backgroundColor: colors.surfaceAlt }]}>
        <Text variant="body" tone="muted" center>
          Nenhum tabuleiro aberto.
        </Text>
      </View>
    );
  }

  const corDaGrade = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.14)';

  return (
    <View style={[styles.janela, { backgroundColor: colors.bg }]} onLayout={enquadrar}>
      <GestureDetector gesture={gestos}>
        <Animated.View style={styles.janela}>
          <Animated.View
            style={[
              styles.mundo,
              { width: larguraMapa, height: alturaMapa, backgroundColor: colors.surfaceAlt },
              estiloDoMundo,
            ]}
          >
            {battleMap.background_url && (
              // `pointerEvents="none"` não é enfeite: a imagem preenche o
              // tabuleiro inteiro e, sem isso, fica com todo toque que cai
              // sobre ela — arrastar o mapa, esticar a régua e pegar uma peça
              // param de funcionar no instante em que um mapa é carregado, e
              // continuam funcionando enquanto o fundo está vazio.
              <Image
                pointerEvents="none"
                source={{ uri: battleMap.background_url }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={150}
              />
            )}

            {areas.map(({ efeito, celulas }) => (
              <View key={efeito.id} pointerEvents="none">
                {celulas.map((celula) => (
                  <View
                    key={`${efeito.id}-${celula.x}-${celula.y}`}
                    style={{
                      position: 'absolute',
                      left: celula.x * lado,
                      top: celula.y * lado,
                      width: lado,
                      height: lado,
                      backgroundColor: efeito.color ?? colors.danger,
                      opacity: efeito.opacity ?? 0.3,
                    }}
                  />
                ))}
              </View>
            ))}

            <Grade colunas={colunas} linhas={linhas} lado={lado} cor={corDaGrade} />

            {/* As coordenadas vêm logo depois da grade, e não por cima de tudo:
                a peça precisa cobrir o rótulo do quadrado onde ela está — e
                quando ela está lá, ninguém precisa do rótulo. Por isso as
                réguas são desenhadas nas QUATRO bordas: com o grupo enfileirado
                na linha de cima, é a de baixo que continua legível. */}
            <Coordenadas colunas={colunas} linhas={linhas} lado={lado} />

            {/* A névoa vem depois da grade e antes das peças: cobre o cenário,
                mas não some com o personagem de quem está olhando. */}
            <View pointerEvents="none">
              {celulasCobertas.map((celula) => (
                <View
                  key={`fog-${celula.x}-${celula.y}`}
                  style={{
                    position: 'absolute',
                    left: celula.x * lado,
                    top: celula.y * lado,
                    width: lado,
                    height: lado,
                    // Preto, e não a cor de fundo do tema: no Pergaminho o
                    // fundo é bege claro, e a névoa sumia por cima de um mapa
                    // também claro. O que a névoa representa é escuridão.
                    backgroundColor: '#0b0a09',
                    // Para o mestre ela é translúcida: ele precisa enxergar o
                    // que cobriu para saber o que revelar em seguida.
                    opacity: ehMestre ? 0.55 : 0.97,
                  }}
                />
              ))}
            </View>

            {cantoDaNevoa && (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: cantoDaNevoa.x * lado,
                  top: cantoDaNevoa.y * lado,
                  width: lado,
                  height: lado,
                  borderWidth: 2,
                  borderColor: colors.accent,
                  backgroundColor: colors.accentFill,
                }}
              />
            )}

            {/* As peças não recebem ponteiro: quem descobre quem está sob o
                dedo é a conta do quadrado, no gesto único do tabuleiro. Com
                elas capturando o toque, o gesto do tabuleiro nem começava
                quando o dedo pousava em cima de uma. */}
            <View pointerEvents="none">
            {battleMap.tokens.map((token) => (
              <MapToken
                key={token.id}
                token={token}
                ladoDoQuadrado={lado}
                podeMover={podeMover(token)}
                selecionado={tokenSelecionado === token.id}
                idArrastado={idArrastado}
                arrastoX={arrastoX}
                arrastoY={arrastoY}
              />
            ))}
            </View>

            {regua && <Regua regua={regua} lado={lado} cor={colors.accent} />}
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {(regua || passosDoArrasto !== null) && (
        <View style={[styles.leitura, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="body">
            {regua
              ? formatarDistancia(distanciaEmMetros(regua.de, regua.para))
              : formatarDistancia((passosDoArrasto ?? 0) * METROS_POR_QUADRADO)}
          </Text>

          {/* De onde para onde, pelo nome dos quadrados: é assim que a mesa
              repete a medida em voz alta sem ter de apontar para a tela. */}
          {regua && (
            <Text variant="caption" tone="muted">
              {nomeDaCelula(regua.de)} → {nomeDaCelula(regua.para)}
            </Text>
          )}
        </View>
      )}

      {modo === 'nevoa' && (
        <View style={[styles.dica, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="caption" tone="muted">
            {cantoDaNevoa
              ? `Canto em ${nomeDaCelula(cantoDaNevoa)}. Toque no canto oposto.`
              : 'Toque num canto da área a cobrir.'}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * As linhas da grade.
 *
 * Uma View por linha, e não um quadrado por célula: um mapa de 30×20 tem 600
 * células e apenas 52 linhas.
 */
function Grade({
  colunas,
  linhas,
  lado,
  cor,
}: {
  colunas: number;
  linhas: number;
  lado: number;
  cor: string;
}) {
  const verticais = useMemo(() => Array.from({ length: colunas + 1 }, (_, i) => i), [colunas]);
  const horizontais = useMemo(() => Array.from({ length: linhas + 1 }, (_, i) => i), [linhas]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {verticais.map((i) => (
        <View
          key={`v${i}`}
          style={{
            position: 'absolute',
            left: i * lado,
            top: 0,
            width: StyleSheet.hairlineWidth,
            height: linhas * lado,
            backgroundColor: cor,
          }}
        />
      ))}
      {horizontais.map((i) => (
        <View
          key={`h${i}`}
          style={{
            position: 'absolute',
            left: 0,
            top: i * lado,
            width: colunas * lado,
            height: StyleSheet.hairlineWidth,
            backgroundColor: cor,
          }}
        />
      ))}
    </View>
  );
}

/**
 * As coordenadas da grade: letras nas colunas, números nas linhas.
 *
 * Existem para a mesa falar do tabuleiro em voz alta. Sem elas, "o goblin está
 * ali" precisa de um dedo apontando a tela — o que funciona na mesa de casa e
 * não funciona para quem joga pelo celular, nem quando a mesa olha a TV e o
 * mestre olha o computador dele.
 *
 * Ficam DENTRO da primeira linha e da primeira coluna, e não em réguas fora da
 * grade: fora, a faixa some da tela assim que o mapa é arrastado para o canto,
 * e é justamente quando o mapa está aproximado que alguém precisa nomear um
 * quadrado. Aqui elas acompanham o mapa em qualquer posição e zoom.
 *
 * Uma `View` por rótulo custa colunas + linhas — trinta e cinco num mapa de
 * 20×15 —, e não uma por quadrado.
 */
function Coordenadas({ colunas, linhas, lado }: { colunas: number; linhas: number; lado: number }) {
  const eixoX = useMemo(() => Array.from({ length: colunas }, (_, i) => i), [colunas]);
  const eixoY = useMemo(() => Array.from({ length: linhas }, (_, i) => i), [linhas]);

  // Acompanha o quadrado, com um piso: num mapa de 100 colunas o lado fica
  // pequeno, e uma letra de três pixels é sujeira na tela, não informação.
  const fonte = Math.max(8, Math.round(lado * 0.3));

  // Branco com sombra preta, e não a cor do tema: por baixo pode estar a
  // pedra clara de uma cripta ou o breu de uma caverna, e o rótulo precisa
  // continuar legível nos dois.
  const estiloDoRotulo = {
    position: 'absolute' as const,
    fontSize: fonte,
    lineHeight: Math.round(fonte * 1.25),
    color: 'rgba(255,255,255,0.92)',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    textAlign: 'center' as const,
  };

  const centradoNaLinha = (linha: number) =>
    linha * lado + Math.max(0, (lado - fonte * 1.25) / 2);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {eixoX.map((coluna) => (
        <Text
          key={`coluna-topo-${coluna}`}
          variant="caption"
          numberOfLines={1}
          style={[estiloDoRotulo, { left: coluna * lado, top: 1, width: lado }]}
        >
          {nomeDaColuna(coluna)}
        </Text>
      ))}

      {eixoX.map((coluna) => (
        <Text
          key={`coluna-base-${coluna}`}
          variant="caption"
          numberOfLines={1}
          style={[
            estiloDoRotulo,
            {
              left: coluna * lado,
              top: (linhas - 1) * lado + Math.max(0, lado - fonte * 1.25 - 1),
              width: lado,
            },
          ]}
        >
          {nomeDaColuna(coluna)}
        </Text>
      ))}

      {eixoY.map((linha) => (
        <Text
          key={`linha-esquerda-${linha}`}
          variant="caption"
          numberOfLines={1}
          style={[estiloDoRotulo, { left: 0, top: centradoNaLinha(linha), width: lado }]}
        >
          {nomeDaLinha(linha)}
        </Text>
      ))}

      {eixoY.map((linha) => (
        <Text
          key={`linha-direita-${linha}`}
          variant="caption"
          numberOfLines={1}
          style={[
            estiloDoRotulo,
            { left: (colunas - 1) * lado, top: centradoNaLinha(linha), width: lado },
          ]}
        >
          {nomeDaLinha(linha)}
        </Text>
      ))}
    </View>
  );
}

/** A régua: uma barra fina girada entre os centros dos dois quadrados. */
function Regua({
  regua,
  lado,
  cor,
}: {
  regua: { de: Celula; para: Celula };
  lado: number;
  cor: string;
}) {
  const x1 = (regua.de.x + 0.5) * lado;
  const y1 = (regua.de.y + 0.5) * lado;
  const x2 = (regua.para.x + 0.5) * lado;
  const y2 = (regua.para.y + 0.5) * lado;

  const comprimento = Math.hypot(x2 - x1, y2 - y1);
  const angulo = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;

  return (
    <View pointerEvents="none">
      <View
        style={{
          position: 'absolute',
          left: x1,
          top: y1 - 1.5,
          width: comprimento,
          height: 3,
          backgroundColor: cor,
          transform: [{ rotate: `${angulo}deg` }],
          transformOrigin: '0px 50%',
        }}
      />
      {[
        { x: x1, y: y1 },
        { x: x2, y: y2 },
      ].map((ponta, indice) => (
        <View
          key={indice}
          style={{
            position: 'absolute',
            left: ponta.x - 5,
            top: ponta.y - 5,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: cor,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  janela: {
    flex: 1,
    overflow: 'hidden',
  },
  mundo: {
    position: 'absolute',
    left: 0,
    top: 0,
    transformOrigin: '0px 0px',
  },
  vazio: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  leitura: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dica: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
