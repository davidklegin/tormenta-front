import { useMemo, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { StageItem, StageSource } from '@/api/types';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  Input,
  Loading,
  Screen,
  SegmentedControl,
  Text,
} from '@/components/ui';
import { PageHeader } from '@/components/layout';
import { RealtimeIndicator } from '@/components/campaign/RealtimeIndicator';
import { StagePosterView } from '@/components/stage';
import { useCampaign, useCampaignCharacters } from '@/hooks/useCampaigns';
import { useCharacter } from '@/hooks/useCharacters';
import { usePowerCatalog } from '@/hooks/usePowerCatalog';
import { useReference } from '@/hooks/useReference';
import { useSpellCatalog } from '@/hooks/useSpellCatalog';
import { useStage, useStageControls, useStageItems } from '@/hooks/useStage';
import { useCampaignChannel } from '@/realtime/useCampaignChannel';
import { useAuthStore } from '@/store/auth';
import { radius, spacing, stroke, useResponsive, useTheme } from '@/theme';

type Fonte = 'acervo' | 'texto' | 'magias' | 'poderes' | 'itens' | 'fichas';

const FONTES: { value: Fonte; label: string }[] = [
  { value: 'acervo', label: 'Acervo' },
  { value: 'texto', label: 'Texto' },
  { value: 'magias', label: 'Magias' },
  { value: 'poderes', label: 'Poderes' },
  { value: 'itens', label: 'Itens' },
  { value: 'fichas', label: 'Fichas' },
];

/**
 * Mesa de Controle: a tela que só o mestre olha.
 *
 * O par dela é o palco (`/palco`), aberto na TV virada para os jogadores.
 * Aqui ficam as duas coisas que o mestre precisa durante a cena: o que está no
 * ar agora, desenhado igualzinho ao que a mesa está vendo, e o material todo à
 * mão para trocar em um toque.
 *
 * A prévia usa o mesmo componente da projeção de propósito. Uma prévia
 * "aproximada" é pior que nenhuma: o mestre só descobriria a diferença pela
 * cara dos jogadores.
 */
export default function StageControlScreen() {
  const { colors } = useTheme();
  const { isDesktop } = useResponsive();

  const params = useLocalSearchParams<{ id: string }>();
  const campaignId = Number(params.id);

  const isPlatformMaster = useAuthStore((estado) => estado.user?.is_master ?? false);

  const campaign = useCampaign(campaignId);
  const stage = useStage(campaignId, isPlatformMaster);
  const { show, clear } = useStageControls(campaignId);

  const [fonte, setFonte] = useState<Fonte>('acervo');

  // O mestre também assina o canal: se ele exibir algo do celular, esta tela
  // acompanha sem recarregar.
  useCampaignChannel(campaignId, isPlatformMaster);

  if (!isPlatformMaster) {
    return (
      <Screen>
        <PageHeader title="Mesa de Controle" back />
        <EmptyState
          icon="mestre"
          title="Área restrita"
          description="A mesa de controle é do mestre da plataforma. O palco da sessão, esse você acompanha pela tela da campanha."
        />
      </Screen>
    );
  }

  const exibir = (source: StageSource) => show.mutate(source);
  const noAr = stage.data?.poster ?? null;

  return (
    <Screen constrained={false}>
      <PageHeader
        title="Mesa de Controle"
        subtitle={campaign.data?.name}
        back
        backLabel="Campanha"
        actions={
          <>
            <RealtimeIndicator />
            <Button
              label="Acervo"
              variant="secondary"
              size="sm"
              onPress={() => router.push(`/(app)/campanhas/${campaignId}/acervo`)}
            />
            <Button
              label="Abrir palco"
              variant="gold"
              size="sm"
              icon={<Icon name="mestre" size={16} color={colors.accentInk} />}
              onPress={() => abrirPalco(campaignId)}
            />
          </>
        }
      />

      <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: spacing.lg, alignItems: 'flex-start' }}>
        {/* No ar agora — fixo à esquerda no desktop, que é onde a tela de
            controle costuma ficar durante a sessão. */}
        <View style={{ width: isDesktop ? 380 : '100%' }}>
          <Card
            title="No ar agora"
            subtitle={
              stage.data?.shown_by
                ? `Exibido por ${stage.data.shown_by.nickname || stage.data.shown_by.name}`
                : 'A tela dos jogadores'
            }
          >
            <View style={{ gap: spacing.md }}>
              {stage.isLoading ? (
                <Loading inline label="Lendo o palco…" />
              ) : noAr ? (
                <StagePosterView poster={noAr} modo="previa" />
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
                    Cortina fechada
                  </Text>
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  label="Limpar tela"
                  variant="secondary"
                  size="sm"
                  disabled={!noAr}
                  loading={clear.isPending}
                  onPress={() => clear.mutate()}
                  style={{ flex: 1 }}
                />
                <Button
                  label="Ver o palco"
                  variant="ghost"
                  size="sm"
                  onPress={() => abrirPalco(campaignId)}
                  style={{ flex: 1 }}
                />
              </View>
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

          {fonte === 'acervo' ? <FonteAcervo campaignId={campaignId} onExibir={exibir} /> : null}
          {fonte === 'texto' ? <FonteTexto onExibir={exibir} enviando={show.isPending} /> : null}
          {fonte === 'magias' ? <FonteMagias onExibir={exibir} /> : null}
          {fonte === 'poderes' ? <FontePoderes onExibir={exibir} /> : null}
          {fonte === 'itens' ? <FonteItens onExibir={exibir} /> : null}
          {fonte === 'fichas' ? <FonteFichas campaignId={campaignId} onExibir={exibir} /> : null}
        </View>
      </View>
    </Screen>
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
  onPress,
}: {
  titulo: string;
  detalhe?: string | null;
  etiqueta?: string | null;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: pressed ? colors.surfaceHover : colors.surface,
        borderRadius: radius.md,
        borderWidth: stroke.hairline,
        borderColor: colors.border,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
      })}
      accessibilityRole="button"
      accessibilityLabel={`Exibir ${titulo}`}
    >
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

      {etiqueta ? <Chip label={etiqueta} compact /> : null}

      <Text variant="caption" tone="primary" uppercase>
        exibir
      </Text>
    </Pressable>
  );
}

