import { View } from 'react-native';
import type { WebFrameProps } from './WebFrame.types';

/**
 * Uma página web dentro da tela — versão do navegador.
 *
 * É um `<iframe>` de verdade, e é essa a razão de o componente existir: abrir
 * um PDF por `<a href>` ou `window.open` levaria o usuário para outra aba, que
 * é justamente o que o visualizador de anexos existe para evitar.
 */
export function WebFrame({ uri, html, title, onError, style }: WebFrameProps) {
  return (
    <View style={[{ flex: 1 }, style]}>
      <iframe
        src={uri}
        srcDoc={uri ? undefined : html}
        title={title ?? 'Conteúdo'}
        onError={onError}
        style={{ border: 0, width: '100%', height: '100%', display: 'block', background: 'transparent' }}
      />
    </View>
  );
}
