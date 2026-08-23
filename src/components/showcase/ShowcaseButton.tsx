import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { ApiError, showcaseApi } from '@/api';
import type { ShowcaseKind } from '@/api/types';
import { Button, Icon, Text } from '@/components/ui';
import { spacing, useTheme } from '@/theme';

/** Quanto tempo o botão fica confirmando antes de voltar ao normal. */
const CONFIRMACAO = 3000;

/**
 * "Exibir aos outros" — aponta este item para todo mundo que está com o app
 * aberto (briefing §21).
 *
 * Não é gesto de dono: qualquer um que consiga abrir a ficha pode exibir o que
 * há nela, porque o uso real é explicar uma regra no meio da sessão — e quem
 * explica costuma ser o mestre olhando a ficha do jogador, não o jogador.
 *
 * Depois de enviar, o botão fica alguns segundos dizendo que exibiu. Sem isso o
 * botão não teria retorno nenhum: quem exibe é justamente o único que **não**
 * recebe o aviso, e ficaria sem saber se o toque valeu.
 */
export function ShowcaseButton({
  kind,
  characterId,
  resourceId,
  style,
}: {
  kind: ShowcaseKind;
  characterId: number;
  resourceId: number;
  style?: React.ComponentProps<typeof Button>['style'];
}) {
  const { colors } = useTheme();
  const [exibido, setExibido] = useState(false);

  const exibir = useMutation({
    mutationFn: () => showcaseApi.share(kind, characterId, resourceId),
    onSuccess: () => setExibido(true),
  });

  useEffect(() => {
    if (!exibido) return;

    const relogio = setTimeout(() => setExibido(false), CONFIRMACAO);

    return () => clearTimeout(relogio);
  }, [exibido]);

  return (
    <View style={{ gap: spacing.xs }}>
      <Button
        label={exibido ? 'Exibido aos outros' : 'Exibir aos outros'}
        variant={exibido ? 'gold' : 'secondary'}
        loading={exibir.isPending}
        onPress={() => exibir.mutate()}
        icon={
          <Icon
            name={exibido ? 'confirmar' : 'jogadores'}
            size={16}
            color={exibido ? colors.accentInk : colors.textMuted}
          />
        }
        style={style}
      />

      {exibir.isError ? (
        <Text variant="caption" tone="danger">
          {exibir.error instanceof ApiError && exibir.error.message
            ? exibir.error.message
            : 'Não foi possível exibir agora. Tente de novo.'}
        </Text>
      ) : null}
    </View>
  );
}
