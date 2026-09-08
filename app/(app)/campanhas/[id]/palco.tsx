import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ErrorState, Icon, Loading, Screen, Text } from '@/components/ui';
import { StagePosterView } from '@/components/stage';
import { InitiativeTracker } from '@/components/combat';
import { useCampaign } from '@/hooks/useCampaigns';
import { useCombat } from '@/hooks/useCombat';
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
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{ id: string }>();
  const campaignId = Number(params.id);

  const campaign = useCampaign(campaignId);
  const stage = useStage(campaignId);
  const combat = useCombat(campaignId);

  // O canal é quem traz a mudança durante a sessão; a consulta acima só cobre
  // a abertura da tela e a queda do socket.
  useCampaignChannel(campaignId, true);

  /**
   * A imagem ocupando a tela inteira.
   *
   * Duas origens, e as duas convivem. O mestre liga o modo pela mesa de
   * controle e ele vale para a mesa inteira — é a resposta para "vejam este
   * mapa direito", e chega à TV e a cada celular pelo canal da campanha. O
   * toque na imagem amplia só na tela de quem tocou: o jogador que quer olhar
   * de perto no aparelho dele não deve mexer no que está projetado na parede.
   *
   * Fica aqui em cima, e não junto de onde é usado, porque abaixo há saídas
   * antecipadas — um hook depois delas rodaria em umas renderizações e não em
   * outras.
   */
  const [ampliadaAqui, setAmpliadaAqui] = useState(false);

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
  const combate = combat.data ?? null;

  const imagem = poster?.image_url ?? null;
  const ampliada = imagem !== null && (stage.data?.image_fullscreen || ampliadaAqui);

  if (ampliada && imagem) {
    return (
      <Pressable
        onPress={() => setAmpliadaAqui((atual) => !atual)}
        accessibilityRole="button"
        accessibilityLabel={`${poster?.title ?? 'Imagem'} em tela cheia. Toque para voltar ao cartaz.`}
        // Preto, e não a cor do tema: é o fundo que some atrás de um mapa
        // recortado, e é o que a mesa espera de uma projeção.
        style={{ flex: 1, backgroundColor: '#000' }}
      >
        <Image
          source={{ uri: imagem }}
          style={{ flex: 1 }}
          /* `contain`: um mapa cortado nas bordas perde justamente o corredor
             que alguém está procurando. */
          contentFit="contain"
          transition={200}
          accessibilityLabel={poster?.title}
        />

        {/* O nome, apagado, num canto. Sem ele a mesa perde a referência do
            que está vendo quando a imagem não se explica sozinha. */}
        {poster?.title ? (
          <View
            style={{
              position: 'absolute',
              bottom: insets.bottom + spacing.md,
              left: spacing.lg,
              opacity: 0.6,
            }}
            pointerEvents="none"
          >
            <Text variant="small" style={{ color: '#fff' }}>
              {poster.title}
            </Text>
          </View>
        ) : null}

        {/* Sair continua ao alcance: no celular do jogador esta é a tela
            inteira, e sem saída ele fica preso na imagem. */}
        <Pressable
          onPress={() => {
            setAmpliadaAqui(false);
            router.back();
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Sair do palco"
          style={{
            position: 'absolute',
            top: insets.top + spacing.sm,
            left: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xxs,
            opacity: 0.55,
          }}
        >
          <Icon name="voltar" size={16} color="#fff" />
          <Text variant="caption" style={{ color: '#fff' }}>
            Sair
          </Text>
        </Pressable>

        {combate?.active ? (
          <View
            style={{
              position: 'absolute',
              top: insets.top + spacing.sm,
              right: spacing.lg,
              zIndex: 50,
            }}
            pointerEvents="none"
          >
            <InitiativeTracker combat={combate} compacto={isPhone} />
          </View>
        ) : null}
      </Pressable>
    );
  }

  return (
    <View style={{ flex: 1 }}>
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
        {poster ? (
          /*
            Tocar no cartaz amplia a imagem — só aqui, nesta tela.

            É a saída do jogador que está no celular e quer ver o mapa de
            perto sem pedir ao mestre. Quando não há imagem, o toque não faz
            nada, e por isso o cartaz não vira botão nesse caso.
          */
          <Pressable
            onPress={imagem ? () => setAmpliadaAqui(true) : undefined}
            disabled={!imagem}
            accessibilityRole={imagem ? 'button' : undefined}
            accessibilityLabel={imagem ? `Ver ${poster.title} em tela cheia` : undefined}
          >
            <StagePosterView poster={poster} modo="palco" />
          </Pressable>
        ) : (
          <Cortina nome={campaign.data?.name} />
        )}
      </View>
      </Screen>

      {/* A ordem de iniciativa fica POR CIMA, fixa no canto: durante o combate
          ela é consultada a cada dez segundos, e rolar a tela atrás dela — ou
          perdê-la quando o mestre troca o que está exibindo — devolveria a
          pergunta "de quem é a vez?" para a mesa em voz alta. */}
      {combate?.active ? (
        <View
          style={{
            position: 'absolute',
            top: insets.top + spacing.xxl,
            right: spacing.lg,
            zIndex: 50,
          }}
          pointerEvents="none"
        >
          <InitiativeTracker combat={combate} compacto={isPhone} />
        </View>
      ) : null}
    </View>
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
