import { packageReferences } from '../src/data/packageCatalog';
import { TEST_FOODS, TEST_SUPPLEMENTS } from '../src/data/testFixtures';
import type { FormulationInput } from '../src/engine/formulate';
import { DEFAULT_SETTINGS, type DogFormulationProfile, type ItemConstraint } from '../src/engine/types';

export const refs = packageReferences();

export function dog(over: Partial<DogFormulationProfile> = {}): DogFormulationProfile {
  return {
    id: 'dog1', name: 'Fido', breed: 'meticcio', lifeStage: 'adult_maintenance',
    weightCurrentKg: 30, weightIdealKg: 30, kcalTarget: 1400, targets: [], attentionNotes: [], formulationRevision: 1,
    ...over,
  };
}

export const food = (id: string) => {
  const f = TEST_FOODS.find((x) => x.id === id);
  if (!f) throw new Error(id);
  return f;
};
export const supplement = (id: string) => {
  const s = TEST_SUPPLEMENTS.find((x) => x.id === id);
  if (!s) throw new Error(id);
  return s;
};

export function input(foods: string[], supps: string[], over: Partial<FormulationInput> = {}, constraints: Record<string, ItemConstraint> = {}): FormulationInput {
  return {
    dog: dog(),
    foods: foods.map((id) => ({ food: food(id), constraint: constraints[id] })),
    supplements: supps.map((id) => ({ supplement: supplement(id), constraint: constraints[id] })),
    nutrients: refs.nutrients,
    limits: refs.limits,
    dietMoisture: 'wet',
    settings: DEFAULT_SETTINGS,
    catalogForSuggestions: { foods: TEST_FOODS, supplements: TEST_SUPPLEMENTS },
    ...over,
  };
}
