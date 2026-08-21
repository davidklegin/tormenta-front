import { Image } from 'expo-image';
import { View } from 'react-native';
import { radius, spacing, stroke, useTheme } from '@/theme';
import { Button } from './Button';
import { Divider } from './Divider';
import { Icon, type IconName } from './Icon';
import { illustration, type IllustrationName } from './illustrations';
import { Text } from './Text';

export type EmptyStateProps = {
  icon?: IconName;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Desenho no lugar do ícone. Sem isto, escolhe um pelo ícone informado. */
  illustration?: IllustrationName;
};

/**
 * Qual desenho combina com cada ícone.
 *
 * O baú vale para coleções — personagens, itens, poderes: está tudo guardado,
 * só não há nada dentro ainda. O mapa vale para campanhas e territórios. O dado
 * vale para o que depende de uma ação que ainda não foi feita.
 */
const POR_ICONE: Partial<Record<IconName, IllustrationName>> = {
  personagens: 'bau',
  equipamento: 'bau',
  poderes: 'bau',
  magias: 'bau',
  campanhas: 'mapa',
  historia: 'mapa',
  anotacoes: 'mapa',
  pericias: 'dado',
  resumo: 'dado',
};

/**
 * Estado vazio.
 *
 * Diz o que está faltando e oferece o próximo passo no mesmo lugar. Uma tela
 * vazia sem explicação é, para quem chegou agora, indistinguível de uma tela
 * quebrada.
 *
 * O desenho é autoral e monocromático — traço na cor da borda, um detalhe em
 * ouro — e mede 96px: grande o bastante para dar caráter à tela, pequeno o
 * bastante para o título continuar sendo a primeira coisa que se lê.
 */
export function EmptyState({
  icon = 'info',
  title,
  description,
  actionLabel,
  onAction,
  illustration: nomeDoDesenho,
}: EmptyStateProps) {
  const { colors } = useTheme();

  const desenho = nomeDoDesenho ?? POR_ICONE[icon];

  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.space7,
        paddingHorizontal: spacing.space4,
        gap: spacing.space3,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: stroke.hairline,
        borderColor: colors.border,
        borderStyle: 'dashed',
      }}
    >
      {desenho ? (
        <Image
          source={{ uri: illustration(desenho, { stroke: colors.border, accent: colors.accent }) }}
          style={{ width: 120, height: 96 }}
          contentFit="contain"
          accessibilityLabel=""
          aria-hidden
          transition={0}
        />
      ) : (
        <Icon name={icon} size={36} color={colors.textSubtle} />
      )}

      <Text variant="heading" center>
        {title}
      </Text>

      {description ? (
        <>
          <Divider size="sm" style={{ alignSelf: 'center', width: 220 }} />
          <Text variant="body" tone="secondary" center style={{ maxWidth: 420 }}>
            {description}
          </Text>
        </>
      ) : null}

      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={{ marginTop: spacing.space1 }} />
      ) : null}
    </View>
  );
}
