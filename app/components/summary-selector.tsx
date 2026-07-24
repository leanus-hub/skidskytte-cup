'use client';

import { useRouter, useSearchParams } from 'next/navigation';

type Region = { id: string; name: string };
type Cup = { id: string; name: string; region_id: string | null };

export default function SummarySelector({
  regions,
  cups,
  selectedRegionId,
  selectedCupId,
}: {
  regions: Region[];
  cups: Cup[];
  selectedRegionId?: string;
  selectedCupId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const regionCups = cups.filter(cup => cup.region_id === selectedRegionId);

  function navigate(regionId: string, cupId?: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set('region', regionId);
    if (cupId) next.set('cup', cupId);
    else next.delete('cup');
    router.push(`/?${next.toString()}`);
  }

  return (
    <section className="selector-panel" aria-label="Välj region och cup">
      <div className="selector-field">
        <label htmlFor="summary-region">Region</label>
        <select
          id="summary-region"
          value={selectedRegionId ?? ''}
          onChange={event => {
            const regionId = event.target.value;
            const firstCup = cups.find(cup => cup.region_id === regionId);
            navigate(regionId, firstCup?.id);
          }}
        >
          {regions.map(region => <option key={region.id} value={region.id}>{region.name}</option>)}
        </select>
      </div>
      <div className="selector-field">
        <label htmlFor="summary-cup">Cup</label>
        <select
          id="summary-cup"
          value={selectedCupId ?? ''}
          disabled={regionCups.length === 0}
          onChange={event => navigate(selectedRegionId ?? '', event.target.value)}
        >
          {regionCups.length === 0
            ? <option value="">Inga cuper i regionen</option>
            : regionCups.map(cup => <option key={cup.id} value={cup.id}>{cup.name}</option>)}
        </select>
      </div>
    </section>
  );
}
