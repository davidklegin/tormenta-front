import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, charactersApi, spellsApi } from '@/api';
import type { AttributeKey, CatalogPower, CatalogSpell, Character, LevelUpPreview } from '@/api/types';
import { Button, Chip, HelpNote, Icon, Input, Loading, SegmentedControl, Select, Sheet, Text } from '@/components/ui';
import { usePowerCatalog } from '@/hooks/usePowerCatalog';
import { useReference } from '@/hooks/useReference';
import { ATTRIBUTE_LABELS, ATTRIBUTE_ORDER } from '@/rules';
import { radius, spacing, tones, useTheme } from '@/theme';

/** A chave do "Aumento de Atributo" no catálogo (ClassPowerSeeder). */
const AUMENTO_DE_ATRIBUTO = 'aumento-de-atributo-qualquer-classe';

/**
 * Subir de nível, passo a passo.
 *
 * A ficha já subia de nível trocando um número na tela de edição — e quem
 * está começando no RPG fazia isso sem saber o que ganhava. Aqui a pessoa
 * escolhe a classe e vê, antes de confirmar, o que muda: PV e PM a mais, as
 * perícias que sobem, o patamar novo, o círculo de magia que abre. Depois
 * escolhe o poder do nível na lista da própria classe (ou um geral no lugar)
 * e as magias que aprende, e confirma uma vez só.
 *
 * Os números vêm do servidor (`GET /characters/:id/level-up`), calculados com
 * a mesma conta da ficha, e não de uma tabela neste arquivo: raça, poderes e
 * Constituição entram como entrariam de verdade.
 */
