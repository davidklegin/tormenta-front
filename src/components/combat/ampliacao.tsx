import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PanResponder, Pressable, View, type LayoutChangeEvent } from 'react-native';
import { Icon, Text } from '@/components/ui';
import { spacing, stroke, useResponsive, useTheme } from '@/theme';

/**
 * Ampliar um quadro flutuante puxando-o pelo canto de baixo à esquerda.
 *
 * Serve à fila de iniciativa nas duas telas em que ela aparece — a coluna do
 * tabuleiro e o quadro virado para a mesa —, e o motivo é o mesmo nas duas: a
 * ordem de combate é lida a três metros de distância, de pé, por gente que não
 * vai chegar perto do aparelho para conferir de quem é a vez.
 *
 * A ampliação é um fator de escala sobre o quadro inteiro, e não uma largura
 * maior: o que precisa crescer é a letra, o retrato e o número — esticar só a
 * caixa daria os mesmos 11px de nome no meio de espaço vazio.
 *
 * O quadro cresce ancorado no canto de cima à direita porque é por ali que ele
 * encosta na borda da tela; crescer daquele canto é crescer para dentro.
 */

/** Onde o toque simples na alça leva, sem precisar mirar o arrasto. */
const ESCALA_DE_UM_TOQUE = 1.6;

/** Acima disto o quadro conta como ampliado (folga para o arredondamento). */
export const AMPLIADO = 1.02;

/** Teto de fábrica. Acima disto o quadro vira a tela inteira. */
const TETO = 2.4;

const CHAVE = 'tormenta20.iniciativa.tamanho';

type Opcoes = {
  /** Largura do quadro no tamanho de sempre. */
  largura: number;

  /** Quanto deixar de respiro entre o quadro ampliado e a borda da tela. */
  folga?: number;

  teto?: number;

  /**
   * Quando o quadro não encolhe por dentro, o teto também respeita a altura.
   *
   * A coluna do tabuleiro tem uma fila que rola, e reduz a própria altura para
   * caber; o quadro da mesa mostra a ordem inteira, sempre, e a única forma de
   * não o deixar passar da borda de baixo é não deixá-lo crescer tanto.
   */
  caberNaAltura?: boolean;

  /**
   * Nome sob o qual guardar o tamanho escolhido. Sem ele o tamanho vale só
   * enquanto a tela estiver aberta.
   *
   * A tela da TV fica ligada a noite inteira e é ajustada uma vez; refazer o
   * ajuste a cada recarga seria um imposto por sessão.
   */
  guardarComo?: string;
};

export type Ampliacao = {
  escala: number;
  ampliado: boolean;

  /** Vai no `onLayout` do quadro: mede a altura antes da escala. */
  aoMedir: (evento: LayoutChangeEvent) => void;

  /** Espalhado na alça — ver `AlcaDeAmpliar`. */
  panHandlers: ReturnType<typeof PanResponder.create>['panHandlers'];

  /** O caminho do teclado e do leitor de tela, que chegam por clique. */
  tocarPeloBotao: () => void;
};

