import { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, Pressable, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CharacterSummary } from '@/api/types';
import { Icon, ProgressBar, Text } from '@/components/ui';
import { useVitalsStore, type PosicaoDoMarcador } from '@/store/vitals';
import { radius, spacing, stroke, useResponsive, useTheme, vitalColors } from '@/theme';

/**
 * Pastilha flutuante de vida e mana.
 *
 * Fica por cima de qualquer tela da área logada e mostra os dois números que
 * mudam a cada turno. É pequena de propósito: quem está no grimório ou nas
 * anotações precisa enxergar o PV sem perder a tela de baixo. O detalhe — os
 * botões de dano e cura — só aparece ao tocar nela, no painel que ela abre.
 *
 * Ela é arrastável porque não existe canto seguro: a mão canhota cobre um lado,
 * a barra de abas ocupa o outro, e no desktop a janela muda de tamanho. O
 * jogador põe onde quiser e o lugar fica guardado.
 */
const LARGURA = 152;

/** Altura antes da primeira medição — o `onLayout` corrige logo em seguida. */
const ALTURA_ESTIMADA = 78;

const MARGEM = 12;

/** Folga do rodapé, para a pastilha não nascer sobre a barra de abas. */
const ESPACO_DA_BARRA = 72;

type Limites = { minX: number; maxX: number; minY: number; maxY: number };

function dentro(posicao: PosicaoDoMarcador, limites: Limites): PosicaoDoMarcador {
  return {
    x: Math.min(Math.max(posicao.x, limites.minX), Math.max(limites.minX, limites.maxX)),
    y: Math.min(Math.max(posicao.y, limites.minY), Math.max(limites.minY, limites.maxY)),
  };
}

