import { View } from 'react-native';
import { Button, Card, Icon, Text } from '@/components/ui';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { spacing, useTheme } from '@/theme';

/**
 * Botão para ativar/desativar notificações push.
 *
 * Mostra o estado atual e permite solicitar permissão ou desativar.
 */
export function PushNotificationButton() {
  const { colors } = useTheme();
  const { state, isSupported, isLoading, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) {
    return null;
  }

  const isEnabled = state === 'granted';
  const isDenied = state === 'denied';

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: isEnabled ? colors.successFill : colors.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            name={isEnabled ? 'confirmar' : 'alerta'}
            size={20}
            color={isEnabled ? colors.success : colors.textMuted}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Notificações de combate</Text>
          <Text variant="small" tone="muted">
            {isEnabled
              ? 'Você será avisado quando for sua vez'
              : isDenied
              ? 'Notificações bloqueadas no navegador'
              : 'Receba um aviso quando for sua vez'}
          </Text>
        </View>

        {isDenied ? (
          <Text variant="small" tone="muted">
            Desbloqueie nas configurações do navegador
          </Text>
        ) : isEnabled ? (
          <Button
            label="Desativar"
            variant="ghost"
            size="sm"
            loading={isLoading}
            onPress={unsubscribe}
          />
        ) : (
          <Button
            label="Ativar"
            variant="primary"
            size="sm"
            loading={isLoading}
            onPress={subscribe}
          />
        )}
      </View>
    </Card>
  );
}
