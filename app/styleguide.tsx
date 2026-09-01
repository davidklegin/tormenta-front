import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  AttributeBlock,
  Button,
  Card,
  Checkbox,
  Chip,
  DiceRoll,
  Divider,
  DropCap,
  EmptyState,
  Input,
  ProgressBar,
  Screen,
  Seal,
  SegmentedControl,
  Select,
  Sheet,
  Skeleton,
  Table,
  Text,
  ThemeToggle,
  TitlePlate,
  Toast,
  Tooltip,
} from '@/components/ui';
import { PageHeader } from '@/components/layout';
import {
  fontSize,
  ornamentAttrs,
  palettes,
  radius,
  spacing,
  stroke,
  typography,
  useMotion,
  useTheme,
  vitalColors,
  type Palette,
} from '@/theme';

/**
 * Guia de estilo.
 *
 * Existe para a mesma razão que uma prancha de referência existe num estúdio:
 * ver todas as peças juntas é a única forma de perceber que duas delas
 * discordam. Cada seção mostra um item do sistema nos dois temas — o alternador
 * fica no cabeçalho — e com movimento normal ou reduzido, pelo interruptor no
 * topo.
 *
 * A simulação de movimento reduzido não mexe na configuração do sistema: ela
 * sobrepõe a política de movimento do aplicativo, e é o mesmo caminho que a
 * preferência real percorre. O que se vê aqui é o que quem tem a preferência
 * ligada vê de verdade.
 */
