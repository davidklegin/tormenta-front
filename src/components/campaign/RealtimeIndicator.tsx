import { View } from 'react-native';
import { Text } from '@/components/ui';
import { radius, spacing, stroke, useTheme, type Palette } from '@/theme';
import { useSessionStore } from '@/store/session';

function statusMap(palette: Palette) {
  return {
    idle: { label: 'Tempo real inativo', color: palette.textSubtle },
    connecting: { label: 'Conectando…', color: palette.warning },
    connected: { label: 'Ao vivo', color: palette.success },
    reconnecting: { label: 'Reconectando…', color: palette.warning },
    offline: { label: 'Atualizando a cada 20s', color: palette.textSubtle },
  } as const;
}

/**
 * Mostra o estado da conexão de tempo real.
 *
 * Existe porque a mesa precisa saber em que modo está: com o socket no ar as
 * mudanças chegam na hora; sem ele, o painel ainda funciona, só que revalidando
 * periodicamente. Esconder isso faria o mestre desconfiar de dados velhos.
 */
export function RealtimeIndicator() {
  const { colors } = useTheme();
  const status = useSessionStore((state) => state.realtimeStatus);
  const { label, color } = statusMap(colors)[status];

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.space1,
        paddingHorizontal: spacing.space2,
        paddingVertical: 4,
        borderRadius: radius.sm,
        backgroundColor: colors.surfaceAlt,
        borderWidth: stroke.hairline,
        borderColor: colors.border,
      }}
      accessibilityRole="text"
      accessibilityLabel={`Estado da conexão: ${label}`}
    >
      <View style={{ width: 7, height: 7, borderRadius: radius.pill, backgroundColor: color }} />
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </View>
  );
}
