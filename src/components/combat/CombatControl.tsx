import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import type { CombatEntryInput } from '@/api';
import type { CombatEntry, CombatState, StageItem } from '@/api/types';
import { Button, Card, Chip, EmptyState, Icon, Input, Loading, Sheet, Text } from '@/components/ui';
import { CombatBuffPanel } from '@/components/combat/CombatBuffPanel';
import { useCampaignCharacters } from '@/hooks/useCampaigns';
import { useCombat, useCombatControls } from '@/hooks/useCombat';
import { useStageItems } from '@/hooks/useStage';
import { useAuthStore } from '@/store/auth';
import { radius, spacing, stroke, useResponsive, useTheme } from '@/theme';

/** Uma linha do rascunho da ordem, antes de virar combate. */
type Rascunho = {
  key: string;
  name: string;
  initiative: string;
  characterId: number | null;
  /** A peça do acervo, quando a criatura foi puxada de lá. */
  stageItemId: number | null;
  hp: string;
};

let sequencia = 0;

const proximaChave = () => `linha-${++sequencia}`;

const linhaVazia = (): Rascunho => ({
  key: proximaChave(),
  name: '',
  initiative: '',
  characterId: null,
  stageItemId: null,
  hp: '',
});

/**
 * Lê o PV que o mestre escreveu na ficha da criatura no acervo.
 *
 * O acervo guarda linhas de texto livre ("PV", "25"), então a leitura aceita
 * os rótulos que a mesa usa e o primeiro número do valor — "25 (3d8+6)" vale
 * 25. Sem achar nada, devolve string vazia e o campo fica para o mestre.
 */
function pvDaPeca(item: StageItem): string {
  for (const fato of item.facts ?? []) {
    const rotulo = fato.label.trim().toLowerCase();

    if (!['pv', 'hp', 'vida', 'pontos de vida'].includes(rotulo)) continue;

    const numero = fato.value.match(/\d+/);

    if (numero) return numero[0];
  }

  return '';
}

/**
 * O combate visto do lado do mestre: montar a ordem e andar com ela.
 *
 * Mora dentro do Painel da mesa, e não numa aba ao lado, porque a ordem e os
 * PV são as duas metades da mesma pergunta — "de quem é a vez, e quanto ele
 * ainda aguenta". Enquanto foram abas separadas, o mestre passou o combate
 * inteiro alternando entre as duas, e cada "próximo turno" custava a ida e a
 * volta; agora ele toca o botão sem tirar os cards da mesa da frente.
 *
 * Duas caras, conforme o estado. Em combate, é a faixa no alto do painel: a
 * ordem numa fileira e, embaixo dela, o botão que ele toca a cada trinta
 * segundos. Fora de combate encolhe para uma linha — numa noite sem briga o
 * painel continua sendo o painel, e a folha de iniciativas só se abre quando a
 * mesa rola os dados.
 *
 * As iniciativas são digitadas, não roladas aqui: quem rola é o jogador, com o
 * dado dele, e o mestre só transcreve. O `d20` existe para os NPCs, que não
 * têm quem role por eles.
 */
export function CombatControl({ campaignId }: { campaignId: number }) {
  // Mexer na ordem é do MASTER da plataforma (`CampaignPolicy::manageStage`),
  // o mesmo recorte do acervo. Era o que a aba já fazia ao existir só para ele,
  // e some junto com ela: mostrar os botões ao mestre de mesa comum renderia um
  // 403 no meio da sessão.
  const podeControlar = useAuthStore((estado) => estado.user?.is_master ?? false);

  const combate = useCombat(campaignId, podeControlar);

  if (!podeControlar) {
    return null;
  }

  if (combate.isLoading) {
    return <Loading inline label="Lendo o combate…" />;
  }

  const estado = combate.data;

  return estado?.active ? (
    <EmAndamento campaignId={campaignId} combate={estado} />
  ) : (
    <Montagem campaignId={campaignId} />
  );
}

