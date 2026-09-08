import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text, type IconName } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';
import type { AreaEffectShape, BattleMapToken } from '@/api/types';
import type { ModoDoTabuleiro } from './BattleMapCanvas';
import { nomeDaCelula } from './geometry';

type Props = {
  modo: ModoDoTabuleiro;
  onModo: (modo: ModoDoTabuleiro) => void;
  ehMestre: boolean;
  tokenSelecionado: BattleMapToken | null;
  podeMoverSelecionado: boolean;
  onDesfazer: () => void;
  onRemover: () => void;
  onEsconder: () => void;
  onTamanho: (tamanho: number) => void;
  onFecharSelecao: () => void;
  onAbrirPainel: () => void;
  onRecentralizar: () => void;
  /** Abre a ficha de quem está jogando. Ausente para quem não tem ficha na mesa. */
  onAbrirFicha?: () => void;
  /** Forma e alcance que o próximo toque no modo Área vai marcar. */
  area: { forma: AreaEffectShape; raio: number };
  onArea: (area: { forma: AreaEffectShape; raio: number }) => void;
};

type Ferramenta = { modo: ModoDoTabuleiro; icone: IconName; rotulo: string };

const DE_TODOS: Ferramenta[] = [
  { modo: 'navegar', icone: 'jogadores', rotulo: 'Mover' },
  { modo: 'medir', icone: 'pericias', rotulo: 'Medir' },
];

const DO_MESTRE: Ferramenta[] = [
  { modo: 'nevoa', icone: 'condicao', rotulo: 'Névoa' },
  { modo: 'area', icone: 'magias', rotulo: 'Área' },
];

/**
 * As formas de área do livro. O alcance é em quadrados, e o rótulo mostra os
 * metros — que é como a magia se descreve ("esfera de 6m", "cone de 9m").
 */
const FORMAS: { valor: AreaEffectShape; rotulo: string }[] = [
  { valor: 'circle', rotulo: 'Esfera' },
  { valor: 'cone', rotulo: 'Cone' },
  { valor: 'line', rotulo: 'Linha' },
  { valor: 'cube', rotulo: 'Cubo' },
];

const ALCANCES = [2, 4, 6, 8];

/** Os tamanhos do livro, na ordem em que a mesa os nomeia. */
const TAMANHOS = [
  { valor: 1, rotulo: 'Médio' },
  { valor: 2, rotulo: 'Grande' },
  { valor: 3, rotulo: 'Enorme' },
  { valor: 4, rotulo: 'Colossal' },
];

/**
 * A barra do tabuleiro.
 *
 * Fica embaixo porque é onde o polegar chega sem trocar a mão de posição — e
 * durante o combate esta barra é tocada mais que qualquer outra coisa da tela.
 *
 * A peça selecionada abre uma faixa **acima** da barra, em vez de substituí-la.
 * Trocar o conteúdo economizava altura, mas levava junto o acesso ao painel do
 * mestre: bastava tocar numa peça para o botão de configurar o tabuleiro sumir,
 * e não havia nada na tela dizendo que era preciso desselecionar para tê-lo de
 * volta.
 */
