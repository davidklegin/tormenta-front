import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Button, Icon, Input, Text, type IconName } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';
import type { BattleMapState } from '@/api/types';
import type { useBattleMapControls } from '@/hooks/useBattleMap';
import { mensagemDoEnvio } from '@/utils/arquivo';
import {
  alinhamentoDoRetangulo,
  formatarPixels,
  gradePermitida,
  MAIOR_GRADE,
  MENOR_GRADE,
  retanguloInicial,
  type RetanguloNaImagem,
} from './alinhamento';

type Props = {
  battleMap: BattleMapState;
  controles: ReturnType<typeof useBattleMapControls>;
  onClose: () => void;
};

/** A vista da imagem na tela: pixel da imagem × `k` + deslocamento. */
type Vista = { k: number; tx: number; ty: number };

/** O que o dedo pegou ao pousar. */
type Alvo = 'vista' | 'corpo' | 'no' | 'ne' | 'so' | 'se';

/** Quadrados que o retângulo cobre ao abrir a tela. */
const QUADRADOS_DE_PARTIDA = 2;

/** Raio, em pixels de tela, em que o dedo pega um canto do retângulo. */
const ALCANCE_DO_CANTO = 24;

/** Menor lado do retângulo, em pixels da imagem. */
const MENOR_RETANGULO = 4;

/** Acima disto a prévia da grade vira borrão e custa caro de desenhar. */
const MAXIMO_DE_LINHAS_NA_PREVIA = 400;

/**
 * Magenta: a cor que quase nenhum mapa usa. Dourado some no pergaminho,
 * branco na pedra clara, preto na caverna — e a prévia precisa ser vista por
 * cima de qualquer um.
 */
const COR_DA_PREVIA = '#FF2BD6';

/**
 * Alinhar a grade do tabuleiro à grade desenhada no mapa.
 *
 * O mestre arrasta um retângulo sobre alguns quadrados do desenho e diz
 * quantos são. Disso sai quantos pixels da imagem cabem num quadrado e onde a
 * primeira linha começa — e o tabuleiro passa a desenhar a imagem nessa
 * escala, em vez de esticá-la sobre a grade. A grade inteira resultante
 * aparece por cima da imagem enquanto ele arrasta: é olhando o corredor do
 * outro lado do mapa que se vê se a medida ficou boa.
 *
 * A tela é de propósito separada do tabuleiro: ali as peças, a névoa e as
 * coordenadas cobririam justamente as linhas desenhadas que é preciso ver, e
 * os gestos de lá (mover peça, medir) disputariam o dedo com os daqui.
 */
