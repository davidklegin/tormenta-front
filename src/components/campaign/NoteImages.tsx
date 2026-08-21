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
 * Imagem escolhida antes de a anotação existir — ainda sem id do servidor.
 *
 * Cadastrando um NPC novo não há onde anexar o retrato: a anotação só ganha id
 * ao ser salva. Então a imagem espera aqui, e quem salva o formulário envia.
 */
export type PendingNoteImage = {
  key: string;
  uri: string;
  name: string;
  type: string;
};

let sequencia = 0;

/** Abre a galeria e devolve o que foi escolhido, já no formato do upload. */
export async function pickNoteImages(): Promise<PendingNoteImage[]> {
  const resultado = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: 10,
    quality: 0.85,
  });

  if (resultado.canceled) return [];

  return resultado.assets.map((asset) => ({
    key: `pendente-${(sequencia += 1)}`,
    uri: asset.uri,
    name: asset.fileName ?? 'imagem.jpg',
    type: asset.mimeType ?? 'image/jpeg',
  }));
}

/**
 * Monta o corpo do upload.
 *
 * Na web o picker devolve uma URI de blob; no celular, um caminho de arquivo.
 * O FormData precisa de formatos diferentes nos dois casos.
 */
export async function buildNoteImageForm(imagem: PendingNoteImage): Promise<FormData> {
  const form = new FormData();

  if (Platform.OS === 'web') {
    const resposta = await fetch(imagem.uri);
    form.append('image', await resposta.blob(), imagem.name);
  } else {
    form.append('image', { uri: imagem.uri, name: imagem.name, type: imagem.type } as never);
  }

  return form;
}

const MINIATURA = 96;

/**
 * Imagens de uma anotação — retrato do NPC, mapa do lugar, brasão da guilda.
 *
 * Um NPC descrito só por texto é difícil de reconhecer sessões depois; a
 * miniatura resolve na hora, e tocar nela abre em tela cheia.
 *
 * Com `noteId`, cada imagem escolhida sobe na hora. Sem ele — anotação ainda
 * sendo cadastrada — as escolhas ficam em `pending` até o formulário salvar.
 */
export function NoteImages({
  campaignId,
  noteId,
  images,
  editable,
  onChanged,
  pending = [],
  onPendingChange,
}: {
  campaignId: number;
  noteId: number | null;
  images: CampaignNoteImage[];
  editable: boolean;
  onChanged: () => void;
  pending?: PendingNoteImage[];
  onPendingChange?: (imagens: PendingNoteImage[]) => void;
}) {
  const { colors } = useTheme();
  const [ampliada, setAmpliada] = useState<CampaignNoteImage | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const total = images.length + pending.length;

  const escolher = useMutation({
    mutationFn: async () => {
      const escolhidas = await pickNoteImages();

      if (escolhidas.length === 0) return false;

      if (noteId === null) {
        onPendingChange?.([...pending, ...escolhidas]);

        return false;
      }

      // O endpoint recebe uma imagem por vez; a seleção múltipla vira uma
      // sequência de envios.
      for (const imagem of escolhidas) {
        await campaignsApi.addNoteImage(campaignId, noteId, await buildNoteImageForm(imagem));
      }

      return true;
    },
    onSuccess: (enviou) => {
      setErro(null);
      if (enviou) onChanged();
    },
    onError: () => setErro('Não foi possível enviar a imagem.'),
  });

  const remover = useMutation({
    mutationFn: (imageId: number) => campaignsApi.removeNoteImage(campaignId, noteId!, imageId),
    onSuccess: () => {
      setAmpliada(null);
      onChanged();
    },
  });

  return (
    <View style={{ gap: spacing.sm }}>
      {total > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {images.map((imagem) => (
              <Pressable
                key={imagem.id}
                onPress={() => setAmpliada(imagem)}
                accessibilityRole="imagebutton"
                accessibilityLabel={imagem.caption ?? 'Imagem da anotação'}
                style={({ pressed }) => ({
                  width: MINIATURA,
                  height: MINIATURA,
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

            {pending.map((imagem) => (
              <View
                key={imagem.key}
                style={{
                  width: MINIATURA,
                  height: MINIATURA,
                  borderRadius: radius.md,
                  overflow: 'hidden',
                  borderWidth: stroke.hairline,
                  borderStyle: 'dashed',
                  borderColor: colors.accentInk,
                }}
              >
                <Image
                  source={{ uri: imagem.uri }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  transition={150}
                />

                {editable ? (
                  <Pressable
                    onPress={() => onPendingChange?.(pending.filter((item) => item.key !== imagem.key))}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Descartar imagem"
                    style={{
                      position: 'absolute',
                      top: spacing.xs,
                      right: spacing.xs,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.overlay,
                    }}
                  >
                    <Icon name="remover" size={14} color={colors.onPrimary} />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}

      {editable ? (
        <Button
          label={total > 0 ? 'Adicionar outra imagem' : 'Adicionar imagem'}
          variant="secondary"
          size="sm"
          onPress={() => escolher.mutate()}
          loading={escolher.isPending}
          icon={<Icon name="adicionar" size={16} color={colors.accentInk} />}
        />
      ) : null}

      {pending.length > 0 ? (
        <Text variant="caption" tone="muted">
          {pending.length === 1
            ? '1 imagem será enviada ao salvar.'
            : `${pending.length} imagens serão enviadas ao salvar.`}
        </Text>
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
              {editable && ampliada && noteId !== null ? (
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
