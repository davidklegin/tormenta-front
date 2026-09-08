import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import type { CombatEntry, ReferenceCondition, StageFact, StageItem } from '@/api/types';
import { Text } from '@/components/ui';
import { rolarTextoDeDano } from '@/rules';
import { radius, spacing, stroke, useTheme } from '@/theme';
import { ConditionBadges } from './ConditionBadges';

type Props = {
  entry: CombatEntry;
  /** A peça do acervo por trás do NPC, quando ele veio de lá. */
  item: StageItem | null;
  conditions: ReferenceCondition[];
  onClose: () => void;
  onUpdateStats?: (entryId: string, stats: { current_hp?: number; max_hp?: number }) => void;
};

/**
 * Rótulos que a mesa usa para a mesma coisa, por campo da ficha.
 *
 * Escritos sem acento porque a comparação normaliza os dois lados — "Resistência"
 * e "Resistencia" chegam iguais aqui.
 */
const SINONIMOS = {
  ca: ['ca', 'ac', 'defesa', 'classe de armadura'],
  pv: ['pv', 'hp', 'vida', 'pontos de vida'],
  nd: ['nd', 'cr', 'nivel de desafio'],
  ataque: ['ataque', 'ataques', 'atq', 'attack'],
  habilidade: ['habilidade', 'habilidades', 'poder', 'poderes', 'especial', 'ability'],
  resistencia: ['resistencia', 'resistencias', 'imunidade', 'imunidades', 'reducao', 'rd'],
} as const;

/**
 * A ficha da criatura, aberta no turno dela.
 *
 * Existe para responder "o que esse bicho faz agora" sem o mestre sair do
 * tabuleiro e ir ao acervo — que era o pulo de tela que mais custava tempo de
 * sessão. Por isso ela é de ação, e não de leitura: o ataque listado rola o
 * próprio dano, e o PV se corrige ali mesmo quando o mestre resolve que o
 * chefe aguenta mais um golpe.
 *
 * O conteúdo é o que o mestre escreveu no acervo, em texto livre. A ficha
 * separa o que reconhece — CA, ataques, habilidades — e mostra o resto como
 * veio, em vez de esconder o que não coube encaixar.
 */