export function MapCalibrator({ battleMap, controles, onClose }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const grade = battleMap.grid;

  // O tamanho que o servidor leu no envio; sem ele (mapas de antes), o que o
  // navegador mediu ao carregar a imagem.
  const [imagem, setImagem] = useState<{ largura: number; altura: number } | null>(
    grade?.image_width && grade?.image_height
      ? { largura: grade.image_width, altura: grade.image_height }
      : null
  );

  const [area, setArea] = useState<{ largura: number; altura: number } | null>(null);
  const [vista, setVistaEstado] = useState<Vista>({ k: 1, tx: 0, ty: 0 });
  const [retangulo, setRetanguloEstado] = useState<RetanguloNaImagem | null>(null);
  const [quadradosX, setQuadradosX] = useState(String(QUADRADOS_DE_PARTIDA));
  const [quadradosY, setQuadradosY] = useState(String(QUADRADOS_DE_PARTIDA));
  const [erro, setErro] = useState<string | null>(null);

  // Os gestos leem daqui: um gesto que dependesse do estado seria refeito a
  // cada quadro do arrasto, e o GestureDetector cancela o que recebe de novo.
  const vistaRef = useRef(vista);
  const retanguloRef = useRef(retangulo);

  const setVista = useCallback((proxima: Vista) => {
    vistaRef.current = proxima;
    setVistaEstado(proxima);
  }, []);

  const setRetangulo = useCallback((proximo: RetanguloNaImagem) => {
    const ajustado = {
      ...proximo,
      largura: Math.max(MENOR_RETANGULO, proximo.largura),
      altura: Math.max(MENOR_RETANGULO, proximo.altura),
    };
    retanguloRef.current = ajustado;
    setRetanguloEstado(ajustado);
  }, []);

  // O retângulo nasce quando o tamanho da imagem é conhecido.
  useEffect(() => {
    if (!imagem || retanguloRef.current) return;

    setRetangulo(retanguloInicial(grade, imagem.largura, imagem.altura, QUADRADOS_DE_PARTIDA));
  }, [imagem, grade, setRetangulo]);

  /** Enquadra a imagem inteira na área. */
  const enquadrar = useCallback(() => {
    if (!imagem || !area) return;

    const k = Math.min(area.largura / imagem.largura, area.altura / imagem.altura) * 0.95;
    setVista({
      k,
      tx: (area.largura - imagem.largura * k) / 2,
      ty: (area.altura - imagem.altura * k) / 2,
    });
  }, [imagem, area, setVista]);

  const enquadrou = useRef(false);
  useEffect(() => {
    if (enquadrou.current || !imagem || !area) return;

    enquadrou.current = true;
    enquadrar();
  }, [imagem, area, enquadrar]);

  const limitesDoZoom = useRef({ minimo: 0.05, maximo: 8 });
  useEffect(() => {
    if (!imagem || !area) return;

    const cabe = Math.min(area.largura / imagem.largura, area.altura / imagem.altura);
    // Até oito pixels de tela por pixel da imagem: é o que basta para pôr a
    // linha do retângulo em cima da linha do desenho, pixel por pixel.
    limitesDoZoom.current = { minimo: cabe * 0.5, maximo: Math.max(8, cabe * 2) };
  }, [imagem, area]);

  /** Aproxima ou afasta mantendo parado o ponto `foco` da área. */
  const zoomEm = useCallback(
    (base: Vista, k: number, focoX: number, focoY: number) => {
      const { minimo, maximo } = limitesDoZoom.current;
      const proximo = Math.min(maximo, Math.max(minimo, k));
      const razao = proximo / base.k;

      setVista({
        k: proximo,
        tx: focoX - (focoX - base.tx) * razao,
        ty: focoY - (focoY - base.ty) * razao,
      });
    },
    [setVista]
  );

  /** O que está sob o ponto da tela: um canto, o retângulo ou a imagem. */
  const alvoEm = useCallback((x: number, y: number): Alvo => {
    const r = retanguloRef.current;
    if (!r) return 'vista';

    const { k, tx, ty } = vistaRef.current;
    const esquerda = tx + r.x * k;
    const topo = ty + r.y * k;
    const direita = esquerda + r.largura * k;
    const base = topo + r.altura * k;

    const cantos: [Alvo, number, number][] = [
      ['no', esquerda, topo],
      ['ne', direita, topo],
      ['so', esquerda, base],
      ['se', direita, base],
    ];

    // O canto mais perto ganha: num retângulo pequeno na tela, os quatro
    // alcances se sobrepõem, e o primeiro da lista roubaria o puxão dos outros.
    let melhor: Alvo | null = null;
    let menor = ALCANCE_DO_CANTO;
    for (const [alvo, cx, cy] of cantos) {
      const distancia = Math.hypot(x - cx, y - cy);
      if (distancia <= menor) {
        menor = distancia;
        melhor = alvo;
      }
    }
    if (melhor) return melhor;

    return x >= esquerda && x <= direita && y >= topo && y <= base ? 'corpo' : 'vista';
  }, []);

  const arrasto = useRef<{ alvo: Alvo; x: number; y: number; retangulo: RetanguloNaImagem | null; vista: Vista } | null>(null);
  const pinca = useRef<{ vista: Vista; focoX: number; focoY: number } | null>(null);

  /**
   * Um Pan só para tudo, decidindo no primeiro contato o que o dedo pegou —
   * o mesmo arranjo do tabuleiro, e pelo mesmo motivo: gestos aninhados em
   * cada canto não recebem a translação certa no React Native Web.
   *
   * O deslocamento é medido de onde o dedo pousou, e não pelo `translation`:
   * o Pan só ativa depois de alguns pixels, e é preciso que a linha acompanhe
   * o dedo desde o primeiro.
   */
  const gestos = useMemo(() => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .minDistance(1)
      .onTouchesDown((evento) => {
        // Segundo dedo: é pinça, e o arrasto em curso para onde está.
        if (evento.allTouches.length > 1) {
          arrasto.current = null;

          return;
        }

        const dedo = evento.allTouches[0];
        if (!dedo) return;

        arrasto.current = {
          alvo: alvoEm(dedo.x, dedo.y),
          x: dedo.x,
          y: dedo.y,
          retangulo: retanguloRef.current,
          vista: vistaRef.current,
        };
      })
      .onUpdate((evento) => {
        const inicio = arrasto.current;
        if (!inicio || evento.numberOfPointers > 1) return;

        const dx = evento.x - inicio.x;
        const dy = evento.y - inicio.y;

        if (inicio.alvo === 'vista' || !inicio.retangulo) {
          setVista({ ...inicio.vista, tx: inicio.vista.tx + dx, ty: inicio.vista.ty + dy });

          return;
        }

        setRetangulo(moverRetangulo(inicio.retangulo, inicio.alvo, dx / inicio.vista.k, dy / inicio.vista.k));
      })
      .onFinalize(() => {
        arrasto.current = null;
      });

    const zoom = Gesture.Pinch()
      .runOnJS(true)
      .onStart((evento) => {
        pinca.current = { vista: vistaRef.current, focoX: evento.focalX, focoY: evento.focalY };
      })
      .onUpdate((evento) => {
        const inicio = pinca.current;
        if (!inicio) return;

        zoomEm(inicio.vista, inicio.vista.k * evento.scale, inicio.focoX, inicio.focoY);
      })
      .onFinalize(() => {
        pinca.current = null;
      });

    return Gesture.Simultaneous(pan, zoom);
  }, [alvoEm, setRetangulo, setVista, zoomEm]);

  // A roda do mouse, só na web — como no tabuleiro, direto no elemento e com
  // `passive: false`, senão a página rola junto.
  const areaRef = useRef<View>(null);
  const zoomEmRef = useRef(zoomEm);
  zoomEmRef.current = zoomEm;

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const elemento = areaRef.current as unknown as HTMLElement | null;
    if (!elemento?.addEventListener) return;

    const girar = (evento: WheelEvent) => {
      evento.preventDefault();

      const unidade = evento.deltaMode === 1 ? 16 : evento.deltaMode === 2 ? 400 : 1;
      const sensibilidade = evento.ctrlKey ? 0.01 : 0.0015;
      const fator = Math.exp(-evento.deltaY * unidade * sensibilidade);
      const caixa = elemento.getBoundingClientRect();
      const atual = vistaRef.current;

      zoomEmRef.current(atual, atual.k * fator, evento.clientX - caixa.left, evento.clientY - caixa.top);
    };

    elemento.addEventListener('wheel', girar, { passive: false });

    return () => elemento.removeEventListener('wheel', girar);
  }, []);

  /** Os botões de ajuste fino: um pixel da imagem por toque. */
  const empurrar = useCallback(
    (dx: number, dy: number, dLargura: number, dAltura: number) => {
      const r = retanguloRef.current;
      if (!r) return;

      setRetangulo({ x: r.x + dx, y: r.y + dy, largura: r.largura + dLargura, altura: r.altura + dAltura });
    },
    [setRetangulo]
  );

  // No computador, as setas movem o retângulo e Shift + setas o redimensionam.
  // Alt multiplica o passo por dez.
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const tecla = (evento: KeyboardEvent) => {
      const alvo = evento.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;

      const passo = evento.altKey ? 10 : 1;
      const direcoes: Record<string, [number, number]> = {
        ArrowLeft: [-passo, 0],
        ArrowRight: [passo, 0],
        ArrowUp: [0, -passo],
        ArrowDown: [0, passo],
      };
      const direcao = direcoes[evento.key];
      if (!direcao) return;

      evento.preventDefault();
      if (evento.shiftKey) {
        empurrar(0, 0, direcao[0], direcao[1]);
      } else {
        empurrar(direcao[0], direcao[1], 0, 0);
      }
    };

    window.addEventListener('keydown', tecla);

    return () => window.removeEventListener('keydown', tecla);
  }, [empurrar]);

  const nx = Math.round(Number(quadradosX));
  const ny = Math.round(Number(quadradosY));
  const contagemValida = Number.isFinite(nx) && Number.isFinite(ny) && nx >= 1 && ny >= 1 && nx <= 100 && ny <= 100;

  const alinhamento = useMemo(
    () =>
      retangulo && imagem && contagemValida
        ? alinhamentoDoRetangulo(retangulo, nx, ny, imagem.largura, imagem.altura)
        : null,
    [retangulo, imagem, contagemValida, nx, ny]
  );

  const colunas = alinhamento ? gradePermitida(alinhamento.colunas) : null;
  const linhas = alinhamento ? gradePermitida(alinhamento.linhas) : null;

  const salvar = () => {
    if (!alinhamento || !imagem || colunas === null || linhas === null) return;

    setErro(null);

    // Três casas bastam: um milésimo de pixel não muda nada na tela, e o
    // número fica legível no banco.
    const casas = (valor: number) => Math.round(valor * 1000) / 1000;

    controles.salvarMapa.mutate(
      {
        name: battleMap.name ?? 'Tabuleiro',
        width_squares: colunas,
        height_squares: linhas,
        grid_config: {
          image_width: imagem.largura,
          image_height: imagem.altura,
          image_square_width: casas(alinhamento.quadradoX),
          image_square_height: casas(alinhamento.quadradoY),
          image_origin_x: casas(alinhamento.origemX),
          image_origin_y: casas(alinhamento.origemY),
        },
      },
      {
        onSuccess: onClose,
        onError: (falha) => setErro(mensagemDoEnvio(falha, 'Não foi possível salvar o alinhamento.')),
      }
    );
  };

  const desfazer = () => {
    setErro(null);
    controles.salvarMapa.mutate(
      {
        name: battleMap.name ?? 'Tabuleiro',
        grid_config: {
          image_square_width: null,
          image_square_height: null,
          image_origin_x: null,
          image_origin_y: null,
        },
      },
      {
        onSuccess: onClose,
        onError: (falha) => setErro(mensagemDoEnvio(falha, 'Não foi possível desfazer o alinhamento.')),
      }
    );
  };

  const aoMedirArea = (evento: LayoutChangeEvent) => {
    const { width, height } = evento.nativeEvent.layout;
    if (width > 0 && height > 0) setArea({ largura: width, altura: height });
  };

  const { k, tx, ty } = vista;

  // A grade inteira que sairia desta medida, para conferir longe do retângulo.
  const previa = useMemo(() => {
    if (!alinhamento || !imagem) return null;

    const { quadradoX, quadradoY, origemX, origemY } = alinhamento;
    const c = alinhamento.colunas;
    const l = alinhamento.linhas;
    if (c < 1 || l < 1 || c + l > MAXIMO_DE_LINHAS_NA_PREVIA) return null;

    return {
      verticais: Array.from({ length: c + 1 }, (_, i) => origemX + i * quadradoX),
      horizontais: Array.from({ length: l + 1 }, (_, i) => origemY + i * quadradoY),
      inicioX: origemX,
      inicioY: origemY,
      fimX: origemX + c * quadradoX,
      fimY: origemY + l * quadradoY,
    };
  }, [alinhamento, imagem]);

  const quadradosDesiguais =
    alinhamento !== null &&
    Math.abs(alinhamento.quadradoX - alinhamento.quadradoY) / Math.max(alinhamento.quadradoX, alinhamento.quadradoY) > 0.03;

  const foraDoLimite =
    alinhamento !== null &&
    (alinhamento.colunas > MAIOR_GRADE ||
      alinhamento.linhas > MAIOR_GRADE ||
      alinhamento.colunas < MENOR_GRADE ||
      alinhamento.linhas < MENOR_GRADE);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View
          style={[
            styles.cabecalho,
            { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border, backgroundColor: colors.surface },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text variant="heading">Alinhar a grade</Text>
            <Text variant="caption" tone="muted">
              {battleMap.name ?? 'Tabuleiro'}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Fechar sem salvar">
            <Icon name="remover" size={24} color={colors.text} />
          </Pressable>
        </View>

        <GestureDetector gesture={gestos}>
          <View ref={areaRef} style={[styles.area, { backgroundColor: '#111' }]} onLayout={aoMedirArea}>
            {battleMap.background_url && (
              <Image
                pointerEvents="none"
                source={{ uri: battleMap.background_url }}
                contentFit="fill"
                onLoad={(evento) => {
                  const { width, height } = evento.source ?? {};
                  if (width && height) setImagem((atual) => atual ?? { largura: width, altura: height });
                }}
                style={{
                  position: 'absolute',
                  left: tx,
                  top: ty,
                  width: (imagem?.largura ?? 1) * k,
                  height: (imagem?.altura ?? 1) * k,
                }}
              />
            )}

            {previa && (
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                {previa.verticais.map((x, i) => (
                  <View
                    key={`v${i}`}
                    style={[
                      styles.linhaDaPrevia,
                      {
                        left: tx + x * k,
                        top: ty + previa.inicioY * k,
                        width: 1,
                        height: (previa.fimY - previa.inicioY) * k,
                      },
                    ]}
                  />
                ))}
                {previa.horizontais.map((y, i) => (
                  <View
                    key={`h${i}`}
                    style={[
                      styles.linhaDaPrevia,
                      {
                        left: tx + previa.inicioX * k,
                        top: ty + y * k,
                        width: (previa.fimX - previa.inicioX) * k,
                        height: 1,
                      },
                    ]}
                  />
                ))}
              </View>
            )}

            {retangulo && (
              <RetanguloNaTela retangulo={retangulo} vista={vista} quadradosX={contagemValida ? nx : 1} quadradosY={contagemValida ? ny : 1} />
            )}

            {!imagem && (
              <View style={styles.centro} pointerEvents="none">
                <Text variant="small" style={{ color: '#ddd' }}>
                  {battleMap.background_url ? 'Abrindo a imagem…' : 'Este tabuleiro ainda não tem imagem de fundo.'}
                </Text>
              </View>
            )}
          </View>
        </GestureDetector>

        <ScrollView
          style={[styles.painel, { borderTopColor: colors.border, backgroundColor: colors.surface }]}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.md, gap: spacing.sm }}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="small" tone="secondary">
            Arraste o retângulo para cima de alguns quadrados do desenho e puxe os cantos até as bordas
            dele baterem nas linhas do mapa. Quanto mais quadrados ele cobrir, mais precisa fica a
            medida. Confira pela grade rosa no outro lado do mapa.
          </Text>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Input
                label="Quadrados na largura"
                value={quadradosX}
                onChangeText={setQuadradosX}
                keyboardType="number-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Quadrados na altura"
                value={quadradosY}
                onChangeText={setQuadradosY}
                keyboardType="number-pad"
                error={contagemValida ? undefined : 'De 1 a 100.'}
              />
            </View>
          </View>

          {alinhamento && colunas !== null && linhas !== null && (
            <View style={{ gap: spacing.xxs }}>
              <Text variant="small">
                1 quadrado = {formatarPixels(alinhamento.quadradoX)} × {formatarPixels(alinhamento.quadradoY)} da
                imagem
              </Text>
              <Text variant="caption" tone="muted">
                O tabuleiro fica com {colunas} × {linhas} quadrados ({(colunas * 1.5).toLocaleString('pt-BR')} ×{' '}
                {(linhas * 1.5).toLocaleString('pt-BR')} m).
              </Text>
              {foraDoLimite && (
                <Text variant="caption" tone="warning">
                  A imagem dá {alinhamento.colunas} × {alinhamento.linhas} quadrados; a grade vai de {MENOR_GRADE} a{' '}
                  {MAIOR_GRADE} em cada lado, e fica com {colunas} × {linhas}.
                </Text>
              )}
              {quadradosDesiguais && (
                <Text variant="caption" tone="warning">
                  Os quadrados medidos não são quadrados. Se o desenho não estiver esticado, confira a contagem
                  ou os cantos.
                </Text>
              )}
            </View>
          )}

          <View style={styles.ajustes}>
            <GrupoDeAjuste rotulo="Mover">
              <BotaoDeAjuste icone="voltar" giro={0} rotulo="Mover para a esquerda" onPress={() => empurrar(-1, 0, 0, 0)} />
              <BotaoDeAjuste icone="expandir" giro={180} rotulo="Mover para cima" onPress={() => empurrar(0, -1, 0, 0)} />
              <BotaoDeAjuste icone="expandir" giro={0} rotulo="Mover para baixo" onPress={() => empurrar(0, 1, 0, 0)} />
              <BotaoDeAjuste icone="voltar" giro={180} rotulo="Mover para a direita" onPress={() => empurrar(1, 0, 0, 0)} />
            </GrupoDeAjuste>
            <GrupoDeAjuste rotulo="Largura">
              <BotaoDeAjuste icone="menos" rotulo="Estreitar" onPress={() => empurrar(0, 0, -1, 0)} />
              <BotaoDeAjuste icone="mais" rotulo="Alargar" onPress={() => empurrar(0, 0, 1, 0)} />
            </GrupoDeAjuste>
            <GrupoDeAjuste rotulo="Altura">
              <BotaoDeAjuste icone="menos" rotulo="Encurtar" onPress={() => empurrar(0, 0, 0, -1)} />
              <BotaoDeAjuste icone="mais" rotulo="Alongar" onPress={() => empurrar(0, 0, 0, 1)} />
            </GrupoDeAjuste>
            <GrupoDeAjuste rotulo="Vista">
              <BotaoDeAjuste icone="telaCheia" rotulo="Ver a imagem inteira" onPress={enquadrar} />
            </GrupoDeAjuste>
          </View>

          {Platform.OS === 'web' && (
            <Text variant="caption" tone="muted">
              No teclado: setas movem, Shift + setas mudam o tamanho, Alt dá passos de 10 px. A roda do mouse
              aproxima.
            </Text>
          )}

          {erro && (
            <Text variant="small" tone="danger">
              {erro}
            </Text>
          )}

          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Button variant="secondary" label="Cancelar" onPress={onClose} style={{ flex: 1 }} />
            <Button
              label="Salvar o alinhamento"
              onPress={salvar}
              disabled={!alinhamento}
              loading={controles.salvarMapa.isPending}
              style={{ flex: 2 }}
            />
          </View>

          {grade?.image && (
            <Button
              variant="ghost"
              label="Voltar a esticar a imagem sobre a grade"
              onPress={desfazer}
              disabled={controles.salvarMapa.isPending}
            />
          )}
        </ScrollView>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** O retângulo do dedo, com a divisão em quadrados e as alças dos cantos. */