export function VitalsPill({ ficha, onPress }: { ficha: CharacterSummary; onPress: () => void }) {
  const { colors, elevation } = useTheme();
  const vitais = vitalColors(colors);

  const { width, height } = useResponsive();
  const insets = useSafeAreaInsets();

  const guardada = useVitalsStore((estado) => estado.posicao);
  const guardarPosicao = useVitalsStore((estado) => estado.guardarPosicao);

  const tamanho = useRef({ largura: LARGURA, altura: ALTURA_ESTIMADA });

  const limites = useMemo<Limites>(
    () => ({
      minX: MARGEM,
      maxX: width - tamanho.current.largura - MARGEM,
      minY: insets.top + MARGEM,
      maxY: height - tamanho.current.altura - insets.bottom - ESPACO_DA_BARRA,
    }),
    [width, height, insets.top, insets.bottom]
  );

  // O gesto lê os limites por referência: o PanResponder é montado uma vez, e
  // sem isto ele continuaria clampando pela largura da janela antiga depois de
  // uma rotação ou de um redimensionamento.
  const limitesRef = useRef(limites);
  limitesRef.current = limites;

  // Quando o arraste termina sobre a própria pastilha, o navegador ainda emite
  // um `click` no elemento — e sem esta marca o gesto de reposicionar abriria o
  // painel toda vez que o dedo saísse de cima dela.
  const fimDoArraste = useRef(0);

  const posicaoRef = useRef<PosicaoDoMarcador>(
    dentro(guardada ?? { x: limites.maxX, y: limites.maxY }, limites)
  );
  const pan = useRef(new Animated.ValueXY(posicaoRef.current)).current;

  // Janela menor (rotação, desktop redimensionado): traz a pastilha de volta
  // para dentro em vez de deixá-la fora do alcance do dedo.
  useEffect(() => {
    const ajustada = dentro(posicaoRef.current, limites);

    if (ajustada.x !== posicaoRef.current.x || ajustada.y !== posicaoRef.current.y) {
      posicaoRef.current = ajustada;
      pan.setValue(ajustada);
    }
  }, [limites, pan]);

  const gesto = useRef(
    PanResponder.create({
      // O toque começa como toque: o arraste só toma a mão depois de 4px, para
      // abrir o painel continuar sendo um toque simples e não uma mira.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evento, gestureState) =>
        Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4,

      onPanResponderGrant: () => {
        // `extractOffset` move o valor atual para o offset e zera o valor, que
        // é o que o `Animated.event` de dx/dy espera receber.
        pan.extractOffset();
      },

      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),

      onPanResponderRelease: (_evento, gestureState) => {
        pan.flattenOffset();

        const destino = dentro(
          {
            x: posicaoRef.current.x + gestureState.dx,
            y: posicaoRef.current.y + gestureState.dy,
          },
          limitesRef.current
        );

        posicaoRef.current = destino;
        pan.setValue(destino);
        guardarPosicao(destino);
        fimDoArraste.current = Date.now();
      },
    })
  ).current;

  const medir = (evento: LayoutChangeEvent) => {
    const { width: largura, height: altura } = evento.nativeEvent.layout;
    tamanho.current = { largura, altura };
  };

  const pv = ficha.hp;
  const pm = ficha.mp;

  const efetivo = pv.current + pv.temp;
  const caido = efetivo <= 0;
  const critico = pv.max > 0 && efetivo / pv.max <= 0.25;

  const corDoPv = caido ? colors.dangerInk : critico ? colors.warningInk : colors.text;

  return (
    <Animated.View
      {...gesto.panHandlers}
      onLayout={medir}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: LARGURA,
        // Abaixo do alerta da vez (100) e do aviso de preparação (90): quando o
        // combate chama, quem tem de ser visto é o alerta.
        zIndex: 80,
        transform: pan.getTranslateTransform(),
      }}
    >
      <Pressable
        onPress={() => {
          if (Date.now() - fimDoArraste.current < 250) return;

          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${ficha.name}: ${pv.current} de ${pv.max} pontos de vida, ${pm.current} de ${pm.max} pontos de mana. Abrir o marcador.`}
        style={({ pressed }) => ({
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: stroke.hairline,
          borderColor: caido ? colors.danger : colors.border,
          borderLeftWidth: stroke.plate,
          borderLeftColor: caido ? colors.danger : colors.accent,
          paddingVertical: spacing.space2,
          paddingHorizontal: spacing.space3,
          gap: spacing.space2,
          opacity: pressed ? 0.85 : 1,
          ...elevation.floating,
        })}
      >
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {ficha.name}
        </Text>

        <LinhaVital
          icone="vida"
          atual={pv.current}
          maximo={pv.max}
          temp={pv.temp}
          cor={vitais.hp}
          corDoNumero={corDoPv}
          trilho={vitais.hpTrack}
        />

        <LinhaVital
          icone="mana"
          atual={pm.current}
          maximo={pm.max}
          temp={pm.temp}
          cor={vitais.mp}
          corDoNumero={colors.text}
          trilho={vitais.mpTrack}
        />
      </Pressable>
    </Animated.View>
  );
}

function LinhaVital({
  icone,
  atual,
  maximo,
  temp,
  cor,
  corDoNumero,
  trilho,
}: {
  icone: 'vida' | 'mana';
  atual: number;
  maximo: number;
  temp: number;
  cor: string;
  corDoNumero: string;
  trilho: string;
}) {
  return (
    <View style={{ gap: spacing.xxs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <Icon name={icone} size={14} color={cor} />
        <Text
          variant="smallStrong"
          style={{ color: corDoNumero, fontVariant: ['tabular-nums'] }}
          numberOfLines={1}
        >
          {atual}
          <Text variant="small" tone="muted">
            {` / ${maximo}`}
          </Text>
        </Text>
        {temp > 0 ? (
          <Text variant="small" style={{ color: cor }}>
            +{temp}
          </Text>
        ) : null}
      </View>

      <ProgressBar value={atual} max={maximo} temp={temp} color={cor} trackColor={trilho} height={5} />
    </View>
  );
}
