import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { apiFetchRaw } from '@/api';
import type { AttachmentKind, NoteAttachment } from '@/api/types';
import type { IconName } from '@/components/ui/Icon';

/** Ícone de cada forma de exibição, para lista e cartão de anexo. */
const ICONES: Record<AttachmentKind, IconName> = {
  image: 'arquivoImagem',
  pdf: 'arquivoPdf',
  video: 'arquivoVideo',
  audio: 'arquivoAudio',
  text: 'arquivoTexto',
  archive: 'arquivoCompactado',
  document: 'arquivoDocumento',
  other: 'arquivo',
};

export function iconeDoAnexo(kind: AttachmentKind): IconName {
  return ICONES[kind] ?? 'arquivo';
}

/**
 * Tamanho em unidade legível.
 *
 * Base 1024 e uma casa decimal a partir de MB: "1,4 MB" diz mais sobre a
 * espera do download do que "1.468.006 bytes".
 */
export function formatarTamanho(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;

  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;

  return `${(kb / 1024).toFixed(1).replace('.', ',')} MB`;
}

/**
 * Anexos que o app abre por dentro, sem sair para outro aplicativo.
 *
 * `other`, `archive` e `document` ficam de fora não por descuido: não há como
 * desenhar um .zip nem um .docx sem um conversor, então o app mostra o cartão
 * do arquivo com o botão de baixar em vez de fingir uma pré-visualização.
 */
export function temPreVisualizacao(kind: AttachmentKind): boolean {
  return kind === 'image' || kind === 'pdf' || kind === 'video' || kind === 'audio' || kind === 'text';
}

/** Caminho da API que entrega o conteúdo do anexo, com autorização e CORS. */
export function caminhoDoConteudo(anexo: NoteAttachment): string {
  return `/attachments/${anexo.id}/download`;
}

/**
 * Salva o arquivo no dispositivo.
 *
 * Na web, baixa como blob e dispara um link `download`: um `<a href>` direto
 * abriria o PDF numa aba nova, que é exatamente o que este recurso existe para
 * evitar. No celular, o arquivo vai para o diretório do app e o menu do
 * sistema decide o destino — Downloads, Drive, WhatsApp.
 */
export async function baixarAnexo(anexo: NoteAttachment): Promise<void> {
  if (Platform.OS === 'web') {
    const resposta = await apiFetchRaw(caminhoDoConteudo(anexo));
    const blob = await resposta.blob();
    const objeto = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = objeto;
    link.download = anexo.name;
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Sem isto o blob fica preso na memória da aba até recarregar.
    setTimeout(() => URL.revokeObjectURL(objeto), 1000);

    return;
  }

  const destino = new FileSystem.File(FileSystem.Paths.cache, nomeSeguro(anexo.name));

  if (destino.exists) destino.delete();

  const baixado = await FileSystem.File.downloadFileAsync(anexo.url, destino);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(baixado.uri, {
      mimeType: anexo.mime_type ?? undefined,
      dialogTitle: anexo.name,
    });
  }
}

/** O nome vem do servidor, mas quem escreve no disco é o app — sem surpresas. */
function nomeSeguro(nome: string): string {
  const limpo = nome.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '');

  return limpo === '' ? 'arquivo' : limpo.slice(-120);
}
