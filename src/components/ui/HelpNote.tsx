import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { radius, spacing, stroke, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';

export type HelpNoteProps = {
  children: string;
  /** Referência ao livro, quando a explicação vem de uma regra. */
  source?: string;
  tone?: 'info' | 'warning';
  /** Começa recolhida, virando só um "entenda". */
  collapsible?: boolean;
};

/**
 * Explicação curta em linha.
 *
 * Existe para quem está abrindo uma ficha de RPG pela primeira vez: em vez de
 * exigir que o jogador saiba de cor o que é "penalidade de armadura" ou por que
 * a Defesa deu 16, a tela conta ali mesmo — com a página do livro quando a
 * informação vem de uma regra.
 *
 * Recolhível quando a dica é longa: quem já sabe não precisa reler.
 */
export function HelpNote({ children, source, tone = 'info', collapsible = false }: HelpNoteProps) {
  const { colors } = useTheme();
  const [aberta, setAberta] = useState(!collapsible);

  const cor = tone === 'warning' ? colors.warningInk : colors.infoInk;
  const fundo = tone === 'warning' ? colors.warningFill : colors.infoFill;
  const traco = tone === 'warning' ? colors.warning : colors.info;

  if (collapsible && !aberta) {
    return (
      <Pressable
        onPress={() => setAberta(true)}
        accessibilityRole="button"
        accessibilityLabel="Entenda esta seção"
        hitSlop={8}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs }}
      >
        <Icon name="ajuda" size={16} color={cor} />
        <Text variant="small" style={{ color: cor }}>
          Entenda
        </Text>
      </Pressable>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.sm,
        backgroundColor: fundo,
        borderRadius: radius.md,
        borderLeftWidth: stroke.seal,
        borderLeftColor: traco,
        padding: spacing.space3,
      }}
      accessibilityRole="text"
    >
      <Icon name={tone === 'warning' ? 'alerta' : 'info'} size={18} color={cor} />

      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="small" tone="secondary">
          {children}
        </Text>
        {source ? (
          <Text variant="caption" tone="muted">
            {source}
          </Text>
        ) : null}
      </View>

      {collapsible ? (
        <Pressable
          onPress={() => setAberta(false)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Recolher explicação"
          // Ver Toast: na web o `hitSlop` não alcança o DOM, o padding sim.
          style={{ padding: spacing.space1, margin: -spacing.space1 }}
        >
          <Icon name="remover" size={16} color={colors.textSubtle} />
        </Pressable>
      ) : null}
    </View>
  );
}
