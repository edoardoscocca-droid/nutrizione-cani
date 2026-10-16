import { Link } from 'react-router-dom';
import { useApp, useData } from '../AppContext';
import { staleFor } from '../../data/recipeService';
import { KCAL_SOURCE_LABEL } from '../../data/model';
import { ErrorBox } from '../components';
import { num } from '../format';

export function DogsPage() {
  const { catalog } = useApp();
  const { data, error } = useData(async (repo) => {
    const [dogs, recipes] = await Promise.all([repo.listDogs(), repo.listRecipes()]);
    const current = await Promise.all(
      recipes.map(async (r) => {
        const vs = await repo.listVersions(r.id);
        return [r.id, vs.find((v) => v.id === r.currentVersionId) ?? vs[vs.length - 1]] as const;
      }),
    );
    return { dogs, recipes, current: new Map(current) };
  });
  const stale =
    data && catalog
      ? data.recipes.filter((r) => {
          const v = data.current.get(r.id);
          const dog = data.dogs.find((d) => d.id === r.dogId);
          return v && dog && !r.archived && staleFor(v, dog, catalog).length > 0;
        })
      : [];
  return (
    <div>
      <div className="row between">
        <h2>I tuoi cani</h2>
        <Link className="button" to="/cani/nuovo">
          + Nuovo cane
        </Link>
      </div>
      <ErrorBox error={error} />
      {stale.length > 0 && (
        <div className="box box-orange">
          <strong>{stale.length === 1 ? '1 ricetta da ricalcolare' : `${stale.length} ricette da ricalcolare`}</strong>: sono cambiati dati del catalogo o del profilo.{' '}
          {stale.map((r, i) => (
            <span key={r.id}>
              {i > 0 && ', '}
              <Link to={`/ricette/${r.id}`}>{r.name}</Link>
            </span>
          ))}
          . Nessuna è stata modificata: apri la ricetta per vedere l’anteprima e confermare.
        </div>
      )}
      {data && data.dogs.length === 0 && (
        <div className="card empty">
          <p>Nessun cane ancora. Crea il primo profilo per iniziare a formulare le ricette.</p>
        </div>
      )}
      <div className="list">
        {data?.dogs.map((d) => {
          const rs = data.recipes.filter((r) => r.dogId === d.id);
          const primary = rs.find((r) => r.isPrimary);
          return (
            <Link key={d.id} to={`/cani/${d.id}`} className="card dog-card">
              <div className="dog-avatar" aria-hidden>
                {d.name.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <strong>{d.name}</strong> <span className="muted">{d.breed || 'razza non indicata'}</span>
                <div className="small">
                  {num(d.weightCurrentKg, 1)} kg attuali · {num(d.weightIdealKg, 1)} kg ideali ·{' '}
                  {d.kcalTarget ? `${num(d.kcalTarget, 0)} kcal/die (${KCAL_SOURCE_LABEL[d.kcalSource]})` : 'kcal da impostare'}
                </div>
                <div className="small">
                  {rs.length}/10 ricette{primary ? ` · principale: ${primary.name}` : ''}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
