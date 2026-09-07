import { View } from 'react-native';
import { Button, Card, Icon, Text } from '@/components/ui';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { spacing, useTheme } from '@/theme';

/**
 * Liga e desliga o aviso de "é sua vez" pelo navegador.
 *
 * Some inteiro no aplicativo nativo e em navegador sem suporte: lá o aviso
 * chega pelo canal do Reverb enquanto o aplicativo estiver aberto, e não há
 * nada para o jogador decidir aqui.
 */
export function PushNotificationButton() {
  const { colors } = useTheme();
  const { state, isSupported, isUnavailable, isLoading, error, subscribe, unsubscribe } =
    usePushNotifications();

  if (!isSupported || state === 'unsupported') {
    return null;
  }

  const ativo = state === 'subscribed';

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: ativo ? colors.successFill : colors.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            name={ativo ? 'confirmar' : 'alerta'}
            size={20}
            color={ativo ? colors.success : colors.textMuted}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Notificações de combate</Text>
          <Text variant="small" tone="muted">
            {explicacao(state, isUnavailable)}
          </Text>
        </View>

        {/*
         * Um botão só quando há o que fazer. Notificação bloqueada se
         * desbloqueia nas configurações do navegador, e servidor sem chave
         * VAPID não tem conserto pelo aplicativo.
         */}
        {!isUnavailable && state !== 'denied' ? (
          <Button
            label={ativo ? 'Desativar' : 'Ativar'}
            variant={ativo ? 'ghost' : 'primary'}
            size="sm"
            disabled={state === 'loading'}
            loading={isLoading}
            onPress={ativo ? unsubscribe : subscribe}
          />
        ) : null}
      </View>

      {error ? (
        <Text variant="small" tone="danger" style={{ marginTop: spacing.sm }}>
          {error.message}
        </Text>
      ) : null}
    </Card>
  );
}

function explicacao(state: string, isUnavailable: boolean): string {
  if (isUnavailable) {
    return 'Este servidor está sem as notificações configuradas';
  }

  if (state === 'denied') {
    return 'Bloqueadas no navegador — libere nas configurações do site';
  }

  if (state === 'subscribed') {
    return 'Você será avisado quando for sua vez, mesmo com o app fechado';
  }

  if (state === 'loading') {
    return 'Conferindo…';
  }

  return 'Receba um aviso quando for sua vez';
}
