import { ActivityIndicator, View } from 'react-native';
import { spacing, useTheme } from '@/theme';
import { Text } from './Text';

export function Loading({ label = 'Carregando…', inline = false }: { label?: string; inline?: boolean }) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
        paddingVertical: inline ? spacing.space4 : spacing.space8,
        flex: inline ? undefined : 1,
      }}
    >
      <ActivityIndicator color={colors.primary} />
      <Text variant="small" tone="muted">
        {label}
      </Text>
    </View>
  );
}
