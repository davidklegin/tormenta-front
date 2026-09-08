import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Chip, ErrorState, Icon, Loading, Screen, Text } from '@/components/ui';
import {
  BattleMapCanvas,
  BattleMapToolbar,
  MasterBoardSheet,
  MasterTokenSidebar,
  type ModoDoTabuleiro,
} from '@/components/battlemap';
import {
  acharEntradaDoToken,
  CombatSidebar,
  ConditionPicker,
  DamagePopover,
  NPCStatSheet,
} from '@/components/combat';
import { useCampaignCharacters } from '@/hooks/useCampaigns';
import { useBattleMap, useBattleMapControls, useMoveToken, useUndoToken } from '@/hooks/useBattleMap';
import { useCombat, useCombatControls } from '@/hooks/useCombat';
import { useReference } from '@/hooks/useReference';
import { useStageItems } from '@/hooks/useStage';
import { useCampaignChannel } from '@/realtime/useCampaignChannel';
import { spacing, useResponsive, useTheme } from '@/theme';
import { ApiError } from '@/api';
import type { AreaEffectShape, CombatCondition, CombatEntry } from '@/api/types';

/**
 * O tabuleiro da mesa.
 *
 * A tela é o mapa: cabeçalho fino em cima, barra de ferramentas embaixo, e
 * todo o resto é tabuleiro. Durante o combate é para cá que a mesa olha, e
 * cada faixa de interface a mais é um pedaço de masmorra a menos.
 *
 * O que cada pessoa enxerga já vem decidido do servidor — a peça escondida e a
 * criatura sob a névoa nem chegam ao aparelho de quem não deve vê-las. Aqui só
 * se desenha o que chegou.
 */
