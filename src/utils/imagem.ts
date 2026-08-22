import type { ImagePickerAsset } from 'expo-image-picker';

import { ArquivoGrandeDemaisError, TAMANHO_MAXIMO_BYTES } from '@/utils/arquivo';

/** Imagem pronta para virar FormData. */
export type ImagemEnviavel = {
  uri: string;
  name: string;
  type: string;
};

/**
 * Prepara a imagem escolhida para o upload.
 *
 * O arquivo sobe **como veio da galeria**: sem redimensionar e sem reencodar.
 * Mapa de masmorra e retrato de NPC perdem detalhe quando encolhidos, e o
 * limite do servidor agora é de 50 MB — grande o bastante para a foto sair
 * inteira. O preço é upload mais lento e mais disco na VPS; foi escolha
 * consciente ao subir o limite.
 *
 * O que sobra de trabalho aqui é só o que o FormData precisa: um nome de
 * arquivo com extensão coerente com o tipo, porque o Laravel valida
 * `mimes:jpg,jpeg,png,webp` e a galeria às vezes devolve nome sem extensão.
 */
export async function prepararImagemParaUpload(
  asset: ImagePickerAsset,
  nomePadrao = 'imagem'
): Promise<ImagemEnviavel> {
  if (asset.fileSize && asset.fileSize > TAMANHO_MAXIMO_BYTES) {
    throw new ArquivoGrandeDemaisError(asset.fileSize);
  }

  const tipo = tipoDaImagem(asset);

  return {
    uri: asset.uri,
    name: trocarExtensao(asset.fileName ?? nomePadrao, extensaoDoTipo(tipo)),
    type: tipo,
  };
}

/**
 * Tipo MIME do arquivo. O picker costuma informá-lo; quando não informa, o
 * nome do arquivo decide, e JPEG é o palpite final por ser o que sai de
 * qualquer câmera.
 */
function tipoDaImagem(asset: ImagePickerAsset): string {
  const informado = asset.mimeType ?? '';
  if (/^image\/(jpeg|png|webp)$/i.test(informado)) return informado.toLowerCase();

  const nome = asset.fileName ?? '';
  if (/\.png$/i.test(nome)) return 'image/png';
  if (/\.webp$/i.test(nome)) return 'image/webp';

  return 'image/jpeg';
}

function extensaoDoTipo(tipo: string): string {
  if (tipo === 'image/png') return 'png';
  if (tipo === 'image/webp') return 'webp';

  return 'jpg';
}

function trocarExtensao(nome: string, extensao: string): string {
  const semExtensao = nome.replace(/\.[^./\\]+$/, '');

  return `${semExtensao || 'imagem'}.${extensao}`;
}
