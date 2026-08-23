import { useState } from 'react';
import { RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, ErrorState, Icon, Loading, Screen, SegmentedControl } from '@/components/ui';
import { PageHeader } from '@/components/layout';
import { MasterDashboardPanel } from '@/components/campaign/MasterDashboardPanel';
import { CombatControl } from '@/components/combat';
import { RealtimeIndicator } from '@/components/campaign/RealtimeIndicator';
import { StageControl, abrirPalco } from '@/components/stage';
import { useMasterDashboard } from '@/hooks/useCampaigns';
import { useCampaignChannel } from '@/realtime/useCampaignChannel';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme';

type Aba = 'painel' | 'mesa' | 'combate';

/**
 * A tela do mestre durante a sessão.
 *
 * Uma tela só, com abas, porque é uma tela só na prática: o mestre passa a
 * noite alternando entre "como estão os jogadores" (PV, condições) e "o que
 * eles estão vendo" (o palco). Enquanto eram rotas separadas, cada alternância
 * custava uma navegação — e cadastrar um NPC no meio da cena custava duas.
 *
 * A mesa de controle traz o acervo dentro dela pelo mesmo motivo: cadastrar e
 * exibir são o mesmo gesto, feito no mesmo minuto.
 *
 * `?aba=mesa` abre direto na mesa de controle, para os atalhos que vêm da tela
 * da campanha caírem no lugar certo.
 */
export default function MasterScreen() {
  const { colors } = useTheme();

  const params = useLocalSearchParams<{ id: string; aba?: string }>();
  const campaignId = Number(params.id);

  const isPlatformMaster = useAuthStore((estado) => estado.user?.is_master ?? false);

  const abaPedida = params.aba === 'mesa' || params.aba === 'combate' ? params.aba : 'painel';
  const [aba, setAba] = useState<Aba>(isPlatformMaster ? abaPedida : 'painel');

  const dashboard = useMasterDashboard(campaignId);

  // Assina o canal privado da campanha: daqui em diante as mudanças de PV, PM,
  // condições e do palco chegam sozinhas, valha qual aba estiver aberta.
  useCampaignChannel(campaignId, true);

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
            {isPlatformMaster ? (
              <Button
                label="Abrir palco"
                variant="gold"
                size="sm"
                icon={<Icon name="mestre" size={16} color={colors.accentInk} />}
                onPress={() => abrirPalco(campaignId)}
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

      {/* As abas só existem para quem tem as duas: o mestre de mesa comum vê o
          painel e mais nada, e um controle de uma opção só seria enfeite. */}
      {isPlatformMaster ? (
        <SegmentedControl
          value={aba}
          onChange={(valor) => setAba(valor as Aba)}
          segments={[
            { value: 'painel', label: 'Painel da mesa' },
            { value: 'mesa', label: 'Mesa de controle' },
            { value: 'combate', label: 'Iniciativa' },
          ]}
        />
      ) : null}

      {aba === 'painel' || !isPlatformMaster ? (
        <MasterDashboardPanel campaignId={campaignId} dashboard={dashboard.data} />
      ) : aba === 'mesa' ? (
        <StageControl campaignId={campaignId} />
      ) : (
        <CombatControl campaignId={campaignId} />
      )}
    </Screen>
  );
}
