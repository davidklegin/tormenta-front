import { RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { Button, EmptyState, ErrorState, Icon, Loading, Screen, Text } from '@/components/ui';
import { CharacterCard } from '@/components/character/CharacterCard';
import { PageHeader, ResponsiveGrid } from '@/components/layout';
import { useCharacters } from '@/hooks/useCharacters';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useAuthStore } from '@/store/auth';
import { radius, spacing, useTheme } from '@/theme';

/**
 * Tela inicial do jogador (briefing §8).
 *
 * Lista os personagens e, quando o usuário mestra alguma campanha, oferece o
 * atalho para o Painel do Mestre — a porta de entrada da sessão.
 */
export default function CharactersScreen() {
  const { colors } = useTheme();

  const user = useAuthStore((state) => state.user);
  const characters = useCharacters();
  const campaigns = useCampaigns();

  const masteredCampaigns = (campaigns.data ?? []).filter((campaign) => campaign.is_master);

  if (characters.isLoading) {
    return (
      <Screen insideTabs>
        <Loading label="Carregando seus personagens…" />
      </Screen>
    );
  }

  return (
    <Screen
      insideTabs
      refreshControl={
        <RefreshControl
          refreshing={characters.isRefetching}
          onRefresh={() => {
            void characters.refetch();
            void campaigns.refetch();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <PageHeader
        title={`Olá, ${user?.nickname || user?.name?.split(' ')[0] || 'aventureiro'}`}
        subtitle="Seus personagens e mesas"
        actions={
          <Button label="Novo personagem" size="sm" onPress={() => router.push('/(app)/personagens/novo')} />
        }
      />

      {characters.isError ? (
        <ErrorState error={characters.error} onRetry={() => void characters.refetch()} />
      ) : null}

      {/* Atalho de mestre (briefing §8) */}
      {masteredCampaigns.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="mestre" size={18} color={colors.accentInk} />
            <Text variant="caption" tone="secondary" uppercase>
              Campanhas que você mestra
            </Text>
          </View>
          <ResponsiveGrid columns={{ phone: 1, tablet: 2, desktop: 3 }}>
            {masteredCampaigns.map((campaign) => (
              <View
                key={campaign.id}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderLeftWidth: 3,
                  borderLeftColor: colors.accentInk,
                  padding: spacing.lg,
                  gap: spacing.md,
                }}
              >
                <View style={{ gap: 2 }}>
                  <Text variant="subheading" numberOfLines={1}>
                    {campaign.name}
                  </Text>
                  <Text variant="small" tone="muted">
                    {campaign.characters_count ?? 0} personagem(ns) · {campaign.members_count ?? 0} membro(s)
                  </Text>
                </View>
                <Button
                  label="Abrir Painel do Mestre"
                  variant="gold"
                  size="sm"
                  onPress={() => router.push(`/(app)/campanhas/${campaign.id}/painel`)}
                />
              </View>
            ))}
          </ResponsiveGrid>
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name="personagens" size={18} color={colors.textMuted} />
          <Text variant="caption" tone="secondary" uppercase>
            Meus personagens
          </Text>
        </View>

        {(characters.data ?? []).length === 0 ? (
          <EmptyState
            icon="personagens"
            title="Vamos criar seu primeiro personagem"
            description="A ficha guarda vida, mana, perícias, magias e tudo o que você usa durante a sessão. Dá para preencher aos poucos — comece pelo nome e pela classe."
            actionLabel="Criar personagem"
            onAction={() => router.push('/(app)/personagens/novo')}
          />
        ) : (
          <ResponsiveGrid columns={{ phone: 1, tablet: 2, desktop: 3 }}>
            {(characters.data ?? []).map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                onPress={() => router.push(`/(app)/personagens/${character.id}`)}
              />
            ))}
          </ResponsiveGrid>
        )}
      </View>
    </Screen>
  );
}
