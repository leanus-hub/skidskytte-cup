import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import RulesRegionSelector from './rules-region-selector';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Cupregler | Regioncup Skidskytte',
  description: 'Regler för regionala skidskyttecuper.',
};

const placementPoints = [
  ['1', '15'], ['2', '13'], ['3', '12'], ['4', '11'], ['5', '10'], ['6', '9'], ['7', '8'],
  ['8', '7'], ['9', '6'], ['10', '5'], ['11', '4'], ['12', '3'], ['13', '2'], ['14 och därefter', '1'],
];

type Region = { id: string; name: string; sort_order: number };

function isSouthRegion(name?: string) {
  const normalized = name?.trim().toLocaleLowerCase('sv-SE');
  return normalized === 'syd' || normalized === 'region syd';
}

export default async function RulesPage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: regionRows } = await supabase.from('regions').select('id,name,sort_order').order('sort_order');
  const regions = (regionRows ?? []) as Region[];
  const south = regions.find(region => isSouthRegion(region.name));
  const selectedRegionId = regions.some(region => region.id === params.region)
    ? params.region!
    : south?.id ?? regions[0]?.id;
  const selectedRegion = regions.find(region => region.id === selectedRegionId);
  const isSouth = isSouthRegion(selectedRegion?.name);

  return <>
    <section className="hero compact-hero">
      <p className="eyebrow">{selectedRegion?.name ?? 'Cupregler'}</p>
      <h1>{isSouth ? 'Regler för Syd Cup' : 'Cupregler'}</h1>
      <p>{isSouth
        ? 'Så räknas den individuella cupen, klubbarnas poängkamp och medaljliga. Reglerna bygger på Region Syds cupregler och de kompletteringar som gäller för sammanställningen.'
        : 'Välj region för att se vilka regler som gäller för den regionala cupen.'}</p>
    </section>

    {regions.length > 0 && <RulesRegionSelector regions={regions} selectedRegionId={selectedRegionId} />}

    {!isSouth && <section className="card section-gap">
      <h2>Inga publicerade cupregler ännu</h2>
      <p className="muted">Det finns ännu inga regionsspecifika cupregler publicerade här för {selectedRegion?.name ?? 'vald region'}.</p>
    </section>}

    {isSouth && <>
      <div className="grid section-gap">
        <section className="card rules-card">
          <p className="eyebrow dark">Individuellt</p><h2>Resultat som räknas</h2>
          <p>Antalet deltävlingar kan variera mellan säsonger. De sämsta placeringarna stryks i den individuella cupen enligt följande:</p>
          <table><thead><tr><th>Deltävlingar</th><th>Resultat som stryks</th></tr></thead><tbody>
            <tr><td>3</td><td>0</td></tr><tr><td>4</td><td>1</td></tr><tr><td>5–7</td><td>2</td></tr><tr><td>8–10</td><td>3</td></tr><tr><td>11–14</td><td>4</td></tr>
          </tbody></table>
          <p>För att vara kvalificerad för pris ska åkaren ha deltagit i minst <strong>3 deltävlingar</strong>.</p>
        </section>

        <section className="card rules-card">
          <p className="eyebrow dark">Poäng</p><h2>Poäng per deltävling</h2>
          <div className="table-scroll"><table><thead><tr><th>Placering</th><th>Poäng</th></tr></thead><tbody>
            {placementPoints.map(([place, points]) => <tr key={place}><td>{place}</td><td><strong>{points}</strong></td></tr>)}
          </tbody></table></div>
          <p><strong>Öppen Klass:</strong> varje giltigt deltagande ger 1 deltagarpoäng oavsett placering.</p>
        </section>

        <section className="card rules-card">
          <p className="eyebrow dark">Placering</p><h2>Region och skiljekriterier</h2>
          <p>Åkare från föreningar utanför Region Syd får delta i deltävlingarna, men räknas bort innan cupplacering och poäng beräknas. Placeringarna räknas därför om utifrån deltagarna från Region Syd.</p>
          <p>Individuella poäng ges i den klass åkaren tävlar i vid respektive deltävling. En åkare kan inte få poäng i två klasser i samma deltävling.</p>
          <p>Vid lika cup-poäng avgör högst träffprocent från de deltävlingar som räknas i den individuella cupen. Är även träffprocenten lika blir placeringen delad.</p>
        </section>

        <section className="card rules-card">
          <p className="eyebrow dark">Klubbkamp</p><h2>Klubbarnas poängliga</h2>
          <p>I klubbarnas poängkamp räknas <strong>alla giltiga deltaganden</strong>. Ett resultat som stryks ur en åkares individuella cupresultat fortsätter alltså att bidra med sina deltävlingpoäng till föreningen.</p>
          <p>Öppen Klass bidrar med <strong>1 poäng per giltigt deltagande</strong> till klubbens poängliga.</p>
        </section>

        <section className="card rules-card">
          <p className="eyebrow dark">Klubbkamp</p><h2>Medaljligan</h2>
          <p>Medaljer från samtliga giltiga deltävlingar räknas. Guld ger <strong>3 medaljpoäng</strong>, silver <strong>2</strong> och brons <strong>1</strong>.</p>
          <p>Placeringen avgörs först av flest medaljpoäng, därefter flest guld och sedan flest silver. Om klubbar fortfarande är lika blir placeringen delad.</p>
          <p><strong>Öppen Klass ger inga medaljer eller medaljpoäng.</strong></p>
        </section>

        <section className="card rules-card">
          <p className="eyebrow dark">Rullskidskytte</p><h2>Utrustning</h2>
          <ul>
            <li>Hjälm är obligatorisk för alla.</li>
            <li>Knäskydd är obligatoriska till och med H/D12–13 och rekommenderas för alla.</li>
            <li>Tävlingshjul är inte tillåtna. Endast godkända träningshjul får användas.</li>
            <li>Arrangören kan kontrollera rullskidor och andra märken kan godkännas efter jämförande test enligt Region Syds regler.</li>
          </ul>
          <p className="muted">Detaljer om godkända hjul och testförfarande finns i Region Syds officiella cupregler.</p>
        </section>
      </div>

      <section className="card section-gap">
        <h2>Officiella regler</h2>
        <p>Grundreglerna för Syd Cup publiceras av Svenska Skidskytteförbundet, Region Syd. Den här sidan kompletterar dem med reglerna för Öppen Klass samt klubbarnas poäng- och medaljliga.</p>
        <a className="text-link" href="https://www.skidskytte.se/rsssf/aktiviteter/syd-cup/regler-for-syd-cup" target="_blank" rel="noreferrer">Läs Region Syds officiella regler ↗</a>
      </section>
    </>}

    <p className="section-gap"><Link className="text-link" href="/">← Till cupställningen</Link></p>
  </>;
}
