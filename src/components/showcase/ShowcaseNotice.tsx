import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import type { ShowcaseEvent } from '@/api/types';
import { Icon, Text } from '@/components/ui';
import { easing, nativeDriver, radius, spacing, stroke, useMotion, useTheme } from '@/theme';

/** Quanto tempo o aviso fica em cena antes de sumir sozinho. */
const DURACAO = 8000;

/** O ícone da aba a que o item pertence — o mesmo símbolo que a ficha usa. */
const ICONES = {
  power: 'poderes',
  spell: 'magias',
  item: 'equipamento',
  class_ability: 'habilidades',
} as const;

/**
 * "Fulano exibiu Bola de Fogo" — o aviso que chega no meio da sessão
 * (briefing §21).
 *
 * É o `Toast` do kit vestido de convite: o aviso inteiro é o alvo de toque,
 * porque a ação existe justamente para ser aceita, e obrigar a acertar um botão
 * pequeno no canto seria mesquinho com quem está com o celular numa mão e o
 * dado na outra.
 *
 * Oito segundos, e não os quatro do Toast comum: aqui o usuário precisa ler
 * quem exibiu, o que foi exibido e **decidir** se quer abrir. Some sozinho
 * depois disso — quem estava no meio de outra coisa não fica com o aviso preso
 * na tela, e nada se perde que não possa ser exibido de novo.
 */
export function ShowcaseNotice({
  evento,
  onAbrir,
  onDispensar,
}: {
  evento: ShowcaseEvent;
  onAbrir: () => void;
  onDispensar: () => void;
}) {
  const { colors, elevation } = useTheme();
  const { reduced, ms } = useMotion();

  const entrada = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animacao = Animated.timing(entrada, {
      toValue: 1,
      duration: reduced ? 0 : ms('base'),
      easing: easing.decelerate,
      useNativeDriver: nativeDriver,
    });
    animacao.start();

    return () => animacao.stop();
  }, [entrada, reduced, ms]);

  useEffect(() => {
    const relogio = setTimeout(onDispensar, DURACAO);

    return () => clearTimeout(relogio);
  }, [onDispensar]);

  const quemExibiu = evento.actor.nickname || evento.actor.name;

  return (
    <Animated.View
      style={{
        opacity: entrada,
        transform: [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
      }}
    >
      <Pressable
        onPress={onAbrir}
        accessibilityRole="button"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${quemExibiu} exibiu ${evento.kind_label.toLowerCase()} ${evento.title}. Toque para ver.`}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.space3,
            backgroundColor: pressed ? colors.surfaceHover : colors.surface,
            borderWidth: stroke.hairline,
            borderColor: colors.accent,
            borderLeftWidth: stroke.plate,
            borderLeftColor: colors.primary,
            borderRadius: radius.md,
            paddingVertical: spacing.space3,
            paddingHorizontal: spacing.space4,
          },
          elevation.floating,
        ]}
      >
        <Retrato url={evento.actor.avatar_url} nome={quemExibiu} />

        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {quemExibiu} exibiu · {evento.character.name}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.space2 }}>
            <Icon name={ICONES[evento.kind]} size={15} color={colors.primary} />
            <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
              {evento.title}
            </Text>
          </View>

          <Text variant="caption" tone="secondary">
            Toque para ver
          </Text>
        </View>

        <Pressable
          onPress={onDispensar}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Dispensar aviso"
          // O padding é o que garante o alvo na web: ali o `hitSlop` não vira
          // área clicável, e um ícone de 16px seria um alvo de 16px.
          style={{ padding: spacing.space2, margin: -spacing.space2 }}
        >
          <Icon name="remover" size={16} color={colors.textSubtle} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

function Retrato({ url, nome }: { url: string | null; nome: string }) {
  const { colors } = useTheme();

  const iniciais = nome
    .split(' ')
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join('');

  return (
    <View
      style={{
        width: 38,
        height: 38,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceAlt,
        borderWidth: stroke.hairline,
        borderColor: colors.borderStrong,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {url ? (
        <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />
      ) : (
        <Text variant="smallStrong" tone="muted">
          {iniciais || '?'}
        </Text>
      )}
    </View>
  );
}
