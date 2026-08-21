import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { easing, hitSize, nativeDriver, radius, spacing, stroke, useMotion, useTheme } from '@/theme';
import { Text } from './Text';

export type ThemeToggleProps = {
  /** Mostra o nome do tema ao lado do selo. Útil em telas largas. */
  showLabel?: boolean;
  size?: number;
};

/**
 * Selo de alternância entre Pergaminho e Tempestade Rubra.
 *
 * O desenho é um selo de cera com o astro gravado: sol de raios curtos no tema
 * claro, lua em quarto crescente no escuro. Ambos são Views — o sol é um disco
 * com oito raios em volta, a lua é um disco com um segundo disco por cima, na
 * cor do selo, deslocado. Nenhuma imagem, nenhuma fonte de ícone.
 *
 * A troca gira o selo meia volta. Com movimento reduzido a rotação some e só o
 * símbolo muda, que é o que carrega a informação.
 */
export function ThemeToggle({ showLabel = false, size = 34 }: ThemeToggleProps) {
  const { colors, isDark, toggle, preference } = useTheme();
  const { reduced, ms } = useMotion();
  const [hover, setHover] = useState(false);

  const rotacao = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  useEffect(() => {
    const animacao = Animated.timing(rotacao, {
      toValue: isDark ? 1 : 0,
      duration: reduced ? 0 : ms('base'),
      easing: easing.emphasis,
      useNativeDriver: nativeDriver,
    });
    animacao.start();

    return () => animacao.stop();
  }, [isDark, rotacao, reduced, ms]);

  const raio = size * 0.5;
  const astro = size * 0.42;

  const descricao = isDark ? 'Tema escuro, Tempestade Rubra' : 'Tema claro, Pergaminho';
  const acao = isDark ? 'Mudar para o tema claro' : 'Mudar para o tema escuro';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.space2 }}>
      <Pressable
        onPress={toggle}
        onHoverIn={() => setHover(true)}
        onHoverOut={() => setHover(false)}
        accessibilityRole="switch"
        accessibilityState={{ checked: isDark }}
        accessibilityLabel={acao}
        accessibilityHint={`${descricao}${preference === 'system' ? ', seguindo o aparelho' : ''}.`}
        hitSlop={8}
        style={{
          minWidth: hitSize.min,
          minHeight: hitSize.min,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Animated.View
          style={{
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: hover ? colors.accentFill : colors.surfaceAlt,
            borderWidth: stroke.hairline,
            borderColor: hover ? colors.accent : colors.borderStrong,
            // Contorno de cera: nenhum canto igual ao outro.
            borderTopLeftRadius: raio * 0.96,
            borderTopRightRadius: raio * 0.84,
            borderBottomLeftRadius: raio * 0.88,
            borderBottomRightRadius: raio,
            transform: [
              { rotate: rotacao.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) },
            ],
          }}
        >
          {isDark ? (
            <View style={{ width: astro, height: astro }}>
              <View
                style={{
                  width: astro,
                  height: astro,
                  borderRadius: astro / 2,
                  backgroundColor: colors.accentInk,
                }}
              />
              {/* O disco de recorte usa a cor do selo, então "come" a lua. */}
              <View
                style={{
                  position: 'absolute',
                  left: astro * 0.3,
                  top: -astro * 0.12,
                  width: astro,
                  height: astro,
                  borderRadius: astro / 2,
                  backgroundColor: hover ? colors.accentFill : colors.surfaceAlt,
                }}
              />
            </View>
          ) : (
            <View style={{ width: astro, height: astro, alignItems: 'center', justifyContent: 'center' }}>
              {[0, 45, 90, 135].map((angulo) => (
                <View
                  key={angulo}
                  style={{
                    position: 'absolute',
                    width: astro,
                    height: stroke.seal,
                    borderRadius: radius.sm,
                    backgroundColor: colors.accentInk,
                    transform: [{ rotate: `${angulo}deg` }],
                  }}
                />
              ))}
              <View
                style={{
                  width: astro * 0.62,
                  height: astro * 0.62,
                  borderRadius: astro,
                  backgroundColor: colors.accentInk,
                }}
              />
            </View>
          )}
        </Animated.View>
      </Pressable>

      {showLabel ? (
        <View
          accessible={false}
          style={{
            paddingHorizontal: spacing.space2,
            paddingVertical: 2,
            borderRadius: radius.sm,
            backgroundColor: colors.neutralFill,
          }}
        >
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {isDark ? 'Tempestade Rubra' : 'Pergaminho'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
