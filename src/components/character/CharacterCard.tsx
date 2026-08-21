import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';
import { Chip, Icon, ProgressBar, Text } from '@/components/ui';
import type { CharacterSummary } from '@/api/types';
import { radius, spacing, stroke, useTheme, vitalColors } from '@/theme';
import { severityFor } from '@/rules';

/**
 * Card da tela inicial do jogador (briefing §8): foto, nome, raça, classe,
 * nível e campanha.
 *
 * Na lista geral, a ficha é de outra pessoa, então o card também diz de quem
 * é. O `player` só vem preenchido nessa lista — na minha, seria repetir meu
 * próprio nome em cada card.
 */
export function CharacterCard({ character, onPress }: { character: CharacterSummary; onPress?: () => void }) {
  const { colors } = useTheme();
  const vitais = vitalColors(colors);
  const severity = severityFor(character.hp.current + character.hp.temp, character.hp.max);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Abrir ficha de ${character.name}`}
      style={({ pressed }) => ({
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.lg }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: radius.md,
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.border,
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="heading" numberOfLines={1} style={{ flex: 1 }}>
              {character.name}
            </Text>
            <Chip label={`Nv ${character.level}`} compact tone="gold" />
          </View>

          <Text variant="small" tone="secondary" numberOfLines={1}>
            {[character.race?.name, character.class_label].filter(Boolean).join(' · ') ||
              'Sem classe definida'}
          </Text>

          {character.campaign ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Icon name="campanhas" size={13} color={colors.textSubtle} />
              <Text variant="small" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
                {character.campaign.name}
              </Text>
            </View>
          ) : (
            <Text variant="small" tone="muted">
              Ainda não está em uma campanha
            </Text>
          )}

          {character.player && !character.is_owner ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Icon name="personagens" size={13} color={colors.textSubtle} />
              <Text variant="small" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
                {character.player.name}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Barras finas de PV/PM na base: leitura imediata sem ocupar espaço */}
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="caption" tone="secondary">
            PV {character.hp.current}/{character.hp.max}
          </Text>
          <Text variant="caption" tone="secondary">
            PM {character.mp.current}/{character.mp.max}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <ProgressBar
              value={character.hp.current}
              max={character.hp.max}
              temp={character.hp.temp}
              color={severity === 'ok' ? vitais.hp : colors.warning}
              trackColor={vitais.hpTrack}
              height={5}
            />
          </View>
          <View style={{ flex: 1 }}>
            <ProgressBar
              value={character.mp.current}
              max={character.mp.max}
              temp={character.mp.temp}
              color={vitais.mp}
              trackColor={vitais.mpTrack}
              height={5}
            />
          </View>
        </View>
      </View>
    </Pressable>
  );
}
