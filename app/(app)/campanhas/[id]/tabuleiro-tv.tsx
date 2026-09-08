import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ErrorState, Icon, Loading, Screen, Text } from '@/components/ui';
import { BattleMapCanvas } from '@/components/battlemap';
import { InitiativeTracker } from '@/components/combat';
import { useBattleMapDaMesa } from '@/hooks/useBattleMap';
import { useCampaign } from '@/hooks/useCampaigns';
import { useCombat } from '@/hooks/useCombat';
import { useCampaignChannel } from '@/realtime/useCampaignChannel';
import { radius, spacing, stroke, useResponsive, useTheme } from '@/theme';

/**
 * O tabuleiro na TV: a tela virada para a mesa.
 *
 * É o irmão do palco. Fica aberta a noite inteira num aparelho do outro lado
 * da sala, e por isso não tem barra de ferramentas, lista de peças, nem
 * qualquer coisa em que se possa esbarrar: o que aparece aqui é o mapa, e o
 * resto é fundo.
 *
 * Duas decisões a distinguem da tela do tabuleiro:
 *
 *   · **Ela pede a visão da MESA, mesmo do mestre.** Quem está logado no
 *     aparelho da sala costuma ser ele — é o computador dele ligado na TV —, e
 *     sem isso a tela grande mostraria a emboscada guardada para o segundo
 *     round e o que está sob a névoa. O corte é feito no servidor
 *     (`?view=table`), e não aqui: o que não deve ser visto não chega.
 *   · **Não se mexe em nada.** Arrastar e aproximar continuam, porque alguém
 *     precisa poder mostrar o canto do salão. Selecionar e mover peça, não —
 *     um toque acidental na TV moveria o dragão na tela de todo mundo.
 */
export default function TabuleiroTvScreen() {
  const { colors } = useTheme();
  const { isPhone } = useResponsive();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{ id: string }>();
  const campaignId = Number(params.id);

  const campaign = useCampaign(campaignId);
  const tabuleiro = useBattleMapDaMesa(campaignId);
  const combate = useCombat(campaignId);

  useCampaignChannel(campaignId, true);

  const [pedidoDeCentralizar, setPedidoDeCentralizar] = useState(0);

  // A barra some sozinha depois de alguns segundos parada. Numa TV ninguém
  // deve ler "Sair" a noite toda; num toque ela volta.
  const [barraVisivel, setBarraVisivel] = useState(true);

  useEffect(() => {
    if (!barraVisivel) return;

    const relogio = setTimeout(() => setBarraVisivel(false), 6000);

    return () => clearTimeout(relogio);
  }, [barraVisivel]);

  const emTelaCheia = acaoDeTelaCheia();
  const mapa = tabuleiro.data;

  if (tabuleiro.isLoading) {
    return (
      <Screen constrained={false}>
        <Loading label="Abrindo o tabuleiro…" />
      </Screen>
    );
  }

  if (tabuleiro.isError) {
    return (
      <Screen constrained={false}>
        <ErrorState
          error={tabuleiro.error}
          onRetry={() => void tabuleiro.refetch()}
          title="O tabuleiro não abriu"
        />
      </Screen>
    );
  }

  return (
    <Pressable
      onPress={() => setBarraVisivel(true)}
      // Sem papel de botão: é a tela inteira, e anunciá-la como botão faria o
      // leitor de tela ler "botão" antes de qualquer coisa do mapa.
      accessible={false}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      {mapa?.id ? (
        <BattleMapCanvas
          battleMap={mapa}
          minhasFichas={[]}
          ehMestre={false}
          modo="navegar"
          somenteLeitura
          tokenSelecionado={null}
          onSelecionarToken={() => {}}
          onMoverToken={() => {}}
          pedidoDeCentralizar={pedidoDeCentralizar}
        />
      ) : (
        <Cortina nome={campaign.data?.name} />
      )}

      {/* A ordem de iniciativa por cima, no canto — como no palco. Durante o
          combate é o que a mesa mais consulta, e ela não pode depender de
          alguém rolar a tela da TV. */}
      {combate.data?.active ? (
        <View
          style={{
            position: 'absolute',
            top: insets.top + spacing.md,
            right: spacing.lg,
            zIndex: 50,
          }}
          pointerEvents="none"
        >
          <InitiativeTracker combat={combate.data} compacto={isPhone} />
        </View>
      ) : null}

      {barraVisivel ? (
        <View
          style={{
            position: 'absolute',
            top: insets.top + spacing.xs,
            left: spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
            borderRadius: radius.lg,
            borderWidth: stroke.hairline,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            opacity: 0.9,
            zIndex: 60,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Sair da exibição"
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xxs }}
          >
            <Icon name="voltar" size={16} color={colors.textMuted} />
            <Text variant="caption" tone="muted">
              Sair
            </Text>
          </Pressable>

          <Text variant="caption" tone="muted" numberOfLines={1}>
            {mapa?.name ?? campaign.data?.name ?? 'Tabuleiro'}
          </Text>

          <Pressable
            onPress={() => setPedidoDeCentralizar((n) => n + 1)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Centralizar o mapa"
          >
            <Text variant="caption" tone="muted">
              Centralizar
            </Text>
          </Pressable>

          {emTelaCheia ? (
            <Pressable
              onPress={emTelaCheia}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Tela cheia"
            >
              <Text variant="caption" tone="muted">
                Tela cheia
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Nenhum mapa na mesa.
 *
 * Uma TV preta na frente do grupo parece defeito. Aqui ela diz o que está
 * acontecendo — nada, ainda.
 */
function Cortina({ nome }: { nome?: string }) {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
      <Icon name="pericias" size={56} color={colors.textSubtle} />
      <Text variant="heading" tone="secondary" center>
        {nome ?? 'Tabuleiro'}
      </Text>
      <Text variant="small" tone="muted" center>
        O mestre ainda não pôs um mapa na mesa.
      </Text>
    </View>
  );
}

/**
 * Pedido de tela cheia na web. Não é hook — não guarda estado nem assina nada.
 *
 * Devolve `null` fora da web e onde o navegador não oferece a API, para o botão
 * simplesmente não aparecer em vez de aparecer e não fazer nada. É o mesmo
 * caminho do palco: numa TV, a barra de endereço rouba um pedaço da cena.
 */
function acaoDeTelaCheia(): (() => void) | null {
  const disponivel =
    Platform.OS === 'web' &&
    typeof document !== 'undefined' &&
    typeof document.documentElement?.requestFullscreen === 'function';

  if (!disponivel) return null;

  return () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();

      return;
    }

    void document.documentElement.requestFullscreen();
  };
}