export default function StyleguideScreen() {
  const { colors, theme } = useTheme();
  const { reduced, systemReduced, simulateReduced } = useMotion();

  const [texto, setTexto] = useState('');
  const [comErro, setComErro] = useState('');
  const [aba, setAba] = useState<'todas' | 'arcanas' | 'divinas'>('todas');
  const [selecao, setSelecao] = useState<string | null>('humano');
  const [marcado, setMarcado] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [avisoVisivel, setAvisoVisivel] = useState(true);
  const [cardAtivo, setCardAtivo] = useState(true);
  const [pv, setPv] = useState(24);

  return (
    <Screen contentStyle={{ maxWidth: 1080 }}>
      <View {...ornamentAttrs(reduced && 'still')}>
        <PageHeader
          title="Guia de estilo"
          subtitle={`Tormenta20 · tema ${theme === 'dark' ? 'Tempestade Rubra' : 'Pergaminho'}`}
          back
          backLabel="Voltar ao app"
        />

        <View style={{ gap: spacing.space6 }}>
          <ControleDeMovimento reduzido={reduced} doSistema={systemReduced} onChange={simulateReduced} />

          {/* ---------------- Fundamentos ---------------- */}

          <Secao numero="A" titulo="Paleta" nota="Os dois temas lado a lado. O tema em vigor está marcado.">
            <View style={{ gap: spacing.space4 }}>
              <Amostras nome="Pergaminho" paleta={palettes.light} ativo={theme === 'light'} />
              <Amostras nome="Tempestade Rubra" paleta={palettes.dark} ativo={theme === 'dark'} />
            </View>
          </Secao>

          <Secao
            numero="B"
            titulo="Tipografia"
            nota="Arial nos quatro papéis. A hierarquia vem do peso, da caixa alta e da entreletra aberta nas variantes de display — não da troca de família."
          >
            <View style={{ gap: spacing.space3 }}>
              {(
                [
                  ['display', '36 · negrito, caixa alta'],
                  ['title', '28 · negrito, caixa alta'],
                  ['heading', '22 · negrito, caixa alta'],
                  ['subheading', '18 · negrito'],
                  ['body', '16 · normal'],
                  ['small', '14 · normal'],
                  ['caption', '12 · negrito, caixa alta'],
                ] as const
              ).map(([variante, descricao]) => (
                <View key={variante} style={{ gap: spacing.xxs }}>
                  <Text variant="caption" tone="muted">
                    {variante} · {descricao}
                  </Text>
                  <Text variant={variante}>Tormenta assola Arton</Text>
                </View>
              ))}

              <View style={{ gap: spacing.xxs }}>
                <Text variant="caption" tone="muted">
                  numeric · 28 · algarismos de largura uniforme
                </Text>
                <Text variant="numeric">18 · 24 · 36</Text>
              </View>

              <Text variant="small" tone="muted">
                Escala: {Object.values(fontSize).join(' / ')} · entrelinha {typography.body.lineHeight}px no
                corpo
              </Text>
            </View>
          </Secao>

          <Secao numero="C" titulo="Espaçamento" nota="Base 4, de --space-1 a --space-8.">
            <View style={{ gap: spacing.space2 }}>
              {([1, 2, 3, 4, 5, 6, 7, 8] as const).map((passo) => {
                const valor = spacing[`space${passo}` as const];

                return (
                  <View
                    key={passo}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.space3 }}
                  >
                    <Text variant="caption" tone="muted" style={{ width: 72 }}>
                      space-{passo}
                    </Text>
                    <View style={{ height: 10, width: valor, backgroundColor: colors.primary }} />
                    <Text variant="caption" tone="muted">
                      {valor}px
                    </Text>
                  </View>
                );
              })}
            </View>
          </Secao>

          {/* ---------------- Os 19 ornamentos ---------------- */}

          <TitlePlate label="Camada de ornamentos" meta="19 itens" fullWidth />

          <Secao
            numero="1"
            titulo="Capitular"
            nota="Primeira letra na fonte de display, altura de três linhas, filete dourado na base. Só entra em texto longo — abaixo de 120 caracteres a capitular vira enfeite sem função."
          >
            <DropCap source="Livro base, p. 154">
              A Tormenta é uma anomalia que corrompe tudo o que toca. Onde ela passa, a terra apodrece, o céu
              se abre em vermelho e criaturas nascem já erradas. Nenhum reino de Arton encontrou modo de
              detê-la; os que tentaram deixaram apenas ruínas e relatos contraditórios sobre o que existe além
              da barreira de poeira.
            </DropCap>
          </Secao>

          <Secao
            numero="2"
            titulo="Divisor ornamental"
            nota="Losango central com linhas que afinam até sumir. Escala em largura sem deformar o losango, porque o losango tem lado fixo e só as linhas esticam."
          >
            <View style={{ gap: spacing.space4 }}>
              <Divider />
              <Divider label="Perícias" />
              <View style={{ width: 160, alignSelf: 'center' }}>
                <Divider size="sm" />
              </View>
            </View>
          </Secao>

          <Secao
            numero="3 e 4"
            titulo="Cantoneiras e fio de rubi"
            nota="As cantoneiras crescem de 12 para 16px e viram ouro sob o ponteiro. O fio de rubi entra deslizando quando o card fica ativo."
          >
            <View style={{ gap: spacing.space3 }}>
              <Card title="Card em repouso" subtitle="Passe o ponteiro para ver as cantoneiras">
                <Text variant="body" tone="secondary">
                  Fundo em --surface, borda de 1px em --border, cantos de no máximo 4px.
                </Text>
              </Card>

              <Card title="Card ativo" active={cardAtivo} subtitle="Fio de rubi no topo">
                <Text variant="body" tone="secondary">
                  O gradiente vai de transparente a --primary e de volta a transparente.
                </Text>
              </Card>

              <Button
                label={cardAtivo ? 'Desativar o card' : 'Ativar o card (repete o fio)'}
                variant="secondary"
                size="sm"
                onPress={() => setCardAtivo((atual) => !atual)}
              />
            </View>
          </Secao>

          <Secao
            numero="5"
            titulo="Selos de lacre"
            nota="Contorno irregular por raio assimétrico, número em negrito centralizado, sombra interna sugerindo a depressão do carimbo."
          >
            <View style={{ gap: spacing.space4 }}>
              <View
                style={{ flexDirection: 'row', gap: spacing.space3, alignItems: 'center', flexWrap: 'wrap' }}
              >
                <Seal value={12} tone="primary" size="lg" accessibilityLabel="Nível 12" />
                <Seal value="3º" tone="gold" accessibilityLabel="Terceiro círculo" />
                <Seal value="PM" tone="arcane" />
                <Seal value="✓" tone="success" accessibilityLabel="Concluído" />
                <Seal value="!" tone="warning" accessibilityLabel="Atenção" />
                <Seal value={1} tone="danger" size="sm" />
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.space2, flexWrap: 'wrap' }}>
                <Chip label="Caído" tone="danger" />
                <Chip label="Abalado" tone="warning" />
                <Chip label="Inspirado" tone="success" />
                <Chip label="Arcano" tone="arcane" />
                <Chip label="Nível 5" tone="gold" />
                <Chip label="Selecionada" tone="primary" selected />
              </View>
            </View>
          </Secao>

          <Secao
            numero="6"
            titulo="Botões"
            nota="Primário como selo cravado, com borda inferior de relevo e brilho diagonal atravessando uma vez por hover. Secundário em contorno dourado, fantasma só texto."
          >
            <View style={{ gap: spacing.space3 }}>
              <View style={{ flexDirection: 'row', gap: spacing.space2, flexWrap: 'wrap' }}>
                <Button label="Primário" onPress={() => undefined} />
                <Button label="Secundário" variant="secondary" onPress={() => undefined} />
                <Button label="Fantasma" variant="ghost" onPress={() => undefined} />
                <Button label="Perigo" variant="danger" onPress={() => undefined} />
                <Button label="Dourado" variant="gold" onPress={() => undefined} />
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.space2, flexWrap: 'wrap' }}>
                <Button label="Pequeno" size="sm" onPress={() => undefined} />
                <Button label="Médio" size="md" onPress={() => undefined} />
                <Button label="Grande" size="lg" onPress={() => undefined} />
                <Button label="Desabilitado" disabled />
                <Button label="Carregando" loading />
              </View>
            </View>
          </Secao>

          <Secao
            numero="7"
            titulo="Inputs de linha"
            nota="Sem caixa: linha inferior de 2px que vira ouro no foco, com rótulo que sobe. O erro pinta a linha e o texto de apoio."
          >
            <View style={{ gap: spacing.space5 }}>
              <Input label="Nome do personagem" value={texto} onChangeText={setTexto} />
              <Input
                label="Pontos de vida"
                value={comErro}
                onChangeText={setComErro}
                error="Informe um número entre 1 e 999."
              />
              <Input label="História" multiline hint="Campo de várias linhas para texto longo." />
              <Select
                label="Raça"
                value={selecao}
                onChange={setSelecao}
                options={[
                  { value: 'humano', label: 'Humano', description: '+2 em três atributos' },
                  { value: 'anao', label: 'Anão', description: '+2 Con, +1 Sab, −1 Des' },
                  { value: 'elfo', label: 'Elfo', description: '+2 Int, +1 Des, −1 Con' },
                ]}
              />
              <Checkbox
                label="Ignora a penalidade de armadura"
                checked={marcado}
                onChange={setMarcado}
                hint="Opção de sim ou não: desmarcada, a caixa vazia diz que a regra está desligada."
              />
            </View>
          </Secao>

          <Secao
            numero="8"
            titulo="Barra de rolagem"
            nota="Trilho em --surface-alt, polegar em --accent-soft de 8px com cantos retos, virando --accent no hover. Vale para a página e para qualquer container rolável — na web; no celular a barra é a do sistema."
          >
            <ScrollView
              style={{
                maxHeight: 120,
                borderWidth: stroke.hairline,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              }}
            >
              <View style={{ padding: spacing.space3, gap: spacing.space2 }}>
                {Array.from({ length: 12 }, (_, i) => (
                  <Text key={i} variant="small" tone="secondary">
                    Linha {i + 1} — role para ver a barra desenhada pelo tema.
                  </Text>
                ))}
              </View>
            </ScrollView>
          </Secao>

          <Secao
            numero="9"
            titulo="Dica"
            nota="Fundo --surface-alt, borda dourada, bico triangular. Entra com fade e 4px de subida. Aparece no ponteiro e no toque longo."
          >
            <View style={{ flexDirection: 'row', gap: spacing.space4, flexWrap: 'wrap' }}>
              <Tooltip
                content="Penalidade de armadura reduz Acrobacia, Furtividade e Ladinagem."
                placement="bottom"
              >
                <Chip label="Penalidade de armadura" tone="warning" />
              </Tooltip>
              <Tooltip content="A Defesa começa em 10 e soma Destreza, armadura e escudo." placement="bottom">
                <Chip label="Defesa 18" tone="primary" />
              </Tooltip>
            </View>
          </Secao>

          <Secao
            numero="10"
            titulo="Modal"
            nota="Fundo escurecido com desfoque leve, moldura dupla — borda externa e filete dourado 4px para dentro — e entrada em escala de 0.97 a 1."
          >
            <Button label="Abrir o painel" onPress={() => setModalAberto(true)} />
            <Sheet
              visible={modalAberto}
              onClose={() => setModalAberto(false)}
              title="Descanso"
              subtitle="Escolha a qualidade do descanso"
              footer={
                <Button label="Fechar" variant="secondary" fullWidth onPress={() => setModalAberto(false)} />
              }
            >
              <Text variant="body" tone="secondary">
                Um descanso confortável recupera todos os PV e PM. Um descanso ruim recupera metade. A moldura
                dupla e o desfoque separam o painel da página sem escondê-la.
              </Text>
            </Sheet>
          </Secao>

          <Secao
            numero="11"
            titulo="Abas"
            nota="A aba ativa é a placa rubra com pontas cortadas na diagonal e filetes dourados. O indicador desliza entre as abas."
          >
            <SegmentedControl
              segments={[
                { value: 'todas', label: 'Todas', badge: 12 },
                { value: 'arcanas', label: 'Arcanas', badge: 7 },
                { value: 'divinas', label: 'Divinas', badge: 5 },
              ]}
              value={aba}
              onChange={setAba}
            />
          </Secao>

          <Secao
            numero="12"
            titulo="Avisos"
            nota="Entrada em scaleY de 0.8 a 1 com origem no topo — o gesto de um pergaminho desenrolando. Ícone à esquerda em formato de selo."
          >
            <View style={{ gap: spacing.space2 }}>
              {avisoVisivel ? (
                <Toast
                  message="Ficha salva. As alterações já chegaram ao Painel do Mestre."
                  tone="success"
                  duration={0}
                  onDismiss={() => setAvisoVisivel(false)}
                />
              ) : (
                <Button
                  label="Mostrar o aviso de novo"
                  variant="secondary"
                  size="sm"
                  onPress={() => setAvisoVisivel(true)}
                />
              )}
              <Toast message="Sem conexão com o servidor. Tentando de novo." tone="danger" duration={0} />
              <Toast message="O mestre encerrou a sessão." tone="arcane" duration={0} />
            </View>
          </Secao>

          <Secao
            numero="13"
            titulo="Carregamento"
            nota="Bloco em --surface-alt com brilho dourado a 8% cruzando em 1,4s. Com movimento reduzido sobra o bloco parado, que é o que de fato comunica que algo está vindo."
          >
            <View style={{ gap: spacing.space2 }}>
              <Skeleton width="60%" height={28} />
              <Skeleton width="100%" />
              <Skeleton width="100%" />
              <Skeleton width="40%" />
            </View>
          </Secao>

          <Secao
            numero="14"
            titulo="Rolagem de dados"
            nota="O d20 gira, o número sobe contando. Vinte natural traz halo dourado e tremor; um natural pisca em vermelho e o bloco perde a cor. Nada passa de 600ms e nada bloqueia o botão."
          >
            <View style={{ flexDirection: 'row', gap: spacing.space3, flexWrap: 'wrap' }}>
              <DiceRoll modifier={5} />
              <DiceRoll label="Forçar 20" roll={() => 20} />
              <DiceRoll label="Forçar 1" roll={() => 1} />
            </View>
          </Secao>

          <Secao
            numero="15 e 16"
            titulo="Atmosfera e grão"
            nota="Já estão nesta página. No escuro há um halo rubi a 6% no alto; no claro, uma vinheta sépia nas bordas. Sobre os dois, o grão de feTurbulence a 4%. Alterne o tema no cabeçalho para comparar."
          >
            <View
              style={{
                height: 120,
                borderWidth: stroke.hairline,
                borderColor: colors.border,
                backgroundColor: colors.bg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="small" tone="muted" center>
                As duas camadas são fixas atrás do conteúdo e não rolam com a página.
              </Text>
            </View>
          </Secao>

          <Secao
            numero="17"
            titulo="Estados vazios"
            nota="Ilustrações autorais monocromáticas em traço --border com um detalhe em --accent. Baú para coleções, mapa para territórios, dado para o que depende de uma ação."
          >
            <View style={{ gap: spacing.space3 }}>
              <EmptyState
                illustration="bau"
                title="Nenhum personagem ainda"
                description="Crie o primeiro para começar a acompanhar PV, PM e condições em tempo real."
                actionLabel="Criar personagem"
                onAction={() => undefined}
              />
              <EmptyState
                illustration="mapa"
                title="Sem campanhas"
                description="Uma campanha reúne os personagens da mesa e libera o Painel do Mestre."
              />
              <EmptyState illustration="dado" title="Nenhuma rolagem registrada" />
            </View>
          </Secao>

          <Secao
            numero="18"
            titulo="Transição de tema"
            nota="O alternador fica no cabeçalho de toda tela. Na web, a raiz faz um fade de 240ms só em background-color e color — borda e sombra não transicionam, para a troca não parecer lenta. A escolha fica no localStorage e o script embutido no HTML a aplica antes do primeiro quadro."
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.space4, flexWrap: 'wrap' }}
            >
              <ThemeToggle showLabel />
              <Text variant="small" tone="secondary" style={{ flex: 1, minWidth: 200 }}>
                Recarregue a página depois de alternar: o tema volta como estava, sem piscar o tema errado
                antes.
              </Text>
            </View>
          </Secao>

          <Secao
            numero="19"
            titulo="Foco"
            nota="Anel de 2px em --accent com 2px de afastamento, por :focus-visible — inclusive nos elementos que o React Native Web gera. Navegue com Tab para percorrer os controles abaixo."
          >
            <View
              style={{ flexDirection: 'row', gap: spacing.space2, flexWrap: 'wrap', alignItems: 'center' }}
            >
              <Button label="Primeiro" variant="secondary" size="sm" onPress={() => undefined} />
              <Button label="Segundo" variant="secondary" size="sm" onPress={() => undefined} />
              <Chip label="Terceiro" onPress={() => undefined} />
              <ThemeToggle />
            </View>
          </Secao>

          {/* ---------------- Peças da ficha ---------------- */}

          <TitlePlate label="Peças da ficha" fullWidth />

          <Secao
            numero="D"
            titulo="Atributos"
            nota="Losangos com valor em algarismos de largura uniforme, borda dourada e halo rubi no ponteiro. Modificador temporário troca a borda para o azul arcano."
          >
            <AttributeGridDemo />
          </Secao>

          <Secao
            numero="E"
            titulo="PV e PM"
            nota="Trilha em --surface-alt com filete de 1px, preenchimento com gradiente sutil e transição por escala — sem recalcular layout."
          >
            <View style={{ gap: spacing.space3 }}>
              <BarraDemo rotulo="Pontos de Vida" valor={pv} maximo={42} tipo="hp" />
              <BarraDemo rotulo="Pontos de Mana" valor={18} maximo={30} tipo="mp" />

              <View style={{ flexDirection: 'row', gap: spacing.space2 }}>
                <Button
                  label="−5 PV"
                  variant="danger"
                  size="sm"
                  onPress={() => setPv((atual) => Math.max(0, atual - 5))}
                />
                <Button
                  label="+5 PV"
                  variant="secondary"
                  size="sm"
                  onPress={() => setPv((atual) => Math.min(42, atual + 5))}
                />
              </View>
            </View>
          </Secao>

          <Secao
            numero="F"
            titulo="Tabelas"
            nota="Cabeçalho em faixa rubra com texto claro, corpo zebrado entre --surface e --surface-alt, sem cantos arredondados e sem grade vertical."
          >
            <Table
              minWidth={520}
              columns={[
                {
                  key: 'nome',
                  header: 'Perícia',
                  flex: 2,
                  render: (l) => <Text variant="small">{l.nome}</Text>,
                },
                {
                  key: 'atributo',
                  header: 'Atributo',
                  width: 96,
                  render: (l) => (
                    <Text variant="caption" tone="secondary">
                      {l.atributo}
                    </Text>
                  ),
                },
                {
                  key: 'total',
                  header: 'Total',
                  width: 72,
                  align: 'right',
                  render: (l) => (
                    <Text variant="numeric" style={{ fontSize: fontSize.md }}>
                      {l.total}
                    </Text>
                  ),
                },
                {
                  key: 'treinada',
                  header: 'Treinada',
                  width: 92,
                  align: 'center',
                  render: (l) =>
                    l.treinada ? (
                      <Seal value="✦" tone="gold" size="sm" accessibilityLabel="Treinada" />
                    ) : null,
                },
              ]}
              rows={PERICIAS}
              keyExtractor={(l) => l.nome}
            />
          </Secao>

          <View style={{ height: spacing.space8 }} />
        </View>
      </View>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