function EmAndamento({ campaignId, combate }: { campaignId: number; combate: CombatState }) {
  const { colors } = useTheme();
  const { isPhone } = useResponsive();
  const { proximo, anterior, encerrar } = useCombatControls(campaignId);

  const [efeitos, setEfeitos] = useState(false);

  // O botão que o mestre toca a noite inteira: o maior da tela, sempre na
  // mesma posição, impossível de errar no escuro da sala.
  const botaoPrincipal = (
    <Button
      label="Próximo turno"
      size="lg"
      loading={proximo.isPending}
      onPress={() => proximo.mutate()}
      fullWidth={isPhone}
      style={isPhone ? undefined : { flex: 1, maxWidth: 420 }}
    />
  );

  const botaoVoltar = (
    <Button
      label="Voltar um turno"
      variant="secondary"
      size="sm"
      loading={anterior.isPending}
      onPress={() => anterior.mutate()}
      style={isPhone ? { flex: 1 } : undefined}
    />
  );

  const botaoEncerrar = (
    <Button
      label="Encerrar combate"
      variant="ghost"
      size="sm"
      loading={encerrar.isPending}
      onPress={() => encerrar.mutate()}
      style={isPhone ? { flex: 1 } : undefined}
    />
  );

  // Aplicar efeito em grupo é um formulário inteiro, e não é o que se faz a
  // cada turno: fica fechado para o painel não virar formulário nas outras
  // vinte vezes em que o mestre passa por aqui.
  const botaoEfeitos = (
    <Button
      label={efeitos ? 'Fechar efeitos' : 'Efeitos em grupo'}
      variant="ghost"
      size="sm"
      icon={<Icon name={efeitos ? 'remover' : 'poderes'} size={14} color={colors.primaryInk} />}
      onPress={() => setEfeitos((atual) => !atual)}
    />
  );

  return (
    <View style={{ gap: spacing.md }}>
      <Card
        active
        title={`Rodada ${combate.round}`}
        subtitle={
          combate.current
            ? `Agora: ${combate.current.name}${combate.next ? ` · em seguida, ${combate.next.name}` : ''}`
            : 'Ordem vazia'
        }
        right={<Chip label={`${combate.entries.length} na ordem`} compact tone="gold" />}
      >
        <View style={{ gap: spacing.md }}>
          {/* A ordem deitada, e não em coluna: lê-se da esquerda para a
              direita, que é como a mesa a diz em voz alta, e sobra altura para
              os cards dos personagens continuarem visíveis logo abaixo. */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {combate.entries.map((entrada, indice) => (
              <LinhaDaOrdem
                key={entrada.id}
                entrada={entrada}
                agora={indice === combate.turn_index}
                emSeguida={indice === (combate.turn_index + 1) % combate.entries.length}
              />
            ))}
          </View>

          {/* No celular a fileira de três não cabe, e o rótulo mais longo
              quebra em três linhas dentro do botão: lá os comandos descem em
              degraus, com o principal sozinho na primeira linha. */}
          {isPhone ? (
            <View style={{ gap: spacing.sm }}>
              {botaoPrincipal}
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {botaoVoltar}
                {botaoEncerrar}
              </View>
              {botaoEfeitos}
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm }}>
              {botaoPrincipal}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  marginLeft: 'auto',
                }}
              >
                {botaoVoltar}
                {botaoEncerrar}
                {botaoEfeitos}
              </View>
            </View>
          )}
        </View>
      </Card>

      {efeitos ? <CombatBuffPanel campaignId={campaignId} /> : null}
    </View>
  );
}

/**
 * Uma posição da ordem, do tamanho de uma etiqueta.
 *
 * Quem age agora ganha o preenchimento dourado, quem vem em seguida só o
 * contorno, e o resto é fundo discreto. É a mesma leitura do quadro do palco
 * (`InitiativeTracker`), de propósito: o mestre e a mesa olham para a mesma
 * ordem, e ela não muda de cara ao trocar de tela.
 *
 * O número da iniciativa usa a escala numérica reduzida — no tamanho de ficha
 * ele ocuparia meia etiqueta, e dois dígitos quebravam em duas linhas.
 */