export function NPCStatSheet({ entry, item, conditions, onClose, onUpdateStats }: Props) {
  const { colors, elevation } = useTheme();

  const [ultimaRolagem, setUltimaRolagem] = useState<string | null>(null);

  const catalogo = useMemo(() => {
    const mapa = new Map<string, ReferenceCondition>();
    for (const c of conditions) mapa.set(c.key, c);
    return mapa;
  }, [conditions]);

  const facts = item?.facts ?? [];

  const ca = acharValor(facts, SINONIMOS.ca);
  const nd = acharValor(facts, SINONIMOS.nd);
  const ataques = acharTodos(facts, SINONIMOS.ataque);
  const habilidades = acharTodos(facts, SINONIMOS.habilidade);
  const resistencias = acharTodos(facts, SINONIMOS.resistencia);

  const reconhecidos = new Set([
    ...ataques,
    ...habilidades,
    ...resistencias,
    ...facts.filter((f) => casa(f.label, [...SINONIMOS.ca, ...SINONIMOS.pv, ...SINONIMOS.nd])),
  ]);

  const resto = facts.filter((f) => !reconhecidos.has(f));

  const rolar = (ataque: StageFact) => {
    const rolagem = rolarTextoDeDano(ataque.value);

    if (rolagem === null) {
      setUltimaRolagem(`${ataque.label}: sem fórmula de dano legível`);

      return;
    }

    const detalhe = rolagem.dados.join(' + ');
    const comFixo = rolagem.fixo !== 0 ? `${detalhe} ${rolagem.fixo > 0 ? '+' : '−'} ${Math.abs(rolagem.fixo)}` : detalhe;

    setUltimaRolagem(`${ataque.label}: ${comFixo} = ${rolagem.total}`);
  };

  return (
    <View
      style={{
        width: 320,
        maxHeight: 460,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: stroke.seal,
        borderColor: colors.accent,
        overflow: 'hidden',
        ...elevation.floating,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderBottomWidth: stroke.hairline,
          borderBottomColor: colors.border,
          backgroundColor: colors.accentFill,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="smallStrong" tone="gold" numberOfLines={1}>
            {entry.name}
          </Text>

          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {nd ? `ND ${nd}` : item?.subtitle ?? 'Sem ficha no acervo'}
          </Text>
        </View>

        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar ficha">
          <Text variant="small" tone="muted">
            ✕
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        {/*
          O PV vem primeiro e não encolhe: é o número que muda a cada golpe, e
          numa ficha de acervo a CA costuma vir com uma ressalva inteira colada
          ("33 (imunidade a fogo e luz)") que, solta, empurrava o PV para fora
          do painel.
        */}
        <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' }}>
          <PontosDeVida entry={entry} onUpdateStats={onUpdateStats} />

          {ca && <Numero rotulo="CA" valor={ca} />}
        </View>

        {(entry.conditions?.length ?? 0) > 0 && (
          <Secao titulo="Condições">
            <ConditionBadges conditions={entry.conditions ?? []} catalog={catalogo} />
          </Secao>
        )}

        {ataques.length > 0 && (
          <Secao titulo="Ataques — toque para rolar o dano">
            {ataques.map((ataque, i) => (
              <Pressable
                key={`${ataque.label}-${i}`}
                onPress={() => rolar(ataque)}
                accessibilityRole="button"
                accessibilityLabel={`Rolar dano de ${ataque.label}`}
                style={({ pressed }) => ({
                  paddingVertical: spacing.xxs,
                  paddingHorizontal: spacing.xs,
                  borderRadius: radius.sm,
                  backgroundColor: pressed ? colors.surfaceHover : 'transparent',
                })}
              >
                <Text variant="small">{ataque.label}</Text>
                <Text variant="small" tone="muted">
                  {ataque.value}
                </Text>
              </Pressable>
            ))}

            {ultimaRolagem && (
              <View
                style={{
                  marginTop: spacing.xs,
                  padding: spacing.xs,
                  borderRadius: radius.sm,
                  backgroundColor: colors.accentFill,
                }}
              >
                <Text variant="small" tone="gold">
                  {ultimaRolagem}
                </Text>
              </View>
            )}
          </Secao>
        )}

        {habilidades.length > 0 && (
          <Secao titulo="Habilidades">
            {habilidades.map((h, i) => (
              <Linha key={`${h.label}-${i}`} fact={h} />
            ))}
          </Secao>
        )}

        {resistencias.length > 0 && (
          <Secao titulo="Resistências e imunidades">
            {resistencias.map((r, i) => (
              <Linha key={`${r.label}-${i}`} fact={r} />
            ))}
          </Secao>
        )}

        {resto.length > 0 && (
          <Secao titulo="Ficha">
            {resto.map((f, i) => (
              <Linha key={`${f.label}-${i}`} fact={f} />
            ))}
          </Secao>
        )}

        {item?.body && (
          <Secao titulo="Descrição">
            <Text variant="small" tone="secondary">
              {item.body}
            </Text>
          </Secao>
        )}

        {item?.secret_notes && (
          <Secao titulo="Só o mestre vê">
            <Text variant="small" tone="danger">
              {item.secret_notes}
            </Text>
          </Secao>
        )}

        {item === null && (
          <Text variant="small" tone="muted">
            Este combatente entrou na ordem só com nome e iniciativa. Cadastre-o no acervo para
            ver ataques e habilidades aqui.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * O PV, editável no lugar.
 *
 * "Tudo editável em tempo real" começa aqui: o chefe revela a segunda forma e
 * o PV máximo muda no meio da luta. Digitar o número certo é mais rápido que
 * calcular a diferença e aplicar como cura.
 */
function PontosDeVida({
  entry,
  onUpdateStats,
}: {
  entry: CombatEntry;
  onUpdateStats?: (entryId: string, stats: { current_hp?: number; max_hp?: number }) => void;
}) {
  const { colors } = useTheme();

  const [editando, setEditando] = useState(false);
  const [atual, setAtual] = useState('');
  const [maximo, setMaximo] = useState('');

  const proporcao = entry.max_hp > 0 ? entry.current_hp / entry.max_hp : 1;
  const cor =
    entry.current_hp <= 0
      ? colors.dangerInk
      : proporcao > 0.5
        ? colors.successInk
        : proporcao > 0.25
          ? colors.warningInk
          : colors.dangerInk;

  const abrir = () => {
    setAtual(String(entry.current_hp));
    setMaximo(String(entry.max_hp));
    setEditando(true);
  };

  const salvar = () => {
    const novoAtual = Number.parseInt(atual, 10);
    const novoMaximo = Number.parseInt(maximo, 10);

    const mudancas: { current_hp?: number; max_hp?: number } = {};

    if (Number.isFinite(novoAtual) && novoAtual !== entry.current_hp) mudancas.current_hp = novoAtual;
    if (Number.isFinite(novoMaximo) && novoMaximo > 0 && novoMaximo !== entry.max_hp) {
      mudancas.max_hp = novoMaximo;
    }

    if (Object.keys(mudancas).length > 0) onUpdateStats?.(entry.id, mudancas);

    setEditando(false);
  };

  if (editando) {
    return (
      <View style={{ gap: 2 }}>
        <Text variant="caption" tone="muted" uppercase>
          PV
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xxs }}>
          <CampoDeNumero valor={atual} onChange={setAtual} rotulo="PV atual" onSubmit={salvar} />

          <Text variant="small" tone="muted">
            /
          </Text>

          <CampoDeNumero valor={maximo} onChange={setMaximo} rotulo="PV máximo" onSubmit={salvar} />

          <Pressable onPress={salvar} hitSlop={8} accessibilityRole="button" accessibilityLabel="Salvar PV">
            <Text variant="small" tone="success">
              ✓
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onUpdateStats ? abrir : undefined}
      accessibilityRole={onUpdateStats ? 'button' : undefined}
      accessibilityLabel={onUpdateStats ? `Editar PV de ${entry.name}` : undefined}
      style={{ gap: 2, flexShrink: 0 }}
    >
      <Text variant="caption" tone="muted" uppercase>
        PV
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
        <Text variant="heading" style={{ color: cor }}>
          {entry.current_hp}
        </Text>

        <Text variant="small" tone="muted">
          /{entry.max_hp}
        </Text>

        {entry.temp_hp > 0 && (
          <Text variant="small" tone="arcane">
            +{entry.temp_hp}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function CampoDeNumero({
  valor,
  onChange,
  rotulo,
  onSubmit,
}: {
  valor: string;
  onChange: (v: string) => void;
  rotulo: string;
  onSubmit: () => void;
}) {
  const { colors } = useTheme();

  return (
    <TextInput
      value={valor}
      onChangeText={(t) => onChange(t.replace(/[^0-9]/g, ''))}
      onSubmitEditing={onSubmit}
      keyboardType="number-pad"
      returnKeyType="done"
      accessibilityLabel={rotulo}
      style={{
        width: 46,
        height: 30,
        paddingHorizontal: spacing.xxs,
        textAlign: 'center',
        borderRadius: radius.sm,
        borderWidth: stroke.hairline,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surfaceAlt,
        color: colors.text,
        fontSize: 14,
      }}
    />
  );
}

/**
 * Um número da ficha, com a ressalva que costuma vir grudada nele.
 *
 * O acervo é texto livre, e o mestre escreve a CA como "33 (imunidade a fogo
 * e luz)". Em corpo de título isso atravessa o painel, então o número fica em
 * destaque e o resto desce para uma linha miúda ao lado.
 */
function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  const casado = valor.trim().match(/^([+-]?\d+)\s*(.*)$/s);
  const destaque = casado?.[1] ?? valor.trim();
  const ressalva = casado?.[2]?.trim() ?? '';

  return (
    <View style={{ gap: 2, flexShrink: 1 }}>
      <Text variant="caption" tone="muted" uppercase>
        {rotulo}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
        {/* O número não encolhe: comprimido, "33" era desenhado como "3". */}
        <Text variant="heading" numberOfLines={1} style={{ flexShrink: 0 }}>
          {destaque}
        </Text>

        {ressalva !== '' && (
          <Text variant="small" tone="muted" numberOfLines={2} style={{ flexShrink: 1 }}>
            {ressalva}
          </Text>
        )}
      </View>
    </View>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.xxs }}>
      <Text variant="caption" tone="muted" uppercase>
        {titulo}
      </Text>
      {children}
    </View>
  );
}

function Linha({ fact }: { fact: StageFact }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.xs }}>
      <Text variant="small" tone="secondary" style={{ flexShrink: 0 }}>
        {fact.label}
      </Text>
      <Text variant="small" style={{ flex: 1 }}>
        {fact.value}
      </Text>
    </View>
  );
}

/**
 * O rótulo é aquele campo?
 *
 * Compara por igualdade, não por "contém": "Deslocamento" contém "ca" e
 * apareceria como Classe de Armadura na ficha de metade do bestiário. O que
 * vale além da igualdade é o rótulo composto — "Ataque: garra", "Ataque 1" —,
 * e para isso basta exigir um separador logo depois da palavra.
 */
function casa(label: string, chaves: readonly string[]): boolean {
  const limpo = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  return chaves.some((chave) => {
    const alvo = chave.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (limpo === alvo) return true;

    return limpo.startsWith(alvo) && /^[\s:/,–-]/.test(limpo.slice(alvo.length));
  });
}

function acharValor(facts: StageFact[], chaves: readonly string[]): string | null {
  return facts.find((f) => casa(f.label, chaves))?.value ?? null;
}

function acharTodos(facts: StageFact[], chaves: readonly string[]): StageFact[] {
  return facts.filter((f) => casa(f.label, chaves));
}
