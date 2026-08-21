import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useMutation } from '@tanstack/react-query';
import { campaignsApi } from '@/api';
import type { CampaignNoteImage } from '@/api/types';
import { Button, Icon, Text } from '@/components/ui';
import { radius, spacing, stroke, useTheme } from '@/theme';

/**
 * Imagens de uma anotação — retrato do NPC, mapa do lugar, brasão da guilda.
 *
 * Um NPC descrito só por texto é difícil de reconhecer sessões depois; a
 * miniatura resolve na hora, e tocar nela abre em tela cheia.
 */
export function NoteImages({
  campaignId,
  noteId,
  images,
  editable,
  onChanged,
}: {
  campaignId: number;
  noteId: number;
  images: CampaignNoteImage[];
  editable: boolean;
  onChanged: () => void;
}) {
  const { colors } = useTheme();
  const [ampliada, setAmpliada] = useState<CampaignNoteImage | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = useMutation({
    mutationFn: async () => {
      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
      });

      if (resultado.canceled || !resultado.assets[0]) return null;

      const asset = resultado.assets[0];
      const form = new FormData();

      // Na web o picker devolve uma URI de blob; no celular, um caminho de
      // arquivo. O FormData precisa de formatos diferentes nos dois casos.
      if (Platform.OS === 'web') {
        const resposta = await fetch(asset.uri);
        form.append('image', await resposta.blob(), asset.fileName ?? 'imagem.jpg');
      } else {
        form.append('image', {
          uri: asset.uri,
          name: asset.fileName ?? 'imagem.jpg',
          type: asset.mimeType ?? 'image/jpeg',
        } as never);
      }

      return campaignsApi.addNoteImage(campaignId, noteId, form);
    },
    onSuccess: (imagem) => {
      if (imagem) {
        setErro(null);
        onChanged();
      }
    },
    onError: () => setErro('Não foi possível enviar a imagem.'),
  });

  const remover = useMutation({
    mutationFn: (imageId: number) => campaignsApi.removeNoteImage(campaignId, noteId, imageId),
    onSuccess: () => {
      setAmpliada(null);
      onChanged();
    },
  });

  return (
    <View style={{ gap: spacing.sm }}>
      {images.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {images.map((imagem) => (
              <Pressable
                key={imagem.id}
                onPress={() => setAmpliada(imagem)}
                accessibilityRole="imagebutton"
                accessibilityLabel={imagem.caption ?? 'Imagem da anotação'}
                style={({ pressed }) => ({
                  width: 96,
                  height: 96,
                  borderRadius: radius.md,
                  overflow: 'hidden',
                  borderWidth: stroke.hairline,
                  borderColor: colors.borderStrong,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Image
                  source={{ uri: imagem.url }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  transition={150}
                />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : null}

      {editable ? (
        <Button
          label={images.length > 0 ? 'Adicionar outra imagem' : 'Adicionar imagem'}
          variant="secondary"
          size="sm"
          onPress={() => enviar.mutate()}
          loading={enviar.isPending}
          icon={<Icon name="adicionar" size={16} color={colors.accentInk} />}
        />
      ) : null}

      {erro ? (
        <Text variant="small" tone="danger">
          {erro}
        </Text>
      ) : null}

      {/* Visualização em tela cheia */}
      <Modal
        visible={ampliada !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAmpliada(null)}
      >
        <View style={{ flex: 1, backgroundColor: colors.overlay }}>
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={() => setAmpliada(null)}
            accessibilityRole="button"
            accessibilityLabel="Fechar imagem"
          />

          <View style={{ flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.lg }}>
            {ampliada ? (
              <Image
                source={{ uri: ampliada.url }}
                style={{ width: '100%', height: '70%', borderRadius: radius.lg }}
                contentFit="contain"
              />
            ) : null}

            {ampliada?.caption ? (
              <Text variant="body" tone="secondary" center>
                {ampliada.caption}
              </Text>
            ) : null}

            <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' }}>
              <Button label="Fechar" variant="secondary" onPress={() => setAmpliada(null)} />
              {editable && ampliada ? (
                <Button
                  label="Remover"
                  variant="danger"
                  onPress={() => remover.mutate(ampliada.id)}
                  loading={remover.isPending}
                />
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
