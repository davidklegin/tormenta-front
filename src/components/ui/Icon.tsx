import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '@/theme';

/**
 * Ícones do aplicativo.
 *
 * Uma família só (MaterialCommunityIcons) para manter espessura e cantos
 * coerentes, e um mapa de nomes do domínio — `perícias`, `magias` — em vez de
 * espalhar strings da biblioteca pelas telas. Trocar um ícone vira uma linha
 * aqui, e nenhuma tela precisa saber que biblioteca está por baixo.
 */
const GLYPHS = {
  // Navegação principal
  personagens: 'account-details-outline',
  campanhas: 'flag-variant-outline',
  perfil: 'account-circle-outline',

  // Abas da ficha
  resumo: 'sword-cross',
  pericias: 'dice-d20-outline',
  equipamento: 'bag-personal-outline',
  poderes: 'lightning-bolt-outline',
  magias: 'auto-fix',
  habilidades: 'shield-star-outline',
  historia: 'book-open-page-variant-outline',
  anotacoes: 'notebook-outline',

  // Domínio
  vida: 'heart',
  mana: 'flash',
  defesa: 'shield-half-full',
  condicao: 'skull-outline',
  descanso: 'bed',
  mestre: 'shield-crown-outline',
  jogadores: 'account-group-outline',
  dinheiro: 'treasure-chest',
  carga: 'sack',

  // Ações
  voltar: 'chevron-left',
  expandir: 'chevron-down',
  adicionar: 'plus',
  adicionarCirculo: 'plus-circle-outline',
  remover: 'close',
  editar: 'pencil',
  excluir: 'trash-can-outline',
  confirmar: 'check',
  buscar: 'magnify',
  telaCheia: 'fullscreen',
  sairDaTelaCheia: 'fullscreen-exit',
  configuracoes: 'cog-outline',
  sair: 'logout',
  convidar: 'account-plus-outline',
  mais: 'plus',
  menos: 'minus',

  // Anexos — um por forma de exibição (ver AttachmentKind na API)
  arquivo: 'file-outline',
  arquivoImagem: 'file-image-outline',
  arquivoPdf: 'file-pdf-box',
  arquivoVideo: 'file-video-outline',
  arquivoAudio: 'file-music-outline',
  arquivoTexto: 'file-document-outline',
  arquivoCompactado: 'folder-zip-outline',
  arquivoDocumento: 'file-document-multiple-outline',
  anexar: 'paperclip',
  baixar: 'download-outline',

  // Sinalização
  ajuda: 'help-circle-outline',
  info: 'information-outline',
  alerta: 'alert-circle-outline',
} as const;

export type IconName = keyof typeof GLYPHS;

export type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
};

/** Tamanhos como tokens, para não aparecerem valores soltos pelas telas. */
export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

export function Icon({ name, size = iconSize.md, color }: IconProps) {
  const { colors } = useTheme();

  return <MaterialCommunityIcons name={GLYPHS[name]} size={size} color={color ?? colors.textMuted} />;
}