function RetanguloNaTela({
  retangulo,
  vista,
  quadradosX,
  quadradosY,
}: {
  retangulo: RetanguloNaImagem;
  vista: Vista;
  quadradosX: number;
  quadradosY: number;
}) {
  const esquerda = vista.tx + retangulo.x * vista.k;
  const topo = vista.ty + retangulo.y * vista.k;
  const largura = retangulo.largura * vista.k;
  const altura = retangulo.altura * vista.k;

  const cantos = [
    [esquerda, topo],
    [esquerda + largura, topo],
    [esquerda, topo + altura],
    [esquerda + largura, topo + altura],
  ];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={{
          position: 'absolute',
          left: esquerda,
          top: topo,
          width: largura,
          height: altura,
          borderWidth: 2,
          borderColor: COR_DA_PREVIA,
          backgroundColor: 'rgba(255,43,214,0.12)',
        }}
      />

      {Array.from({ length: Math.max(0, quadradosX - 1) }, (_, i) => (
        <View
          key={`dx${i}`}
          style={{
            position: 'absolute',
            left: esquerda + ((i + 1) * largura) / quadradosX,
            top: topo,
            width: 1,
            height: altura,
            backgroundColor: COR_DA_PREVIA,
          }}
        />
      ))}
      {Array.from({ length: Math.max(0, quadradosY - 1) }, (_, i) => (
        <View
          key={`dy${i}`}
          style={{
            position: 'absolute',
            left: esquerda,
            top: topo + ((i + 1) * altura) / quadradosY,
            width: largura,
            height: 1,
            backgroundColor: COR_DA_PREVIA,
          }}
        />
      ))}

      {cantos.map(([x, y], i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: (x ?? 0) - 9,
            top: (y ?? 0) - 9,
            width: 18,
            height: 18,
            borderRadius: 9,
            borderWidth: 3,
            borderColor: COR_DA_PREVIA,
            backgroundColor: '#fff',
          }}
        />
      ))}
    </View>
  );
}

