'use client';

import { useMemo, useState } from 'react';
import { addClubAlias, updateClubRegion } from './admin-actions';

type Region = { id: string; name: string };
type Club = {
  id: string;
  name: string;
  short_name: string | null;
  aliases: string[] | null;
  region_id: string | null;
};

export default function ClubManager({
  regions,
  clubs,
  initialRegionId,
  initialClubId,
}: {
  regions: Region[];
  clubs: Club[];
  initialRegionId?: string;
  initialClubId?: string;
}) {
  const firstRegion = initialRegionId && regions.some(r => r.id === initialRegionId)
    ? initialRegionId
    : regions[0]?.id ?? '';
  const [regionId, setRegionId] = useState(firstRegion);

  const filteredClubs = useMemo(
    () => clubs.filter(club => club.region_id === regionId).sort((a, b) => a.name.localeCompare(b.name, 'sv')),
    [clubs, regionId],
  );

  const initialClub = initialClubId && filteredClubs.some(club => club.id === initialClubId)
    ? initialClubId
    : filteredClubs[0]?.id ?? '';
  const [clubId, setClubId] = useState(initialClub);

  const selectedClub = filteredClubs.find(club => club.id === clubId) ?? filteredClubs[0] ?? null;

  function changeRegion(nextRegionId: string) {
    setRegionId(nextRegionId);
    const firstClub = clubs
      .filter(club => club.region_id === nextRegionId)
      .sort((a, b) => a.name.localeCompare(b.name, 'sv'))[0];
    setClubId(firstClub?.id ?? '');
  }

  return <section className="admin-club-layout">
    <aside className="card club-picker">
      <h2>Regioner & föreningar</h2>
      <p className="muted">Välj först region och därefter förening. Listorna uppdateras direkt.</p>

      <label htmlFor="club_region">Region</label>
      <select id="club_region" value={regionId} onChange={event => changeRegion(event.target.value)}>
        {regions.map(region => <option key={region.id} value={region.id}>{region.name}</option>)}
      </select>

      <label htmlFor="club_select">Förening</label>
      <select
        id="club_select"
        value={selectedClub?.id ?? ''}
        onChange={event => setClubId(event.target.value)}
        disabled={filteredClubs.length === 0}
      >
        {filteredClubs.length === 0
          ? <option value="">Inga föreningar i regionen</option>
          : filteredClubs.map(club => <option key={club.id} value={club.id}>{club.name}</option>)}
      </select>

      <p className="muted club-count">{filteredClubs.length} föreningar i vald region</p>
    </aside>

    <section className="card admin-workspace">
      {selectedClub ? <>
        <p className="eyebrow dark">Redigera förening</p>
        <h2>{selectedClub.name}</h2>

        <form action={updateClubRegion}>
          <input type="hidden" name="club_id" value={selectedClub.id}/>
          <input type="hidden" name="return_region" value={regionId}/>
          <label htmlFor="edit_region">Föreningens region</label>
          <select id="edit_region" name="region_id" required defaultValue={selectedClub.region_id ?? regionId} key={`${selectedClub.id}-region`}>
            {regions.map(region => <option key={region.id} value={region.id}>{region.name}</option>)}
          </select>
          <button type="submit">Spara region</button>
        </form>

        <hr/>
        <h3>Föreningsalias</h3>
        <p className="alias-box">{(selectedClub.aliases ?? []).join(', ') || 'Inga alias ännu'}</p>
        <form action={addClubAlias}>
          <input type="hidden" name="club_id" value={selectedClub.id}/>
          <input type="hidden" name="return_region" value={regionId}/>
          <label htmlFor="club_alias">Nytt alias</label>
          <input id="club_alias" name="alias" required placeholder="Alternativt föreningsnamn"/>
          <button type="submit">Lägg till alias</button>
        </form>
      </> : <p>Inga föreningar hittades i den valda regionen.</p>}
    </section>
  </section>;
}
