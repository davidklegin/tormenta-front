import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Icon, Text } from '@/components/ui';
import { useCombatAlertStore } from '@/store/combat';
import { useUserChannel } from '@/realtime/useUserChannel';
import { nativeDriver, radius, spacing, stroke, useMotion, useResponsive, useTheme } from '@/theme';

/** Quanto tempo o alerta da vez fica na tela antes de sair sozinho. */
const DURACAO_DO_ALERTA = 15_000;

/** O aviso de preparação é discreto e some antes. */
const DURACAO_DO_AVISO = 10_000;

/**
 * "É a sua vez" na tela do jogador.
 *
 * Monta uma vez na área logada, acima de todas as telas, e assina o canal
 * pessoal: quando a vez chega, o jogador quase nunca está na tela do combate —
 * está na ficha conferindo PM ou no grimório procurando a magia. O aviso
 * precisa alcançá-lo onde ele estiver.
 *
 * São duas intensidades, porque são dois momentos diferentes:
 *
 *   · **Sua vez** — a tela inteira pulsa em vermelho. É chamativo de
 *     propósito: numa mesa barulhenta, um aviso educado é um aviso perdido, e
 *     o custo de perder a vez é a mesa inteira esperando.
 *   · **Você é o próximo** — uma faixa no topo, que não interrompe nada. Serve
 *     para o jogador decidir o que vai fazer antes de a vez chegar, que é o
 *     que faz o combate andar.
 *
 * O pulso respeita movimento reduzido: com ele ligado, a moldura vermelha
 * aparece parada. Continua impossível de ignorar, e não pisca na cara de quem
 * pediu para nada piscar.
 */
export function TurnAlertOverlay() {
  useUserChannel();

  const alerta = useCombatAlertStore((estado) => estado.alerta);
  const aviso = useCombatAlertStore((estado) => estado.aviso);
  const dispensarAlerta = useCombatAlertStore((estado) => estado.dispensarAlerta);
  const dispensarAviso = useCombatAlertStore((estado) => estado.dispensarAviso);

  // Sai sozinho: o jogador que voltou ao celular no meio do turno não deveria
  // achar a tela vermelha esperando por ele.
  useEffect(() => {
    if (!alerta) return;

    const relogio = setTimeout(dispensarAlerta, DURACAO_DO_ALERTA);

    return () => clearTimeout(relogio);
  }, [alerta, dispensarAlerta]);

  useEffect(() => {
    if (!aviso) return;

    const relogio = setTimeout(dispensarAviso, DURACAO_DO_AVISO);

    return () => clearTimeout(relogio);
  }, [aviso, dispensarAviso]);

  return (
    <>
      {aviso ? <AvisoDePreparacao nome={aviso.entry.name} onDispensar={dispensarAviso} /> : null}
      {alerta ? (
        <AlertaDaVez
          nome={alerta.entry.name}
          rodada={alerta.round}
          mesa={alerta.campaign.name}
          onDispensar={dispensarAlerta}
        />
      ) : null}
    </>
  );
}

function AlertaDaVez({
  nome,
  rodada,
  mesa,
  onDispensar,
}: {
  nome: string;
  rodada: number;
  mesa: string;
  onDispensar: () => void;
}) {
  const { colors } = useTheme();
  const { reduced } = useMotion();
  const { isPhone } = useResponsive();

  const pulso = useRef(new Animated.Value(reduced ? 0.5 : 0)).current;

  useEffect(() => {
    if (reduced) return;

    const animacao = Animated.loop(
      Animated.sequence([
        Animated.timing(pulso, { toValue: 1, duration: 520, useNativeDriver: nativeDriver }),
        Animated.timing(pulso, { toValue: 0, duration: 520, useNativeDriver: nativeDriver }),
      ])
    );

    animacao.start();

    return () => animacao.stop();
  }, [pulso, reduced]);

  const opacidade = pulso.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.62] });

  return (
    <View
      // Cobre a tela inteira e recebe o toque: dispensar é o gesto mais
      // provável, e ele não deve exigir mira.
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}
      pointerEvents="box-none"
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.danger,
          opacity: opacidade,
        }}
        pointerEvents="none"
      />

      <Pressable
        onPress={onDispensar}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}
        accessibilityRole="button"
        accessibilityLabel="Entendi, é a minha vez"
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderWidth: stroke.plate,
            borderColor: colors.danger,
            paddingVertical: spacing.xl,
            paddingHorizontal: isPhone ? spacing.lg : spacing.xxl,
            gap: spacing.md,
            alignItems: 'center',
            maxWidth: 520,
          }}
        >
          <Icon name="condicao" size={40} color={colors.dangerInk} />

          <Text variant={isPhone ? 'title' : 'display'} tone="danger" center>
            É a sua vez
          </Text>

          <Text variant="subheading" center numberOfLines={2}>
            {nome}
          </Text>

          <Text variant="small" tone="secondary" center>
            {mesa} · rodada {rodada}
          </Text>

          <Button label="Estou pronto" onPress={onDispensar} />
        </View>
      </Pressable>
    </View>
  );
}

/**
 * "Você é o próximo": faixa no topo, sem cobrir nada.
 *
 * Fica presa ao topo com `pointerEvents="box-none"`: a faixa ocupa a largura
 * da tela para se posicionar, mas só ela recebe toque — o resto continua
 * chegando à tela de baixo, que o jogador ainda está usando.
 */
function AvisoDePreparacao({ nome, onDispensar }: { nome: string; onDispensar: () => void }) {
  const { colors, elevation } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        position: 'absolute',
        top: insets.top + spacing.space3,
        left: spacing.md,
        right: spacing.md,
        alignItems: 'center',
        zIndex: 90,
      }}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={onDispensar}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          maxWidth: 460,
          backgroundColor: colors.warningFill,
          borderRadius: radius.md,
          borderWidth: stroke.hairline,
          borderColor: colors.warning,
          borderLeftWidth: stroke.plate,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          ...elevation.floating,
        }}
        accessibilityRole="button"
        accessibilityLabel="Dispensar aviso"
      >
        <Icon name="alerta" size={18} color={colors.warningInk} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="smallStrong" tone="warning">
            Prepare-se — o próximo turno é seu
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {nome}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
