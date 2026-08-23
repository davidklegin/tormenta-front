import { Platform, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ErrorState, Icon, Loading, Screen, Text } from '@/components/ui';
import { StagePosterView } from '@/components/stage';
import { useCampaign } from '@/hooks/useCampaigns';
import { useStage } from '@/hooks/useStage';
import { useCampaignChannel } from '@/realtime/useCampaignChannel';
import { radius, spacing, stroke, useResponsive, useTheme } from '@/theme';

/**
 * O palco: a tela virada para os jogadores.
 *
 * Feita para uma coisa só — ficar aberta a noite inteira numa TV, do outro
 * lado da mesa, mostrando o que o mestre manda da tela dele. Por isso não tem
 * cabeçalho, abas nem nada em que se possa esbarrar: o que aparece aqui é o
 * cartaz, e o resto é fundo.
 *
 * Os jogadores também abrem esta rota no próprio aparelho — a mesma exibição
 * chega às duas telas pelo canal da campanha.
 *
 * O que está no ar é *estado*, não notificação: recarregar a página, perder o
 * wi-fi e reconectar, ou abrir a tela no meio da cena devolvem exatamente o
 * mesmo cartaz. Foi por isso que o palco virou uma tabela no servidor em vez
 * de reaproveitar o "Exibir aos outros" da ficha, que é um aviso passageiro.
 */
export default function StageScreen() {
  const { colors } = useTheme();
  const { isPhone, height: altura } = useResponsive();

  const params = useLocalSearchParams<{ id: string }>();
  const campaignId = Number(params.id);

  const campaign = useCampaign(campaignId);
  const stage = useStage(campaignId);

  // O canal é quem traz a mudança durante a sessão; a consulta acima só cobre
  // a abertura da tela e a queda do socket.
  useCampaignChannel(campaignId, true);

  // Numa TV, a barra de endereço rouba um pedaço da cena. Na web dá para pedir
  // tela cheia — nas plataformas nativas o app já ocupa tudo.
  const emTelaCheia = acaoDeTelaCheia();

  if (stage.isLoading) {
    return (
      <Screen constrained={false}>
        <Loading label="Abrindo o palco…" />
      </Screen>
    );
  }

  if (stage.isError) {
    return (
      <Screen constrained={false}>
        <ErrorState
          error={stage.error}
          onRetry={() => void stage.refetch()}
          title="O palco não abriu"
        />
      </Screen>
    );
  }

  const poster = stage.data?.poster ?? null;

  return (
    <Screen constrained={false} scroll>
      {/* Barra mínima: sair e tela cheia. Fica apagada de propósito — na TV
          ninguém deve ler isto, e no celular do jogador ainda é o caminho de
          volta. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, opacity: 0.55 }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Sair do palco"
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xxs }}
        >
          <Icon name="voltar" size={16} color={colors.textMuted} />
          <Text variant="caption" tone="muted">
            Sair
          </Text>
        </Pressable>

        <View style={{ flex: 1 }} />

        <Text variant="caption" tone="muted" numberOfLines={1}>
          {campaign.data?.name ?? 'Palco da sessão'}
        </Text>

        {emTelaCheia ? (
          <Pressable
            onPress={emTelaCheia}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Tela cheia"
            style={{ paddingHorizontal: spacing.xs }}
          >
            <Text variant="caption" tone="muted">
              Tela cheia
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* O cartaz ocupa a altura da tela e fica centrado nela: numa TV, um NPC
          curto encostado no topo deixa dois terços de vazio embaixo. */}
      <View style={{ minHeight: altura - 140, justifyContent: 'center', paddingVertical: isPhone ? spacing.md : spacing.xl }}>
        {poster ? <StagePosterView poster={poster} modo="palco" /> : <Cortina nome={campaign.data?.name} />}
      </View>
    </Screen>
  );
}

/**
 * A cortina fechada.
 *
 * Precisa existir com desenho próprio: entre uma cena e outra o palco fica
 * vazio por minutos, e uma tela em branco na frente da mesa parece defeito.
 * Aqui ela diz o que está acontecendo — nada, ainda.
 */
function Cortina({ nome }: { nome?: string }) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
        paddingVertical: spacing.xxxl * 2,
        borderRadius: radius.lg,
        borderWidth: stroke.hairline,
        borderColor: colors.border,
        borderStyle: 'dashed',
        backgroundColor: colors.surfaceAlt,
      }}
    >
      <Icon name="mestre" size={48} color={colors.textSubtle} />
      <Text variant="heading" tone="secondary" center>
        {nome ?? 'Palco da sessão'}
      </Text>
      <Text variant="small" tone="muted" center>
        Aguardando o mestre exibir algo.
      </Text>
    </View>
  );
}

/**
 * Pedido de tela cheia na web. Não é hook — não guarda estado nem assina nada.
 *
 * Devolve `null` fora da web e onde o navegador não oferece a API — assim o
 * botão simplesmente não aparece, em vez de aparecer e não fazer nada.
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
