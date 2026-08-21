import { Image } from 'expo-image';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Chip, Seal, Text } from '@/components/ui';
import type { Character } from '@/api/types';
import { radius, spacing, stroke, useResponsive, useTheme } from '@/theme';

/**
 * Cabeçalho da ficha: identidade e o que o jogador mais consulta —
 * Defesa, deslocamento e CD de magia.
 */
export function CharacterHeader({ character }: { character: Character }) {
  const { isPhone } = useResponsive();
  const { colors } = useTheme();

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
        <View
          style={{
            width: isPhone ? 64 : 80,
            height: isPhone ? 64 : 80,
            borderRadius: radius.lg,
            backgroundColor: colors.surfaceAlt,
            borderWidth: stroke.hairline,
            borderColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {character.avatar_url ? (
            <Image
              source={{ uri: character.avatar_url }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <Text variant="title" tone="muted">
              {character.name.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>

        <View style={{ flex: 1, gap: spacing.xs, minWidth: 0 }}>
          <Text variant={isPhone ? 'title' : 'display'} numberOfLines={1}>
            {character.name}
          </Text>
          <Text variant="small" tone="secondary" numberOfLines={2}>
            {[character.race?.name, character.class_label, character.origin?.name]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
            <Chip label={character.progression.tier} tone="neutral" compact />
            {character.deity ? <Chip label={character.deity.name} tone="arcane" compact /> : null}
            {character.campaign ? <Chip label={character.campaign.name} tone="neutral" compact /> : null}
          </View>
        </View>

        <Seal
          value={character.level}
          tone="gold"
          size={isPhone ? 'md' : 'lg'}
          accessibilityLabel={`Nível ${character.level}`}
        />

        {character.permissions.can_update ? (
          <Button
            label="Editar"
            variant="secondary"
            size="sm"
            onPress={() => router.push(`/(app)/personagens/${character.id}/editar`)}
          />
        ) : null}
      </View>

      {/* Faixa de valores consultados o tempo todo */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <StatTile label="Defesa" value={character.defense.total} highlight />
        <StatTile label="Deslocamento" value={`${character.displacement.effective}m`} />
        {character.spellcasting.total !== null ? (
          <StatTile label="CD de magia" value={character.spellcasting.total} />
        ) : null}
        {character.armor_penalty !== 0 ? (
          <StatTile label="Penal. armadura" value={character.armor_penalty} tone="warning" />
        ) : null}
      </View>
    </View>
  );
}

function StatTile({
  label,
  value,
  highlight = false,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
  tone?: 'default' | 'warning';
}) {
  const { colors } = useTheme();

  const color = tone === 'warning' ? colors.warningInk : highlight ? colors.primaryInk : colors.text;

  return (
    <View
      style={{
        flexGrow: 1,
        minWidth: 104,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: stroke.hairline,
        borderColor: highlight ? colors.primary : colors.border,
        borderBottomWidth: highlight ? stroke.seal : stroke.hairline,
        borderBottomColor: highlight ? colors.accent : colors.border,
        paddingVertical: spacing.space2,
        paddingHorizontal: spacing.space3,
        gap: 2,
      }}
    >
      <Text variant="caption" tone="secondary" uppercase>
        {label}
      </Text>
      <Text variant="numeric" style={{ color, fontSize: 22 }}>
        {value}
      </Text>
    </View>
  );
}
