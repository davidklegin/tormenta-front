import type { StyleProp, ViewStyle } from 'react-native';

export type WebFrameProps = {
  /** Endereço a carregar. Exclusivo com `html`. */
  uri?: string;
  /** HTML pronto, para o que o app monta na hora (áudio e vídeo). */
  html?: string;
  title?: string;
  onError?: () => void;
  style?: StyleProp<ViewStyle>;
};
