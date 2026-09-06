import { View } from 'react-native';
import type { CombatState } from '@/api/types';
import { Card, Chip, Icon, Text } from '@/components/ui';
import { useCombat } from '@/hooks/useCombat';
import { radius, spacing, stroke, useTheme } from '@/theme';

/**
 * Painel de iniciativa dentro da ficha do personagem.
 *
 * Mostra a lista completa de quem está no combate e em que ordem,
 * destacando a vez atual e a posição do personagem que está olhando.
 * Atualiza em tempo real via Reverb.
 */
export function InitiativePanel({
  campaignId,
  characterId,
}: {
  campaignId: number | null;
  characterId: number;
}) {
  const combat = useCombat(campaignId);

  if (!campaignId || !combat.data?.active) {
    return null;
  }

  const { entries, turn_index, round } = combat.data;

  // Encontrar a posição do personagem na ordem
  const myIndex = entries.findIndex((e) => e.character_id === characterId);
  const myPosition = myIndex >= 0 ? myIndex + 1 : null;
  const turnosAteMinhaVez = myIndex >= 0 ? (myIndex - turn_index + entries.length) % entries.length : null;

  return (
    <Card title="Ordem de Combate" subtitle={`Rodada ${round}`}>
      <View style={{ gap: spacing.sm }}>
        {/* Resumo da posição */}
        {myPosition !== null ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs }}>
            <Chip
              label={`${myPosition}º na ordem`}
              tone={turn_index === myIndex ? 'gold' : 'neutral'}
              compact
            />
            {turn_index === myIndex ? (
              <Chip label="SUA VEZ!" tone="gold" />
            ) : turnosAteMinhaVez !== null && turnosAteMinhaVez > 0 ? (
              <Chip
                label={turnosAteMinhaVez === 1 ? 'Próximo' : `Em ${turnosAteMinhaVez} turnos`}
                compact
              />
            ) : null}
          </View>
        ) : null}

        {/* Lista de iniciativa */}
        <View style={{ gap: spacing.xs }}>
          {entries.map((entry, index) => (
            <InitiativeEntry
              key={entry.id}
              name={entry.name}
              initiative={entry.initiative}
              isNpc={entry.is_npc}
              isCurrent={index === turn_index}
              isMe={entry.character_id === characterId}
              avatarUrl={entry.avatar_url}
            />
          ))}
        </View>
      </View>
    </Card>
  );
}

function InitiativeEntry({
  name,
  initiative,
  isNpc,
  isCurrent,
  isMe,
  avatarUrl,
}: {
  name: string;
  initiative: number;
  isNpc: boolean;
  isCurrent: boolean;
  isMe: boolean;
  avatarUrl?: string | null;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: isCurrent
          ? colors.accentFill
          : isMe
          ? colors.surfaceAlt
          : colors.surface,
        borderRadius: radius.md,
        borderWidth: stroke.hairline,
        borderColor: isCurrent ? colors.accent : isMe ? colors.borderStrong : colors.border,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
      }}
    >
      <Text
        variant="numeric"
        tone={isCurrent ? 'gold' : 'muted'}
        style={{ width: 28, textAlign: 'right' }}
      >
        {initiative}
      </Text>

      <Text
        variant={isCurrent || isMe ? 'bodyStrong' : 'body'}
        style={{ flex: 1 }}
        numberOfLines={1}
      >
        {name}
      </Text>

      {isNpc ? <Chip label="NPC" compact /> : null}
      {isCurrent ? <Chip label="agora" compact tone="gold" /> : null}
      {isMe && !isCurrent ? <Chip label="você" compact tone="neutral" /> : null}
    </View>
  );
}