export function useAmpliacao({
  largura,
  folga = spacing.xl,
  teto = TETO,
  caberNaAltura = false,
  guardarComo,
}: Opcoes): Ampliacao {
  const { width: janelaLargura, height: janelaAltura } = useResponsive();

  const [escala, setEscala] = useState(1);

  /* Altura de layout do quadro, antes da escala. Em estado, e não só em
     referência, porque o teto depende dela quando `caberNaAltura`. */
  const [altura, setAltura] = useState(0);

  const escalaMaxima = Math.max(
    1,
    Math.min(
      teto,
      (janelaLargura - folga) / largura,
      caberNaAltura && altura > 0 ? (janelaAltura - folga) / altura : teto
    )
  );

  const chave = guardarComo ? `${CHAVE}.${guardarComo}` : null;

  /* Escrita solta, como no marcador de vitais: ninguém espera o disco para ver
     o quadro crescer, e uma gravação perdida custa, no pior caso, refazer o
     ajuste na próxima abertura. */
  const guardar = (valor: number) => {
    if (chave) void AsyncStorage.setItem(chave, String(valor)).catch(() => {});
  };

  useEffect(() => {
    if (!chave) return;

    let vivo = true;

    void AsyncStorage.getItem(chave)
      .then((bruto) => {
        const guardado = Number(bruto);

        if (vivo && Number.isFinite(guardado) && guardado > 1) setEscala(guardado);
      })
      .catch(() => {});

    return () => {
      vivo = false;
    };
  }, [chave]);

  /*
    Janela menor — o mestre girou o tablet, ou encolheu a janela do navegador —
    traz o quadro de volta para dentro dela. Sem isto a ampliação escolhida numa
    tela grande deixa a alça fora do alcance na pequena, e não há como desfazê-la.
  */
  useEffect(() => {
    setEscala((atual) => Math.min(atual, escalaMaxima));
  }, [escalaMaxima]);

  /*
    O gesto é montado uma vez e lê tudo por referência: remontá-lo a cada render
    mataria o arrasto em andamento, e a fila re-renderiza sozinha a cada turno e
    a cada dano que chega pelo tempo real.
  */
  const medidas = useRef({ largura, altura, escala, maxima: escalaMaxima });
  medidas.current.largura = largura;
  medidas.current.altura = altura;
  medidas.current.escala = escala;
  medidas.current.maxima = escalaMaxima;

  const escalaAoPegar = useRef(1);

  /* Distingue o arrasto do toque: os dois começam igual, no mesmo dedo. */
  const arrastou = useRef(false);

  /*
    Quando a mão soltou o ponteiro. O navegador ainda emite um clique depois do
    arrasto, e sem esta marca terminar de puxar desfaria a ampliação que se
    acabou de escolher — o toque do teclado e o do leitor de tela chegam por
    esse mesmo clique, e continuam passando porque não vêm depois de um gesto.
  */
  const fimDoGesto = useRef(0);

  /*
    Alternar entre o tamanho de sempre e o ampliado, lido por referência: o
    gesto é montado uma vez, e esta função muda a cada render junto com o teto
    que ela consulta.
  */
  const alternar = useRef<() => void>(() => {});

  alternar.current = () => {
    const destino = escala > AMPLIADO ? 1 : Math.min(ESCALA_DE_UM_TOQUE, escalaMaxima);

    setEscala(destino);
    guardar(destino);
  };

  const puxador = useRef(
    PanResponder.create({
      /*
        A alça toma o gesto no primeiro contato e pela descida (`Capture`) — as
        duas coisas contra o costume, e as duas necessárias.

        No costume, quem quer arrastar espera alguns pixels de movimento para
        não roubar o toque de ninguém. Aqui isso não funcionava: o botão de
        dentro vira o responder no primeiro contato (ele é consultado antes, por
        estar mais fundo), e a partir daí a negociação por movimento só ouve
        quem está debaixo do ponteiro. A alça tem 28×22, e um puxão de verdade
        já sai dela no primeiro passo — o gesto nunca chegava a começar, sem
        erro nenhum: a escala apenas não saía do lugar.

        O preço é que o botão de dentro não vê mais o toque do dedo nem o do
        mouse; quem decide entre puxar e tocar é o `onPanResponderRelease` aqui
        embaixo, e o botão fica sendo o caminho do teclado e do leitor de tela.
      */
      onStartShouldSetPanResponderCapture: () => true,

      onPanResponderGrant: () => {
        escalaAoPegar.current = medidas.current.escala;
        arrastou.current = false;
      },

      onPanResponderMove: (_evento, gesto) => {
        if (Math.abs(gesto.dx) > 3 || Math.abs(gesto.dy) > 3) arrastou.current = true;

        if (!arrastou.current) return;

        const { largura: l, altura: a } = medidas.current;
        const diagonal = l * l + a * a;

        if (diagonal === 0) return;

        /*
          A alça mora em `escala × (−largura, altura)` a partir do canto de cima
          à direita, que é a âncora. Projetar o dedo nesse vetor é o que faz o
          canto acompanhar a mão em vez de correr na frente dela.
        */
        const avanco = (gesto.dx * -l + gesto.dy * a) / diagonal;
        const alvo = escalaAoPegar.current + avanco;

        setEscala(Math.round(Math.min(Math.max(alvo, 1), medidas.current.maxima) * 100) / 100);
      },

      onPanResponderRelease: () => {
        fimDoGesto.current = Date.now();

        if (arrastou.current) {
          guardar(medidas.current.escala);

          return;
        }

        alternar.current();
      },

      onPanResponderTerminate: () => {
        fimDoGesto.current = Date.now();
      },
    })
  ).current;

  return {
    escala,
    ampliado: escala > AMPLIADO,

    aoMedir: (evento) => setAltura(evento.nativeEvent.layout.height),

    panHandlers: puxador.panHandlers,

    tocarPeloBotao: () => {
      if (Date.now() - fimDoGesto.current < 300) return;

      alternar.current();
    },
  };
}

/**
 * A alça de ampliar: uma faixa no rodapé do quadro, com o puxador à esquerda.
 *
 * Fica nesse canto porque é o único do quadro que não encosta em nada — o de
 * cima à direita está preso na borda da tela, e é dele que a ampliação cresce.
 * Puxar de um canto solto para fora é o gesto que a mão já espera.
 *
 * Numa faixa própria em vez de flutuando sobre a lista: por cima, cobriria o
 * último nome da ordem — que é justamente quem acabou de entrar em cena quando
 * a fila está cheia.
 */
export function AlcaDeAmpliar({
  ampliacao,
  /** Mostra o tamanho escolhido e o convite. Desligado, fica só o puxador. */
  dica = true,
}: {
  ampliacao: Ampliacao;
  dica?: boolean;
}) {
  const { colors } = useTheme();

  const { ampliado, escala } = ampliacao;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: stroke.hairline,
        borderTopColor: colors.border,
        backgroundColor: colors.surfaceAlt,
        paddingRight: spacing.sm,
      }}
    >
      <View {...ampliacao.panHandlers}>
        <Pressable
          onPress={ampliacao.tocarPeloBotao}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={
            ampliado ? 'Voltar a iniciativa ao tamanho normal' : 'Ampliar a iniciativa'
          }
          accessibilityHint="Arraste este canto para escolher o tamanho"
          style={{
            width: 28,
            height: 22,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            name={ampliado ? 'sairDaTelaCheia' : 'telaCheia'}
            size={14}
            color={ampliado ? colors.accent : colors.textMuted}
          />
        </Pressable>
      </View>

      <View style={{ flex: 1 }} />

      {/* O tamanho escolhido, dito em voz baixa: sem ele, quem puxou até o teto
          fica tentando puxar mais e achando que travou. */}
      {dica ? (
        <Text variant="caption" tone={ampliado ? 'gold' : 'muted'}>
          {ampliado ? `${Math.round(escala * 100)}%` : 'puxe para ampliar'}
        </Text>
      ) : null}
    </View>
  );
}
