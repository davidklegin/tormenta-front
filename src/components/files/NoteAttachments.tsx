import { useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '@/api';
import type { NoteAttachment } from '@/api/types';
import { Button, Icon, Text, iconSize } from '@/components/ui';
import { ArquivoGrandeDemaisError, TAMANHO_MAXIMO_BYTES } from '@/utils/arquivo';
import { prepararImagemParaUpload } from '@/utils/imagem';
import { formatarTamanho, iconeDoAnexo } from '@/utils/arquivo';
import { radius, spacing, stroke, useTheme } from '@/theme';
import { AttachmentViewer } from './AttachmentViewer';

/**
 * Arquivo escolhido antes de a anotação existir — ainda sem id do servidor.
 *
 * Cadastrando um NPC novo não há onde anexar o retrato: a anotação só ganha id
 * ao ser salva. Então o arquivo espera aqui, e quem salva o formulário envia.
 */
export type PendingAttachment = {
  key: string;
  uri: string;
  name: string;
  type: string;
  /** Só para mostrar o tamanho na espera; o servidor confere o dele. */
  size?: number;
};

let sequencia = 0;

function proximaChave(): string {
  sequencia += 1;

  return `pendente-${sequencia}`;
}

/**
 * Abre a galeria e devolve o que foi escolhido, no formato do upload.
 *
 * `quality: 1` — que é o padrão do picker — porque a imagem sobe como veio: o
 * mapa da masmorra e o retrato do NPC são anexados justamente por serem
 * grandes, e o servidor aceita 50 MB por arquivo. Acima disso o preparo lança
 * `ArquivoGrandeDemaisError` aqui, em vez de gastar o upload inteiro para
 * receber um 413 mudo no fim.
 */
export async function pickNoteImages(): Promise<PendingAttachment[]> {
  const resultado = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: 10,
    quality: 1,
  });

  if (resultado.canceled) return [];

  return Promise.all(
    resultado.assets.map(async (asset) => ({
      key: proximaChave(),
      ...(await prepararImagemParaUpload(asset, 'imagem')),
    }))
  );
}

/**
 * Abre o seletor de arquivos do sistema — qualquer tipo.
 *
 * Como na galeria, o arquivo sobe como está; muda só de onde ele vem. O `size`
 * do picker é opcional: quando o sistema não informa, quem barra o arquivo
 * grande demais é a validação do servidor.
 */
export async function pickNoteFiles(): Promise<PendingAttachment[]> {
  const resultado = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    multiple: true,
    copyToCacheDirectory: true,
  });

  if (resultado.canceled) return [];

  return resultado.assets.map((asset) => {
    if (asset.size && asset.size > TAMANHO_MAXIMO_BYTES) {
      throw new ArquivoGrandeDemaisError(asset.size);
    }

    return {
      key: proximaChave(),
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType ?? 'application/octet-stream',
      size: asset.size ?? undefined,
    };
  });
}

/**
 * Monta o corpo do upload.
 *
 * Na web o picker devolve uma URI de blob; no celular, um caminho de arquivo.
 * O FormData precisa de formatos diferentes nos dois casos.
 */
export async function buildAttachmentForm(arquivo: PendingAttachment): Promise<FormData> {
  const form = new FormData();

  if (Platform.OS === 'web') {
    const resposta = await fetch(arquivo.uri);
    form.append('file', await resposta.blob(), arquivo.name);
  } else {
    form.append('file', { uri: arquivo.uri, name: arquivo.name, type: arquivo.type } as never);
  }

  return form;
}

const MINIATURA = 96;

/**
 * Arquivos de uma anotação — retrato do NPC, mapa do lugar, ficha em PDF.
 *
 * Um NPC descrito só por texto é difícil de reconhecer sessões depois; a
 * miniatura resolve na hora, e tocar nela abre o arquivo dentro do app, sem
 * mandar ninguém para outra aba.
 *
 * Com `onUpload`, cada arquivo escolhido sobe na hora. Sem ele — anotação
 * ainda sendo cadastrada — as escolhas ficam em `pending` até o formulário
 * salvar.
 */
