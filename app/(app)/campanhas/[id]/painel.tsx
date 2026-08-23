import { useMemo, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Loading,
  Screen,
  SegmentedControl,
  Text,
} from '@/components/ui';
import { CharacterStatusCard } from '@/components/campaign/CharacterStatusCard';
import { RealtimeIndicator } from '@/components/campaign/RealtimeIndicator';
import { PageHeader, ResponsiveGrid } from '@/components/layout';
import { useMasterDashboard } from '@/hooks/useCampaigns';
import { useCampaignChannel } from '@/realtime/useCampaignChannel';
import { useAuthStore } from '@/store/auth';
import { spacing, useResponsive, useTheme } from '@/theme';

type SortMode = 'name' | 'hp' | 'conditions';

/**
 * Painel do Mestre (briefing §5, §6 e §7).
 *
 * Feita para ficar aberta durante a sessão inteira: os cards se atualizam
 * sozinhos via WebSocket, sem recarregar a tela. A ordenação por PV coloca
 * quem está em apuros no topo, que é a pergunta mais frequente do mestre.
 *
 * Em telas grandes vira uma grade com resumo lateral, aproveitando o espaço
 * em vez de esticar o layout de celular (briefing §21).
 */
export default function MasterDashboardScreen() {
  const { colors } = useTheme();

  const params = useLocalSearchParams<{ id: string }>();
  const campaignId = Number(params.id);
  const { isDesktop } = useResponsive();

  const dashboard = useMasterDashboard(campaignId);
  const isPlatformMaster = useAuthStore((estado) => estado.user?.is_master ?? false);

  // Assina o canal privado da campanha: daqui em diante as mudanças de PV, PM
  // e condições chegam sozinhas.
  useCampaignChannel(campaignId, true);

  const [sort, setSort] = useState<SortMode>('hp');

  const characters = useMemo(() => {
    const list = [...(dashboard.data?.characters ?? [])];

    if (sort === 'name') {
      return list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }

    if (sort === 'conditions') {
      return list.sort(
        (a, b) => b.conditions.length - a.conditions.length || a.name.localeCompare(b.name, 'pt-BR')
      );
    }

    // Menor fração de PV primeiro: quem está mais perto de cair aparece antes.
    return list.sort((a, b) => a.hp.ratio - b.hp.ratio);
  }, [dashboard.data?.characters, sort]);

  const summary = useMemo(() => {
    const list = dashboard.data?.characters ?? [];

    return {
      total: list.length,
      down: list.filter((character) => character.status.is_down).length,
      critical: list.filter((character) => character.status.severity === 'critical').length,
      conditions: list.reduce((total, character) => total + character.conditions.length, 0),
    };
  }, [dashboard.data?.characters]);

  if (dashboard.isLoading) {
    return (
      <Screen>
        <Loading label="Abrindo o Painel do Mestre…" />
      </Screen>
    );
  }

  if (dashboard.isError) {
    return (
      <Screen>
        <PageHeader title="Painel do Mestre" back />
        <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen
      constrained={false}
      refreshControl={
        <RefreshControl
          refreshing={dashboard.isRefetching}
          onRefresh={() => void dashboard.refetch()}
          tintColor={colors.primary}
        />
      }
    >
      <PageHeader
        title="Painel do Mestre"
        subtitle={dashboard.data?.campaign.name}
        back
        backLabel="Campanhas"
        actions={
          <>
            <RealtimeIndicator />
            {/* O painel e a mesa de controle andam juntos durante a sessão:
                um mostra como a mesa está, o outro o que ela está vendo. */}
            {isPlatformMaster ? (
              <Button
                label="Mesa de Controle"
                variant="gold"
                size="sm"
                onPress={() => router.push(`/(app)/campanhas/${campaignId}/controle`)}
              />
            ) : null}
            <Button
              label="Campanha"
              variant="secondary"
              size="sm"
              onPress={() => router.push(`/(app)/campanhas/${campaignId}`)}
            />
          </>
        }
      />

      {/* Resumo rápido da mesa */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <SummaryTile label="Personagens" value={summary.total} />
        <SummaryTile label="Caídos" value={summary.down} tone={summary.down > 0 ? 'danger' : 'neutral'} />
        <SummaryTile
          label="PV crítico"
          value={summary.critical}
          tone={summary.critical > 0 ? 'warning' : 'neutral'}
        />
        <SummaryTile label="Condições" value={summary.conditions} />
      </View>

      <View
        style={{ flexDirection: isDesktop ? 'row' : 'column', gap: spacing.lg, alignItems: 'flex-start' }}
      >
        <View style={{ flex: 1, gap: spacing.md, width: '100%' }}>
          <SegmentedControl
            value={sort}
            onChange={setSort}
            segments={[
              { value: 'hp', label: 'Mais feridos' },
              { value: 'name', label: 'Por nome' },
              { value: 'conditions', label: 'Com condições' },
            ]}
          />

          {characters.length === 0 ? (
            <EmptyState
              icon="personagens"
              title="Nenhum personagem na mesa"
              description="Os personagens aparecem aqui quando os jogadores os vincularem a esta campanha."
              actionLabel="Ver campanha"
              onAction={() => router.push(`/(app)/campanhas/${campaignId}`)}
            />
          ) : (
            <ResponsiveGrid columns={{ phone: 1, tablet: 2, desktop: 3 }}>
              {characters.map((character) => (
                <CharacterStatusCard
                  key={character.id}
                  character={character}
                  onPress={() => router.push(`/(app)/personagens/${character.id}`)}
                />
              ))}
            </ResponsiveGrid>
          )}
        </View>

        {/* Coluna lateral só no desktop: mais informação simultânea (§21) */}
        {isDesktop ? (
          <View style={{ width: 300, gap: spacing.md }}>
            <Card title="Situação da mesa">
              <View style={{ gap: spacing.sm }}>
                {characters.map((character) => (
                  <View
                    key={character.id}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}
                  >
                    <Text variant="small" numberOfLines={1} style={{ flex: 1 }}>
                      {character.name}
                    </Text>
                    <Text
                      variant="smallStrong"
                      tone={
                        character.status.severity === 'ok'
                          ? 'secondary'
                          : character.status.severity === 'warning'
                            ? 'warning'
                            : 'danger'
                      }
                    >
                      {character.hp.current}/{character.hp.max}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>

            <Card title="Condições ativas">
              {summary.conditions === 0 ? (
                <Text variant="small" tone="muted">
                  Ninguém sob efeito de condição.
                </Text>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {characters
                    .filter((character) => character.conditions.length > 0)
                    .map((character) => (
                      <View key={character.id} style={{ gap: spacing.xs }}>
                        <Text variant="smallStrong" numberOfLines={1}>
                          {character.name}
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                          {character.conditions.map((condition) => (
                            <Chip
                              key={condition.id}
                              label={condition.name}
                              compact
                              tone={condition.is_incapacitating ? 'danger' : 'warning'}
                            />
                          ))}
                        </View>
                      </View>
                    ))}
                </View>
              )}
            </Card>

            <Card title="Anotações da campanha">
              <Button
                label="Abrir anotações"
                variant="secondary"
                size="sm"
                onPress={() => router.push(`/(app)/campanhas/${campaignId}/anotacoes`)}
              />
            </Card>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function SummaryTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'warning' | 'danger';
}) {
  const { colors } = useTheme();

  const color = tone === 'danger' ? colors.danger : tone === 'warning' ? colors.warning : colors.text;

  return (
    <View
      style={{
        flexGrow: 1,
        minWidth: 120,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: tone === 'neutral' ? colors.border : color,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        gap: 2,
      }}
    >
      <Text variant="caption" tone="secondary" uppercase>
        {label}
      </Text>
      <Text variant="numeric" style={{ color, fontSize: 24 }}>
        {value}
      </Text>
    </View>
  );
}
