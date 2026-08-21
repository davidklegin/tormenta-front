import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';
import { Chip, ProgressBar, Seal, Text } from '@/components/ui';
import type { DashboardCharacter } from '@/api/types';
import { radius, severityColors, spacing, stroke, useTheme, vitalColors } from '@/theme';

export type CharacterStatusCardProps = {
  character: DashboardCharacter;
  onPress?: () => void;
};

/**
 * Card do Painel do Mestre (briefing §5 e §7).
 *
 * Mostra foto, nome, jogador, classe, nível, PV, PM e condições — o suficiente
 * para o mestre ler a situação da mesa de relance. A faixa colorida na borda
 * esquerda e a cor do número de PV sinalizam gravidade sem poluir o card.
 */
export function CharacterStatusCard({ character, onPress }: CharacterStatusCardProps) {
  const { colors } = useTheme();
  const vitais = vitalColors(colors);

  const severity = character.status.severity;
  const accent = severityColors(colors)[severity];
  const isDown = character.status.is_down;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${character.name}, ${character.class_label}, ${character.hp.current} de ${character.hp.max} pontos de vida`}
      style={({ pressed }) => ({
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: stroke.hairline,
        borderColor: severity === 'ok' ? colors.border : accent,
        borderLeftWidth: stroke.plate,
        borderLeftColor: accent,
        padding: spacing.space4,
        gap: spacing.space3,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {/* Cabeçalho: retrato, nome, jogador e classe */}
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
        <Avatar url={character.avatar_url} name={character.name} down={isDown} />

        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading" numberOfLines={1}>
            {character.name}
          </Text>
          <Text variant="small" tone="secondary" numberOfLines={1}>
            {character.class_label || '—'}
            {character.race ? ` · ${character.race}` : ''}
          </Text>
          <Text variant="small" tone="muted" numberOfLines={1}>
            Jogador: {character.player.name ?? '—'}
          </Text>
        </View>

        <Seal value={character.level} tone="gold" size="sm" accessibilityLabel={`Nível ${character.level}`} />
      </View>

      {/* Vitalidade */}
      <View style={{ gap: spacing.sm }}>
        <VitalRow
          label="PV"
          current={character.hp.current}
          max={character.hp.max}
          temp={character.hp.temp}
          color={vitais.hp}
          trackColor={vitais.hpTrack}
          valueColor={severity === 'ok' ? colors.text : accent}
        />
        <VitalRow
          label="PM"
          current={character.mp.current}
          max={character.mp.max}
          temp={character.mp.temp}
          color={vitais.mp}
          trackColor={vitais.mpTrack}
          valueColor={colors.text}
        />
      </View>

      {isDown ? (
        <View
          style={{
            backgroundColor: colors.dangerFill,
            borderRadius: radius.sm,
            borderLeftWidth: stroke.seal,
            borderLeftColor: colors.danger,
            paddingVertical: spacing.space1,
            paddingHorizontal: spacing.space2,
          }}
        >
          <Text variant="smallStrong" tone="danger">
            {character.status.is_dead
              ? 'Morto'
              : `Inconsciente e sangrando · morre em ${character.status.death_threshold} PV`}
          </Text>
        </View>
      ) : null}

      {/* Condições */}
      {character.conditions.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {character.conditions.map((condition) => (
            <Chip
              key={condition.id}
              label={condition.name}
              compact
              tone={condition.is_incapacitating ? 'danger' : condition.severity >= 3 ? 'warning' : 'neutral'}
            />
          ))}
        </View>
      ) : null}

      {/* Buffs, debuffs e recursos */}
      {character.resources.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {character.resources.map((resource) => (
            <Chip
              key={resource.id}
              compact
              tone={resource.kind === 'debuff' ? 'warning' : resource.kind === 'buff' ? 'success' : 'arcane'}
              label={
                resource.max_value !== null
                  ? `${resource.name} ${resource.current_value ?? 0}/${resource.max_value}`
                  : resource.name
              }
            />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function VitalRow({
  label,
  current,
  max,
  temp,
  color,
  trackColor,
  valueColor,
}: {
  label: string;
  current: number;
  max: number;
  temp: number;
  color: string;
  trackColor: string;
  valueColor: string;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text variant="caption" tone="secondary" uppercase>
          {label}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xxs }}>
          <Text variant="numeric" style={{ color: valueColor, fontSize: 20 }}>
            {current}
          </Text>
          <Text variant="small" tone="muted">
            / {max}
          </Text>
          {temp > 0 ? (
            <Text variant="small" style={{ color, marginLeft: spacing.xs }}>
              +{temp}
            </Text>
          ) : null}
        </View>
      </View>
      <ProgressBar value={current} max={max} temp={temp} color={color} trackColor={trackColor} height={6} />
    </View>
  );
}

function Avatar({ url, name, down }: { url: string | null; name: string; down: boolean }) {
  const { colors } = useTheme();

  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <View
      style={{
        width: 52,
        height: 52,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceAlt,
        borderWidth: stroke.hairline,
        borderColor: down ? colors.danger : colors.borderStrong,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {url ? (
        <Image
          source={{ uri: url }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <Text variant="subheading" tone="muted">
          {initials || '?'}
        </Text>
      )}
    </View>
  );
}
