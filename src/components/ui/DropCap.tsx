import { View } from 'react-native';
import {
  cssOrnaments,
  fontFamily,
  fontSize,
  ornamentAttrs,
  spacing,
  stroke,
  typography,
  useTheme,
} from '@/theme';
import { Text } from './Text';

export type DropCapProps = {
  children: string;
  /** Referência ao livro, quando o texto vem de uma regra. */
  source?: string;
};

/**
 * Texto longo com capitular.
 *
 * A primeira letra sai na fonte de display, na altura de três linhas, em rubi, com um
 * filete de ouro na base — a abertura de um capítulo de grimório. Vale para
 * descrição de poder, de magia e de regra: os textos que o jogador realmente
 * para para ler.
 *
 * Na web a capitular é `float: left` de verdade, vindo do `ornaments.css`: o
 * texto contorna a letra e volta à margem na quarta linha, como em livro.
 *
 * No celular não existe float. Ali a letra vai para uma coluna própria e o
 * parágrafo para a coluna ao lado — que é como a tipografia resolvia isso antes
 * do CSS. Perde-se o texto dobrando sob a capitular; ganha-se um alinhamento
 * que não quebra quando a fonte não carrega ou o corpo do texto muda.
 *
 * Só aplica quando há texto suficiente para justificar: em uma linha e meia, a
 * capitular vira enfeite sem função e atrapalha a leitura.
 */
const MINIMO_DE_CARACTERES = 120;

export function DropCap({ children, source }: DropCapProps) {
  const { colors } = useTheme();

  const texto = children.trim();
  const vale = texto.length >= MINIMO_DE_CARACTERES;

  if (!vale) {
    return (
      <View style={{ gap: spacing.space1 }}>
        <Text variant="body">{texto}</Text>
        {source ? (
          <Text variant="caption" tone="muted">
            {source}
          </Text>
        ) : null}
      </View>
    );
  }

  const inicial = texto.slice(0, 1).toUpperCase();
  const restante = texto.slice(1);

  if (cssOrnaments) {
    return (
      <View style={{ gap: spacing.space1 }}>
        <Text variant="body" {...ornamentAttrs('dropcap')}>
          {texto}
        </Text>
        {source ? (
          <Text variant="caption" tone="muted">
            {source}
          </Text>
        ) : null}
      </View>
    );
  }

  // Três linhas do corpo, que é o que a capitular deve ocupar de altura.
  const alturaDeTresLinhas = (typography.body.lineHeight ?? fontSize.md) * 3;

  return (
    <View style={{ gap: spacing.space1 }}>
      <View style={{ flexDirection: 'row', gap: spacing.space3, alignItems: 'flex-start' }}>
        <View
          style={{
            borderBottomWidth: stroke.hairline,
            borderBottomColor: colors.accent,
            paddingBottom: spacing.space1,
            marginTop: spacing.space1,
          }}
        >
          <Text
            aria-hidden
            style={{
              fontFamily: fontFamily.displayStrong,
              fontWeight: '700',
              fontSize: Math.round(alturaDeTresLinhas * 0.78),
              lineHeight: alturaDeTresLinhas,
              color: colors.primaryInk,
            }}
          >
            {inicial}
          </Text>
        </View>

        {/* A capitular já mostra a inicial, então o parágrafo desenhado começa
            na segunda letra. O leitor de tela, porém, recebe o texto inteiro
            pelo rótulo — quem ouve não deve perder a primeira letra da palavra. */}
        <Text variant="body" style={{ flex: 1 }} accessibilityLabel={texto}>
          {restante}
        </Text>
      </View>

      {source ? (
        <Text variant="caption" tone="muted">
          {source}
        </Text>
      ) : null}
    </View>
  );
}