function GrupoDeAjuste({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.xxs }}>
      <Text variant="caption" tone="muted">
        {rotulo}
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.xs }}>{children}</View>
    </View>
  );
}

function BotaoDeAjuste({
  icone,
  giro = 0,
  rotulo,
  onPress,
}: {
  icone: IconName;
  giro?: number;
  rotulo: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      style={({ pressed }) => [
        styles.botao,
        { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceAlt : colors.surface },
      ]}
    >
      <View style={{ transform: [{ rotate: `${giro}deg` }] }}>
        <Icon name={icone} size={20} color={colors.text} />
      </View>
    </Pressable>
  );
}

/**
 * O retângulo depois de o dedo andar `dx`, `dy` pixels da imagem: inteiro,
 * se pegou o meio; só aquele canto, se pegou um canto.
 */
function moverRetangulo(r: RetanguloNaImagem, alvo: Alvo, dx: number, dy: number): RetanguloNaImagem {
  switch (alvo) {
    case 'corpo':
      return { ...r, x: r.x + dx, y: r.y + dy };
    case 'no':
      return { x: r.x + dx, y: r.y + dy, largura: r.largura - dx, altura: r.altura - dy };
    case 'ne':
      return { ...r, y: r.y + dy, largura: r.largura + dx, altura: r.altura - dy };
    case 'so':
      return { ...r, x: r.x + dx, largura: r.largura - dx, altura: r.altura + dy };
    case 'se':
      return { ...r, largura: r.largura + dx, altura: r.altura + dy };
    default:
      return r;
  }
}

const styles = StyleSheet.create({
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  area: {
    flex: 1,
    overflow: 'hidden',
  },
  centro: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linhaDaPrevia: {
    position: 'absolute',
    backgroundColor: 'rgba(255,43,214,0.75)',
  },
  painel: {
    flexGrow: 0,
    maxHeight: '45%',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ajustes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  botao: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