const PERICIAS = [
  { nome: 'Atletismo', atributo: 'FOR', total: 9, treinada: true },
  { nome: 'Acrobacia', atributo: 'DES', total: 4, treinada: false },
  { nome: 'Fortitude', atributo: 'CON', total: 11, treinada: true },
  { nome: 'Misticismo', atributo: 'INT', total: 7, treinada: true },
  { nome: 'Percepção', atributo: 'SAB', total: 6, treinada: false },
  { nome: 'Diplomacia', atributo: 'CAR', total: 12, treinada: true },
];

const ATRIBUTOS = [
  { sigla: 'FOR', valor: '+3', detalhe: undefined },
  { sigla: 'DES', valor: '+2', detalhe: 'raça +1' },
  { sigla: 'CON', valor: '+4', detalhe: undefined },
  { sigla: 'INT', valor: '+1', detalhe: undefined },
  { sigla: 'SAB', valor: '+0', detalhe: undefined },
  { sigla: 'CAR', valor: '+5', detalhe: 'temp +2', temporario: true },
];

function AttributeGridDemo() {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.space2, justifyContent: 'center' }}>
      {ATRIBUTOS.map((atributo) => (
        <AttributeBlock
          key={atributo.sigla}
          abbreviation={atributo.sigla}
          value={atributo.valor}
          detail={atributo.detalhe}
          highlighted={Boolean(atributo.temporario)}
        />
      ))}
    </View>
  );
}

