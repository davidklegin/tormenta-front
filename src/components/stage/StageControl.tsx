import { useMemo, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { NoteAttachment, StageItem, StageItemKind, StagePoster, StageSource, StageState } from '@/api/types';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  Input,
  Loading,
  SegmentedControl,
  Text,
  Toast,
  type IconName,
} from '@/components/ui';
import { useCampaignCharacters } from '@/hooks/useCampaigns';
import { useCharacter } from '@/hooks/useCharacters';
import { useDebounced } from '@/hooks/useDebounced';
import { usePowerCatalog } from '@/hooks/usePowerCatalog';
import { useReference } from '@/hooks/useReference';
import { useSpellCatalog } from '@/hooks/useSpellCatalog';
import { useStage, useStageControls, useStageItemMutations, useStageItems } from '@/hooks/useStage';
import { radius, spacing, stroke, useResponsive, useTheme } from '@/theme';
import { iconeDoAnexo } from '@/utils/arquivo';
import { contemTermo, normalizar } from '@/utils/texto';
import { StageItemForm } from './StageItemForm';
import { StagePosterView } from './StagePosterView';

type Fonte = 'acervo' | 'texto' | 'magias' | 'poderes' | 'itens' | 'fichas';

const FONTES: { value: Fonte; label: string }[] = [
  { value: 'acervo', label: 'Acervo' },
  { value: 'texto', label: 'Texto' },
  { value: 'magias', label: 'Magias' },
  { value: 'poderes', label: 'Poderes' },
  { value: 'itens', label: 'Itens' },
  { value: 'fichas', label: 'Fichas' },
];

/** Quantos itens de catálogo a lista mostra antes de pedir "mostrar mais". */
const POR_VEZ = 40;

/** Ícone de cada tipo de peça, para a miniatura de quem não tem retrato. */
const ICONE_DA_PECA: Record<StageItemKind, IconName> = {
  npc: 'jogadores',
  place: 'campanhas',
  image: 'arquivoImagem',
  handout: 'arquivoDocumento',
  text: 'anotacoes',
};

/**
 * Identidade de uma fonte, para saber qual linha está sendo enviada.
 *
 * As chaves são ordenadas porque o objeto é remontado a cada render e a ordem
 * de escrita não é garantia de nada — comparar o texto cru daria falso negativo
 * justo na linha que o mestre acabou de tocar.
 */
function chaveDaFonte(source: StageSource): string {
  return JSON.stringify(Object.entries(source).sort());
}

/**
 * Mesa de Controle: cadastrar e exibir no mesmo lugar.
 *
 * O acervo não é uma tela à parte porque as duas coisas acontecem juntas —
 * durante a sessão o mestre cadastra o NPC que a mesa acabou de inventar um
 * motivo para conhecer e o coloca no ar em seguida. Separá-las custaria uma
 * navegação no meio da cena, que é exatamente o momento em que ninguém tem
 * tempo para isso.
 *
 * O que está no ar fica sempre visível, desenhado com o MESMO componente da
 * projeção: uma prévia aproximada seria pior que nenhuma — o mestre só
 * descobriria a diferença pela cara dos jogadores.
 */
