import { useEffect, useRef, useState } from 'react';
import { Animated, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { easing, fontSize, nativeDriver, spacing, stroke, typography, useMotion, useTheme } from '@/theme';
import { Text } from './Text';

export type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  hint?: string;
  right?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
};

/**
 * Campo de texto com rótulo flutuante, dica e mensagem de erro.
 *
 * O erro vem do backend (validação do Laravel) e é exibido junto ao campo, para
 * o jogador corrigir sem procurar (briefing §30: validar nos dois lados).
 *
 * A caixa completa saiu: sobrou a linha inferior de 2px, que vira ouro no foco.
 * Menos moldura significa mais papel visível, que é o ponto do tema — e o
 * formulário deixa de parecer um formulário empilhado sobre um pergaminho.
 *
 * O rótulo sobe quando o campo tem foco ou conteúdo. A subida é `translateY` e
 * `scale`, nunca `fontSize`: mudar o corpo da fonte remede o layout a cada
 * quadro, e essa é exatamente a animação que trava em aparelho modesto.
 */
export function Input({ label, error, hint, right, containerStyle, style, multiline, ...props }: InputProps) {
  const { colors } = useTheme();
  const { reduced, ms } = useMotion();
  const [focused, setFocused] = useState(false);

  const temConteudo = Boolean(props.value ?? props.defaultValue);
  // O placeholder ocupa a mesma linha do rótulo em repouso. Quando existe um,
  // o rótulo já sobe de saída — do contrário os dois se escrevem por cima, que
  // é o defeito clássico de rótulo flutuante mal condicionado.
  const flutuando = focused || temConteudo || Boolean(props.placeholder);

  const posicao = useRef(new Animated.Value(flutuando ? 1 : 0)).current;

  useEffect(() => {
    const animacao = Animated.timing(posicao, {
      toValue: flutuando ? 1 : 0,
      duration: reduced ? 0 : ms('fast'),
      easing: easing.standard,
      useNativeDriver: nativeDriver,
    });
    animacao.start();

    return () => animacao.stop();
  }, [flutuando, posicao, reduced, ms]);

  const corDaLinha = error ? colors.danger : focused ? colors.accent : colors.border;
  const alturaMinima = multiline ? 110 : 46;

  return (
    <View style={[{ gap: spacing.space1 }, containerStyle]}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'flex-end',
          gap: spacing.space2,
          minHeight: alturaMinima,
          paddingTop: label ? spacing.space5 : 0,
          borderBottomWidth: stroke.seal,
          borderBottomColor: corDaLinha,
        }}
      >
        {label ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              // A origem fica no canto superior esquerdo para o rótulo encolher
              // "para dentro" da própria posição, sem escorregar para o lado.
              transform: [
                {
                  translateY: posicao.interpolate({
                    inputRange: [0, 1],
                    // Em repouso o rótulo fica na linha do texto; ao subir,
                    // encosta no topo da caixa.
                    outputRange: [spacing.space5 + spacing.space1, 0],
                  }),
                },
                { scale: posicao.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] }) },
              ],
              transformOrigin: 'left top',
            }}
          >
            <Text variant="smallStrong" tone={error ? 'danger' : focused ? 'gold' : 'secondary'}>
              {label}
            </Text>
          </Animated.View>
        ) : null}

        <TextInput
          {...props}
          multiline={multiline}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          placeholderTextColor={colors.textSubtle}
          style={[
            {
              flex: 1,
              color: colors.text,
              fontFamily: typography.body.fontFamily,
              fontSize: fontSize.md,
              paddingVertical: spacing.space2,
              textAlignVertical: multiline ? 'top' : 'center',
              // O anel de foco do tema é desenhado pela linha inferior e, na
              // web, pelo `:focus-visible` do ornaments.css. O contorno padrão
              // do navegador competiria com os dois.
              outlineStyle: 'none',
            } as never,
            style,
          ]}
        />
        {right}
      </View>

      {error ? (
        <Text variant="small" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
