import { View } from 'react-native';
import { Image } from 'expo-image';
import type { StagePoster } from '@/api/types';
import { Chip, Icon, Text } from '@/components/ui';
import { AttachmentPreview } from '@/components/files';
import { formatarTamanho, iconeDoAnexo, temPreVisualizacao } from '@/utils/arquivo';
import { radius, spacing, stroke, useResponsive, useTheme } from '@/theme';

export type StagePosterViewProps = {
  poster: StagePoster;
  /**
   * `palco` é a tela virada para os jogadores — tipografia grande, imagem
   * dominante, a três metros de distância. `previa` é o mesmo cartaz reduzido
   * na mesa de controle, para o mestre conferir o que está projetando sem
   * precisar olhar a outra tela.
   */
  modo?: 'palco' | 'previa';
};

/**
 * O cartaz do palco.
 *
 * Um componente só para tudo que o mestre exibe — NPC, mapa, magia da
 * biblioteca, poder da ficha de um jogador. Isso é possível porque o servidor
 * já entrega tudo no mesmo formato (App\Support\StagePoster): título,
 * subtítulo, texto, `facts`, etiquetas, imagem e arquivo.
 *
 * O `kind` não escolhe um componente, e sim o *arranjo*: mapa e imagem querem
 * a tela inteira, o retrato do NPC quer ficar ao lado do texto, e a leitura em
 * voz alta não quer imagem nenhuma — quer letra grande.
 */
