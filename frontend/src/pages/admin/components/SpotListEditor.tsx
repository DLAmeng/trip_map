import { SpotEditorCard } from './SpotEditorCard';
import type { SpotItem } from '../../../types/trip';

interface SpotListEditorProps {
  spots: SpotItem[];
  onUpdateSpot: (id: string, payload: Partial<SpotItem>) => void;
  onDeleteSpot: (id: string) => void;
  onAddSpot: (spot: SpotItem) => void;
}

export function SpotListEditor({ spots, onUpdateSpot, onDeleteSpot, onAddSpot }: SpotListEditorProps) {
  const handleAdd = () => {
    const lastSpot = spots[spots.length - 1];
    const newSpot: SpotItem = {
      id: `spot-${Date.now()}`,
      day: lastSpot ? lastSpot.day : 1,
      order: lastSpot ? lastSpot.order + 1 : 1,
      name: '新景点',
      city: lastSpot ? lastSpot.city : '',
      area: '',
      lat: lastSpot ? lastSpot.lat + 0.001 : 35.6895,
      lng: lastSpot ? lastSpot.lng + 0.001 : 139.6917,
      mustVisit: false,
      type: 'spot',
    };
    onAddSpot(newSpot);
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>景点列表 ({spots.length})</h2>
        <button className="btn btn-primary" onClick={handleAdd}>+ 新增景点</button>
      </div>
      <div className="card-list">
        {spots.map((spot) => (
          <SpotEditorCard
            key={spot.id}
            spot={spot}
            onUpdate={(payload) => onUpdateSpot(spot.id, payload)}
            onDelete={() => onDeleteSpot(spot.id)}
          />
        ))}
        {spots.length === 0 && (
          <div className="empty-state">还没有景点，点击上方按钮添加。</div>
        )}
      </div>
    </section>
  );
}
