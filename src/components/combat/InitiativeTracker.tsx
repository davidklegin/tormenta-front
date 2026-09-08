import { View } from 'react-native';
import { Image } from 'expo-image';
import type { CombatState } from '@/api/types';
import { Text } from '@/components/ui';
import { radius, spacing, stroke, useTheme } from '@/theme';
import { AlcaDeAmpliar, useAmpliacao } from './ampliacao';

/** Largura do quadro no tamanho de sempre. */
const LARGURA = 260;
const LARGURA_COMPACTA = 200;

/**
 * Teto da ampliação neste quadro — maior que o da coluna do tabuleiro.
 *
 * Aqui a distância de leitura é a da sala inteira, e o quadro divide a tela com
 * um mapa ou um cartaz que não precisa de cada pedaço: um terço da largura de
 * uma TV ainda deixa o essencial à vista.
 */
const TETO_DA_MESA = 3;

/**
 * A ordem de iniciativa como ela aparece no palco: um quadro no canto,
 * por cima de tudo.
 *
 * Fica sempre visível durante o combate porque é a pergunta que a mesa faz o
 * tempo todo — "de quem é a vez?" e "quando chega a minha?". Uma tela que
 * responde isso sem ninguém precisar perguntar economiza mais tempo de sessão
 * do que qualquer outra coisa aqui.
 *
 * Compacto de propósito: divide a tela com o cartaz que está sendo exibido, e
 * o cartaz é o conteúdo. Quem age agora ganha a faixa dourada; os demais são
 * uma lista discreta abaixo dele.
 *
 * `ampliavel` acrescenta a alça do canto. Vale onde alguém pode chegar perto do
 * aparelho e ajustar — a TV da sala —, e não onde o quadro é só passagem.
 */
export function InitiativeTracker({
  combat,
  compacto = false,
  ampliavel = false,
  dica = true,
}: {
  combat: CombatState;
  compacto?: boolean;
  /** Deixa o quadro crescer, puxado pelo canto de baixo à esquerda. */
  ampliavel?: boolean;
  /** O convite escrito na alça. Some junto com a barra da TV, onde ninguém
      deve ficar lendo instrução a noite inteira. */
  dica?: boolean;
}) {
  const { colors, elevation } = useTheme();

  const largura = compacto ? LARGURA_COMPACTA : LARGURA;

  /*
    O quadro da mesa mostra a ordem inteira, sem rolagem: quem está do outro
    lado da sala não vai rolar lista nenhuma. Por isso a ampliação aqui também
    respeita a altura da tela — é o único jeito de a fila não passar da borda de
    baixo quando o combate tem muita gente.
  */
  const ampliacao = useAmpliacao({
    largura,
    teto: TETO_DA_MESA,
    caberNaAltura: true,
    guardarComo: ampliavel ? 'mesa' : undefined,
  });

  if (!combat.active || combat.entries.length === 0) return null;

  return (
    <View
      onLayout={ampliacao.aoMedir}
      /* Só a alça é para ser tocada: nas telas viradas para a mesa, tocar em
         qualquer outro lugar já tem dono — revelar a barra, ampliar o cartaz. */
      pointerEvents="box-none"
      style={{
        width: largura,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: stroke.seal,
        borderColor: colors.accent,
        overflow: 'hidden',
        ...elevation.floating,
        transform: [{ scale: ampliavel ? ampliacao.escala : 1 }],
        /* O quadro está encostado no canto de cima à direita da tela: crescer
           por ali é crescer para dentro dela, e não para fora. */
        transformOrigin: 'right top',
      }}
    >
      <View pointerEvents="none" style={{ padding: spacing.md, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="caption" tone="secondary" uppercase>
            Iniciativa
          </Text>
          <Text variant="caption" tone="gold" uppercase>
            Rodada {combat.round}
          </Text>
        </View>

        <View style={{ gap: spacing.xxs }}>
          {combat.entries.map((entrada, indice) => {
            const agora = indice === combat.turn_index;
            const proximo = indice === (combat.turn_index + 1) % combat.entries.length;

            return (
              <View
                key={entrada.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xs,
                  paddingVertical: agora ? spacing.xs : 2,
                  paddingHorizontal: spacing.xs,
                  borderRadius: radius.sm,
                  backgroundColor: agora ? colors.accentFill : 'transparent',
                  borderLeftWidth: agora ? stroke.plate : proximo ? stroke.hairline : 0,
                  borderLeftColor: agora ? colors.accent : colors.border,
                }}
              >
                {entrada.avatar_url ? (
                  <Image
                    source={{ uri: entrada.avatar_url }}
                    style={{ width: agora ? 24 : 18, height: agora ? 24 : 18, borderRadius: radius.sm }}
                    contentFit="cover"
                    accessibilityLabel={entrada.name}
                  />
                ) : null}

                <Text
                  variant={agora ? 'smallStrong' : 'small'}
                  tone={agora ? 'gold' : entrada.is_npc ? 'muted' : 'secondary'}
                  numberOfLines={1}
                  style={{ flex: 1 }}
                >
                  {entrada.name}
                </Text>

                <Text variant="caption" tone={agora ? 'gold' : 'muted'}>
                  {entrada.initiative}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {ampliavel ? <AlcaDeAmpliar ampliacao={ampliacao} dica={dica} /> : null}
    </View>
  );
}