export function NoteAttachments({
  attachments,
  editable,
  onUpload,
  onRemove,
  onChanged,
  pending = [],
  onPendingChange,
}: {
  attachments: NoteAttachment[];
  editable: boolean;
  /** Envia um arquivo. Ausente enquanto a anotação não tem id. */
  onUpload?: (form: FormData) => Promise<unknown>;
  onRemove?: (attachment: NoteAttachment) => Promise<unknown>;
  onChanged: () => void;
  pending?: PendingAttachment[];
  onPendingChange?: (arquivos: PendingAttachment[]) => void;
}) {
  const { colors } = useTheme();
  const [aberto, setAberto] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const total = attachments.length + pending.length;

  const escolher = useMutation({
    mutationFn: async (origem: 'galeria' | 'arquivos') => {
      const escolhidos = origem === 'galeria' ? await pickNoteImages() : await pickNoteFiles();

      if (escolhidos.length === 0) return false;

      if (!onUpload) {
        onPendingChange?.([...pending, ...escolhidos]);

        return false;
      }

      // O endpoint recebe um arquivo por vez; a seleção múltipla vira uma
      // sequência de envios.
      for (const arquivo of escolhidos) {
        await onUpload(await buildAttachmentForm(arquivo));
      }

      return true;
    },
    onSuccess: (enviou) => {
      setErro(null);
      if (enviou) onChanged();
    },
    // O servidor sabe dizer o que houve — tamanho acima do limite, teto de
    // arquivos da anotação. Repetir isso é mais útil que um "falhou". Quando o
    // próprio app barrou o arquivo na escolha, a mensagem já vem pronta e nem
    // chega a haver requisição.
    onError: (falha) =>
      setErro(
        falha instanceof ArquivoGrandeDemaisError || falha instanceof ApiError
          ? falha.message
          : 'Não foi possível enviar o arquivo.'
      ),
  });

  const remover = useMutation({
    mutationFn: (anexo: NoteAttachment) => onRemove!(anexo),
    onSuccess: () => {
      setAberto(null);
      onChanged();
    },
    onError: () => setErro('Não foi possível remover o arquivo.'),
  });

  return (
    <View style={{ gap: spacing.sm }}>
      {total > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {attachments.map((anexo, posicao) => (
              <Miniatura
                key={anexo.id}
                nome={anexo.name}
                legenda={anexo.caption ?? undefined}
                tamanho={anexo.size_bytes}
                uri={anexo.kind === 'image' ? anexo.url : undefined}
                icone={iconeDoAnexo(anexo.kind)}
                onPress={() => setAberto(posicao)}
              />
            ))}

            {pending.map((arquivo) => (
              <Miniatura
                key={arquivo.key}
                nome={arquivo.name}
                tamanho={arquivo.size ?? null}
                uri={arquivo.type.startsWith('image/') ? arquivo.uri : undefined}
                icone="arquivo"
                pendente
                onDiscard={
                  editable
                    ? () => onPendingChange?.(pending.filter((item) => item.key !== arquivo.key))
                    : undefined
                }
              />
            ))}
          </View>
        </ScrollView>
      ) : null}

      {editable ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Button
            label={total > 0 ? 'Outra imagem' : 'Imagem'}
            variant="secondary"
            size="sm"
            onPress={() => escolher.mutate('galeria')}
            loading={escolher.isPending && escolher.variables === 'galeria'}
            icon={<Icon name="adicionar" size={iconSize.sm} color={colors.accentInk} />}
          />
          <Button
            label={total > 0 ? 'Outro arquivo' : 'Arquivo'}
            variant="secondary"
            size="sm"
            onPress={() => escolher.mutate('arquivos')}
            loading={escolher.isPending && escolher.variables === 'arquivos'}
            icon={<Icon name="anexar" size={iconSize.sm} color={colors.accentInk} />}
          />
        </View>
      ) : null}

      {pending.length > 0 ? (
        <Text variant="caption" tone="muted">
          {pending.length === 1
            ? '1 arquivo será enviado ao salvar.'
            : `${pending.length} arquivos serão enviados ao salvar.`}
        </Text>
      ) : null}

      {erro ? (
        <Text variant="small" tone="danger">
          {erro}
        </Text>
      ) : null}

      <AttachmentViewer
        attachments={attachments}
        startIndex={aberto ?? 0}
        visible={aberto !== null}
        onClose={() => setAberto(null)}
        onRemove={editable && onRemove ? (anexo) => remover.mutate(anexo) : undefined}
        removing={remover.isPending}
      />
    </View>
  );
}

function Miniatura({
  nome,
  legenda,
  tamanho,
  uri,
  icone,
  pendente = false,
  onPress,
  onDiscard,
}: {
  nome: string;
  legenda?: string;
  tamanho: number | null | undefined;
  uri?: string;
  icone: Parameters<typeof Icon>[0]['name'];
  pendente?: boolean;
  onPress?: () => void;
  onDiscard?: () => void;
}) {
  const { colors } = useTheme();

  const moldura = {
    width: MINIATURA,
    height: MINIATURA,
    borderRadius: radius.md,
    overflow: 'hidden' as const,
    borderWidth: stroke.hairline,
    borderColor: pendente ? colors.accentInk : colors.borderStrong,
    borderStyle: pendente ? ('dashed' as const) : ('solid' as const),
    backgroundColor: colors.surfaceAlt,
  };

  const conteudo = uri ? (
    <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />
  ) : (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xs, gap: 2 }}>
      <Icon name={icone} size={28} color={colors.accentInk} />
      <Text variant="caption" tone="secondary" center numberOfLines={2}>
        {nome}
      </Text>
      {tamanho ? (
        <Text variant="caption" tone="muted">
          {formatarTamanho(tamanho)}
        </Text>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={legenda ?? nome}
        style={({ pressed }) => [moldura, { opacity: pressed ? 0.8 : 1 }]}
      >
        {conteudo}
      </Pressable>
    );
  }

  return (
    <View style={moldura}>
      {conteudo}

      {onDiscard ? (
        <Pressable
          onPress={onDiscard}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Descartar ${nome}`}
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
  );
}