function BarraDemo({
  rotulo,
  valor,
  maximo,
  tipo,
}: {
  rotulo: string;
  valor: number;
  maximo: number;
  tipo: 'hp' | 'mp';
}) {
  const { colors } = useTheme();
  const vitais = vitalColors(colors);

  return (
    <View style={{ gap: spacing.space1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text variant="caption" tone="secondary">
          {rotulo}
        </Text>
        <Text variant="numeric" style={{ fontSize: fontSize.lg }}>
          {valor} / {maximo}
        </Text>
      </View>
      <ProgressBar
        value={valor}
        max={maximo}
        color={tipo === 'hp' ? vitais.hp : vitais.mp}
        trackColor={tipo === 'hp' ? vitais.hpTrack : vitais.mpTrack}
      />
    </View>
  );
}

/** Interruptor que simula a preferência de movimento reduzido do sistema. */
function ControleDeMovimento({
  reduzido,
  doSistema,
  onChange,
}: {
  reduzido: boolean;
  doSistema: boolean;
  onChange: (valor: boolean | null) => void;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.space3,
        flexWrap: 'wrap',
        padding: spacing.space3,
        backgroundColor: colors.surfaceAlt,
        borderWidth: stroke.hairline,
        borderColor: colors.border,
        borderLeftWidth: stroke.plate,
        borderLeftColor: colors.info,
        borderRadius: radius.md,
      }}
    >
      <View style={{ flex: 1, minWidth: 220, gap: spacing.xxs }}>
        <Text variant="smallStrong">Movimento reduzido</Text>
        <Text variant="small" tone="muted">
          {doSistema
            ? 'O aparelho já pede movimento reduzido.'
            : 'O aparelho não pede redução; use o interruptor para simular.'}
        </Text>
      </View>

      <Pressable
        onPress={() => onChange(reduzido ? false : true)}
        accessibilityRole="switch"
        accessibilityState={{ checked: reduzido }}
        accessibilityLabel="Simular movimento reduzido"
        style={{
          paddingHorizontal: spacing.space3,
          paddingVertical: spacing.space2,
          backgroundColor: reduzido ? colors.primary : 'transparent',
          borderWidth: stroke.hairline,
          borderColor: reduzido ? colors.primary : colors.borderStrong,
          borderRadius: radius.md,
        }}
      >
        <Text variant="smallStrong" style={{ color: reduzido ? colors.onPrimary : colors.textMuted }}>
          {reduzido ? 'Reduzido' : 'Normal'}
        </Text>
      </Pressable>

      <Button label="Seguir o sistema" variant="ghost" size="sm" onPress={() => onChange(null)} />
    </View>
  );
}

