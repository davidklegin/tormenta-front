import { View } from 'react-native';
import { Image } from 'expo-image';
import type { NoteAttachment } from '@/api/types';
import { Icon, Text } from '@/components/ui';
import { iconeDoAnexo } from '@/utils/arquivo';
import { radius, spacing, stroke, useTheme } from '@/theme';

/**
 * A tira de anexos no cartão da anotação.
 *
 * Serve para reconhecer a anotação de relance — o retrato do NPC, o ícone do
 * PDF da missão. Não abre nada: quem abre é o visualizador, dentro do
 * formulário, onde a lista completa já está à mão.
 */
export function AttachmentStrip({
  attachments,
  size = 56,
  limit = 4,
}: {
  attachments: NoteAttachment[];
  size?: number;
  limit?: number;
}) {
  const { colors } = useTheme();

  if (attachments.length === 0) return null;

  const moldura = {
    width: size,
    height: size,
    borderRadius: radius.sm,
    borderWidth: stroke.hairline,
    borderColor: colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden' as const,
  };

  return (
    <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs }}>
      {attachments.slice(0, limit).map((anexo) =>
        anexo.kind === 'image' ? (
          <Image
            key={anexo.id}
            source={{ uri: anexo.url }}
            style={moldura}
            contentFit="cover"
            transition={150}
            accessibilityLabel={anexo.caption ?? anexo.name}
          />
        ) : (
          <View key={anexo.id} style={moldura} accessibilityLabel={anexo.name}>
            <Icon name={iconeDoAnexo(anexo.kind)} size={Math.round(size * 0.42)} color={colors.accentInk} />
          </View>
        )
      )}

      {attachments.length > limit ? (
        <View style={moldura}>
          <Text variant="caption" tone="muted">
            +{attachments.length - limit}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