function FonteAcervo({
  campaignId,
  onExibir,
}: {
  campaignId: number;
  onExibir: (source: StageSource) => void;
}) {
  const [q, setQ] = useState('');
  const itens = useStageItems(campaignId, { q: q || undefined });

  const lista = itens.data ?? [];

  return (
    <View style={{ gap: spacing.sm }}>
      <Input placeholder="Buscar no acervo…" value={q} onChangeText={setQ} autoCorrect={false} />

      {itens.isLoading ? (
        <Loading inline label="Abrindo o acervo…" />
      ) : lista.length === 0 ? (
        <EmptyState
          icon="mestre"
          title="Nada no acervo"
          description="Cadastre NPCs, mapas e textos para exibir durante a sessão."
          actionLabel="Abrir o acervo"
          onAction={() => router.push(`/(app)/campanhas/${campaignId}/acervo`)}
        />
      ) : (
        lista.map((peca) => <PecaDoAcervo key={peca.id} peca={peca} onExibir={onExibir} />)
      )}
    </View>
  );
}

/**
 * A peça e, abaixo dela, seus arquivos.
 *
 * Exibir a peça manda o conjunto — retrato, texto e dados. Exibir um arquivo
 * manda só ele, na tela toda: é a diferença entre apresentar o NPC e projetar
 * o mapa que ele desenhou.
 */
function PecaDoAcervo({ peca, onExibir }: { peca: StageItem; onExibir: (source: StageSource) => void }) {
  const anexos = peca.attachments ?? [];

  return (
    <View style={{ gap: spacing.xs }}>
      <Linha
        titulo={peca.title}
        detalhe={peca.subtitle}
        etiqueta={peca.kind_label}
        onPress={() => onExibir({ source: 'stage_item', id: peca.id })}
      />

      {anexos.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingLeft: spacing.md }}>
          {anexos.map((anexo) => (
            <Chip
              key={anexo.id}
              label={anexo.caption || anexo.name}
              compact
              tone={anexo.kind === 'image' ? 'arcane' : 'neutral'}
              onPress={() => onExibir({ source: 'attachment', id: anexo.id })}
            />
          ))}
        </View>
      ) : null}
    </View>
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
        <Button
          label="Exibir texto"
          disabled={texto.trim() === ''}
          loading={enviando}
          onPress={() => onExibir({ source: 'text', body: texto.trim(), title: titulo.trim() || undefined })}
        />
      </View>
    </Card>
  );
}