function Secao({
  numero,
  titulo,
  nota,
  children,
}: {
  numero: string;
  titulo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: spacing.space3 }}>
      <TitlePlate label={titulo} meta={numero} />

      {nota ? (
        <Text variant="small" tone="secondary" style={{ maxWidth: 720 }}>
          {nota}
        </Text>
      ) : null}

      {children}
    </View>
  );
}

/** Amostras de cor de uma paleta, com o nome do token do briefing. */
function Amostras({ nome, paleta, ativo }: { nome: string; paleta: Palette; ativo: boolean }) {
  const { colors } = useTheme();

  const AMOSTRAS: { chave: keyof Palette; rotulo: string }[] = [
    { chave: 'bg', rotulo: '--bg' },
    { chave: 'surface', rotulo: '--surface' },
    { chave: 'surfaceAlt', rotulo: '--surface-alt' },
    { chave: 'border', rotulo: '--border' },
    { chave: 'text', rotulo: '--text' },
    { chave: 'textMuted', rotulo: '--text-muted' },
    { chave: 'primary', rotulo: '--primary' },
    { chave: 'primaryHover', rotulo: '--primary-hover' },
    { chave: 'accent', rotulo: '--accent' },
    { chave: 'accentSoft', rotulo: '--accent-soft' },
    { chave: 'danger', rotulo: '--danger' },
    { chave: 'success', rotulo: '--success' },
    { chave: 'info', rotulo: '--info' },
  ];

  return (
    <View style={{ gap: spacing.space2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.space2 }}>
        <Text variant="subheading">{nome}</Text>
        {ativo ? <Chip label="em uso" tone="gold" compact /> : null}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.space2 }}>
        {AMOSTRAS.map(({ chave, rotulo }) => (
          <View key={rotulo} style={{ width: 104, gap: spacing.xxs }}>
            <View
              style={{
                height: 44,
                backgroundColor: paleta[chave] as string,
                borderWidth: stroke.hairline,
                borderColor: colors.borderStrong,
              }}
            />
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {rotulo}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {paleta[chave] as string}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
