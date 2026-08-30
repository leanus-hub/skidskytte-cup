'use client';

import { useMemo, useState } from 'react';
import { addClubAlias, createClub, updateClubRegion } from './admin-actions';

type Region = { id: string; name: string };
type Club = {
  id: string;
  name: string;
  short_name: string | null;
  aliases: string[] | null;
  region_id: string | null;
};

const ALL = 'all';
const UNASSIGNED = 'unassigned';

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
  const validInitialRegion = initialRegionId && regions.some(region => region.id === initialRegionId)
    ? initialRegionId
    : ALL;
  const [filterRegionId, setFilterRegionId] = useState(validInitialRegion);
  const [clubId, setClubId] = useState(initialClubId ?? '');

  const filteredClubs = useMemo(() => {
    const rows = filterRegionId === ALL
      ? clubs
      : filterRegionId === UNASSIGNED
        ? clubs.filter(club => !club.region_id)
        : clubs.filter(club => club.region_id === filterRegionId);
    return [...rows].sort((a, b) => a.name.localeCompare(b.name, 'sv'));
  }, [clubs, filterRegionId]);

  const selectedClub = filteredClubs.find(club => club.id === clubId) ?? filteredClubs[0] ?? null;

  function changeRegion(nextRegionId: string) {
    setFilterRegionId(nextRegionId);
    const rows = nextRegionId === ALL
      ? clubs
      : nextRegionId === UNASSIGNED
        ? clubs.filter(club => !club.region_id)
        : clubs.filter(club => club.region_id === nextRegionId);
    const firstClub = [...rows].sort((a, b) => a.name.localeCompare(b.name, 'sv'))[0];
    setClubId(firstClub?.id ?? '');
  }

  return <section className="admin-club-layout">
    <aside className="card club-picker">
      <p className="eyebrow dark">Föreningsregister</p>
      <h2>Välj förening</h2>
      <p className="muted">Filtret visar alla föreningar, en region eller de som ännu saknar region.</p>

      <label htmlFor="club_region_filter">Filtrera på region</label>
      <select id="club_region_filter" value={filterRegionId} onChange={event => changeRegion(event.target.value)}>
        <option value={ALL}>Alla föreningar</option>
        {regions.map(region => <option key={region.id} value={region.id}>{region.name}</option>)}
        <option value={UNASSIGNED}>Saknar region</option>
      </select>

      <label htmlFor="club_select">Förening</label>
      <select
        id="club_select"
        value={selectedClub?.id ?? ''}
        onChange={event => setClubId(event.target.value)}
        disabled={filteredClubs.length === 0}
      >
        {filteredClubs.length === 0
          ? <option value="">Inga föreningar matchar filtret</option>
          : filteredClubs.map(club => <option key={club.id} value={club.id}>{club.name}</option>)}
      </select>

      <p className="muted club-count">{filteredClubs.length} av {clubs.length} föreningar visas</p>

      <hr/>
      <h3>Skapa ny förening</h3>
      <p className="muted">Används när en importerad förening verkligen är ny. Befintliga namn och alias kontrolleras för att undvika dubletter.</p>
      <form action={createClub}>
        <label htmlFor="new_club_name">Föreningsnamn</label>
        <input id="new_club_name" name="name" required placeholder="Officiellt föreningsnamn"/>

        <label htmlFor="new_club_short_name">Kortnamn</label>
        <input id="new_club_short_name" name="short_name" placeholder="Valfritt kortnamn"/>

        <label htmlFor="new_club_region">Region</label>
        <select id="new_club_region" name="region_id" required defaultValue={filterRegionId !== ALL && filterRegionId !== UNASSIGNED ? filterRegionId : ''}>
          <option value="" disabled>Välj region</option>
          {regions.map(region => <option key={region.id} value={region.id}>{region.name}</option>)}
        </select>
        <button type="submit">Skapa förening</button>
      </form>
    </aside>

    <section className="card admin-workspace">
      {selectedClub ? <>
        <p className="eyebrow dark">Redigera förening</p>
        <h2>{selectedClub.name}</h2>
        <p className="muted">Nuvarande region: {regions.find(region => region.id === selectedClub.region_id)?.name ?? 'Saknas'}</p>

        <form action={updateClubRegion} key={`${selectedClub.id}-region-form`}>
          <input type="hidden" name="club_id" value={selectedClub.id}/>
          <input type="hidden" name="return_region" value={filterRegionId === ALL || filterRegionId === UNASSIGNED ? '' : filterRegionId}/>
          <label htmlFor="edit_region">Ny region</label>
          <select id="edit_region" name="region_id" required defaultValue={selectedClub.region_id ?? ''}>
            <option value="" disabled>Välj region</option>
            {regions.map(region => <option key={region.id} value={region.id}>{region.name}</option>)}
          </select>
          <button type="submit">Spara region</button>
        </form>

        <hr/>
        <h3>Föreningsalias</h3>
        <p className="alias-box">{(selectedClub.aliases ?? []).join(', ') || 'Inga alias ännu'}</p>
        <form action={addClubAlias} key={`${selectedClub.id}-alias-form`}>
          <input type="hidden" name="club_id" value={selectedClub.id}/>
          <input type="hidden" name="return_region" value={filterRegionId === ALL || filterRegionId === UNASSIGNED ? '' : filterRegionId}/>
          <label htmlFor="club_alias">Nytt alias</label>
          <input id="club_alias" name="alias" required placeholder="Alternativt föreningsnamn"/>
          <button type="submit">Lägg till alias</button>
        </form>
      </> : <><h2>Ingen förening vald</h2><p>Byt filter eller kontrollera att föreningar finns i tabellen <code>clubs</code>.</p></>}
    </section>
  </section>;
}
