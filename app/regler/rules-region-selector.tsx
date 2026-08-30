'use client';

import { useRouter, useSearchParams } from 'next/navigation';

type Region = { id: string; name: string };

export default function RulesRegionSelector({
  regions,
  selectedRegionId,
}: {
  regions: Region[];
  selectedRegionId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <section className="selector-panel" aria-label="Välj region för cupregler">
      <div className="selector-field">
        <label htmlFor="rules-region">Region</label>
        <select
          id="rules-region"
          value={selectedRegionId ?? ''}
          onChange={event => {
            const next = new URLSearchParams(searchParams.toString());
            next.set('region', event.target.value);
            router.push(`/regler?${next.toString()}`);
          }}
        >
          {regions.map(region => (
            <option key={region.id} value={region.id}>{region.name}</option>
          ))}
        </select>
      </div>
    </section>
  );
}