export function StagePosterView({ poster, modo = 'palco' }: StagePosterViewProps) {
  const { colors } = useTheme();
  const { isPhone, isDesktop } = useResponsive();

  const palco = modo === 'palco';
  const grande = palco && !isPhone;

  // Mapa, planta, ilustração de cena: a imagem É o conteúdo, e dividir espaço
  // com uma coluna de texto só a encolheria.
  const imagemDomina = poster.kind === 'image' || poster.kind === 'place';
  const temTexto = Boolean(poster.body) || poster.facts.length > 0;

  const imagem = poster.image_url ? (
    <Image
      source={{ uri: poster.image_url }}
      style={{
        width: '100%',
        // No palco a imagem manda: sem altura fixa ela cresceria pelo aspecto
        // e empurraria o título para fora da tela.
        height: palco ? (imagemDomina ? 520 : 380) : 180,
        borderRadius: radius.lg,
        borderWidth: stroke.hairline,
        borderColor: colors.border,
        backgroundColor: colors.surfaceAlt,
      }}
      contentFit={imagemDomina ? 'contain' : 'cover'}
      transition={200}
      accessibilityLabel={poster.title}
    />
  ) : null;

  const cabecalho = (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Chip label={poster.kind_label} compact tone="gold" />
        {poster.tags.map((tag) => (
          <Chip key={tag} label={tag} compact />
        ))}
      </View>

      <Text variant={grande ? 'display' : palco ? 'title' : 'subheading'} numberOfLines={3}>
        {poster.title}
      </Text>

      {poster.subtitle ? (
        <Text variant={grande ? 'subheading' : 'small'} tone="secondary" numberOfLines={2}>
          {poster.subtitle}
        </Text>
      ) : null}
    </View>
  );

  const fichaDeDados =
    poster.facts.length > 0 ? (
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: palco ? spacing.md : spacing.sm,
        }}
      >
        {poster.facts.map((linha, indice) => (
          <View
            key={`${linha.label}-${indice}`}
            style={{
              backgroundColor: colors.surfaceAlt,
              borderRadius: radius.md,
              borderWidth: stroke.hairline,
              borderColor: colors.border,
              paddingVertical: palco ? spacing.sm : spacing.xs,
              paddingHorizontal: palco ? spacing.md : spacing.sm,
              gap: 2,
              minWidth: palco ? 120 : 90,
            }}
          >
            <Text variant="caption" tone="muted" uppercase>
              {linha.label}
            </Text>
            <Text variant={palco ? 'subheading' : 'smallStrong'}>{linha.value}</Text>
          </View>
        ))}
      </View>
    ) : null;

  const corpo = poster.body ? (
    <Text
      variant="body"
      tone={poster.kind === 'text' ? 'default' : 'secondary'}
      // Maior no palco, mas sem engrossar: um parágrafo inteiro em negrito
      // cansa antes do fim da descrição do NPC. Quem é lido a três metros é o
      // texto de leitura em voz alta, que ganha mais um degrau.
      style={
        grande
          ? { fontSize: poster.kind === 'text' ? 26 : 20, lineHeight: poster.kind === 'text' ? 40 : 32 }
          : undefined
      }
      // A leitura em voz alta é o texto e mais nada na tela: centralizá-la faz
      // dela o cartaz, em vez de um parágrafo perdido no canto.
      center={poster.kind === 'text' && palco}
    >
      {poster.body}
    </Text>
  ) : null;

  const aprimoramentos =
    poster.enhancements && poster.enhancements.length > 0 ? (
      <View style={{ gap: spacing.sm }}>
        <Text variant="caption" tone="secondary" uppercase>
          Aprimoramentos
        </Text>
        {poster.enhancements.map((aprimoramento, indice) => (
          <View
            key={indice}
            style={{
              backgroundColor: colors.surfaceAlt,
              borderRadius: radius.md,
              padding: spacing.md,
              gap: 2,
            }}
          >
            <Text variant="smallStrong" tone="arcane">
              {aprimoramento.cost}
            </Text>
            <Text variant={palco ? 'body' : 'small'} tone="secondary">
              {aprimoramento.text}
            </Text>
          </View>
        ))}
      </View>
    ) : null;

  const arquivo = poster.file ? <ArquivoDoCartaz file={poster.file} modo={modo} /> : null;

  const galeria =
    poster.gallery.length > 1 ? (
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        {poster.gallery.slice(1).map((imagemExtra) => (
          <Image
            key={imagemExtra.id}
            source={{ uri: imagemExtra.url }}
            style={{
              width: palco ? 140 : 64,
              height: palco ? 140 : 64,
              borderRadius: radius.md,
              borderWidth: stroke.hairline,
              borderColor: colors.border,
            }}
            contentFit="cover"
            transition={150}
            accessibilityLabel={imagemExtra.caption ?? poster.title}
          />
        ))}
      </View>
    ) : null;

  const conteudo = (
    <View style={{ gap: palco ? spacing.lg : spacing.md, flex: 1 }}>
      {cabecalho}
      {fichaDeDados}
      {corpo}
      {aprimoramentos}
      {arquivo}
      {galeria}
    </View>
  );

  // Retrato ao lado do texto: só quando há os dois e a tela comporta as duas
  // colunas. No celular tudo empilha, que é o único arranjo legível ali.
  const duasColunas = palco && isDesktop && imagem !== null && !imagemDomina && temTexto;

  if (duasColunas) {
    return (
      <View style={{ flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' }}>
        <View style={{ width: 380 }}>{imagem}</View>
        {conteudo}
      </View>
    );
  }

  return (
    <View style={{ gap: palco ? spacing.lg : spacing.md }}>
      {imagem}
      {conteudo}
    </View>
  );
}

/**
 * O arquivo do cartaz.
 *
 * PDF, vídeo e áudio abrem embutidos na projeção — é a carta que os jogadores
 * precisam ler e a trilha que precisa tocar, e mandá-los "baixar" no meio da
 * cena não funcionaria. O que não tem como desenhar (um .zip, uma planilha)
 * vira o cartão com nome e tamanho, sem fingir pré-visualização.
 */
function ArquivoDoCartaz({
  file,
  modo,
}: {
  file: NonNullable<StagePoster['file']>;
  modo: 'palco' | 'previa';
}) {
  const { colors } = useTheme();

  const embutivel = modo === 'palco' && temPreVisualizacao(file.kind) && file.kind !== 'image';

  if (embutivel) {
    return (
      <View
        style={{
          height: 420,
          borderRadius: radius.lg,
          borderWidth: stroke.hairline,
          borderColor: colors.border,
          overflow: 'hidden',
          backgroundColor: colors.surfaceAlt,
        }}
      >
        {/* O mesmo desenho do visualizador de anexos: o pdf.js para a carta, as
            tags de mídia para o áudio e o vídeo da cena. */}
        <AttachmentPreview
          attachment={{
            id: file.id,
            url: file.url,
            name: file.name,
            mime_type: file.mime_type,
            kind: file.kind,
            kind_label: file.kind_label,
            caption: null,
            size_bytes: file.size_bytes,
            sort_order: 0,
          }}
        />
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.md,
        borderWidth: stroke.hairline,
        borderColor: colors.border,
        padding: spacing.md,
      }}
    >
      <Icon name={iconeDoAnexo(file.kind)} size={28} color={colors.textMuted} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="smallStrong" numberOfLines={1}>
          {file.name}
        </Text>
        <Text variant="caption" tone="muted">
          {file.kind_label}
          {file.size_bytes ? ` · ${formatarTamanho(file.size_bytes)}` : ''}
        </Text>
      </View>
    </View>
  );
}
