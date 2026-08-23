import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { apiFetchRaw, getApiBaseUrl } from '@/api';
import type { NoteAttachment } from '@/api/types';
import { Button, Icon, Loading, Text, WebFrame, iconSize } from '@/components/ui';
import { baixarAnexo, caminhoDoConteudo, formatarTamanho, iconeDoAnexo } from '@/utils/arquivo';
import { radius, spacing, stroke, useTheme, type Palette } from '@/theme';

/**
 * Visualizador de anexos.
 *
 * A razão de existir cabe numa frase: tocar num arquivo não pode tirar a
 * pessoa do app. Abrir uma aba nova no meio de uma sessão é perder o lugar na
 * ficha, na anotação e às vezes na conexão de tempo real — então tudo que dá
 * para desenhar é desenhado aqui dentro, em tela cheia, com o tema do app.
 *
 * Cada formato tem um caminho:
 *
 *   · imagem — direto, com `expo-image`;
 *   · PDF — o visualizador do navegador quando ele existe, e o pdf.js servido
 *     pelo backend quando não (Android, e navegadores de celular em geral);
 *   · vídeo e áudio — as tags do HTML, que já trazem os controles prontos;
 *   · texto — buscado e exibido em fonte monoespaçada;
 *   · o resto (.zip, .docx, .xlsx) — cartão com o botão de baixar, porque
 *     inventar uma pré-visualização de planilha seria pior que não ter.
 */
export function AttachmentViewer({
  attachments,
  startIndex,
  visible,
  onClose,
  onRemove,
  removing = false,
}: {
  attachments: NoteAttachment[];
  startIndex: number;
  visible: boolean;
  onClose: () => void;
  onRemove?: (attachment: NoteAttachment) => void;
  removing?: boolean;
}) {
  const { colors } = useTheme();
  const [indice, setIndice] = useState(startIndex);

  // Abrir pelo terceiro anexo tem que começar no terceiro, e não onde a última
  // visita parou.
  useEffect(() => {
    if (visible) setIndice(startIndex);
  }, [visible, startIndex]);

  const anexo = attachments[Math.min(indice, attachments.length - 1)];

  if (!anexo) return null;

  const temAnterior = indice > 0;
  const temProximo = indice < attachments.length - 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.overlay }}>
        <View
          style={{
            flex: 1,
            margin: spacing.md,
            borderRadius: radius.lg,
            borderWidth: stroke.hairline,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
            overflow: 'hidden',
          }}
        >
          <Cabecalho
            /* Estado de download é por arquivo: trocar de anexo não pode
               herdar o "falha ao baixar" do anterior. */
            key={anexo.id}
            anexo={anexo}
            colors={colors}
            onClose={onClose}
            onRemove={onRemove ? () => onRemove(anexo) : undefined}
            removing={removing}
          />

          <View style={{ flex: 1, backgroundColor: colors.surfaceAlt }}>
            {/* A chave força um visualizador novo a cada anexo: sem ela, trocar
                de arquivo reaproveitaria o WebView com o conteúdo anterior. */}
            <AttachmentPreview key={anexo.id} attachment={anexo} />
          </View>

          <Rodape
            anexo={anexo}
            colors={colors}
            posicao={`${indice + 1} de ${attachments.length}`}
            mostrarNavegacao={attachments.length > 1}
            onAnterior={temAnterior ? () => setIndice((i) => i - 1) : undefined}
            onProximo={temProximo ? () => setIndice((i) => i + 1) : undefined}
          />
        </View>
      </View>
    </Modal>
  );
}

function Cabecalho({
  anexo,
  colors,
  onClose,
  onRemove,
  removing,
}: {
  anexo: NoteAttachment;
  colors: Palette;
  onClose: () => void;
  onRemove?: () => void;
  removing: boolean;
}) {
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState(false);

  async function baixar() {
    setBaixando(true);
    setErro(false);

    try {
      await baixarAnexo(anexo);
    } catch {
      setErro(true);
    } finally {
      setBaixando(false);
    }
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        borderBottomWidth: stroke.hairline,
        borderBottomColor: colors.border,
      }}
    >
      <Icon name={iconeDoAnexo(anexo.kind)} size={iconSize.lg} color={colors.accentInk} />

      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {anexo.name}
        </Text>
        <Text variant="caption" tone="muted">
          {[anexo.kind_label, formatarTamanho(anexo.size_bytes)].filter(Boolean).join(' · ')}
          {erro ? ' · falha ao baixar' : ''}
        </Text>
      </View>

      <Pressable
        onPress={baixar}
        disabled={baixando}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Baixar arquivo"
        style={{ opacity: baixando ? 0.5 : 1, padding: spacing.xs }}
      >
        <Icon name="baixar" size={iconSize.lg} color={colors.textMuted} />
      </Pressable>

      {onRemove ? (
        <Pressable
          onPress={onRemove}
          disabled={removing}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Remover arquivo"
          style={{ opacity: removing ? 0.5 : 1, padding: spacing.xs }}
        >
          <Icon name="excluir" size={iconSize.lg} color={colors.dangerInk} />
        </Pressable>
      ) : null}

      <Pressable
        onPress={onClose}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Fechar"
        style={{ padding: spacing.xs }}
      >
        <Icon name="remover" size={iconSize.lg} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