export function BattleMapToolbar({
  modo,
  onModo,
  ehMestre,
  tokenSelecionado,
  podeMoverSelecionado,
  onDesfazer,
  onRemover,
  onEsconder,
  onTamanho,
  onFecharSelecao,
  onAbrirPainel,
  onRecentralizar,
  onAbrirFicha,
  area,
  onArea,
}: Props) {
  const { colors } = useTheme();
  const ferramentas = ehMestre ? [...DE_TODOS, ...DO_MESTRE] : DE_TODOS;

  return (
    // Acima da pastilha de PV/PM (zIndex 80), que é arrastável e nasce no
    // rodapé: com a barra quebrando em linha no celular, ela cobria "Área" e
    // "Tirar" — e um botão coberto é tão inalcançável quanto um botão cortado.
    <View style={{ zIndex: 90 }}>
      {/* A escolha de forma e alcance acompanha o modo Área, e só ele. Ela
          saía da tela assim que uma peça era selecionada — e como selecionar
          uma peça é o gesto que antecede movê-la, na prática bastava mexer no
          tabuleiro para perder de vista com o que a próxima área seria
          marcada. As duas faixas convivem: são perguntas diferentes. */}
      {modo === 'area' && (
        <View
          style={[
            styles.faixaDaPeca,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          ]}
        >
          <View style={styles.trilho}>
            {FORMAS.map((forma) => (
              <Acao
                key={forma.valor}
                rotulo={forma.rotulo}
                ativa={area.forma === forma.valor}
                onPress={() => onArea({ ...area, forma: forma.valor })}
              />
            ))}

            <View style={[styles.separador, { backgroundColor: colors.border }]} />

            {ALCANCES.map((quadrados) => (
              <Acao
                key={quadrados}
                rotulo={`${quadrados * 1.5} m`.replace('.', ',')}
                ativa={area.raio === quadrados}
                onPress={() => onArea({ ...area, raio: quadrados })}
              />
            ))}
          </View>
        </View>
      )}
      {tokenSelecionado && (
        <View
          style={[
            styles.faixaDaPeca,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          ]}
        >
          <View style={styles.cabecalhoDaPeca}>
            <Text variant="small" numberOfLines={1} style={{ flex: 1 }}>
              {tokenSelecionado.name}
            </Text>

            {/* O quadrado, pelo nome que a grade mostra: é assim que a mesa
                repete a posição em voz alta sem apontar para a tela. */}
            <Text variant="caption" tone="gold">
              {nomeDaCelula(tokenSelecionado.position)}
            </Text>
            {/* A dica só para quem comanda a peça: dizer "toque no mapa para
                mover" ao jogador que selecionou o dragão do mestre é um convite
                que termina em 403 — a peça não anda e a tela não explica. */}
            <Text variant="caption" tone="muted">
              {podeMoverSelecionado ? 'toque no mapa para mover' : 'peça do mestre'}
            </Text>
            <Pressable
              onPress={onFecharSelecao}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Soltar a peça"
            >
              <Icon name="remover" size={16} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.trilho}>
            {podeMoverSelecionado && <Acao icone="voltar" rotulo="Desfazer" onPress={onDesfazer} />}

            {ehMestre && (
              <>
                <Acao
                  icone={tokenSelecionado.visible ? 'condicao' : 'info'}
                  rotulo={tokenSelecionado.visible ? 'Esconder' : 'Revelar'}
                  onPress={onEsconder}
                />

                {TAMANHOS.map((tamanho) => (
                  <Acao
                    key={tamanho.valor}
                    rotulo={tamanho.rotulo}
                    ativa={tokenSelecionado.size === tamanho.valor}
                    onPress={() => onTamanho(tamanho.valor)}
                  />
                ))}

                <Acao icone="excluir" rotulo="Tirar" onPress={onRemover} tom={colors.danger} />
              </>
            )}
          </View>
        </View>
      )}

      <View style={[styles.barra, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.trilho}>
          {ferramentas.map((ferramenta) => (
            <Acao
              key={ferramenta.modo}
              icone={ferramenta.icone}
              rotulo={ferramenta.rotulo}
              ativa={modo === ferramenta.modo}
              onPress={() => onModo(ferramenta.modo)}
            />
          ))}
        </View>

        {/* Fora da fileira de ferramentas: recentralizar não é um modo do
            tabuleiro, e perder o mapa de vista ao arrastar é fácil demais para
            a saída dividir espaço com o resto. */}
        <Acao icone="buscar" rotulo="Centralizar" onPress={onRecentralizar} />

        {/* A ficha de quem está jogando, sem sair do mapa. Fica ao lado do
            painel do mestre porque é o equivalente do jogador: o botão que
            abre o que é dele, e não uma ferramenta de desenhar no tabuleiro. */}
        {onAbrirFicha && <Acao icone="personagens" rotulo="Ficha" onPress={onAbrirFicha} />}

        {ehMestre && <Acao icone="configuracoes" rotulo="Tabuleiro" onPress={onAbrirPainel} />}
      </View>
    </View>
  );
}

function Acao({
  icone,
  rotulo,
  onPress,
  tom,
  ativa = false,
}: {
  icone?: IconName;
  rotulo: string;
  onPress: () => void;
  tom?: string;
  ativa?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: ativa }}
      accessibilityLabel={rotulo}
      style={[
        styles.ferramenta,
        {
          backgroundColor: ativa ? colors.primaryFill : 'transparent',
          borderColor: ativa ? colors.primary : 'transparent',
        },
      ]}
    >
      {icone && (
        <Icon name={icone} size={18} color={tom ?? (ativa ? colors.primaryInk : colors.textMuted)} />
      )}
      <Text
        variant="caption"
        tone={ativa ? 'default' : 'muted'}
        style={tom ? { color: tom } : undefined}
      >
        {rotulo}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  faixaDaPeca: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cabecalhoDaPeca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.xxs,
  },
  /**
   * A fileira de botões quebra em linha quando não cabe.
   *
   * Era um `ScrollView` horizontal sem barra de rolagem visível: no celular,
   * "Névoa" e "Área" ficavam além da borda, sem nada na tela dizendo que
   * havia mais coisa para o lado — e no desktop não há gesto de rolagem
   * horizontal para descobri-las. Uma barra de duas linhas custa altura;
   * um botão inalcançável custa a ferramenta inteira.
   */
  trilho: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  separador: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginHorizontal: spacing.xxs,
  },
  ferramenta: {
    alignItems: 'center',
    gap: 2,
    minWidth: 58,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
