import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';

/**
 * Maior lado da imagem depois do preparo.
 *
 * Uma foto de celular sai da galeria com 4000 px e vários MB. Aqui ela é
 * retrato de NPC, mapa ou avatar — desenhada em miniatura de 96 px e, no
 * máximo, em tela cheia. 1600 px cobre isso com folga e derruba o arquivo de
 * megabytes para centenas de KB.
 */
const LADO_MAXIMO = 1600;

/** 0.8 é o ponto em que o JPEG ainda não mostra artefato em tela de celular. */
const QUALIDADE = 0.8;

/** Imagem pronta para virar FormData. */
export type ImagemEnviavel = {
  uri: string;
  name: string;
  type: string;
};

/**
 * Reduz a imagem escolhida antes de enviar.
 *
 * Existe porque o limite de upload não é só a validação do Laravel: o nginx
 * corta o corpo da requisição antes de o PHP existir, e o usuário recebe um 413
 * seco. Enviando a imagem já reduzida, o upload não chega perto de nenhum
 * desses tetos.
 *
 * PNG continua PNG: brasão e mapa costumam ter transparência, e convertê-los
 * para JPEG colocaria um fundo sólido no lugar. Todo o resto sai como JPEG.
 */
export async function prepararImagemParaUpload(
  asset: ImagePickerAsset,
  nomePadrao = 'imagem'
): Promise<ImagemEnviavel> {
  const ehPng =
    /png/i.test(asset.mimeType ?? '') || /\.png$/i.test(asset.fileName ?? '');
  const formato = ehPng ? SaveFormat.PNG : SaveFormat.JPEG;
  const extensao = ehPng ? 'png' : 'jpg';

  try {
    const contexto = ImageManipulator.manipulate(asset.uri);

    // Só encolhe. Sem esta checagem, uma imagem de 400 px seria ampliada para
    // 1600 — arquivo maior, e nenhum pixel novo de verdade.
    const maiorLado = Math.max(asset.width ?? 0, asset.height ?? 0);
    if (maiorLado > LADO_MAXIMO) {
      contexto.resize(
        (asset.width ?? 0) >= (asset.height ?? 0)
          ? { width: LADO_MAXIMO }
          : { height: LADO_MAXIMO }
      );
    }

    const referencia = await contexto.renderAsync();
    const resultado = await referencia.saveAsync({ compress: QUALIDADE, format: formato });

    return {
      uri: resultado.uri,
      name: trocarExtensao(asset.fileName ?? nomePadrao, extensao),
      type: ehPng ? 'image/png' : 'image/jpeg',
    };
  } catch {
    // Formato exótico que o manipulador não abre: segue o original. Pior que
    // enviar reduzido, melhor que não deixar o usuário enviar nada.
    return {
      uri: asset.uri,
      name: asset.fileName ?? `${nomePadrao}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    };
  }
}

function trocarExtensao(nome: string, extensao: string): string {
  const semExtensao = nome.replace(/\.[^./\\]+$/, '');

  return `${semExtensao || 'imagem'}.${extensao}`;
}