function Rodape({
  anexo,
  colors,
  posicao,
  mostrarNavegacao,
  onAnterior,
  onProximo,
}: {
  anexo: NoteAttachment;
  colors: Palette;
  posicao: string;
  mostrarNavegacao: boolean;
  onAnterior?: () => void;
  onProximo?: () => void;
}) {
  if (!anexo.caption && !mostrarNavegacao) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        borderTopWidth: stroke.hairline,
        borderTopColor: colors.border,
      }}
    >
      <View style={{ flex: 1 }}>
        {anexo.caption ? (
          <Text variant="small" tone="secondary" numberOfLines={2}>
            {anexo.caption}
          </Text>
        ) : null}
      </View>

      {mostrarNavegacao ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Button label="‹" variant="secondary" size="sm" onPress={onAnterior} disabled={!onAnterior} />
          <Text variant="caption" tone="muted">
            {posicao}
          </Text>
          <Button label="›" variant="secondary" size="sm" onPress={onProximo} disabled={!onProximo} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * O conteúdo de um anexo, desenhado sem moldura nem navegação.
 *
 * Exportado porque tem um segundo consumidor: o palco da sessão projeta a
 * carta em PDF e toca o áudio da cena com este mesmo desenho. Um visualizador
 * de PDF diferente na TV significaria, na prática, um dos dois quebrado sem
 * ninguém notar.
 */
export function AttachmentPreview({ attachment: anexo }: { attachment: NoteAttachment }) {
  const { colors, isDark } = useTheme();

  switch (anexo.kind) {
    case 'image':
      return (
        <Image
          source={{ uri: anexo.url }}
          style={{ flex: 1 }}
          contentFit="contain"
          transition={150}
          accessibilityLabel={anexo.caption ?? anexo.name}
        />
      );

    case 'pdf':
      return <WebFrame uri={urlDoVisualizadorPdf(anexo.url, isDark)} title={anexo.name} />;

    case 'video':
    case 'audio':
      return <WebFrame html={htmlDeMidia(anexo, colors)} title={anexo.name} />;

    case 'text':
      return <Texto anexo={anexo} />;

    default:
      return <SemPreVisualizacao anexo={anexo} />;
  }
}

/** Trecho máximo lido de um arquivo de texto — o suficiente para conferir. */
const LIMITE_DE_TEXTO = 200_000;

function Texto({ anexo }: { anexo: NoteAttachment }) {
  const { colors } = useTheme();
  const [estado, setEstado] = useState<{ conteudo?: string; erro?: boolean }>({});

  useEffect(() => {
    let ativo = true;

    // Pela API, e não pela URL do storage: é o caminho que responde a `fetch`
    // de outra origem e o que confere se esta pessoa pode ler a anotação.
    apiFetchRaw(caminhoDoConteudo(anexo))
      .then((resposta) => resposta.text())
      .then((texto) => {
        if (ativo) setEstado({ conteudo: texto.slice(0, LIMITE_DE_TEXTO) });
      })
      .catch(() => {
        if (ativo) setEstado({ erro: true });
      });

    return () => {
      ativo = false;
    };
    // Pelo id: a lista pode ser recarregada e trazer outro objeto para o
    // mesmo arquivo, e reler o conteúdo por causa disso não muda nada.
  }, [anexo.id]);

  if (estado.erro) return <SemPreVisualizacao anexo={anexo} motivo="Não foi possível ler este arquivo." />;
  if (estado.conteudo === undefined) return <Loading label="Abrindo arquivo…" />;

  const truncado = estado.conteudo.length >= LIMITE_DE_TEXTO;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md }} horizontal={false}>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <Text
          selectable
          style={{
            fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
            fontSize: 13,
            lineHeight: 19,
            color: colors.text,
          }}
        >
          {estado.conteudo}
        </Text>
      </ScrollView>

      {truncado ? (
        <Text variant="caption" tone="muted" style={{ marginTop: spacing.md }}>
          Arquivo grande: mostrando o começo. Baixe para ver o resto.
        </Text>
      ) : null}
    </ScrollView>
  );
}

