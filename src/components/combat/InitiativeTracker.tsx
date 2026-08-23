import { View } from 'react-native';
import { Image } from 'expo-image';
import type { CombatState } from '@/api/types';
import { Text } from '@/components/ui';
import { radius, spacing, stroke, useTheme } from '@/theme';

/**
 * A ordem de iniciativa como ela aparece no palco: um quadro no canto,
 * por cima de tudo.
 *
 * Fica sempre visível durante o combate porque é a pergunta que a mesa faz o
 * tempo todo — "de quem é a vez?" e "quando chega a minha?". Uma tela que
 * responde isso sem ninguém precisar perguntar economiza mais tempo de sessão
 * do que qualquer outra coisa aqui.
 *
 * Compacto de propósito: divide a tela com o cartaz que está sendo exibido, e
 * o cartaz é o conteúdo. Quem age agora ganha a faixa dourada; os demais são
 * uma lista discreta abaixo dele.
 */
export function InitiativeTracker({ combat, compacto = false }: { combat: CombatState; compacto?: boolean }) {
  const { colors, elevation } = useTheme();

  if (!combat.active || combat.entries.length === 0) return null;

  const largura = compacto ? 200 : 260;

  return (
    <View
      style={{
        width: largura,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: stroke.seal,
        borderColor: colors.accent,
        padding: spacing.md,
        gap: spacing.sm,
        ...elevation.floating,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="caption" tone="secondary" uppercase>
          Iniciativa
        </Text>
        <Text variant="caption" tone="gold" uppercase>
          Rodada {combat.round}
        </Text>
      </View>

      <View style={{ gap: spacing.xxs }}>
        {combat.entries.map((entrada, indice) => {
          const agora = indice === combat.turn_index;
          const proximo = indice === (combat.turn_index + 1) % combat.entries.length;

          return (
            <View
              key={entrada.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                paddingVertical: agora ? spacing.xs : 2,
                paddingHorizontal: spacing.xs,
                borderRadius: radius.sm,
                backgroundColor: agora ? colors.accentFill : 'transparent',
                borderLeftWidth: agora ? stroke.plate : proximo ? stroke.hairline : 0,
                borderLeftColor: agora ? colors.accent : colors.border,
              }}
            >
              {entrada.avatar_url ? (
                <Image
                  source={{ uri: entrada.avatar_url }}
                  style={{ width: agora ? 24 : 18, height: agora ? 24 : 18, borderRadius: radius.sm }}
                  contentFit="cover"
                  accessibilityLabel={entrada.name}
                />
              ) : null}

              <Text
                variant={agora ? 'smallStrong' : 'small'}
                tone={agora ? 'gold' : entrada.is_npc ? 'muted' : 'secondary'}
                numberOfLines={1}
                style={{ flex: 1 }}
              >
                {entrada.name}
              </Text>

              <Text variant="caption" tone={agora ? 'gold' : 'muted'}>
                {entrada.initiative}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
