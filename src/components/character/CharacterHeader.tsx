import { Image } from 'expo-image';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Chip, Text } from '@/components/ui';
import type { Character } from '@/api/types';
import { radius, spacing, stroke, useResponsive, useTheme } from '@/theme';
import { AttributeGrid } from './AttributeGrid';

/**
 * Cabeçalho da ficha: identidade e o que o jogador mais consulta —
 * atributos, raça/classe/origem, Defesa, deslocamento e CD de magia.
 *
 * Os atributos vêm logo abaixo do nome porque são o que se olha em toda
 * rolagem, em qualquer aba. Raça, classe, origem, divindade e nível ficam
 * rotulados no mesmo desenho dos números da faixa: numa lista separada por
 * pontos, "Suraggel" e "Nobre" viram uma linha só que ninguém lê.
 */
export function CharacterHeader({ character }: { character: Character }) {
  const { isPhone } = useResponsive();
  const { colors } = useTheme();

  const identidade = [
    { label: 'Raça', value: character.race?.name },
    { label: 'Classe', value: character.class_label },
    { label: 'Origem', value: character.origin?.name },
    { label: 'Divindade', value: character.deity?.name },
    { label: 'Nível', value: String(character.level) },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));

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
          <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
            <Chip label={character.progression.tier} tone="neutral" compact />
            {character.campaign ? <Chip label={character.campaign.name} tone="neutral" compact /> : null}
          </View>
        </View>

        {character.permissions.can_update ? (
          <Button
            label="Editar"
            variant="secondary"
            size="sm"
            onPress={() => router.push(`/(app)/personagens/${character.id}/editar`)}
          />
        ) : null}
      </View>

      {/* Os seis atributos, logo abaixo do nome */}
      <AttributeGrid attributes={character.attributes} />

      {/* Quem é o personagem, rotulado */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        {identidade.map((item) => (
          <Tile key={item.label} label={item.label}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {item.value}
            </Text>
          </Tile>
        ))}
      </View>

      {/* Faixa de valores consultados o tempo todo */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <StatTile label="Defesa" value={character.defense.total} highlight />
        <StatTile label="Deslocamento" value={`${character.displacement.effective}m`} />
        {character.spellcasting.total !== null ? (
          <StatTile label="CD de magia" value={character.spellcasting.total} />
        ) : null}
        {character.damage_reduction.total > 0 ? (
          <StatTile label="RD" value={character.damage_reduction.total} />
        ) : null}
        {character.armor_penalty !== 0 ? (
          <StatTile label="Penal. armadura" value={character.armor_penalty} tone="warning" />
        ) : null}
      </View>
    </View>
  );
}

/** Moldura das faixas do cabeçalho: rótulo em versalete e o valor embaixo. */
function Tile({
  label,
  highlight = false,
  children,
}: {
  label: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();

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
      {children}
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
    <Tile label={label} highlight={highlight}>
      <Text variant="numeric" style={{ color, fontSize: 22 }}>
        {value}
      </Text>
    </Tile>
  );
}
