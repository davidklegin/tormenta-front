import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Button, Divider, Icon, Input, SegmentedControl, Sheet, Text } from '@/components/ui';
import { useStageItems } from '@/hooks/useStage';
import { formDeImagem, prepararImagemParaUpload } from '@/utils/imagem';
import { radius, spacing, useTheme } from '@/theme';
import type { BattleMapState } from '@/api/types';
import type { useBattleMapControls } from '@/hooks/useBattleMap';
import { nomeDaForma } from './geometry';

type Props = {
  visible: boolean;
  onClose: () => void;
  campaignId: number;
  battleMap: BattleMapState;
  controles: ReturnType<typeof useBattleMapControls>;
};

type Aba = 'mapa' | 'pecas';

/**
 * O painel do mestre.
 *
 * Junta num lugar só o que se faz *entre* os lances: montar o mapa, trazer o
 * grupo, pôr os inimigos. Fica fora do tabuleiro porque durante a luta a tela
 * inteira é o mapa — abrir isto é um gesto deliberado, não algo em que se
 * esbarra ao arrastar uma peça.
 */
export function MasterBoardSheet({ visible, onClose, campaignId, battleMap, controles }: Props) {
  const { colors } = useTheme();
  const [aba, setAba] = useState<Aba>('mapa');

  return (
    <Sheet visible={visible} onClose={onClose} title="Tabuleiro" subtitle="Controles do mestre">
      <SegmentedControl
        segments={[
          { value: 'mapa', label: 'Mapa' },
          { value: 'pecas', label: 'Peças', badge: battleMap.tokens.length },
        ]}
        value={aba}
        onChange={setAba}
      />

      <View style={{ height: spacing.md }} />

      {aba === 'mapa' ? (
        <AbaDoMapa battleMap={battleMap} controles={controles} />
      ) : (
        <AbaDasPecas campaignId={campaignId} battleMap={battleMap} controles={controles} />
      )}
    </Sheet>
  );
}

function AbaDoMapa({
  battleMap,
  controles,
}: {
  battleMap: BattleMapState;
  controles: Props['controles'];
}) {
  const { colors } = useTheme();

  const [nome, setNome] = useState(battleMap.name ?? 'Novo tabuleiro');
  const [largura, setLargura] = useState(String(battleMap.grid?.width ?? 20));
  const [altura, setAltura] = useState(String(battleMap.grid?.height ?? 15));
  const [erro, setErro] = useState<string | null>(null);

  /**
   * As caixas acompanham o tabuleiro quando ele muda por fora.
   *
   * Elas nasciam com o valor do primeiro render e ficavam paradas ali. Subir
   * uma imagem de fundo reencaixa a altura na proporção da imagem — e como o
   * botão que sobe a imagem está neste mesmo painel, o campo "Altura" ficava
   * mostrando o número velho. O toque seguinte em "Salvar o mapa" mandava esse
   * número velho de volta e desfazia o encaixe, deixando a grade do aplicativo
   * fora da grade desenhada no mapa. O mesmo valia para o que chega pelo
   * WebSocket com o painel aberto.
   */
  useEffect(() => {
    setLargura(String(battleMap.grid?.width ?? 20));
    setAltura(String(battleMap.grid?.height ?? 15));
  }, [battleMap.grid?.width, battleMap.grid?.height]);

  useEffect(() => {
    setNome(battleMap.name ?? 'Novo tabuleiro');
  }, [battleMap.name]);

  const salvar = () => {
    const l = Number(largura);
    const a = Number(altura);

    if (!Number.isFinite(l) || !Number.isFinite(a) || l < 5 || a < 5 || l > 100 || a > 100) {
      setErro('A grade vai de 5 a 100 quadrados em cada lado.');

      return;
    }

    setErro(null);
    controles.salvarMapa.mutate({
      name: nome.trim() || 'Tabuleiro',
      width_squares: Math.round(l),
      height_squares: Math.round(a),
      state: battleMap.state === 'ended' || battleMap.state === null ? 'preparing' : battleMap.state,
    });
  };

  const escolherFundo = async () => {
    const resultado = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });

    if (resultado.canceled || !resultado.assets[0]) return;

    const imagem = await prepararImagemParaUpload(resultado.assets[0], 'mapa');

    controles.enviarFundo.mutate(await formDeImagem('image', imagem));
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <Input label="Nome" value={nome} onChangeText={setNome} placeholder="Cripta de Tannah-Toh" />

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Input label="Largura" value={largura} onChangeText={setLargura} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            label="Altura"
            value={altura}
            onChangeText={setAltura}
            keyboardType="number-pad"
            error={erro ?? undefined}
          />
        </View>
      </View>

      <Text variant="caption" tone="muted">
        Em quadrados de 1,5 m. {largura || '?'} × {altura || '?'} quadrados ={' '}
        {(Number(largura) || 0) * 1.5} × {(Number(altura) || 0) * 1.5} m.
      </Text>

      <View style={{ height: spacing.md }} />

      {battleMap.background_url && (
        <Image
          source={{ uri: battleMap.background_url }}
          style={{ width: '100%', height: 120, borderRadius: radius.md }}
          contentFit="cover"
        />
      )}

      <View style={{ height: spacing.sm }} />

      <Button
        variant="secondary"
        onPress={escolherFundo}
        loading={controles.enviarFundo.isPending}
        label={battleMap.background_url ? 'Trocar a imagem de fundo' : 'Escolher imagem de fundo'}
      />

      <View style={{ height: spacing.sm }} />

      <Button label="Salvar o mapa" onPress={salvar} loading={controles.salvarMapa.isPending} />

      <Divider />

      <Text variant="small" tone="muted">
        Estado do tabuleiro
      </Text>
      <View style={{ height: spacing.xs }} />
      <SegmentedControl
        segments={[
          { value: 'preparing', label: 'Preparando' },
          { value: 'active', label: 'Em combate' },
          { value: 'paused', label: 'Pausado' },
        ]}
        value={battleMap.state === 'ended' || !battleMap.state ? 'preparing' : battleMap.state}
        onChange={(estado) =>
          controles.salvarMapa.mutate({
            name: battleMap.name ?? 'Tabuleiro',
            state: estado as 'preparing' | 'active' | 'paused',
          })
        }
      />

      <Divider />

      {battleMap.fog_regions.length > 0 && (
        <>
          <Button
            variant="secondary"
            label={`Revelar tudo (${battleMap.fog_regions.length} área${battleMap.fog_regions.length > 1 ? 's' : ''} coberta${battleMap.fog_regions.length > 1 ? 's' : ''})`}
            onPress={() => controles.salvarNevoa.mutate([])}
            loading={controles.salvarNevoa.isPending}
          />
          <View style={{ height: spacing.sm }} />
        </>
      )}

      {battleMap.area_effects.length > 0 && (
        <>
          <Text variant="small" tone="muted">
            Áreas marcadas
          </Text>
          <View style={{ height: spacing.xs }} />
          {battleMap.area_effects.map((efeito) => (
            <Pressable
              key={efeito.id}
              onPress={() => controles.removerArea.mutate(efeito.id)}
              style={[styles.linha, { borderColor: colors.border }]}
            >
              <Text variant="small" style={{ flex: 1 }}>
                {efeito.label ?? nomeDaForma(efeito.shape)} — {efeito.x}, {efeito.y}
              </Text>
              <Icon name="excluir" size={16} color={colors.danger} />
            </Pressable>
          ))}
          <View style={{ height: spacing.sm }} />
        </>
      )}

      <Button
        variant="secondary"
        label="Guardar o tabuleiro"
        onPress={() => controles.guardarTabuleiro.mutate()}
        loading={controles.guardarTabuleiro.isPending}
      />
      <Text variant="caption" tone="muted" center style={{ marginTop: spacing.xxs }}>
        O mapa fica salvo; só sai da tela da mesa.
      </Text>
    </ScrollView>
  );
}

