import { View } from 'react-native';
import { ApiError } from '@/api';
import { radius, spacing, stroke, useTheme } from '@/theme';
import { Button } from './Button';
import { Text } from './Text';

export type ErrorStateProps = {
  error: unknown;
  onRetry?: () => void;
  title?: string;
};

/** Traduz o erro para linguagem útil e oferece uma ação de recuperação. */
export function ErrorState({ error, onRetry, title }: ErrorStateProps) {
  const { colors } = useTheme();

  const message =
    error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Algo deu errado.';

  const isOffline = error instanceof ApiError && error.status === 0;

  return (
    <View
      style={{
        gap: spacing.md,
        padding: spacing.lg,
        backgroundColor: colors.dangerFill,
        borderRadius: radius.lg,
        borderWidth: stroke.hairline,
        borderColor: colors.danger,
        borderLeftWidth: stroke.plate,
      }}
    >
      <Text variant="subheading" tone="danger">
        {title ?? (isOffline ? 'Sem conexão com o servidor' : 'Não foi possível carregar')}
      </Text>
      <Text variant="small" tone="secondary">
        {message}
      </Text>
      {onRetry ? <Button label="Tentar novamente" variant="secondary" size="sm" onPress={onRetry} /> : null}
    </View>
  );
}
