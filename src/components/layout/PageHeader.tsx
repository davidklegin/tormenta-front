import { View } from 'react-native';
import { BackButton, Divider, Text, ThemeToggle } from '@/components/ui';
import { spacing, useResponsive } from '@/theme';

export type PageHeaderProps = {
  title: string;
  subtitle?: string;
  /** Mostra o botão de voltar; útil em telas empilhadas. */
  back?: boolean;
  /** Rótulo do botão de voltar — dizer o destino ajuda mais que "Voltar". */
  backLabel?: string;
  actions?: React.ReactNode;
};

/**
 * Cabeçalho de tela: título, subtítulo e ações.
 *
 * O alternador de tema mora aqui, à direita, antes das demais ações. É o lugar
 * certo por dois motivos: é o cabeçalho que toda tela da área logada usa, então
 * o controle fica sempre no mesmo canto; e ele é secundário às ações da tela,
 * então vem antes delas na ordem de leitura mas depois em importância visual —
 * um selo pequeno, não um botão.
 *
 * O filete ornamental abaixo do título fecha o bloco e separa o cabeçalho do
 * conteúdo sem precisar de uma régua cheia atravessando a tela.
 */
export function PageHeader({ title, subtitle, back, backLabel, actions }: PageHeaderProps) {
  const { isPhone } = useResponsive();

  return (
    <View style={{ gap: spacing.space3 }}>
      {/* O voltar fica em linha própria, acima do título: no celular, dividir
          a linha com o título espremia os dois. */}
      {back ? <BackButton label={backLabel ?? 'Voltar'} /> : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: spacing.space3,
          flexWrap: isPhone ? 'wrap' : 'nowrap',
        }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: spacing.xxs }}>
          <Text variant={isPhone ? 'title' : 'display'} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="small" tone="secondary" numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View
          style={{
            flexDirection: 'row',
            gap: spacing.space2,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <ThemeToggle showLabel={!isPhone} />
          {actions}
        </View>
      </View>

      <Divider />
    </View>
  );
}
