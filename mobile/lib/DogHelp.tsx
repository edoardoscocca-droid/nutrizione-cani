// Aiuti del profilo del cane: condizione corporea (schema illustrato) e fattore energetico (intervalli orientativi).
// Si aprono sopra la schermata: chiudendoli i dati inseriti restano.

import { useState } from 'react';
import { Image, Linking, ScrollView, useWindowDimensions, View } from 'react-native';
import { ENERGY_FACTOR_HELP, type EnergyFactorCategory } from '../../src/data/formulationPresets';
import { Box, Button, Card, NumField, Row, Sheet, T, useTheme } from './ui';

const BCS_IMAGE = require('../assets/bcs-guida.jpg');
const BCS_RATIO = 1536 / 1024;
export const WSAVA_BCS_URL = 'https://wsava.org/wp-content/uploads/2020/01/Body-Condition-Score-Dog.pdf';

export function BcsHelp({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const w = width - 32;
  return (
    <Sheet visible={visible} title="Condizione corporea (BCS)" onClose={onClose}>
      <T small muted>Schema orientativo, non una tavola ufficiale. Allarga con due dita per ingrandire. Il punteggio va da 1 a 9, compresi i valori intermedi non illustrati (2, 4, 6, 8).</T>
      <ScrollView
        style={{ width: w, height: w * BCS_RATIO, borderRadius: 16 }}
        maximumZoomScale={5}
        minimumZoomScale={1}
        bouncesZoom
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        <Image source={BCS_IMAGE} style={{ width: w, height: w * BCS_RATIO }} resizeMode="contain" accessibilityLabel="Schema della condizione corporea: punteggi 1, 3, 5, 7 e 9 visti dall’alto e di lato" />
      </ScrollView>
      <Button title="Consulta la guida WSAVA" kind="secondary" small onPress={() => Linking.openURL(WSAVA_BCS_URL)} />
    </Sheet>
  );
}

/** Fattore energetico: l'utente sceglie una categoria e il numero nell'intervallo, oppure un valore personalizzato. */
export function EnergyFactorHelp({
  visible,
  onClose,
  category,
  onChoose,
}: {
  visible: boolean;
  onClose: () => void;
  category: string | null;
  onChoose: (factor: number, category: string | null) => void;
}) {
  const t = useTheme();
  const [picked, setPicked] = useState<EnergyFactorCategory | null>(null);
  const [value, setValue] = useState<number | null>(null);
  const [custom, setCustom] = useState<number | null>(null);
  const inRange = picked && value !== null && value >= picked.min && value <= picked.max;
  const close = () => {
    setPicked(null);
    setValue(null);
    onClose();
  };
  return (
    <Sheet visible={visible} title="Fattore energetico" onClose={close}>
      <T>{ENERGY_FACTOR_HELP.text}</T>
      <T small muted>Valori per il cane adulto in mantenimento. Scegli una categoria e indica il numero da usare nel suo intervallo.</T>
      {ENERGY_FACTOR_HELP.categories.map((c) => {
        const sel = picked?.id === c.id;
        return (
          <Card key={c.id} onPress={() => { setPicked(c); setValue(null); }} style={sel ? { borderWidth: 2, borderColor: t.accent } : undefined}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T style={{ flex: 1 }} bold={sel || category === c.id}>{c.label}</T>
              <T bold>{f1(c.min)}–{f1(c.max)}</T>
            </Row>
            {sel && (
              <View style={{ gap: 6 }}>
                <NumField label={`Numero da usare (tra ${f1(c.min)} e ${f1(c.max)})`} value={value} onChange={setValue} />
                {value !== null && !inRange && (
                  <Box color="orange">
                    <T small>Il valore è fuori dall’intervallo di questa categoria: per usarlo inseriscilo come fattore personalizzato.</T>
                  </Box>
                )}
                <Button title="Usa questo valore" disabled={!inRange} onPress={() => { onChoose(value as number, c.id); close(); }} />
              </View>
            )}
          </Card>
        );
      })}
      <Card>
        <T bold>Fattore personalizzato</T>
        <NumField label="Valore" value={custom} onChange={setCustom} />
        <Button title="Usa il fattore personalizzato" kind="secondary" disabled={!(custom !== null && custom > 0)} onPress={() => { onChoose(custom as number, null); close(); }} />
      </Card>
    </Sheet>
  );
}

/** una cifra decimale fissa, come negli intervalli della nutrizionista (1,0–1,2). */
export function f1(n: number) {
  return n.toFixed(1).replace('.', ',');
}

export function categoryLabel(id: string | null): EnergyFactorCategory | null {
  return ENERGY_FACTOR_HELP.categories.find((c) => c.id === id) ?? null;
}