export function StageControl({ campaignId }: { campaignId: number }) {
  const { colors } = useTheme();
  const { isDesktop, height } = useResponsive();

  const stage = useStage(campaignId);
  const { show, clear, publishLive } = useStageControls(campaignId);

  const [fonte, setFonte] = useState<Fonte>('acervo');
  const [aviso, setAviso] = useState<string | null>(null);

  /**
   * No celular a prévia começa fechada.
   *
   * O cartaz de um NPC ocupa uma tela e meia, e ele fica ACIMA das fontes: com
   * a prévia aberta, chegar ao acervo para exibir a próxima peça custava mil e
   * trezentos pixels de rolagem. Fechada, o mestre continua vendo o que está
   * no ar — título, tipo e retrato — e a lista fica à mão.
   */
  const [previaAberta, setPreviaAberta] = useState(false);
  const mostrarPrevia = isDesktop || previaAberta;

  const exibir = (source: StageSource) => show.mutate(source);
  const noAr = stage.data?.poster ?? null;

  /**
   * Qual linha está esperando o servidor.
   *
   * Numa lista de trinta linhas iguais, sem esta marca o mestre não sabe se
   * acertou o alvo — e toca de novo, exibindo outra coisa por engano.
   */
  const enviando = show.isPending && show.variables ? chaveDaFonte(show.variables) : null;
  const estaEnviando = (source: StageSource) => enviando === chaveDaFonte(source);

  return (
    <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: spacing.lg, alignItems: 'flex-start' }}>
      {/* No ar agora — fixo à esquerda no desktop, que é onde a tela de
          controle costuma ficar durante a sessão. */}
      <View
        style={[
          { width: isDesktop ? 380 : '100%', gap: spacing.sm },
          // Na web a coluna acompanha a rolagem. Com trinta peças no acervo, o
          // "no ar agora" saía da tela justamente quando o mestre escolhia a
          // próxima — e exibir sem ver o que foi para a TV é o pior dos mundos:
          // o erro só aparece na cara dos jogadores.
          isDesktop && Platform.OS === 'web'
            ? ({
                position: 'sticky',
                top: spacing.md,
                alignSelf: 'flex-start',
                // O cartaz de um NPC com história longa passa da altura da
                // tela: sem teto, o painel colado no topo empurra o fim do
                // texto para fora e não há como alcançá-lo rolando.
                maxHeight: height - spacing.xxl,
                overflowY: 'auto',
              } as never)
            : null,
        ]}
      >
        {aviso ? <Toast message={aviso} tone="success" onDismiss={() => setAviso(null)} /> : null}

        <Card
          title="No ar agora"
          subtitle={
            stage.data?.shown_by
              ? `Exibido por ${stage.data.shown_by.nickname || stage.data.shown_by.name}`
              : 'A tela dos jogadores'
          }
          active={Boolean(noAr)}
        >
          <View style={{ gap: spacing.md }}>
            {stage.isLoading ? (
              <Loading inline label="Lendo o palco…" />
            ) : noAr ? (
              mostrarPrevia ? (
                <StagePosterView poster={noAr} modo="previa" />
              ) : (
                <ResumoDoAr poster={noAr} onAbrir={() => setPreviaAberta(true)} />
              )
            ) : (
              <View
                style={{
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingVertical: spacing.xl,
                  borderRadius: radius.lg,
                  borderWidth: stroke.hairline,
                  borderStyle: 'dashed',
                  borderColor: colors.border,
                }}
              >
                <Icon name="mestre" size={28} color={colors.textSubtle} />
                <Text variant="small" tone="muted">
                  Cortina fechada — nada sendo exibido
                </Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              {/* Fechar a cortina é o gesto urgente da mesa ("tira isso da
                  tela!"): quando há algo no ar ele vira o botão cheio, e não
                  mais um contorno discreto ao lado de outro. */}
              <Button
                label="Tirar da tela"
                variant={noAr ? 'primary' : 'secondary'}
                size="sm"
                icon={
                  noAr ? <Icon name="remover" size={16} color={colors.onPrimary} /> : undefined
                }
                disabled={!noAr}
                loading={clear.isPending}
                onPress={() => clear.mutate()}
                style={{ flex: 1, minWidth: 150 }}
              />
              <Button
                label="Ver o palco"
                variant="ghost"
                size="sm"
                onPress={() => abrirPalco(campaignId)}
                style={{ flex: 1, minWidth: 130 }}
              />
            </View>

            {!isDesktop && noAr && previaAberta ? (
              <Button
                label="Fechar a prévia"
                variant="ghost"
                size="sm"
                icon={<Icon name="expandir" size={16} color={colors.textMuted} />}
                onPress={() => setPreviaAberta(false)}
              />
            ) : null}

            {/* Depois de a mesa ver, o material deixa de ser surpresa e vira
                consulta: enviar para as anotações é o gesto seguinte. O aviso
                é passageiro de propósito — o rótulo fixo em "enviado" mentia
                sobre o cartaz seguinte, que ainda não tinha sido enviado. */}
            <Button
              label="Enviar para as anotações"
              variant="ghost"
              size="sm"
              icon={<Icon name="anotacoes" size={16} color={colors.textMuted} />}
              disabled={!noAr}
              loading={publishLive.isPending}
              onPress={() =>
                publishLive.mutate(undefined, {
                  onSuccess: () => setAviso('Enviado para as anotações da campanha.'),
                })
              }
            />
          </View>
        </Card>
      </View>

      {/* Fontes: tudo que pode ir ao ar. */}
      <View style={{ flex: 1, gap: spacing.md, width: isDesktop ? undefined : '100%' }}>
        <SegmentedControl
          scrollable
          value={fonte}
          onChange={(valor) => setFonte(valor as Fonte)}
          segments={FONTES}
        />

        {fonte === 'acervo' ? (
          <FonteAcervo
            campaignId={campaignId}
            onExibir={exibir}
            stage={stage.data ?? null}
            estaEnviando={estaEnviando}
          />
        ) : null}
        {fonte === 'texto' ? <FonteTexto onExibir={exibir} enviando={show.isPending} /> : null}
        {fonte === 'magias' ? <FonteMagias onExibir={exibir} estaEnviando={estaEnviando} /> : null}
        {fonte === 'poderes' ? <FontePoderes onExibir={exibir} estaEnviando={estaEnviando} /> : null}
        {fonte === 'itens' ? <FonteItens onExibir={exibir} estaEnviando={estaEnviando} /> : null}
        {fonte === 'fichas' ? (
          <FonteFichas campaignId={campaignId} onExibir={exibir} estaEnviando={estaEnviando} />
        ) : null}
      </View>
    </View>
  );
}

