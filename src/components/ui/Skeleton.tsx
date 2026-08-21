import { useEffect, useRef, useState } from 'react';
import { Animated, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { duration, gradient, nativeDriver, radius, useMotion, useTheme } from '@/theme';

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/** Duração do brilho. Longa de propósito: rápido demais vira cintilação. */
const VARREDURA = 1400;

/**
 * Bloco de carregamento.
 *
 * Retângulo em `surfaceAlt` com um brilho dourado a 8% de opacidade cruzando na
 * horizontal. O brilho é um gradiente movido por `translateX` — nunca muda
 * largura nem posição de layout, então o custo é o de compor uma camada.
 *
 * Com movimento reduzido sobra o bloco parado, que é o que de fato comunica
 * "isto ainda está vindo". O brilho é enfeite e some sem prejuízo.
 */
export function Skeleton({ width = '100%', height = 16, style }: SkeletonProps) {
  const { colors } = useTheme();
  const { reduced } = useMotion();

  const [larguraMedida, setLarguraMedida] = useState(0);
  const varredura = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) return;

    const ciclo = Animated.loop(
      Animated.timing(varredura, {
        toValue: 1,
        duration: VARREDURA,
        useNativeDriver: nativeDriver,
      })
    );
    ciclo.start();

    return () => ciclo.stop();
  }, [varredura, reduced]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Carregando"
      onLayout={(evento) => setLarguraMedida(evento.nativeEvent.layout.width)}
      style={[
        {
          width,
          height,
          backgroundColor: colors.surfaceAlt,
          borderRadius: radius.sm,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {reduced ? null : (
        <Animated.View
          aria-hidden
          style={[
            { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, opacity: 0.08 },
            gradient(`linear-gradient(90deg, transparent 0%, ${colors.accentSoft} 50%, transparent 100%)`),
            {
              // Em pontos, e não em porcentagem: o driver nativo só interpola
              // números. Com string, a animação estoura em tempo de execução.
              transform: [
                {
                  translateX: varredura.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-larguraMedida, larguraMedida],
                  }),
                },
              ],
            },
          ]}
        />
      )}
    </View>
  );
}

/** Alias para deixar explícito o tempo usado, quando alguém for ajustar. */
Skeleton.duration = { sweep: VARREDURA, base: duration.base };
