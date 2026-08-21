import { ScrollView, View, type RefreshControlProps, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, stroke, useResponsive, useTheme } from '@/theme';
import { Atmosphere } from './Atmosphere';

export type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  /** Limita a largura no desktop para o conteúdo não esticar demais. */
  constrained?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Barra fixa no rodapé (ex.: ação principal de um formulário). */
  footer?: React.ReactNode;
  /**
   * A tela está dentro da navegação por abas? Nesse caso o rodapé do sistema
   * já é coberto pela própria barra de abas, e repetir o inset aqui criaria
   * uma faixa vazia.
   */
  insideTabs?: boolean;
};

/**
 * Container padrão das telas.
 *
 * Cuida de quatro coisas que, se ficarem soltas, aparecem como defeito visível:
 *
 * 1. **Áreas seguras.** O Android 16 tornou edge-to-edge obrigatório, então o
 *    conteúdo passa por baixo da barra de status e da barra de gestos. Aqui o
 *    topo recebe o inset sempre, e o rodapé recebe quando a tela não está sob
 *    a barra de abas — sem isso, botões do topo e do rodapé ficam escondidos.
 *
 * 2. **Folga de rolagem.** O conteúdo rolável termina bem acima da borda, para
 *    o último item não nascer colado na barra de gestos.
 *
 * 3. **Largura máxima.** No desktop o texto para de esticar; telas que ganham
 *    com a largura toda, como o Painel do Mestre, passam `constrained={false}`.
 *
 * 4. **Atmosfera.** A camada de fundo fica aqui, e não em cada tela, para que
 *    nenhuma delas apareça sobre uma chapa lisa por esquecimento.
 */
export function Screen({
  children,
  scroll = true,
  padded = true,
  constrained = true,
  refreshControl,
  contentStyle,
  footer,
  insideTabs = false,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { contentMaxWidth } = useResponsive();
  const { colors } = useTheme();

  // A barra de abas já ocupa o rodapé; somar o inset de novo abriria um vão.
  const bottomInset = insideTabs ? 0 : insets.bottom;

  const inner: StyleProp<ViewStyle> = [
    {
      width: '100%',
      alignSelf: 'center',
      maxWidth: constrained ? contentMaxWidth : undefined,
      padding: padded ? spacing.space4 : 0,
      gap: spacing.space4,
    },
    contentStyle,
  ];

  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingTop: insets.top,
        // Folga generosa: o último item não deve encostar na barra de gestos.
        paddingBottom: bottomInset + spacing.space7,
        flexGrow: 1,
      }}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
    >
      <View style={inner}>{children}</View>
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, paddingTop: insets.top, paddingBottom: bottomInset }, inner]}>{children}</View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Atmosphere />
      {body}

      {footer ? (
        <View
          style={{
            paddingHorizontal: spacing.space4,
            paddingTop: spacing.space3,
            paddingBottom: bottomInset + spacing.space3,
            borderTopWidth: stroke.hairline,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
            flexDirection: 'row',
            gap: spacing.space2,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}