/**
 * O que está no ar, em três linhas.
 *
 * É o suficiente para o mestre saber que a TV mostra o que ele mandou: o
 * retrato, o nome e o tipo. A prévia inteira continua a um toque — e é ela que
 * mostra exatamente o que os jogadores leem.
 */
function ResumoDoAr({ poster, onAbrir }: { poster: StagePoster; onAbrir: () => void }) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onAbrir}
      accessibilityRole="button"
      accessibilityLabel={`Ver a prévia de ${poster.title}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.sm,
        borderRadius: radius.md,
        borderWidth: stroke.hairline,
        borderColor: colors.success,
        backgroundColor: pressed ? colors.surfaceHover : colors.surfaceAlt,
      })}
    >
      {poster.image_url ? (
        <Image
          source={{ uri: poster.image_url }}
          style={{
            width: 56,
            height: 56,
            borderRadius: radius.sm,
            borderWidth: stroke.hairline,
            borderColor: colors.border,
          }}
          contentFit="cover"
          transition={150}
          accessibilityLabel=""
          aria-hidden
        />
      ) : null}

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="caption" tone="muted" uppercase>
          {poster.kind_label}
        </Text>
        <Text variant="bodyStrong" numberOfLines={1}>
          {poster.title}
        </Text>
        {poster.subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {poster.subtitle}
          </Text>
        ) : null}
      </View>

      <Text variant="caption" tone="primary" uppercase>
        ver prévia
      </Text>
    </Pressable>
  );
}

/**
 * Uma linha de qualquer lista de fonte.
 *
 * Toda fonte termina no mesmo gesto — escolher e exibir —, então todas usam
 * esta linha. O toque na linha inteira exibe: durante a cena, mirar num botão
 * pequeno é justamente o que não dá para pedir.
 */
function Linha({
  titulo,
  detalhe,
  etiqueta,
  noAr,
  enviando,
  miniatura,
  emCartao,
  onPress,
}: {
  titulo: string;
  detalhe?: string | null;
  etiqueta?: string | null;
  noAr?: boolean;
  /** Esperando a resposta do servidor para esta linha. */
  enviando?: boolean;
  miniatura?: React.ReactNode;
  /** A linha já está dentro de uma moldura (o cartão da peça): sem borda dupla. */
  emCartao?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={enviando}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: pressed ? colors.surfaceHover : emCartao ? 'transparent' : colors.surface,
        borderRadius: emCartao ? 0 : radius.md,
        borderWidth: emCartao ? 0 : stroke.hairline,
        // A que está no ar se destaca na lista: no meio de vinte peças, é a
        // única informação que o mestre procura de relance.
        borderColor: noAr ? colors.success : colors.border,
        // Alvo de toque de mesa: a mão vai à tela no escuro, com o dado na
        // outra. Menos que isto vira erro de mira.
        paddingVertical: spacing.sm + 2,
        paddingHorizontal: spacing.md,
      })}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(enviando) }}
      accessibilityLabel={`Exibir ${titulo}${noAr ? ' (já está no ar)' : ''}`}
    >
      {miniatura}

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {titulo}
        </Text>
        {detalhe ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {detalhe}
          </Text>
        ) : null}
      </View>

      {noAr ? <Chip label="no ar" compact tone="success" /> : null}
      {etiqueta ? <Chip label={etiqueta} compact /> : null}

      <Text variant="caption" tone={enviando ? 'muted' : 'primary'} uppercase>
        {enviando ? 'exibindo…' : 'exibir'}
      </Text>
    </Pressable>
  );
}

/**
 * Linha de contagem acima de uma lista.
 *
 * Diz quantos itens a lista tem e quantos ela está mostrando. Sem isso, uma
 * lista cortada no quadragésimo item é indistinguível de uma lista que acabou —
 * e o mestre conclui que a magia não existe no catálogo.
 */
function Contagem({ visiveis, total, rotulo }: { visiveis: number; total: number; rotulo: string }) {
  const texto =
    visiveis < total ? `Mostrando ${visiveis} de ${total} ${rotulo}` : `${total} ${rotulo}`;

  return (
    <Text variant="caption" tone="muted">
      {texto}
    </Text>
  );
}

function FonteAcervo({
  campaignId,
  onExibir,
  stage,
  estaEnviando,
}: {
  campaignId: number;
  onExibir: (source: StageSource) => void;
  stage: StageState | null;
  estaEnviando: (source: StageSource) => boolean;
}) {
  const { colors } = useTheme();

  const [q, setQ] = useState('');
  const [kind, setKind] = useState<string>('todos');
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<StageItem | null>(null);

  // A busca só vira requisição depois da pausa na digitação: sem isso, "gorack"
  // dispara seis consultas e a lista pisca a cada letra.
  const termo = useDebounced(q.trim(), 250);

  const itens = useStageItems(campaignId, {
    q: termo || undefined,
    kind: kind === 'todos' ? undefined : (kind as StageItemKind),
  });

  const lista = itens.data ?? [];
  const filtrando = termo !== '' || kind !== 'todos';

  const abrirNova = () => {
    setEditando(null);
    setFormOpen(true);
  };

  const limparFiltros = () => {
    setQ('');
    setKind('todos');
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Input
            placeholder="Buscar no acervo…"
            value={q}
            onChangeText={setQ}
            autoCorrect={false}
            // O X aparece só com o campo preenchido: limpar a busca sem apagar
            // letra por letra é o gesto mais repetido desta tela.
            right={
              q === '' ? (
                <Icon name="buscar" size={18} color={colors.textSubtle} />
              ) : (
                <Pressable
                  onPress={() => setQ('')}
                  accessibilityRole="button"
                  accessibilityLabel="Limpar busca"
                  // Ver Toast: na web o `hitSlop` não vira área clicável; o
                  // padding sim.
                  style={{ padding: spacing.space2, margin: -spacing.space2 }}
                >
                  <Icon name="remover" size={18} color={colors.textSubtle} />
                </Pressable>
              )
            }
          />
        </View>
        <Button
          label="Nova peça"
          size="sm"
          icon={<Icon name="adicionar" size={16} color={colors.onPrimary} />}
          onPress={abrirNova}
        />
      </View>

      <SegmentedControl
        scrollable
        value={kind}
        onChange={setKind}
        segments={[
          { value: 'todos', label: 'Todos' },
          { value: 'npc', label: 'NPC' },
          { value: 'place', label: 'Lugar' },
          { value: 'image', label: 'Imagem' },
          { value: 'handout', label: 'Documento' },
          { value: 'text', label: 'Texto' },
        ]}
      />

      {itens.isLoading ? (
        <Loading inline label="Abrindo o acervo…" />
      ) : lista.length === 0 && filtrando ? (
        /* Acervo cheio e busca sem resposta não é "acervo vazio": dizer isso
           mandaria o mestre cadastrar de novo o NPC que ele já tem. */
        <EmptyState
          icon="buscar"
          title="Nada encontrado"
          description={
            termo
              ? `Nenhuma peça do acervo combina com “${termo}”${kind === 'todos' ? '' : ' neste tipo'}.`
              : 'Nenhuma peça deste tipo no acervo.'
          }
          actionLabel="Limpar busca"
          onAction={limparFiltros}
        />
      ) : lista.length === 0 ? (
        <EmptyState
          icon="mestre"
          title="Acervo vazio"
          description="Cadastre NPCs, mapas, cartas e textos de leitura. Nada disso aparece para os jogadores até você exibir."
          actionLabel="Cadastrar a primeira peça"
          onAction={abrirNova}
        />
      ) : (
        <>
          <Text variant="caption" tone="muted">
            {lista.length === 1 ? '1 peça' : `${lista.length} peças`}
            {filtrando ? ' encontradas' : ' no acervo'}
            {itens.isFetching ? ' · atualizando…' : ''}
          </Text>

          {lista.map((peca) => (
            <PecaDoAcervo
              key={peca.id}
              campaignId={campaignId}
              peca={peca}
              stage={stage}
              onExibir={onExibir}
              estaEnviando={estaEnviando}
              onEditar={() => {
                setEditando(peca);
                setFormOpen(true);
              }}
            />
          ))}
        </>
      )}

      <StageItemForm
        key={editando?.id ?? `nova-${kind}`}
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        campaignId={campaignId}
        /* A versão recém-carregada, e não a que abriu o formulário: anexar um
           arquivo recarrega a lista, e é dali que sai a tira de anexos. */
        item={editando ? (lista.find((item) => item.id === editando.id) ?? editando) : null}
        defaultKind={kind === 'todos' ? 'npc' : (kind as StageItemKind)}
      />
    </View>
  );
}

/**
 * O retrato da peça em miniatura — ou o ícone do tipo, quando não há retrato.
 *
 * Um acervo de trinta NPCs lido só por nome obriga a decorar a lista. A cara do
 * NPC é como o mestre o reconhece, e é ela que ele procura enquanto a mesa
 * espera.
 */
function Miniatura({ anexo, kind, size = 44 }: { anexo?: NoteAttachment; kind: StageItemKind; size?: number }) {
  const { colors } = useTheme();

  const moldura = {
    width: size,
    height: size,
    borderRadius: radius.sm,
    borderWidth: stroke.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  };

  if (anexo?.kind === 'image') {
    return (
      <Image
        source={{ uri: anexo.url }}
        style={moldura}
        contentFit="cover"
        transition={150}
        accessibilityLabel=""
        aria-hidden
      />
    );
  }

  return (
    <View style={moldura} aria-hidden>
      <Icon
        name={anexo ? iconeDoAnexo(anexo.kind) : ICONE_DA_PECA[kind]}
        size={Math.round(size * 0.45)}
        color={colors.textSubtle}
      />
    </View>
  );
}

/** Rótulo curto para o chip do anexo: legendas inteiras tomavam a linha toda. */
function rotuloDoAnexo(anexo: NoteAttachment): string {
  const texto = anexo.caption?.trim() || anexo.name;

  return texto.length > 28 ? `${texto.slice(0, 27).trimEnd()}…` : texto;
}

/**
 * A peça, seus arquivos e o que dá para fazer com ela.
 *
 * Exibir a peça manda o conjunto — retrato, texto e dados. Exibir um arquivo
 * manda só ele, na tela toda: é a diferença entre apresentar o NPC e projetar
 * o mapa que ele desenhou.
 *
 * Tudo isso mora dentro de uma moldura só. Antes a linha tinha borda e as ações
 * flutuavam soltas abaixo dela: em trinta peças seguidas não se via onde uma
 * terminava e a outra começava, e "excluir" ficava perto demais da peça de
 * baixo.
 */
function PecaDoAcervo({
  campaignId,
  peca,
  stage,
  onExibir,
  onEditar,
  estaEnviando,
}: {
  campaignId: number;
  peca: StageItem;
  stage: StageState | null;
  onExibir: (source: StageSource) => void;
  onEditar: () => void;
  estaEnviando: (source: StageSource) => boolean;
}) {
  const { colors } = useTheme();
  const { remove, publish } = useStageItemMutations(campaignId);
  const { clear } = useStageControls(campaignId);

  // Excluir é o único gesto sem volta desta tela, e mora ao lado dos que se usam
  // toda hora: pede a segunda batida antes de apagar.
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  const anexos = peca.attachments ?? [];
  const retrato = anexos.find((anexo) => anexo.kind === 'image');

  const origem = stage?.source ?? null;
  const pecaNoAr = origem?.type === 'stage_item' && origem.id === peca.id;
  const arquivoNoAr = (id: number) => origem?.type === 'attachment' && origem.id === id;
  const algoDestaPecaNoAr = pecaNoAr || anexos.some((anexo) => arquivoNoAr(anexo.id));

  return (
    <View
      style={{
        borderWidth: stroke.hairline,
        borderColor: algoDestaPecaNoAr ? colors.success : colors.border,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        marginBottom: spacing.sm,
        overflow: 'hidden',
      }}
    >
      <Linha
        emCartao
        titulo={peca.title}
        detalhe={peca.subtitle}
        etiqueta={peca.kind_label}
        noAr={pecaNoAr}
        enviando={estaEnviando({ source: 'stage_item', id: peca.id })}
        miniatura={<Miniatura anexo={retrato ?? anexos[0]} kind={peca.kind} />}
        onPress={() => onExibir({ source: 'stage_item', id: peca.id })}
      />

      {anexos.length > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.xs,
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.sm,
          }}
        >
          {anexos.map((anexo) => (
            <Chip
              key={anexo.id}
              label={rotuloDoAnexo(anexo)}
              compact
              selected={arquivoNoAr(anexo.id)}
              tone={arquivoNoAr(anexo.id) ? 'success' : anexo.kind === 'image' ? 'arcane' : 'neutral'}
              onPress={() => onExibir({ source: 'attachment', id: anexo.id })}
            />
          ))}
        </View>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.xs,
          borderTopWidth: stroke.hairline,
          borderTopColor: colors.border,
        }}
      >
        {confirmandoExclusao ? (
          <>
            <Text variant="small" tone="muted">
              Excluir “{peca.title}” do acervo?
            </Text>
            <Acao
              label="sim, excluir"
              tom={colors.dangerInk}
              carregando={remove.isPending}
              onPress={() => remove.mutate(peca.id)}
            />
            <Acao label="cancelar" onPress={() => setConfirmandoExclusao(false)} />
          </>
        ) : (
          <>
            <Acao label="editar" icone="editar" onPress={onEditar} />

            {/* Só aparece quando há o que tirar: um botão que não faz nada é pior
                que a ausência dele. */}
            {algoDestaPecaNoAr ? (
              <Acao
                label="tirar da tela"
                icone="remover"
                onPress={() => clear.mutate()}
                carregando={clear.isPending}
              />
            ) : null}

            <Acao
              label={peca.published_note_id ? 'atualizar na campanha' : 'enviar para a campanha'}
              icone="anotacoes"
              onPress={() => publish.mutate(peca.id)}
              carregando={publish.isPending && publish.variables === peca.id}
              tom={colors.primaryInk}
            />

            <View style={{ flex: 1 }} />

            <Acao
              label="excluir"
              icone="excluir"
              onPress={() => setConfirmandoExclusao(true)}
              tom={colors.textSubtle}
            />
          </>
        )}
      </View>
    </View>
  );
}

function Acao({
  label,
  onPress,
  carregando,
  tom,
  icone,
}: {
  label: string;
  onPress: () => void;
  carregando?: boolean;
  tom?: string;
  icone?: IconName;
}) {
  const { colors } = useTheme();
  const cor = tom ?? colors.textMuted;

  return (
    <Pressable
      onPress={onPress}
      disabled={carregando}
      accessibilityRole="button"
      accessibilityLabel={label}
      // O padding é o alvo de toque: na web o `hitSlop` não alcança o DOM, e
      // estas são palavras de 11px numa tela usada com pouca luz.
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        marginHorizontal: -spacing.xxs,
        paddingHorizontal: spacing.xxs,
        opacity: carregando ? 0.5 : 1,
      }}
    >
      {icone ? <Icon name={icone} size={14} color={cor} /> : null}
      <Text variant="small" style={{ color: cor }}>
        {carregando ? 'enviando…' : label}
      </Text>
    </Pressable>
  );
}

function FonteTexto({
  onExibir,
  enviando,
}: {
  onExibir: (source: StageSource) => void;
  enviando: boolean;
}) {
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');

  return (
    <Card title="Texto na tela" subtitle="A leitura em voz alta, um aviso, uma pergunta">
      <View style={{ gap: spacing.md }}>
        <Input label="Título" value={titulo} onChangeText={setTitulo} placeholder="A porta se abre" />
        <Input
          label="Texto"
          value={texto}
          onChangeText={setTexto}
          multiline
          placeholder="O cheiro de enxofre chega antes da luz."
        />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            label="Exibir texto"
            disabled={texto.trim() === ''}
            loading={enviando}
            onPress={() => onExibir({ source: 'text', body: texto.trim(), title: titulo.trim() || undefined })}
            style={{ flex: 1 }}
          />
          {/* A leitura seguinte começa do zero, e apagar dois campos à mão no
              meio da cena é tempo que a mesa passa olhando o mestre digitar. */}
          <Button
            label="Limpar"
            variant="ghost"
            disabled={texto === '' && titulo === ''}
            onPress={() => {
              setTitulo('');
              setTexto('');
            }}
          />
        </View>
      </View>
    </Card>
  );
}

function FonteMagias({
  onExibir,
  estaEnviando,
}: {
  onExibir: (source: StageSource) => void;
  estaEnviando: (source: StageSource) => boolean;
}) {
  const [q, setQ] = useState('');
  const catalogo = useSpellCatalog({ q });

  return (
    <View style={{ gap: spacing.sm }}>
      <Input placeholder="Buscar magia…" value={q} onChangeText={setQ} autoCorrect={false} />

      {catalogo.isLoading ? (
        <Loading inline label="Buscando magias…" />
      ) : catalogo.spells.length === 0 ? (
        <EmptyState
          icon="buscar"
          title="Nenhuma magia encontrada"
          description={`Nada na biblioteca combina com “${q.trim()}”.`}
        />
      ) : (
        <>
          <Contagem visiveis={catalogo.spells.length} total={catalogo.total} rotulo="magias" />

          {catalogo.spells.map((magia) => (
            <Linha
              key={magia.id}
              titulo={magia.name}
              detalhe={magia.header}
              etiqueta={`${magia.mp_cost} PM`}
              enviando={estaEnviando({ source: 'catalog_spell', id: magia.id })}
              onPress={() => onExibir({ source: 'catalog_spell', id: magia.id })}
            />
          ))}

          {/* A lista cortava em quarenta sem dizer nada: quem procurasse a
              quadragésima primeira magia concluiria que ela não existe. */}
          {catalogo.hasNextPage ? (
            <Button
              label="Mostrar mais"
              variant="ghost"
              size="sm"
              loading={catalogo.isFetchingNextPage}
              onPress={() => void catalogo.fetchNextPage()}
            />
          ) : null}
        </>
      )}
    </View>
  );
}

function FontePoderes({
  onExibir,
  estaEnviando,
}: {
  onExibir: (source: StageSource) => void;
  estaEnviando: (source: StageSource) => boolean;
}) {
  const [q, setQ] = useState('');
  const catalogo = usePowerCatalog({ q });

  return (
    <View style={{ gap: spacing.sm }}>
      <Input placeholder="Buscar poder…" value={q} onChangeText={setQ} autoCorrect={false} />

      {catalogo.isLoading ? (
        <Loading inline label="Buscando poderes…" />
      ) : catalogo.powers.length === 0 ? (
        <EmptyState
          icon="buscar"
          title="Nenhum poder encontrado"
          description={`Nada na biblioteca combina com “${q.trim()}”.`}
        />
      ) : (
        <>
          <Contagem visiveis={catalogo.powers.length} total={catalogo.total} rotulo="poderes" />

          {catalogo.powers.map((poder) => (
            <Linha
              key={poder.id}
              titulo={poder.name}
              detalhe={poder.requirements}
              etiqueta={poder.subtype ?? poder.type_label}
              enviando={estaEnviando({ source: 'catalog_power', id: poder.id })}
              onPress={() => onExibir({ source: 'catalog_power', id: poder.id })}
            />
          ))}

          {catalogo.hasNextPage ? (
            <Button
              label="Mostrar mais"
              variant="ghost"
              size="sm"
              loading={catalogo.isFetchingNextPage}
              onPress={() => void catalogo.fetchNextPage()}
            />
          ) : null}
        </>
      )}
    </View>
  );
}

/**
 * Itens vêm do bootstrap de referência, que já está em cache — a lista inteira
 * cabe numa resposta e não precisa de rota paginada como magias e poderes.
 */
function FonteItens({
  onExibir,
  estaEnviando,
}: {
  onExibir: (source: StageSource) => void;
  estaEnviando: (source: StageSource) => boolean;
}) {
  const [q, setQ] = useState('');
  const [limite, setLimite] = useState(POR_VEZ);
  const referencia = useReference();

  const encontrados = useMemo(() => {
    const todos = referencia.data?.items ?? [];
    const termo = normalizar(q.trim());

    return termo ? todos.filter((item) => contemTermo(item.name, termo)) : todos;
  }, [referencia.data?.items, q]);

  const itens = encontrados.slice(0, limite);

  return (
    <View style={{ gap: spacing.sm }}>
      <Input
        placeholder="Buscar item…"
        value={q}
        onChangeText={(valor) => {
          setQ(valor);
          setLimite(POR_VEZ);
        }}
        autoCorrect={false}
      />

      {referencia.isLoading ? (
        <Loading inline label="Carregando itens…" />
      ) : encontrados.length === 0 ? (
        <EmptyState
          icon="buscar"
          title="Nenhum item encontrado"
          description={`Nada no catálogo combina com “${q.trim()}”.`}
        />
      ) : (
        <>
          <Contagem visiveis={itens.length} total={encontrados.length} rotulo="itens" />

          {itens.map((item) => (
            <Linha
              key={item.id}
              titulo={item.name}
              detalhe={item.damage ?? null}
              etiqueta={item.category}
              enviando={estaEnviando({ source: 'catalog_item', id: item.id })}
              onPress={() => onExibir({ source: 'catalog_item', id: item.id })}
            />
          ))}

          {itens.length < encontrados.length ? (
            <Button
              label="Mostrar mais"
              variant="ghost"
              size="sm"
              onPress={() => setLimite((atual) => atual + POR_VEZ)}
            />
          ) : null}
        </>
      )}
    </View>
  );
}

/**
 * O que está nas fichas da mesa.
 *
 * Serve para o mestre projetar o poder que o jogador acabou de usar, com o
 * texto exato da ficha dele — em vez de o jogador ler em voz alta enquanto os
 * outros tentam lembrar como a regra funciona.
 */
function FonteFichas({
  campaignId,
  onExibir,
  estaEnviando,
}: {
  campaignId: number;
  onExibir: (source: StageSource) => void;
  estaEnviando: (source: StageSource) => boolean;
}) {
  const personagens = useCampaignCharacters(campaignId);
  const [escolhido, setEscolhido] = useState<number | null>(null);

  const ficha = useCharacter(escolhido);
  const lista = personagens.data ?? [];

  if (personagens.isLoading) {
    return <Loading inline label="Carregando personagens…" />;
  }

  if (lista.length === 0) {
    return (
      <EmptyState
        icon="jogadores"
        title="Nenhum personagem na mesa"
        description="Quando os jogadores vincularem as fichas, os poderes e magias delas aparecem aqui."
      />
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {lista.map((personagem) => (
          <Chip
            key={personagem.id}
            label={personagem.name}
            compact
            selected={escolhido === personagem.id}
            tone={escolhido === personagem.id ? 'primary' : 'neutral'}
            onPress={() => setEscolhido(escolhido === personagem.id ? null : personagem.id)}
          />
        ))}
      </View>

      {escolhido === null ? (
        <Text variant="small" tone="muted">
          Escolha um personagem para ver os poderes, magias, itens e habilidades da ficha.
        </Text>
      ) : ficha.isLoading ? (
        <Loading inline label="Abrindo a ficha…" />
      ) : (
        <View style={{ gap: spacing.md }}>
          <GrupoDaFicha
            titulo="Poderes"
            linhas={(ficha.data?.powers ?? []).map((poder) => ({
              id: poder.id,
              titulo: poder.name,
              detalhe: poder.type_label,
            }))}
            estaEnviando={(id) => estaEnviando({ source: 'sheet', kind: 'power', character_id: escolhido, id })}
            onExibir={(id) => onExibir({ source: 'sheet', kind: 'power', character_id: escolhido, id })}
          />
          <GrupoDaFicha
            titulo="Magias"
            linhas={(ficha.data?.spells ?? []).map((magia) => ({
              id: magia.id,
              titulo: magia.name,
              detalhe: magia.header,
            }))}
            estaEnviando={(id) => estaEnviando({ source: 'sheet', kind: 'spell', character_id: escolhido, id })}
            onExibir={(id) => onExibir({ source: 'sheet', kind: 'spell', character_id: escolhido, id })}
          />
          <GrupoDaFicha
            titulo="Equipamento"
            linhas={(ficha.data?.items ?? []).map((item) => ({
              id: item.id,
              titulo: item.name,
              detalhe: item.category_label,
            }))}
            estaEnviando={(id) => estaEnviando({ source: 'sheet', kind: 'item', character_id: escolhido, id })}
            onExibir={(id) => onExibir({ source: 'sheet', kind: 'item', character_id: escolhido, id })}
          />
          <GrupoDaFicha
            titulo="Habilidades"
            linhas={(ficha.data?.class_abilities ?? []).map((habilidade) => ({
              id: habilidade.id,
              titulo: habilidade.name,
              detalhe: `${habilidade.level_acquired}º nível`,
            }))}
            estaEnviando={(id) =>
              estaEnviando({ source: 'sheet', kind: 'class_ability', character_id: escolhido, id })
            }
            onExibir={(id) => onExibir({ source: 'sheet', kind: 'class_ability', character_id: escolhido, id })}
          />
        </View>
      )}
    </View>
  );
}

function GrupoDaFicha({
  titulo,
  linhas,
  onExibir,
  estaEnviando,
}: {
  titulo: string;
  linhas: { id: number; titulo: string; detalhe?: string | null }[];
  onExibir: (id: number) => void;
  estaEnviando: (id: number) => boolean;
}) {
  if (linhas.length === 0) return null;

  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="caption" tone="secondary" uppercase>
        {titulo}
      </Text>
      {linhas.map((linha) => (
        <Linha
          key={linha.id}
          titulo={linha.titulo}
          detalhe={linha.detalhe}
          enviando={estaEnviando(linha.id)}
          onPress={() => onExibir(linha.id)}
        />
      ))}
    </View>
  );
}

/**
 * Abre o palco.
 *
 * Na web vai para uma aba nova, e é o ponto inteiro da feature: o mestre
 * arrasta aquela aba para a TV e continua controlando desta. Sem isso, a única
 * forma seria abrir o app duas vezes e navegar até aqui de novo em cada uma.
 */
export function abrirPalco(campaignId: number): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // Do endereço atual, trocando só o último segmento: assim o `baseUrl` do
    // app (que em produção é `/web`) entra sozinho, sem ser remontado aqui.
    const url = window.location.href.replace(/\/(painel|controle|acervo)\/?(\?.*)?$/, '/palco');

    window.open(url, '_blank');

    return;
  }

  router.push(`/(app)/campanhas/${campaignId}/palco`);
}
