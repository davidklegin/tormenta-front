import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, View } from 'react-native';
import { easing, hitSize, nativeDriver, radius, spacing, stroke, useMotion, useTheme } from '@/theme';
import { Text } from './Text';

export type Segment<T extends string> = { value: T; label: string; badge?: number };

export type SegmentedControlProps<T extends string> = {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  scrollable?: boolean;
};

/** Inclinação do corte das pontas da placa ativa. */
const CORTE = '-10deg';

/**
 * Alternador compacto — filtros por círculo de magia, tipo de poder, etc.
 *
 * A aba ativa é a placa do tema: faixa rubra com as pontas cortadas na
 * diagonal e texto claro. As inativas ficam em `surfaceAlt` com texto discreto,
 * de modo que a ativa é a única coisa saturada da fileira.
 *
 * A placa desliza entre as abas em vez de aparecer instantaneamente na nova
 * posição — o olho acompanha para onde a seleção foi. O que se anima é só
 * `translateX`, com driver nativo; a largura acompanha a aba sem animação, de
 * propósito: animar largura é mexer em layout a cada quadro, e no caso comum,
 * em que as abas dividem a linha igualmente, ela nem chega a mudar.
 */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  scrollable = false,
}: SegmentedControlProps<T>) {
  const { colors } = useTheme();
  const { reduced, ms } = useMotion();

  const [larguras, setLarguras] = useState<Record<string, { x: number; width: number }>>({});
  const deslocamento = useRef(new Animated.Value(0)).current;

  const ativo = larguras[value];

  useEffect(() => {
    if (!ativo) return;

    const animacao = Animated.timing(deslocamento, {
      toValue: ativo.x,
      duration: reduced ? 0 : ms('base'),
      easing: easing.standard,
      useNativeDriver: nativeDriver,
    });
    animacao.start();

    return () => animacao.stop();
  }, [ativo, deslocamento, reduced, ms]);

  const content = (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.md,
        borderWidth: stroke.hairline,
        borderColor: colors.border,
        padding: 3,
        gap: 3,
      }}
    >
      {ativo ? (
        <Animated.View
          pointerEvents="none"
          aria-hidden
          style={{
            position: 'absolute',
            top: 3,
            bottom: 3,
            left: 0,
            width: ativo.width,
            backgroundColor: colors.primary,
            borderTopWidth: stroke.hairline,
            borderBottomWidth: stroke.hairline,
            borderTopColor: colors.accent,
            borderBottomColor: colors.accent,
            transform: [{ translateX: deslocamento }, { skewX: CORTE }],
          }}
        />
      ) : null}

      {segments.map((segment) => {
        const active = segment.value === value;

        return (
          <Pressable
            key={segment.value}
            onPress={() => onChange(segment.value)}
            onLayout={(evento) => {
              const { x, width } = evento.nativeEvent.layout;
              setLarguras((atual) =>
                atual[segment.value]?.x === x && atual[segment.value]?.width === width
                  ? atual
                  : { ...atual, [segment.value]: { x, width } }
              );
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{
              flex: scrollable ? undefined : 1,
              minHeight: hitSize.min,
              paddingVertical: spacing.space2,
              paddingHorizontal: spacing.space3,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: spacing.space1,
            }}
          >
            <Text variant="smallStrong" style={{ color: active ? colors.onPrimary : colors.textMuted }}>
              {segment.label}
            </Text>

            {segment.badge !== undefined && segment.badge > 0 ? (
              <View
                style={{
                  minWidth: 18,
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                  borderRadius: radius.sm,
                  backgroundColor: active ? colors.accent : colors.neutralFill,
                }}
              >
                <Text variant="caption" style={{ color: active ? colors.onAccent : colors.neutralInk }}>
                  {segment.badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );

  if (!scrollable) return content;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingRight: spacing.space4 }}
    >
      {content}
    </ScrollView>
  );
}