function LinhaDaOrdem({
  entrada,
  agora,
  emSeguida,
}: {
  entrada: CombatEntry;
  agora: boolean;
  emSeguida: boolean;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flexGrow: 1,
        flexBasis: 200,
        minWidth: 170,
        backgroundColor: agora ? colors.accentFill : colors.surfaceAlt,
        borderRadius: radius.md,
        borderWidth: agora ? stroke.seal : stroke.hairline,
        // Quem vem em seguida é só o contorno dourado: uma etiqueta a mais
        // roubava a largura do nome numa fileira apertada, e quem é o próximo
        // já está escrito por extenso no subtítulo do card.
        borderColor: agora || emSeguida ? colors.accent : colors.border,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
      }}
    >
      <Text
        variant="numeric"
        tone={agora || emSeguida ? 'gold' : 'muted'}
        numberOfLines={1}
        style={{ fontSize: 18, lineHeight: 22 }}
      >
        {entrada.initiative}
      </Text>

      {entrada.avatar_url ? (
        <Image
          source={{ uri: entrada.avatar_url }}
          style={{ width: 22, height: 22, borderRadius: radius.sm }}
          contentFit="cover"
          accessibilityLabel={entrada.name}
        />
      ) : null}

      <Text
        variant={agora ? 'bodyStrong' : 'small'}
        tone={agora ? 'gold' : entrada.is_npc ? 'muted' : 'secondary'}
        style={{ flex: 1 }}
        numberOfLines={1}
      >
        {entrada.name}
      </Text>

      {entrada.is_npc ? <Chip label="NPC" compact /> : null}
    </View>
  );
}