function SemPreVisualizacao({ anexo, motivo }: { anexo: NoteAttachment; motivo?: string }) {
  const { colors } = useTheme();
  const [baixando, setBaixando] = useState(false);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
        padding: spacing.xl,
      }}
    >
      <Icon name={iconeDoAnexo(anexo.kind)} size={64} color={colors.textSubtle} />

      <Text variant="body" tone="secondary" center>
        {motivo ?? `Não há como mostrar ${anexo.kind_label.toLowerCase()} dentro do app.`}
      </Text>

      <Text variant="caption" tone="muted" center>
        {[anexo.name, formatarTamanho(anexo.size_bytes)].filter(Boolean).join(' · ')}
      </Text>

      <Button
        label={Platform.OS === 'web' ? 'Baixar arquivo' : 'Abrir com outro app'}
        variant="secondary"
        loading={baixando}
        icon={<Icon name="baixar" size={iconSize.sm} color={colors.accentInk} />}
        onPress={async () => {
          setBaixando(true);
          try {
            await baixarAnexo(anexo);
          } catch {
            // O aviso de falha já aparece no cabeçalho; aqui basta não travar.
          } finally {
            setBaixando(false);
          }
        }}
      />
    </View>
  );
}

/**
 * Onde abrir um PDF.
 *
 * Navegador de computador tem visualizador próprio — melhor que qualquer coisa
 * que o app monte, com busca e impressão. Quando não tem (Android, e a maioria
 * dos navegadores de celular), o iframe cairia no comportamento de baixar o
 * arquivo, então quem desenha é o pdf.js servido pelo backend, na mesma origem
 * do arquivo.
 */
function urlDoVisualizadorPdf(url: string, escuro: boolean): string {
  const nativo =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    (navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled === true;

  if (nativo) return url;

  return `${origemDoArquivo(url)}/pdfjs/viewer.html?file=${encodeURIComponent(url)}&theme=${escuro ? 'dark' : 'light'}`;
}

/**
 * A origem do próprio arquivo, e não a que está configurada como API.
 *
 * As duas costumam ser a mesma máquina, mas não a mesma string: o app pode
 * estar apontado para `127.0.0.1:8010` enquanto o Laravel monta as URLs do
 * storage com o `APP_URL`, que diz `localhost:8010`. Para o navegador isso são
 * origens diferentes, e o pdf.js — que busca o arquivo por fetch — levaria um
 * bloqueio de CORS. Servindo o visualizador da mesma origem do arquivo, a
 * questão não chega a existir.
 */
function origemDoArquivo(url: string): string {
  const barra = url.indexOf('/', url.indexOf('//') + 2);

  if (url.startsWith('http') && barra > 0) return url.slice(0, barra);

  // URL relativa ou estranha: resta o endereço configurado da API.
  return getApiBaseUrl().replace(/\/+$/, '');
}

/**
 * Página mínima para vídeo e áudio.
 *
 * As tags do HTML já trazem controles, barra de progresso e volume prontos e
 * iguais nas duas plataformas — bem mais do que valeria a pena reconstruir com
 * componentes nativos só para tocar o áudio de uma sessão.
 */
function htmlDeMidia(anexo: NoteAttachment, colors: Palette): string {
  const url = escaparHtml(anexo.url);
  const tag =
    anexo.kind === 'video'
      ? `<video controls playsinline preload="metadata" src="${url}"></video>`
      : `<audio controls preload="metadata" src="${url}"></audio>`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; height: 100%; background: ${colors.surfaceAlt}; }
  body { display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; }
  video { max-width: 100%; max-height: 100%; background: #000; border-radius: 8px; }
  audio { width: 100%; max-width: 480px; }
  p { color: ${colors.textMuted}; font: 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; }
</style>
</head>
<body>${tag}<noscript><p>${escaparHtml(anexo.name)}</p></noscript></body>
</html>`;
}

/** O nome do arquivo veio de quem enviou: não entra em HTML sem passar por aqui. */
function escaparHtml(valor: string): string {
  return valor.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
