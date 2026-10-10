import { Modal, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Icon, Text } from '@/components/ui';
import { radius, spacing, stroke, useTheme } from '@/theme';

/**
 * O rosto de quem está na luta, em tamanho de se ver.
 *
 * Pedido da mesa: no tabuleiro, tocar no rosto de um inimigo e ver quem ele é.
 * O retrato da fila tem 22px e a peça no mapa um quadrado de 1,5 m, e é nesse
 * tamanho que "o goblin de capuz" e "o goblin de lança" viram a mesma mancha.
 *
 * Só nome e imagem, de propósito: são as duas coisas que a mesa já vê na
 * fila. PV, Defesa e o resto da ficha da criatura são do mestre, e ficam na
 * ficha do NPC (`NPCStatSheet`), que só abre para ele.
 */
export function RetratoAmpliado({
  nome,
  imagem,
  onClose,
}: {
  nome: string;
  imagem: string | null;
  onClose: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Fechar retrato"
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
        }}
      >
        {/* O cartão engole o toque: tocar na imagem não fecha, só o fundo. */}
        <Pressable
          onPress={() => {}}
          accessible={false}
          style={{
            width: '100%',
            maxWidth: 420,
            borderRadius: radius.lg,
            borderWidth: stroke.hairline,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              padding: spacing.md,
              borderBottomWidth: stroke.hairline,
              borderBottomColor: colors.border,
            }}
          >
            <Text variant="heading" numberOfLines={2} style={{ flex: 1 }}>
              {nome}
            </Text>

            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
            >
              <Icon name="remover" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {imagem ? (
            <Image
              source={{ uri: imagem }}
              style={{ width: '100%', aspectRatio: 1, backgroundColor: colors.surfaceAlt }}
              contentFit="contain"
              accessibilityLabel={`Retrato de ${nome}`}
            />
          ) : (
            <View
              style={{
                width: '100%',
                aspectRatio: 1,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surfaceAlt,
                gap: spacing.xs,
              }}
            >
              <Text variant="display" tone="muted">
                {nome.charAt(0).toUpperCase()}
              </Text>
              <Text variant="caption" tone="muted">
                Sem retrato cadastrado
              </Text>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