function AbaDasPecas({
  campaignId,
  battleMap,
  controles,
}: {
  campaignId: number;
  battleMap: BattleMapState;
  controles: Props['controles'];
}) {
  const { colors } = useTheme();
  const acervo = useStageItems(campaignId, { kind: 'npc' });

  const jaNoMapa = new Set(
    battleMap.tokens.filter((t) => t.entity_type === 'stage_item').map((t) => t.entity_id)
  );

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <Button
        label="Trazer o grupo para o mapa"
        onPress={() => controles.adicionarGrupo.mutate()}
        loading={controles.adicionarGrupo.isPending}
      />
      <Text variant="caption" tone="muted" center style={{ marginTop: spacing.xxs }}>
        Põe as fichas da mesa que ainda não estão no tabuleiro.
      </Text>

      <Divider />

      <Text variant="small" tone="muted">
        Do acervo
      </Text>
      <View style={{ height: spacing.xs }} />

      {acervo.data?.length ? (
        acervo.data.map((peca) => (
          <Pressable
            key={peca.id}
            onPress={() =>
              controles.adicionarToken.mutate({
                entity_type: 'stage_item',
                entity_id: peca.id,
                position_x: 0,
                position_y: 0,
                size: 1,
              })
            }
            style={[styles.linha, { borderColor: colors.border }]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="small" numberOfLines={1}>
                {peca.title}
              </Text>
              {peca.subtitle && (
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {peca.subtitle}
                </Text>
              )}
            </View>
            {jaNoMapa.has(peca.id) && (
              <Text variant="caption" tone="muted">
                no mapa
              </Text>
            )}
            <Icon name="adicionarCirculo" size={18} color={colors.primary} />
          </Pressable>
        ))
      ) : (
        <Text variant="caption" tone="muted">
          {acervo.isLoading
            ? 'Abrindo o acervo…'
            : 'Nenhum NPC no acervo desta campanha. Cadastre um em Acervo para trazê-lo ao mapa.'}
        </Text>
      )}

      <Divider />

      <Button
        variant="secondary"
        label="Marcador sem ficha"
        onPress={() =>
          controles.adicionarToken.mutate({
            entity_type: 'generic',
            position_x: 0,
            position_y: 0,
            label: 'Marcador',
            size: 1,
          })
        }
        loading={controles.adicionarToken.isPending}
      />
      <Text variant="caption" tone="muted" center style={{ marginTop: spacing.xxs }}>
        Para o que não tem ficha: um barril, uma armadilha, o corpo caído.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