export default function TabuleiroScreen() {
  const { colors } = useTheme();
  const { isPhone } = useResponsive();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{ id: string }>();
  const campaignId = Number(params.id);

  // As fichas da mesa vêm da rota que existe para isso, e não do GET da
  // campanha: aquele payload nunca carrega a relação `characters` (o resource
  // usa `whenLoaded`, e o controller só faz `loadCount`), então o campo chegava
  // sempre vazio. O mestre não notava, porque para ele `podeMover` responde sim
  // antes de olhar a lista; o jogador ficava sem conseguir arrastar a peça do
  // próprio personagem, que é o único gesto que ele tem neste tabuleiro.
  const fichasDaMesa = useCampaignCharacters(campaignId);
  const tabuleiro = useBattleMap(campaignId);
  const combate = useCombat(campaignId);
  const combatControls = useCombatControls(campaignId);

  const mover = useMoveToken(campaignId);
  const desfazer = useUndoToken(campaignId);
  const controles = useBattleMapControls(campaignId);

  useCampaignChannel(campaignId, true);

  const [modo, setModo] = useState<ModoDoTabuleiro>('navegar');
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [painelAberto, setPainelAberto] = useState(false);
  const [pedidoDeCentralizar, setPedidoDeCentralizar] = useState(0);

  // A lista de peças nasce aberta no desktop e recolhida no celular, onde ela
  // cobriria justamente o pedaço de masmorra que o mestre está olhando. Fica
  // como uma aba estreita, com a contagem, a um toque de voltar.
  const [pecasAbertas, setPecasAbertas] = useState(!isPhone);

  // Quem está com a ficha aberta e quem está recebendo condição. Guardados por
  // id, e não como objeto: a entrada é substituída a cada resposta do servidor,
  // e um objeto congelado mostraria o PV de antes do último golpe.
  const [fichaDe, setFichaDe] = useState<string | null>(null);
  const [condicoesDe, setCondicoesDe] = useState<string | null>(null);

  // Esfera de 6 m é a Bola de Fogo — a área que mais vai à mesa, e por isso o
  // ponto de partida. A barra troca forma e alcance sem abrir painel nenhum.
  const [area, setArea] = useState<{ forma: AreaEffectShape; raio: number }>({
    forma: 'circle',
    raio: 4,
  });

  const mapa = tabuleiro.data;

  // Quem manda no tabuleiro é o servidor que diz, e não o papel na campanha:
  // nesta plataforma o palco pertence ao MASTER, não a todo mestre de mesa, e
  // `is_master` da campanha responde outra pergunta. Usar o papel aqui
  // ofereceria controles que a API devolveria 403.
  const ehMestre = mapa?.is_master_view ?? false;

  const minhasFichas = useMemo(
    () => fichasDaMesa.data?.filter((f) => f.is_owner).map((f) => f.id) ?? [],
    [fichasDaMesa.data]
  );

  // O catálogo de condições é a fonte dos nomes dos marcadores. Vem para todos:
  // o jogador também vê que o goblin está caído.
  const referencia = useReference();
  const condicoesDoLivro = referencia.data?.conditions ?? [];

  // O acervo é a ficha por trás dos NPCs, e a rota devolve 403 para jogador —
  // então só o mestre pede. É ele quem abre a ficha da criatura, de qualquer
  // forma.
  const acervo = useStageItems(campaignId, { kind: 'npc' }, ehMestre);

  const ordem = combate.data ?? null;

  const acharEntrada = useCallback(
    (entryId: string | null) => ordem?.entries.find((e) => e.id === entryId) ?? null,
    [ordem?.entries]
  );

  const entradaDaFicha = acharEntrada(fichaDe);
  const entradaDasCondicoes = acharEntrada(condicoesDe);

  const pecaDaFicha = useMemo(() => {
    if (entradaDaFicha?.stage_item_id == null) return null;

    return acervo.data?.find((item) => item.id === entradaDaFicha.stage_item_id) ?? null;
  }, [acervo.data, entradaDaFicha?.stage_item_id]);

  const tokenSelecionado = useMemo(
    () => mapa?.tokens.find((t) => t.id === selecionado) ?? null,
    [mapa?.tokens, selecionado]
  );

  /** A linha da iniciativa da peça que está selecionada no mapa, se houver. */
  const entradaDoToken = useMemo(() => {
    if (!tokenSelecionado || !ordem?.active) return null;

    return acharEntradaDoToken(tokenSelecionado, ordem.entries);
  }, [tokenSelecionado, ordem]);

  const podeMoverSelecionado = useMemo(() => {
    if (!tokenSelecionado) return false;
    if (ehMestre) return true;
    if (tokenSelecionado.entity_type !== 'player_character') return false;

    return tokenSelecionado.entity_id !== null && minhasFichas.includes(tokenSelecionado.entity_id);
  }, [tokenSelecionado, ehMestre, minhasFichas]);

  const aoMover = useCallback(
    (tokenId: number, x: number, y: number) => mover.mutate({ tokenId, x, y }),
    [mover]
  );

  const aoAplicarDano = useCallback(
    (entryId: string, amount: number) => combatControls.aplicarDano.mutate({ entry_id: entryId, amount }),
    [combatControls.aplicarDano]
  );

  const aoAtualizarStats = useCallback(
    (entryId: string, stats: { current_hp?: number; max_hp?: number }) =>
      combatControls.atualizarStats.mutate({ entry_id: entryId, ...stats }),
    [combatControls.atualizarStats]
  );

  /**
   * Passa a vez e, se quem entrou for criatura, já abre a ficha dela.
   *
   * É o pulo de tela que a mesa mais fazia: virava o turno do goblin e o mestre
   * ia procurar no acervo o que o goblin sabe fazer. Abrir sozinho aqui é o
   * ganho principal desta tela.
   */
  const aoProximoTurno = useCallback(() => {
    combatControls.proximo.mutate(undefined, {
      onSuccess: (estado) => setFichaDe(estado.current?.is_npc ? estado.current.id : null),
    });
  }, [combatControls.proximo]);

  const aoAplicarCondicao = useCallback(
    (entryId: string, key: string, duracao: number | null) =>
      combatControls.adicionarCondicao.mutate({
        entry_id: entryId,
        condition_key: key,
        ...(duracao === null ? {} : { duration: duracao }),
      }),
    [combatControls.adicionarCondicao]
  );

  const aoRemoverCondicao = useCallback(
    (entry: CombatEntry, condicao: CombatCondition) =>
      combatControls.removerCondicao.mutate({ entry_id: entry.id, condition_id: condicao.id }),
    [combatControls.removerCondicao]
  );

  /**
   * Marca uma área no chão.
   *
   * Vem de dois gestos: o toque põe a área com a forma e o alcance escolhidos
   * na barra; o arrasto, do conjurador até o alvo, dita também a direção e a
   * distância — é o único caminho que serve para cone e linha, que sem
   * direção apontariam sempre para o mesmo lado.
   */
  const aoMarcarArea = useCallback(
    (celula: { x: number; y: number }, direcao: number | null, alcance: number | null) => {
      const raio = alcance ?? area.raio;

      // Cone, linha e cubo se estendem a partir da origem, e por isso levam
      // `length`; a esfera se mede do centro para fora, e leva `radius`.
      const medida = area.forma === 'circle' ? { radius: raio } : { length: raio, width: 1 };

      controles.adicionarArea.mutate({
        shape: area.forma,
        x: celula.x,
        y: celula.y,
        ...medida,
        ...(direcao === null ? {} : { direction: direcao }),
        color: colors.danger,
        opacity: 0.3,
      });
    },
    [controles.adicionarArea, colors.danger, area]
  );

  /**
   * Atalhos de teclado do mestre, no navegador.
   *
   * O combate anda de "próximo turno" dezenas de vezes por sessão, e o mestre
   * está com uma das mãos nos dados. As ações vão por `ref` porque as mutations
   * do React Query trocam de identidade a cada render — nas dependências, o
   * listener seria removido e recriado sem parar.
   */
  const atalhos = useRef({ proximo: aoProximoTurno, anterior: () => {}, desfazer: () => {} });

  atalhos.current = {
    proximo: aoProximoTurno,
    anterior: () => combatControls.anterior.mutate(),
    desfazer: () => combatControls.desfazerDano.mutate(),
  };

  const combateAtivo = combate.data?.active ?? false;

  useEffect(() => {
    if (Platform.OS !== 'web' || !ehMestre || !combateAtivo) return;

    const aoTeclar = (evento: KeyboardEvent) => {
      // Digitar "n" num campo de dano não pode virar passagem de turno.
      const alvo = evento.target as HTMLElement | null;

      if (alvo?.tagName === 'INPUT' || alvo?.tagName === 'TEXTAREA' || alvo?.isContentEditable) {
        return;
      }

      if ((evento.key === 'z' || evento.key === 'Z') && (evento.ctrlKey || evento.metaKey)) {
        evento.preventDefault();
        atalhos.current.desfazer();

        return;
      }

      if (evento.ctrlKey || evento.metaKey || evento.altKey) return;

      if (evento.key === 'n' || evento.key === 'N' || evento.key === 'ArrowRight') {
        evento.preventDefault();
        atalhos.current.proximo();

        return;
      }

      if (evento.key === 'ArrowLeft') {
        evento.preventDefault();
        atalhos.current.anterior();
      }
    };

    window.addEventListener('keydown', aoTeclar);

    return () => window.removeEventListener('keydown', aoTeclar);
  }, [ehMestre, combateAtivo]);

  if (tabuleiro.isLoading) {
    return (
      <Screen constrained={false}>
        <Loading label="Abrindo o tabuleiro…" />
      </Screen>
    );
  }

  // O tabuleiro é de quem senta à mesa (CampaignPolicy::viewStage), então quem
  // ainda não entrou na campanha leva 403 aqui. Isso não é uma falha, e
  // "Tentar novamente" era a resposta errada: repetir a chamada dá 403 de novo,
  // e a pessoa fica achando que o aplicativo quebrou quando o que falta é
  // entrar na mesa — que é um botão em outra tela.
  if (tabuleiro.error instanceof ApiError && tabuleiro.error.isForbidden) {
    return (
      <Screen constrained={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm }}>
          <Icon name="jogadores" size={48} color={colors.textSubtle} />
          <Text variant="heading" tone="secondary" center>
            O tabuleiro é de quem está na mesa
          </Text>
          <Text variant="small" tone="muted" center>
            Entre na campanha para acompanhar o mapa durante a sessão.
          </Text>
          <Pressable
            onPress={() => router.replace(`/(app)/campanhas/${campaignId}`)}
            accessibilityRole="button"
            style={{
              marginTop: spacing.sm,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              borderRadius: 8,
              backgroundColor: colors.primary,
            }}
          >
            <Text variant="small" style={{ color: colors.onPrimary }}>
              Ir para a campanha
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (tabuleiro.isError) {
    return (
      <Screen constrained={false}>
        <ErrorState
          error={tabuleiro.error}
          onRetry={() => void tabuleiro.refetch()}
          title="O tabuleiro não abriu"
        />
      </Screen>
    );
  }


  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingTop: insets.top + spacing.xs,
          paddingBottom: spacing.xs,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Icon name="voltar" size={20} color={colors.textMuted} />
        </Pressable>

        <Text variant="small" numberOfLines={1} style={{ flex: 1 }}>
          {mapa?.name ?? 'Tabuleiro'}
        </Text>

        {mapa?.state === 'active' && <Chip label="Em combate" tone="danger" compact />}
        {mapa?.state === 'preparing' && <Chip label="Preparando" tone="warning" compact />}
        {mapa?.state === 'paused' && <Chip label="Pausado" tone="neutral" compact />}
      </View>

      {/*
        A mesa de controle divide a linha com o mapa, em vez de flutuar por
        cima dele.

        Flutuando, ela tapava a masmorra justamente onde o mestre põe as peças —
        o canto de cima à esquerda é onde `addPartyTokens` enfileira o grupo — e
        obrigava a escolher entre ver a lista e ver o mapa. Como coluna, o
        tabuleiro simplesmente ocupa o que sobra, e as duas coisas ficam de pé
        ao mesmo tempo. É só do mestre: o jogador não tem o que controlar aqui,
        e para ele a tela inteira continua sendo o mapa.
      */}
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {ehMestre && mapa?.id && (
          <MasterTokenSidebar
            tokens={mapa.tokens ?? []}
            areas={mapa.area_effects ?? []}
            entries={ordem?.entries ?? []}
            conditions={condicoesDoLivro}
            selecionado={selecionado}
            aberta={pecasAbertas}
            compacto={isPhone}
            onAlternar={() => setPecasAbertas((atual) => !atual)}
            onSelecionar={setSelecionado}
            onEsconder={(token) =>
              controles.ajustarToken.mutate({
                tokenId: token.id,
                dados: { is_visible: !token.visible },
              })
            }
            onTamanho={(token, tamanho) =>
              controles.ajustarToken.mutate({
                tokenId: token.id,
                dados: { size: tamanho },
              })
            }
            onRemover={(token) => {
              controles.removerToken.mutate(token.id);
              setSelecionado(null);
            }}
            onRemoverArea={(efeitoId) => controles.removerArea.mutate(efeitoId)}
            onAbrirCondicoes={(entry) => setCondicoesDe(entry.id)}
            onAbrirFicha={(entry) => setFichaDe(entry.id)}
            onAplicarDano={aoAplicarDano}
          />
        )}

        <View style={{ flex: 1 }}>
          {mapa?.id ? (
            <BattleMapCanvas
              battleMap={mapa}
              minhasFichas={minhasFichas}
              ehMestre={ehMestre}
              modo={modo}
              tokenSelecionado={selecionado}
              onSelecionarToken={setSelecionado}
              onMoverToken={aoMover}
              onPintarNevoa={(regiao) =>
                controles.salvarNevoa.mutate([...(mapa.fog_regions ?? []), regiao])
              }
              onMarcarArea={aoMarcarArea}
              onRemoverArea={(efeitoId) => controles.removerArea.mutate(efeitoId)}
              pedidoDeCentralizar={pedidoDeCentralizar}
            />
          ) : (
            <Cortina ehMestre={ehMestre} onAbrirPainel={() => setPainelAberto(true)} />
          )}

          {/*
            A ficha da criatura flutua sobre o mapa, e não na coluna: ela abre
            sozinha quando a vez vira para um NPC, e empurrando a lista de peças
            para baixo tiraria da tela justamente o que o mestre estava lendo.
          */}
          {ehMestre && entradaDaFicha && (
            <View style={{ position: 'absolute', top: spacing.sm, left: spacing.md, zIndex: 90 }}>
              <NPCStatSheet
                entry={entradaDaFicha}
                item={pecaDaFicha}
                conditions={condicoesDoLivro}
                onClose={() => setFichaDe(null)}
                onUpdateStats={aoAtualizarStats}
              />
            </View>
          )}

          {ordem?.active && (
            <View style={{ position: 'absolute', top: spacing.sm, right: spacing.md, zIndex: 90 }}>
              <CombatSidebar
                combat={ordem}
                isMaster={ehMestre}
                conditions={condicoesDoLivro}
                compacto={isPhone}
                minhasFichas={minhasFichas}
                onNextTurn={aoProximoTurno}
                onPreviousTurn={() => combatControls.anterior.mutate()}
                onApplyDamage={aoAplicarDano}
                onUndoDamage={() => combatControls.desfazerDano.mutate()}
                onReorder={(ids) => combatControls.reordenar.mutate(ids)}
                onOpenConditions={(entry) => setCondicoesDe(entry.id)}
                onRemoveCondition={aoRemoverCondicao}
                onOpenSheet={(entry) => setFichaDe(entry.id)}
              />
            </View>
          )}
        </View>
      </View>

      <ConditionPicker
        visible={entradaDasCondicoes !== null}
        entry={entradaDasCondicoes}
        conditions={condicoesDoLivro}
        onClose={() => setCondicoesDe(null)}
        onApply={(key, duracao) =>
          entradaDasCondicoes && aoAplicarCondicao(entradaDasCondicoes.id, key, duracao)
        }
      />

      {/*
        Bater na peça, e não na lista.
        Com oito criaturas em cena, achar o goblin certo é mais rápido pelo
        mapa — ele está onde o jogador apontou — do que relendo nomes iguais na
        fila. Só aparece quando a peça selecionada tem uma linha na iniciativa;
        um cenário ou um marcador solto não têm PV para perder.
      */}
      {ehMestre && entradaDoToken && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.surfaceAlt,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              paddingHorizontal: spacing.md,
              paddingTop: spacing.xs,
            }}
          >
            <Text variant="caption" tone="gold" numberOfLines={1} style={{ flex: 1 }}>
              {entradaDoToken.name}
            </Text>

            <Text variant="caption" tone="muted">
              {entradaDoToken.current_hp}/{entradaDoToken.max_hp} PV
            </Text>

            <Pressable
              onPress={() => setCondicoesDe(entradaDoToken.id)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Aplicar condição em ${entradaDoToken.name}`}
            >
              <Icon name="condicao" size={16} color={colors.textMuted} />
            </Pressable>
          </View>

          <DamagePopover
            alvo={entradaDoToken.name}
            onSubmit={(valor) => aoAplicarDano(entradaDoToken.id, valor)}
            onClose={() => setSelecionado(null)}
          />
        </View>
      )}

      {mapa?.id && (
        <BattleMapToolbar
          modo={modo}
          onModo={(proximo) => {
            setModo(proximo);
            setSelecionado(null);
          }}
          ehMestre={ehMestre}
          tokenSelecionado={tokenSelecionado}
          podeMoverSelecionado={podeMoverSelecionado}
          onDesfazer={() => tokenSelecionado && desfazer.mutate(tokenSelecionado.id)}
          onRemover={() => {
            if (!tokenSelecionado) return;
            controles.removerToken.mutate(tokenSelecionado.id);
            setSelecionado(null);
          }}
          onEsconder={() =>
            tokenSelecionado &&
            controles.ajustarToken.mutate({
              tokenId: tokenSelecionado.id,
              dados: { is_visible: !tokenSelecionado.visible },
            })
          }
          onTamanho={(tamanho) =>
            tokenSelecionado &&
            controles.ajustarToken.mutate({
              tokenId: tokenSelecionado.id,
              dados: { size: tamanho },
            })
          }
          onFecharSelecao={() => setSelecionado(null)}
          onRecentralizar={() => setPedidoDeCentralizar((n) => n + 1)}
          area={area}
          onArea={setArea}
          onAbrirPainel={() => setPainelAberto(true)}
        />
      )}

      {ehMestre && mapa && (
        <MasterBoardSheet
          visible={painelAberto}
          onClose={() => setPainelAberto(false)}
          campaignId={campaignId}
          battleMap={mapa}
          controles={controles}
        />
      )}
    </View>
  );
}

/**
 * Nenhum tabuleiro aberto.
 *
 * Para o jogador é informação; para o mestre é o caminho de abrir um. Uma tela
 * vazia sem saída deixaria a mesa achando que a função não funciona.
 */
function Cortina({ ehMestre, onAbrirPainel }: { ehMestre: boolean; onAbrirPainel: () => void }) {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm }}>
      <Icon name="mestre" size={48} color={colors.textSubtle} />
      <Text variant="heading" tone="secondary" center>
        Nenhum tabuleiro aberto
      </Text>

      {ehMestre ? (
        <>
          <Text variant="small" tone="muted" center>
            Monte o mapa e traga o grupo para começar.
          </Text>
          <Pressable
            onPress={onAbrirPainel}
            accessibilityRole="button"
            style={{
              marginTop: spacing.sm,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              borderRadius: 8,
              backgroundColor: colors.primary,
            }}
          >
            <Text variant="small" style={{ color: colors.onPrimary }}>
              Abrir o painel do tabuleiro
            </Text>
          </Pressable>
        </>
      ) : (
        <Text variant="small" tone="muted" center>
          O mestre ainda não pôs um mapa na mesa.
        </Text>
      )}
    </View>
  );
}
