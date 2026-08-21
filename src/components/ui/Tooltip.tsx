import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { easing, nativeDriver, radius, spacing, stroke, useMotion, useTheme } from '@/theme';
import { Text } from './Text';

export type TooltipProps = {
  /** Texto da dica. Uma frase; se precisar de mais, use `HelpNote`. */
  content: string;
  children: React.ReactNode;
  /** Lado em que a dica aparece. Por padrão, acima do alvo. */
  placement?: 'top' | 'bottom';
  style?: StyleProp<ViewStyle>;
};

const BICO = 6;

/**
 * Dica curta ancorada a um elemento.
 *
 * Aparece no ponteiro (desktop) e no toque longo (celular) — as duas coisas,
 * porque uma dica que só existe no hover não existe em metade dos aparelhos que
 * rodam este app.
 *
 * A entrada é fade mais 4px de subida. `opacity` e `translateY`, nada além
 * disso: uma dica que empurra o layout ao aparecer é pior que nenhuma dica.
 */
export function Tooltip({ content, children, placement = 'top', style }: TooltipProps) {
  const { colors, elevation } = useTheme();
  const { reduced, ms } = useMotion();
  const [visivel, setVisivel] = useState(false);

  const entrada = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animacao = Animated.timing(entrada, {
      toValue: visivel ? 1 : 0,
      duration: reduced ? 0 : ms('fast'),
      easing: easing.decelerate,
      useNativeDriver: nativeDriver,
    });
    animacao.start();

    return () => animacao.stop();
  }, [visivel, entrada, reduced, ms]);

  const acima = placement === 'top';

  return (
    <View style={[{ position: 'relative' }, style]}>
      <Pressable
        onHoverIn={() => setVisivel(true)}
        onHoverOut={() => setVisivel(false)}
        onLongPress={() => setVisivel(true)}
        onPressOut={() => setVisivel(false)}
        accessibilityHint={content}
      >
        {children}
      </Pressable>

      {visivel ? (
        <Animated.View
          pointerEvents="none"
          accessibilityRole="text"
          style={[
            {
              position: 'absolute',
              left: 0,
              [acima ? 'bottom' : 'top']: '100%',
              marginBottom: acima ? BICO : 0,
              marginTop: acima ? 0 : BICO,
              maxWidth: 260,
              minWidth: 120,
              backgroundColor: colors.surfaceAlt,
              borderWidth: stroke.hairline,
              borderColor: colors.accent,
              borderRadius: radius.sm,
              paddingVertical: spacing.space2,
              paddingHorizontal: spacing.space3,
              opacity: entrada,
              transform: [
                {
                  translateY: entrada.interpolate({
                    inputRange: [0, 1],
                    outputRange: [acima ? 4 : -4, 0],
                  }),
                },
              ],
            },
            elevation.card,
          ]}
        >
          <Text variant="small">{content}</Text>

          {/* Bico: quadrado girado 45°, metade dele escondida atrás do balão. */}
          <View
            aria-hidden
            style={{
              position: 'absolute',
              left: spacing.space4,
              [acima ? 'bottom' : 'top']: -BICO / 2 - 1,
              width: BICO,
              height: BICO,
              backgroundColor: colors.surfaceAlt,
              borderRightWidth: acima ? stroke.hairline : 0,
              borderBottomWidth: acima ? stroke.hairline : 0,
              borderLeftWidth: acima ? 0 : stroke.hairline,
              borderTopWidth: acima ? 0 : stroke.hairline,
              borderColor: colors.accent,
              transform: [{ rotate: '45deg' }],
            }}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}
