import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { hitSize, radius, spacing, stroke, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';

export type BackButtonProps = {
  /** Para onde ir quando não houver histórico (abertura por link direto). */
  fallback?: string;
  label?: string;
};

/**
 * Botão de voltar.
 *
 * Um alvo de 44pt com rótulo visível, e não um chevron solto: em telas de
 * celular o texto é o que torna o destino óbvio, e o tamanho é o que torna o
 * toque confiável. Quando a tela é aberta por link direto não existe histórico,
 * então caímos em uma rota conhecida em vez de deixar o botão sem efeito.
 */
export function BackButton({ fallback = '/(app)/(tabs)/personagens', label = 'Voltar' }: BackButtonProps) {
  const { colors } = useTheme();

  return (
    <View style={{ flexDirection: 'row' }}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as never))}
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={8}
        style={({ pressed }) => ({
          minHeight: hitSize.min,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          paddingVertical: spacing.sm,
          paddingLeft: spacing.sm,
          paddingRight: spacing.md,
          borderRadius: radius.md,
          borderWidth: stroke.hairline,
          borderColor: pressed ? colors.accent : colors.borderStrong,
          backgroundColor: pressed ? colors.surfaceHover : colors.surface,
        })}
      >
        <Icon name="voltar" size={20} color={colors.textMuted} />
        <Text variant="smallStrong" tone="secondary">
          {label}
        </Text>
      </Pressable>
    </View>
  );
}
