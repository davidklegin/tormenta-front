import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme';
import type { BattleMapToken } from '@/api/types';

type Props = {
  token: BattleMapToken;
  ladoDoQuadrado: number;
  podeMover: boolean;
  selecionado: boolean;
  /** Id da peça que o dedo está arrastando agora; -1 quando nenhuma. */
  idArrastado: SharedValue<number>;
  arrastoX: SharedValue<number>;
  arrastoY: SharedValue<number>;
};

/**
 * Uma peça no tabuleiro — desenho, e só.
 *
 * O gesto de arrastar não mora aqui: mora no tabuleiro, que descobre pela
 * conta do quadrado quem está sob o dedo (ver BattleMapCanvas). Gesto por peça,
 * aninhado dentro do container com zoom, chegava com `translationX` zerado no
 * React Native Web — a peça não saía do lugar e nada denunciava o motivo.
 *
 * O que sobrou aqui é a leitura do arrasto em curso: quando o id arrastado é o
 * desta peça, ela acompanha o dedo. Tudo dentro do worklet, sem passar pelo
 * React a cada quadro.
 */
function MapTokenBase({
  token,
  ladoDoQuadrado,
  podeMover,
  selecionado,
  idArrastado,
  arrastoX,
  arrastoY,
}: Props) {
  const { colors } = useTheme();

  const lado = token.size * ladoDoQuadrado;
  const baseX = token.position.x * ladoDoQuadrado;
  const baseY = token.position.y * ladoDoQuadrado;

  const estiloAnimado = useAnimatedStyle(() => {
    const euEstouIndo = idArrastado.value === token.id;

    return {
      transform: [
        { translateX: euEstouIndo ? arrastoX.value : 0 },
        { translateY: euEstouIndo ? arrastoY.value : 0 },
        { scale: euEstouIndo ? 1.12 : 1 },
      ],
      zIndex: euEstouIndo || selecionado ? 20 : 10,
    };
  });

  const contorno = selecionado ? colors.accent : podeMover ? colors.primary : colors.border;

  return (
      <Animated.View
        style={[styles.peca, { left: baseX, top: baseY, width: lado, height: lado }, estiloAnimado]}
        accessibilityRole="button"
        accessibilityLabel={`${token.name}${podeMover ? ', tocável para mover' : ''}`}
      >
        <View
          style={[
            styles.moldura,
            {
              borderColor: contorno,
              backgroundColor: colors.surface,
              borderWidth: selecionado ? 3 : 2,
              // A peça escondida existe só na tela do mestre; o quadriculado
              // não cabe aqui, então ela vai translúcida.
              opacity: token.visible ? 1 : 0.55,
            },
          ]}
        >
          {token.image_url ? (
            <Image source={{ uri: token.image_url }} style={styles.retrato} contentFit="cover" />
          ) : (
            <View style={[styles.retrato, styles.iniciais, { backgroundColor: colors.surfaceAlt }]}>
              <Text variant="caption" tone="secondary" style={{ fontSize: Math.min(16, lado / 3) }}>
                {iniciais(token.name)}
              </Text>
            </View>
          )}
        </View>

        {token.conditions.length > 0 && (
          <View
            style={[styles.selo, { backgroundColor: colors.warningFill, borderColor: colors.warning }]}
          >
            <Text variant="caption" style={{ fontSize: 9, color: colors.warningInk }}>
              {token.conditions.length}
            </Text>
          </View>
        )}

        <View style={[styles.nome, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="caption" numberOfLines={1} style={{ fontSize: 9 }}>
            {token.name}
          </Text>
        </View>
      </Animated.View>
  );
}


function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0];

  if (!primeira) return '?';
  if (partes.length === 1) return primeira.slice(0, 2).toUpperCase();

  const ultima = partes[partes.length - 1] ?? primeira;

  return ((primeira[0] ?? '') + (ultima[0] ?? '')).toUpperCase();
}

const styles = StyleSheet.create({
  peca: {
    position: 'absolute',
    padding: 2,
  },
  moldura: {
    flex: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  retrato: {
    width: '100%',
    height: '100%',
  },
  iniciais: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  selo: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 15,
    height: 15,
    paddingHorizontal: 3,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nome: {
    position: 'absolute',
    bottom: -13,
    left: -6,
    right: -6,
    paddingHorizontal: 3,
    borderRadius: 3,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
});

export const MapToken = memo(MapTokenBase);
