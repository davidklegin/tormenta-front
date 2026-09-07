import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import type { MasterDashboard } from '@/api/types';
import { Button, Card, Chip, EmptyState, SegmentedControl, Text } from '@/components/ui';
import { ResponsiveGrid } from '@/components/layout';
import { CharacterStatusCard } from '@/components/campaign/CharacterStatusCard';
import { CombatControl } from '@/components/combat';
import { spacing, useResponsive, useTheme } from '@/theme';

type SortMode = 'name' | 'hp' | 'conditions';

/**
 * Como a mesa está agora: a ordem de iniciativa, e o PV, o PM e as condições
 * de cada personagem.
 *
 * Componente, e não tela, porque divide espaço com a mesa de controle numa
 * aba ao lado — durante a sessão o mestre alterna entre "como estão os
 * jogadores" e "o que eles estão vendo" o tempo todo, e cada alternância que
 * custasse uma navegação seria uma a menos que ele faria.
 *
 * O combate entra aqui, e não numa terceira aba, pelo mesmo motivo levado ao
 * limite: em combate as duas perguntas do mestre são "de quem é a vez" e
 * "quanto ele ainda aguenta", e ele as faz alternadamente a cada trinta
 * segundos. A ordem fica no alto porque é o que ele toca; os cards continuam
 * logo abaixo, no mesmo campo de visão.
 *
 * A ordenação por PV coloca quem está em apuros no topo, que é a pergunta
 * mais frequente do mestre.
 */
export function MasterDashboardPanel({ campaignId, dashboard }: { campaignId: number; dashboard: MasterDashboard | undefined }) {
  const { isDesktop } = useResponsive();
  const [sort, setSort] = useState<SortMode>('hp');

  const characters = useMemo(() => {
    const list = [...(dashboard?.characters ?? [])];

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
  }, [dashboard?.characters, sort]);

  const summary = useMemo(() => {
    const list = dashboard?.characters ?? [];

    return {
      total: list.length,
      down: list.filter((character) => character.status.is_down).length,
      critical: list.filter((character) => character.status.severity === 'critical').length,
      conditions: list.reduce((total, character) => total + character.conditions.length, 0),
    };
  }, [dashboard?.characters]);

  return (
    <View style={{ gap: spacing.lg }}>
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

      {/* A iniciativa: faixa de comando em combate, uma linha discreta fora
          dele. Só aparece para quem pode mexer nela (ver CombatControl). */}
      <CombatControl campaignId={campaignId} />

      <View
        style={{ flexDirection: isDesktop ? 'row' : 'column', gap: spacing.lg, alignItems: 'flex-start' }}
      >
        <View style={{ flex: 1, gap: spacing.md, width: '100%' }}>
          <SegmentedControl
            value={sort}
            onChange={(valor) => setSort(valor as SortMode)}
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
    </View>
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
