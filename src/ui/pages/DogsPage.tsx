import { Link } from 'react-router-dom';
import { useData } from '../AppContext';
import { KCAL_SOURCE_LABEL } from '../../data/model';
import { ErrorBox } from '../components';
import { num } from '../format';

export function DogsPage() {
  const { data, error } = useData(async (repo) => {
    const [dogs, recipes] = await Promise.all([repo.listDogs(), repo.listRecipes()]);
    return { dogs, recipes };
  });
  return (
    <div>
      <div className="row between">
        <h2>I tuoi cani</h2>
        <Link className="button" to="/cani/nuovo">
          + Nuovo cane
        </Link>
      </div>
      <ErrorBox error={error} />
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
