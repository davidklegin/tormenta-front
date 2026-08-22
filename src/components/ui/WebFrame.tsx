import { WebView } from 'react-native-webview';
import type { WebFrameProps } from './WebFrame.types';

/**
 * Uma página web dentro da tela — versão de celular.
 *
 * Serve ao visualizador de anexos: é o que desenha PDF, vídeo e áudio sem que
 * o app precise chamar outro aplicativo. O WebView do Android não abre PDF
 * sozinho, então quem entra em cena naquele caso é o visualizador pdf.js
 * servido pelo backend — ver `urlDoVisualizadorPdf`.
 */
export function WebFrame({ uri, html, title, onError, style }: WebFrameProps) {
  return (
    <WebView
      source={uri ? { uri } : { html: html ?? '' }}
      style={[{ flex: 1, backgroundColor: 'transparent' }, style]}
      accessibilityLabel={title}
      onError={onError}
      onHttpError={onError}
      originWhitelist={['*']}
      // O vídeo toca no lugar, e não em tela cheia por conta própria.
      allowsInlineMediaPlayback
      // Nada começa a tocar sozinho: som inesperado no meio da sessão é ruim.
      mediaPlaybackRequiresUserAction
      javaScriptEnabled
      domStorageEnabled
      // A barra de rolagem do WebView some no Android; a do conteúdo basta.
      showsVerticalScrollIndicator={false}
    />
  );
}