function FonteMagias({ onExibir }: { onExibir: (source: StageSource) => void }) {
  const [q, setQ] = useState('');
  const catalogo = useSpellCatalog({ q });

  return (
    <View style={{ gap: spacing.sm }}>
      <Input placeholder="Buscar magia…" value={q} onChangeText={setQ} autoCorrect={false} />

      {catalogo.isLoading ? (
        <Loading inline label="Buscando magias…" />
      ) : (
        catalogo.spells
          .slice(0, 40)
          .map((magia) => (
            <Linha
              key={magia.id}
              titulo={magia.name}
              detalhe={magia.header}
              etiqueta={`${magia.mp_cost} PM`}
              onPress={() => onExibir({ source: 'catalog_spell', id: magia.id })}
            />
          ))
      )}
    </View>
  );
}

function FontePoderes({ onExibir }: { onExibir: (source: StageSource) => void }) {
  const [q, setQ] = useState('');
  const catalogo = usePowerCatalog({ q });

  return (
    <View style={{ gap: spacing.sm }}>
      <Input placeholder="Buscar poder…" value={q} onChangeText={setQ} autoCorrect={false} />

      {catalogo.isLoading ? (
        <Loading inline label="Buscando poderes…" />
      ) : (
        catalogo.powers
          .slice(0, 40)
          .map((poder) => (
            <Linha
              key={poder.id}
              titulo={poder.name}
              detalhe={poder.requirements}
              etiqueta={poder.subtype ?? poder.type_label}
              onPress={() => onExibir({ source: 'catalog_power', id: poder.id })}
            />
          ))
      )}
    </View>
  );
}

/**
 * Itens vêm do bootstrap de referência, que já está em cache — a lista inteira
 * cabe numa resposta e não precisa de rota paginada como magias e poderes.
 */
function FonteItens({ onExibir }: { onExibir: (source: StageSource) => void }) {
  const [q, setQ] = useState('');
  const referencia = useReference();

  const itens = useMemo(() => {
    const todos = referencia.data?.items ?? [];
    const termo = q.trim().toLowerCase();

    return (termo ? todos.filter((item) => item.name.toLowerCase().includes(termo)) : todos).slice(0, 40);
  }, [referencia.data?.items, q]);

  return (
    <View style={{ gap: spacing.sm }}>
      <Input placeholder="Buscar item…" value={q} onChangeText={setQ} autoCorrect={false} />

      {referencia.isLoading ? (
        <Loading inline label="Carregando itens…" />
      ) : (
        itens.map((item) => (
          <Linha
            key={item.id}
            titulo={item.name}
            detalhe={item.damage ?? null}
            etiqueta={item.category}
            onPress={() => onExibir({ source: 'catalog_item', id: item.id })}
          />
        ))
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
}: {
  campaignId: number;
  onExibir: (source: StageSource) => void;
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
            onExibir={(id) =>
              onExibir({ source: 'sheet', kind: 'power', character_id: escolhido, id })
            }
          />
          <GrupoDaFicha
            titulo="Magias"
            linhas={(ficha.data?.spells ?? []).map((magia) => ({
              id: magia.id,
              titulo: magia.name,
              detalhe: magia.header,
            }))}
            onExibir={(id) =>
              onExibir({ source: 'sheet', kind: 'spell', character_id: escolhido, id })
            }
          />
          <GrupoDaFicha
            titulo="Equipamento"
            linhas={(ficha.data?.items ?? []).map((item) => ({
              id: item.id,
              titulo: item.name,
              detalhe: item.category_label,
            }))}
            onExibir={(id) => onExibir({ source: 'sheet', kind: 'item', character_id: escolhido, id })}
          />
          <GrupoDaFicha
            titulo="Habilidades"
            linhas={(ficha.data?.class_abilities ?? []).map((habilidade) => ({
              id: habilidade.id,
              titulo: habilidade.name,
              detalhe: `${habilidade.level_acquired}º nível`,
            }))}
            onExibir={(id) =>
              onExibir({ source: 'sheet', kind: 'class_ability', character_id: escolhido, id })
            }
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
}: {
  titulo: string;
  linhas: { id: number; titulo: string; detalhe?: string | null }[];
  onExibir: (id: number) => void;
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
function abrirPalco(campaignId: number): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // Do endereço atual, trocando só o último segmento: assim o `baseUrl` do
    // app (que em produção é `/web`) entra sozinho, sem ser remontado aqui.
    const url = window.location.href.replace(/\/controle\/?(\?.*)?$/, '/palco');

    window.open(url, '_blank');

    return;
  }

  router.push(`/(app)/campanhas/${campaignId}/palco`);
}