export function LevelUpSheet({
  visible,
  onClose,
  character,
  onDone,
}: {
  visible: boolean;
  onClose: () => void;
  character: Character;
  onDone?: (nivel: number) => void;
}) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const referencia = useReference();

  const primaria = character.classes.find((c) => c.is_primary) ?? character.classes[0];

  const [classeId, setClasseId] = useState<number | null>(primaria?.game_class_id ?? null);
  const [poder, setPoder] = useState<CatalogPower | null>(null);
  const [atributo, setAtributo] = useState<AttributeKey | null>(null);
  const [magias, setMagias] = useState<number[]>([]);
  const [concluido, setConcluido] = useState<number | null>(null);

  // Abrir de novo começa do zero: o nível anterior já foi gravado, e as
  // escolhas dele não valem para o próximo.
  useEffect(() => {
    if (!visible) return;

    setClasseId(primaria?.game_class_id ?? null);
    setPoder(null);
    setAtributo(null);
    setMagias([]);
    setConcluido(null);
  }, [visible, primaria?.game_class_id]);

  // Trocar de classe troca a lista de poderes e de magias.
  useEffect(() => {
    setPoder(null);
    setAtributo(null);
    setMagias([]);
  }, [classeId]);

  const ehAumento = poder?.key === AUMENTO_DE_ATRIBUTO;
  const atributoDaPrevia = ehAumento ? atributo : null;

  const previa = useQuery({
    queryKey: ['character', character.id, 'level-up', classeId, atributoDaPrevia],
    queryFn: () => charactersApi.levelUpPreview(character.id, classeId as number, atributoDaPrevia),
    enabled: visible && classeId !== null && concluido === null,
    placeholderData: (anterior) => anterior,
  });

  const subir = useMutation({
    mutationFn: async () => {
      const resultado = await charactersApi.levelUp(character.id, classeId as number, atributoDaPrevia);

      // O nível já está gravado; o poder e as magias entram pelas rotas de
      // importação de sempre, que copiam o texto do catálogo para a ficha.
      if (poder) await charactersApi.importPowers(character.id, [poder.id]);
      if (magias.length > 0) await charactersApi.importSpells(character.id, magias);

      return resultado;
    },
    onSuccess: (resultado) => {
      setConcluido(resultado.level);
      onDone?.(resultado.level);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['character', character.id] });
      void queryClient.invalidateQueries({ queryKey: ['characters'] });
    },
  });

  const opcoesDeClasse = useMemo(() => {
    const doPersonagem = new Map(character.classes.map((c) => [c.game_class_id, c.level]));

    return (referencia.data?.classes ?? []).map((classe) => {
      const nivel = doPersonagem.get(classe.id);

      return {
        value: classe.id,
        label: nivel ? `${classe.name} (${nivel}º → ${nivel + 1}º)` : `${classe.name} (nova classe)`,
        description: nivel ? undefined : 'Multiclasse: o 1º nível desta classe',
      };
    });
  }, [referencia.data?.classes, character.classes]);

  const dados = previa.data;
  const faltaAtributo = ehAumento && atributo === null;

  const rodape =
    concluido !== null ? (
      <Button label="Fechar" onPress={onClose} style={{ flex: 1 }} />
    ) : (
      <>
        <Button label="Cancelar" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
        <Button
          label={dados ? `Subir para o ${dados.level.after}º nível` : 'Subir de nível'}
          onPress={() => subir.mutate()}
          disabled={!dados || faltaAtributo || previa.isFetching}
          loading={subir.isPending}
          style={{ flex: 1 }}
        />
      </>
    );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Subir de nível"
      subtitle={`${character.name} · ${character.level}º nível`}
      footer={rodape}
    >
      {concluido !== null ? (
        <View style={{ gap: spacing.md, alignItems: 'center', paddingVertical: spacing.lg }}>
          <Icon name="confirmar" size={40} color={colors.success} />
          <Text variant="heading" center>
            {character.name} chegou ao {concluido}º nível
          </Text>
          <Text variant="small" tone="muted" center>
            PV, PM e perícias já estão recalculados na ficha.
            {poder ? ` ${poder.name} entrou na aba Poderes.` : ''}
            {magias.length > 0 ? ' As magias novas estão na aba Magias.' : ''}
          </Text>
        </View>
      ) : (
        <>
          <Passo numero={1} titulo="Em qual classe?">
            <Select
              value={classeId}
              options={opcoesDeClasse}
              onChange={setClasseId}
              placeholder="Escolha a classe"
              searchable
            />
            <HelpNote collapsible source="Tormenta 20, p. 35">
              Cada nível novo vai para uma classe. Continuar na mesma é o comum; escolher outra é fazer
              multiclasse, e o personagem passa a ter as duas.
            </HelpNote>
          </Passo>

          {previa.isPending && classeId !== null ? <Loading label="Calculando o nível…" /> : null}

          {previa.isError ? (
            <Text variant="small" tone="danger">
              {previa.error instanceof ApiError ? previa.error.message : 'Não deu para calcular o nível.'}
            </Text>
          ) : null}

          {dados ? (
            <>
              <Passo numero={2} titulo="O que muda">
                <Mudancas previa={dados} />
              </Passo>

              {dados.power_slot ? (
                <Passo numero={3} titulo="Escolha um poder">
                  <EscolhaDoPoder
                    character={character}
                    previa={dados}
                    escolhido={poder}
                    onEscolher={(p) => {
                      setPoder(p);
                      if (p?.key !== AUMENTO_DE_ATRIBUTO) setAtributo(null);
                    }}
                  />

                  {ehAumento ? (
                    <View style={{ gap: spacing.xs }}>
                      <Text variant="small">Qual atributo sobe +1?</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                        {ATTRIBUTE_ORDER.map((chave) => (
                          <Chip
                            key={chave}
                            label={ATTRIBUTE_LABELS[chave].full}
                            tone="primary"
                            selected={atributo === chave}
                            onPress={() => setAtributo(chave)}
                          />
                        ))}
                      </View>
                      <Text variant="caption" tone="muted">
                        Só uma vez por patamar para o mesmo atributo. Constituição a mais soma PV em todos os
                        níveis — a conta acima já mostra isso.
                      </Text>
                    </View>
                  ) : null}
                </Passo>
              ) : (
                <Passo numero={3} titulo="Habilidades do 1º nível">
                  <HelpNote source={dados.class.book_page ? `Tormenta 20, p. ${dados.class.book_page}` : undefined}>
                    {`O 1º nível de ${dados.class.name} não traz um poder para escolher: traz as habilidades de 1º nível da classe. Confira a tabela da classe no livro e anote-as na aba Habilidades.`}
                  </HelpNote>
                </Passo>
              )}

              {dados.spells && dados.spells.learns > 0 ? (
                <Passo numero={4} titulo={tituloDasMagias(dados.spells.learns, dados.spells.initial)}>
                  <EscolhaDasMagias
                    character={character}
                    previa={dados}
                    escolhidas={magias}
                    onAlternar={(id) =>
                      setMagias((atual) =>
                        atual.includes(id)
                          ? atual.filter((x) => x !== id)
                          : atual.length >= (dados.spells?.learns ?? 0)
                            ? atual
                            : [...atual, id]
                      )
                    }
                  />
                </Passo>
              ) : null}

              {subir.isError ? (
                <Text variant="small" tone="danger">
                  {subir.error instanceof ApiError
                    ? subir.error.message
                    : 'Não deu para subir de nível. Tente de novo.'}
                </Text>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </Sheet>
  );
}

function tituloDasMagias(quantas: number, iniciais: boolean): string {
  if (iniciais) return `Magias iniciais (${quantas})`;

  return quantas === 1 ? 'Aprenda uma magia' : `Aprenda ${quantas} magias`;
}

/** Um bloco numerado do assistente. */
function Passo({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
  const { colors } = useTheme();

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primaryFill,
            borderWidth: 1,
            borderColor: colors.primary,
          }}
        >
          <Text variant="caption" tone="primary">
            {numero}
          </Text>
        </View>
        <Text variant="subheading">{titulo}</Text>
      </View>
      {children}
    </View>
  );
}

/**
 * O que o nível novo faz com a ficha, em linhas curtas.
 *
 * Só aparece o que muda de verdade: no 3º nível as perícias não sobem, e
 * dizer "+0 nas perícias" ensinaria a pessoa a ignorar a lista.
 */
function Mudancas({ previa }: { previa: LevelUpPreview }) {
  const { colors } = useTheme();

  const linhas: { rotulo: string; valor: string; nota?: string }[] = [
    {
      rotulo: 'Nível',
      valor: `${previa.level.before}º → ${previa.level.after}º`,
      nota: `${previa.class.name} ${previa.class.level_before > 0 ? `${previa.class.level_before}º → ` : ''}${previa.class.level_after}º`,
    },
    {
      rotulo: 'Pontos de Vida',
      valor: `+${previa.hp.gain}`,
      nota: previa.hp.overridden
        ? 'O PV máximo desta ficha está travado à mão, e continua como está.'
        : `máximo ${previa.hp.before} → ${previa.hp.after}; os PV atuais sobem o mesmo tanto`,
    },
    {
      rotulo: 'Pontos de Mana',
      valor: `+${previa.mp.gain}`,
      nota: previa.mp.overridden ? 'O PM máximo desta ficha está travado à mão.' : `máximo ${previa.mp.before} → ${previa.mp.after}`,
    },
  ];

  if (previa.half_level.after > previa.half_level.before) {
    linhas.push({
      rotulo: 'Perícias',
      valor: '+1 em todas',
      nota: 'Metade do nível entra em toda perícia, e na CD das suas magias e habilidades.',
    });
  }

  if (previa.training_bonus.after > previa.training_bonus.before) {
    linhas.push({
      rotulo: 'Perícias treinadas',
      valor: `+${previa.training_bonus.after - previa.training_bonus.before}`,
      nota: `O bônus de treinamento passa de +${previa.training_bonus.before} para +${previa.training_bonus.after}.`,
    });
  }

  if (previa.tier.after !== previa.tier.before) {
    linhas.push({ rotulo: 'Patamar', valor: previa.tier.after, nota: `Deixa de ser ${previa.tier.before}.` });
  }

  if (previa.spells?.new_circle) {
    linhas.push({
      rotulo: 'Magias',
      valor: `${previa.spells.new_circle}º círculo`,
      nota: 'Um círculo novo de magias passa a estar ao seu alcance.',
    });
  }

  const xpCurto = previa.experience.current < previa.experience.required;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
        {linhas.map((linha, i) => (
          <View
            key={linha.rotulo}
            style={{
              flexDirection: 'row',
              gap: spacing.md,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderBottomWidth: i === linhas.length - 1 ? 0 : 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="small">{linha.rotulo}</Text>
              {linha.nota ? (
                <Text variant="caption" tone="muted">
                  {linha.nota}
                </Text>
              ) : null}
            </View>
            <Text variant="body" tone="gold">
              {linha.valor}
            </Text>
          </View>
        ))}
      </View>

      {/* Não trava: muita mesa sobe por marco da história, sem contar XP. */}
      {xpCurto ? (
        <HelpNote tone="warning" source="Tormenta 20, p. 35">
          {`A ficha marca ${previa.experience.current.toLocaleString('pt-BR')} XP, e o ${previa.level.after}º nível pede ${previa.experience.required.toLocaleString('pt-BR')}. Se o mestre liberou o nível por marco da história, pode seguir.`}
        </HelpNote>
      ) : null}
    </View>
  );
}

/**
 * "Nº nível de <classe>" no pré-requisito: o nível mínimo na classe.
 *
 * É o pré-requisito mais comum dos poderes de classe, e o único que dá para
 * conferir com certeza aqui. Os outros (atributo, outro poder) ficam à vista
 * para a pessoa ler.
 */
function nivelExigido(requisito: string | null, classe: string): number | null {
  if (!requisito) return null;

  const achado = new RegExp(`(\\d+)º nível de ${classe}`, 'i').exec(requisito);

  return achado ? Number(achado[1]) : null;
}

function EscolhaDoPoder({
  character,
  previa,
  escolhido,
  onEscolher,
}: {
  character: Character;
  previa: LevelUpPreview;
  escolhido: CatalogPower | null;
  onEscolher: (poder: CatalogPower | null) => void;
}) {
  const [lista, setLista] = useState<'classe' | 'geral'>('classe');
  const [busca, setBusca] = useState('');

  const daClasse = usePowerCatalog({ type: 'classe', subtype: previa.class.name, q: busca || undefined });
  const deTodas = usePowerCatalog({ type: 'classe', subtype: 'Qualquer classe', q: busca || undefined });
  const gerais = usePowerCatalog({ type: 'geral', q: busca || undefined });

  const jaTem = useMemo(
    () => new Set(character.powers.map((p) => p.power_id).filter((id): id is number => id !== null)),
    [character.powers]
  );

  const poderes = lista === 'classe' ? [...deTodas.powers, ...daClasse.powers] : gerais.powers;
  const consulta = lista === 'classe' ? daClasse : gerais;

  return (
    <View style={{ gap: spacing.sm }}>
      <SegmentedControl
        value={lista}
        onChange={(valor) => setLista(valor)}
        segments={[
          { value: 'classe', label: `Poder de ${previa.class.name}` },
          { value: 'geral', label: 'Poder geral' },
        ]}
      />

      <Text variant="caption" tone="muted">
        {lista === 'classe'
          ? 'Todo nível a partir do 2º numa classe traz um poder dela. Os que pedem um nível maior ficam marcados.'
          : 'No lugar do poder de classe, você pode escolher um poder geral — de combate, de destino, de magia.'}
      </Text>

      <Input placeholder="Buscar por nome ou pré-requisito…" value={busca} onChangeText={setBusca} autoCorrect={false} />

      {consulta.isLoading ? (
        <Loading />
      ) : poderes.length === 0 ? (
        <Text variant="small" tone="muted">
          Nenhum poder com essa busca.
        </Text>
      ) : (
        <Lista>
          {poderes.map((poder, i) => {
            const exigido = nivelExigido(poder.requirements, previa.class.name);
            const cedo = exigido !== null && exigido > previa.class.level_after;
            const repetivel = poder.key === AUMENTO_DE_ATRIBUTO;
            const tem = jaTem.has(poder.id) && !repetivel;

            return (
              <LinhaEscolhivel
                key={poder.id}
                titulo={poder.name}
                legenda={[
                  tem ? 'Já na ficha' : null,
                  cedo ? `Disponível no ${exigido}º nível de ${previa.class.name}` : null,
                  poder.requirements ? `Pré-requisito: ${poder.requirements}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                marcado={escolhido?.id === poder.id}
                desabilitado={tem || cedo}
                ultimo={i === poderes.length - 1}
                tipo="radio"
                onPress={() => onEscolher(escolhido?.id === poder.id ? null : poder)}
              />
            );
          })}
        </Lista>
      )}

      {consulta.hasNextPage ? (
        <Button
          label="Carregar mais"
          variant="secondary"
          onPress={() => void consulta.fetchNextPage()}
          loading={consulta.isFetchingNextPage}
        />
      ) : null}

      <Text variant="caption" tone="muted">
        {escolhido
          ? `Escolhido: ${escolhido.name}.`
          : 'Sem escolha agora, o nível sobe do mesmo jeito, e o poder pode entrar depois pela aba Poderes.'}
      </Text>
    </View>
  );
}

function EscolhaDasMagias({
  character,
  previa,
  escolhidas,
  onAlternar,
}: {
  character: Character;
  previa: LevelUpPreview;
  escolhidas: number[];
  onAlternar: (id: number) => void;
}) {
  const magia = previa.spells;
  const [circulo, setCirculo] = useState(1);
  const [busca, setBusca] = useState('');

  const lista = useQuery({
    queryKey: ['spells', 'level-up', magia?.tradition, circulo, busca],
    queryFn: () =>
      spellsApi.list({ tradition: magia?.tradition, circle: circulo, q: busca || undefined, per_page: 100 }),
    enabled: magia !== null,
  });

  const conhecidas = useMemo(
    () => new Set(character.spells.map((s) => s.spell_id).filter((id): id is number => id !== null)),
    [character.spells]
  );

  if (!magia) return null;

  const circulos = Array.from({ length: magia.max_circle }, (_, i) => i + 1);
  const magias: CatalogSpell[] = lista.data?.data ?? [];

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="caption" tone="muted">
        {`De qualquer círculo que você já lança (até o ${magia.max_circle}º).`}
        {magia.limited_schools ? ' Bardo e druida só aprendem das três escolas que escolheram.' : ''}
        {` ${escolhidas.length} de ${magia.learns} escolhida${magia.learns === 1 ? '' : 's'}.`}
      </Text>

      {circulos.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {circulos.map((c) => (
            <Chip key={c} label={`${c}º círculo`} tone="arcane" selected={circulo === c} onPress={() => setCirculo(c)} />
          ))}
        </View>
      ) : null}

      <Input placeholder="Buscar magia…" value={busca} onChangeText={setBusca} autoCorrect={false} />

      {lista.isLoading ? (
        <Loading />
      ) : magias.length === 0 ? (
        <Text variant="small" tone="muted">
          Nenhuma magia com essa busca.
        </Text>
      ) : (
        <Lista>
          {magias.map((m, i) => {
            const conhece = conhecidas.has(m.id);
            const marcada = escolhidas.includes(m.id);
            const cheia = !marcada && escolhidas.length >= magia.learns;

            return (
              <LinhaEscolhivel
                key={m.id}
                titulo={m.name}
                legenda={[conhece ? 'Já conhece' : null, m.school_label, m.target_label].filter(Boolean).join(' · ')}
                marcado={marcada}
                desabilitado={conhece || cheia}
                ultimo={i === magias.length - 1}
                tipo="checkbox"
                onPress={() => onAlternar(m.id)}
              />
            );
          })}
        </Lista>
      )}
    </View>
  );
}

function Lista({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();

  return (
    <View style={{ borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
      {children}
    </View>
  );
}

function LinhaEscolhivel({
  titulo,
  legenda,
  marcado,
  desabilitado,
  ultimo,
  tipo,
  onPress,
}: {
  titulo: string;
  legenda: string;
  marcado: boolean;
  desabilitado: boolean;
  ultimo: boolean;
  tipo: 'radio' | 'checkbox';
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const arcano = tones(colors).arcane;

  return (
    <Pressable
      onPress={desabilitado ? undefined : onPress}
      disabled={desabilitado}
      accessibilityRole={tipo}
      accessibilityState={{ checked: marcado, disabled: desabilitado }}
      accessibilityLabel={legenda ? `${titulo}, ${legenda}` : titulo}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderBottomWidth: ultimo ? 0 : 1,
        borderBottomColor: colors.border,
        opacity: desabilitado ? 0.5 : 1,
        backgroundColor: pressed || marcado ? colors.surfaceHover : 'transparent',
      })}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: tipo === 'radio' ? 10 : radius.sm,
          borderWidth: 1,
          borderColor: marcado ? arcano.border : colors.borderStrong,
          backgroundColor: marcado ? arcano.solid : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {marcado ? <Icon name="confirmar" size={14} color={arcano.onSolid} /> : null}
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" numberOfLines={1}>
          {titulo}
        </Text>
        {legenda ? (
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {legenda}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