function Montagem({ campaignId }: { campaignId: number }) {
  const { colors } = useTheme();

  const [aberta, setAberta] = useState(false);

  // A lista de personagens só é buscada quando a folha abre: fechada, esta
  // seção é uma linha de texto, e uma linha de texto não pede requisição.
  const personagens = useCampaignCharacters(aberta ? campaignId : null);
  const { definir } = useCombatControls(campaignId);

  const [npcs, setNpcs] = useState<Rascunho[]>([]);
  const [fichas, setFichas] = useState<Record<number, string>>({});
  const [acervoAberto, setAcervoAberto] = useState(false);

  const acervo = useStageItems(campaignId, { kind: 'npc' }, aberta);

  const lista = personagens.data ?? [];

  const entries: CombatEntryInput[] = useMemo(() => {
    const dosJogadores = lista
      .filter((personagem) => (fichas[personagem.id] ?? '').trim() !== '')
      .map((personagem) => ({
        character_id: personagem.id,
        initiative: Number(fichas[personagem.id]),
      }));

    const dosNpcs = npcs
      .filter((npc) => npc.name.trim() !== '' && npc.initiative.trim() !== '')
      .map((npc) => {
        const pv = Number.parseInt(npc.hp, 10);

        return {
          name: npc.name.trim(),
          initiative: Number(npc.initiative),
          ...(npc.stageItemId === null ? {} : { stage_item_id: npc.stageItemId }),
          // Sem PV digitado, o servidor lê o da peça do acervo — e, sem peça,
          // usa o padrão. Mandar um zero aqui poria a criatura morta na mesa.
          ...(Number.isFinite(pv) && pv > 0 ? { max_hp: pv, current_hp: pv } : {}),
        };
      });

    return [...dosJogadores, ...dosNpcs].filter((linha) => Number.isFinite(linha.initiative));
  }, [lista, fichas, npcs]);

  if (!aberta) {
    return (
      <Card
        title="Combate"
        subtitle="Ninguém em iniciativa agora"
        right={
          <Button
            label="Montar iniciativa"
            variant="secondary"
            size="sm"
            icon={<Icon name="pericias" size={14} color={colors.accentInk} />}
            onPress={() => setAberta(true)}
          />
        }
      >
        <Text variant="small" tone="muted">
          Quando a mesa rolar, anote as iniciativas aqui: a ordem aparece neste painel e fixa no canto do
          palco.
        </Text>
      </Card>
    );
  }

  return (
    <Card
      title="Nova ordem de iniciativa"
      subtitle="Anote o que a mesa rolou"
      right={
        <Button
          label="Fechar"
          variant="ghost"
          size="sm"
          icon={<Icon name="remover" size={14} color={colors.textMuted} />}
          onPress={() => setAberta(false)}
        />
      }
    >
      {personagens.isLoading ? (
        <Loading inline label="Carregando personagens…" />
      ) : (
        <View style={{ gap: spacing.md }}>
          {lista.length === 0 ? (
            <EmptyState
              icon="jogadores"
              title="Nenhum personagem na mesa"
              description="Você ainda pode montar o combate só com NPCs."
            />
          ) : (
            <View style={{ gap: spacing.sm }}>
              <Text variant="caption" tone="secondary" uppercase>
                Personagens
              </Text>

              {/* Em coluna única numa tela larga, o nome e o campo parariam em
                  pontas opostas do painel — e transcrever a iniciativa que o
                  jogador acabou de dizer viraria uma travessia de olho. Daí a
                  fileira que quebra, com um teto de largura por linha: com dois
                  personagens na mesa elas não se esticam até as bordas. */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {lista.map((personagem) => (
                  <View
                    key={personagem.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-end',
                      gap: spacing.sm,
                      flexGrow: 1,
                      flexBasis: 260,
                      minWidth: 200,
                      maxWidth: 360,
                    }}
                  >
                    <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
                      {personagem.name}
                    </Text>
                    <View style={{ width: 96 }}>
                      <Input
                        placeholder="—"
                        keyboardType="number-pad"
                        value={fichas[personagem.id] ?? ''}
                        onChangeText={(valor) =>
                          setFichas((atual) => ({ ...atual, [personagem.id]: valor.replace(/[^0-9-]/g, '') }))
                        }
                      />
                    </View>
                  </View>
                ))}
              </View>

              <Text variant="caption" tone="muted">
                Quem ficar em branco não entra nesta ordem.
              </Text>
            </View>
          )}

          <View style={{ gap: spacing.sm }}>
            <Text variant="caption" tone="secondary" uppercase>
              NPCs e criaturas
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {npcs.map((npc) => (
                <View
                  key={npc.key}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-end',
                    gap: spacing.sm,
                    flexGrow: 1,
                    flexBasis: 400,
                    minWidth: 280,
                    maxWidth: 560,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Input
                      placeholder="Goblin 1"
                      value={npc.name}
                      onChangeText={(valor) =>
                        setNpcs((atual) =>
                          atual.map((linha) => (linha.key === npc.key ? { ...linha, name: valor } : linha))
                        )
                      }
                    />
                  </View>
                  <View style={{ width: 68 }}>
                    <Input
                      placeholder="Ini"
                      keyboardType="number-pad"
                      value={npc.initiative}
                      onChangeText={(valor) =>
                        setNpcs((atual) =>
                          atual.map((linha) =>
                            linha.key === npc.key
                              ? { ...linha, initiative: valor.replace(/[^0-9-]/g, '') }
                              : linha
                          )
                        )
                      }
                    />
                  </View>

                  <View style={{ width: 68 }}>
                    <Input
                      placeholder="PV"
                      keyboardType="number-pad"
                      value={npc.hp}
                      onChangeText={(valor) =>
                        setNpcs((atual) =>
                          atual.map((linha) =>
                            linha.key === npc.key
                              ? { ...linha, hp: valor.replace(/[^0-9]/g, '') }
                              : linha
                          )
                        )
                      }
                    />
                  </View>

                  {/* O NPC não tem quem role por ele. */}
                  <Pressable
                    onPress={() =>
                      setNpcs((atual) =>
                        atual.map((linha) =>
                          linha.key === npc.key
                            ? { ...linha, initiative: String(1 + Math.floor(Math.random() * 20)) }
                            : linha
                        )
                      )
                    }
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Rolar iniciativa de ${npc.name || 'NPC'}`}
                    style={{ padding: spacing.sm }}
                  >
                    <Icon name="pericias" size={20} color={colors.primaryInk} />
                  </Pressable>

                  <Pressable
                    onPress={() => setNpcs((atual) => atual.filter((linha) => linha.key !== npc.key))}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remover ${npc.name || 'NPC'}`}
                    style={{ padding: spacing.sm }}
                  >
                    <Icon name="excluir" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              <Button
                label="Adicionar NPC"
                variant="ghost"
                size="sm"
                icon={<Icon name="adicionar" size={14} color={colors.primaryInk} />}
                onPress={() => setNpcs((atual) => [...atual, linhaVazia()])}
              />

              <Button
                label="Trazer do acervo"
                variant="ghost"
                size="sm"
                icon={<Icon name="mestre" size={14} color={colors.primaryInk} />}
                onPress={() => setAcervoAberto(true)}
              />
            </View>
          </View>

          <Button
            label={`Começar combate${entries.length > 0 ? ` (${entries.length})` : ''}`}
            disabled={entries.length === 0}
            loading={definir.isPending}
            onPress={() => definir.mutate({ entries })}
            fullWidth
          />

          <SeletorDoAcervo
            visible={acervoAberto}
            onClose={() => setAcervoAberto(false)}
            itens={acervo.data ?? []}
            carregando={acervo.isLoading}
            onEscolher={(item, quantidade) =>
              setNpcs((atual) => [
                ...atual,
                ...Array.from({ length: quantidade }, (_, i) => ({
                  ...linhaVazia(),
                  // Um bicho só fica com o nome limpo; um bando ganha número,
                  // que é o que a fila usa para agrupá-los e o que o mestre
                  // fala em voz alta ("goblin 2 cai").
                  name: quantidade === 1 ? item.title : `${item.title} ${i + 1}`,
                  stageItemId: item.id,
                  hp: pvDaPeca(item),
                  initiative: String(1 + Math.floor(Math.random() * 20)),
                })),
              ])
            }
          />
        </View>
      )}
    </Card>
  );
}

/**
 * Escolhe uma criatura do acervo e diz quantas entram.
 *
 * Puxar do acervo em vez de digitar resolve duas coisas de uma vez: o PV vem
 * junto, e o vínculo com a peça fica guardado — é ele que faz a ficha da
 * criatura abrir sozinha no turno dela, lá no tabuleiro.
 *
 * A quantidade existe porque combate de bando é a regra, não a exceção: sem
 * ela, pôr seis goblins na mesa são seis idas ao mesmo painel.
 */
function SeletorDoAcervo({
  visible,
  onClose,
  itens,
  carregando,
  onEscolher,
}: {
  visible: boolean;
  onClose: () => void;
  itens: StageItem[];
  carregando: boolean;
  onEscolher: (item: StageItem, quantidade: number) => void;
}) {
  const { colors } = useTheme();

  const [quantidade, setQuantidade] = useState(1);

  const escolher = (item: StageItem) => {
    onEscolher(item, quantidade);
    setQuantidade(1);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Trazer do acervo" subtitle="A ficha vem junto">
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="caption" tone="muted" uppercase>
            Quantas
          </Text>

          {[1, 2, 3, 4, 6, 8].map((n) => (
            <Pressable
              key={n}
              onPress={() => setQuantidade(n)}
              accessibilityRole="button"
              accessibilityState={{ selected: quantidade === n }}
              style={{
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
                borderRadius: radius.pill,
                borderWidth: stroke.hairline,
                borderColor: quantidade === n ? colors.accent : colors.border,
                backgroundColor: quantidade === n ? colors.accentFill : 'transparent',
              }}
            >
              <Text variant="caption" tone={quantidade === n ? 'gold' : 'muted'}>
                {n}
              </Text>
            </Pressable>
          ))}
        </View>

        {carregando && <Loading inline label="Abrindo o acervo…" />}

        {!carregando && itens.length === 0 && (
          <Text variant="small" tone="muted">
            Nenhuma criatura no acervo desta campanha. Cadastre uma peça do tipo NPC para
            trazê-la com ficha e PV para o combate.
          </Text>
        )}

        {itens.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => escolher(item)}
            accessibilityRole="button"
            accessibilityLabel={`Trazer ${item.title}`}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              paddingVertical: spacing.xs,
              paddingHorizontal: spacing.sm,
              borderRadius: radius.md,
              backgroundColor: pressed ? colors.surfaceHover : 'transparent',
            })}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="small" numberOfLines={1}>
                {item.title}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {item.subtitle ?? item.facts.map((f) => `${f.label} ${f.value}`).join(' · ')}
              </Text>
            </View>

            {pvDaPeca(item) !== '' && (
              <Chip label={`PV ${pvDaPeca(item)}`} compact />
            )}
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}
