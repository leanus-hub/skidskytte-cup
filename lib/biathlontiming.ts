import * as cheerio from 'cheerio';

export type ImportedResult = {
  className: string;
  place: number | null;
  bib: number | null;
  athleteName: string;
  clubName: string;
  status: 'OK' | 'DNS' | 'DNF' | 'DSQ' | 'UNKNOWN';
  totalTimeMs: number | null;
  shooting: number[];
  shootingHits: number | null;
  shootingShots: number | null;
  raw: Record<string, unknown>;
};

export type ImportedRace = {
  title: string | null;
  results: ImportedResult[];
  sourceUsed: string;
  warnings: string[];
};

const clean = (value: string) => value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const normalizeHeader = (value: string) => clean(value).toLocaleLowerCase('sv-SE').replace(/[.]/g, '');

function parseInteger(value: string): number | null {
  const match = clean(value).match(/^-?\d+$/);
  return match ? Number(match[0]) : null;
}

function parseTimeMs(value: string): number | null {
  const text = clean(value).replace(/^\+/, '');
  if (!text || text === '-' || !/^\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?$/.test(text)) return null;
  const parts = text.replace(',', '.').split(':').map(Number);
  let seconds = 0;
  if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
  else seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  return Math.round(seconds * 1000);
}

function parseStatus(rowText: string, placeText: string): ImportedResult['status'] {
  const value = `${rowText} ${placeText}`.toUpperCase();
  if (/\bDNS\b|EJ START|STARTADE EJ/.test(value)) return 'DNS';
  if (/\bDNF\b|BRUTIT|BRÖT/.test(value)) return 'DNF';
  if (/\bDSQ\b|DISK/.test(value)) return 'DSQ';
  return parseInteger(placeText) ? 'OK' : 'UNKNOWN';
}

function parseShooting(values: string[]): { misses: number[]; hits: number | null; shots: number | null } {
  const misses: number[] = [];
  for (const raw of values) {
    const value = clean(raw);
    if (!value || value === '-') continue;
    if (/^\d+$/.test(value)) {
      // BiathlonTiming often renders one miss digit per shooting series, e.g. 110 or 2 1 0.
      if (value.length > 1) misses.push(...value.split('').map(Number));
      else misses.push(Number(value));
    }
  }
  if (!misses.length || misses.some(n => n < 0 || n > 5)) return { misses: [], hits: null, shots: null };
  const shots = misses.length * 5;
  return { misses, shots, hits: shots - misses.reduce((sum, n) => sum + n, 0) };
}

function headerIndex(headers: string[], candidates: RegExp[]) {
  return headers.findIndex(header => candidates.some(candidate => candidate.test(header)));
}

function parseHtml(html: string, sourceUsed: string): ImportedRace {
  const $ = cheerio.load(html);
  const warnings: string[] = [];
  const title = clean($('h1').first().text() || $('title').text()) || null;
  const results: ImportedResult[] = [];

  $('table').each((_, table) => {
    const headerCells = $(table).find('thead tr').last().find('th,td').map((__, el) => normalizeHeader($(el).text())).get();
    let headers = headerCells;
    if (!headers.length) headers = $(table).find('tr').first().find('th,td').map((__, el) => normalizeHeader($(el).text())).get();

    const placeIdx = headerIndex(headers, [/^plac/, /^rank/, /^plats/]);
    const bibIdx = headerIndex(headers, [/^nr$/, /^startnr/, /^bib/]);
    const nameIdx = headerIndex(headers, [/^namn/, /^name/, /^åkare/]);
    const clubIdx = headerIndex(headers, [/^klubb/, /^club/, /^förening/]);
    const totalIdx = headerIndex(headers, [/totaltid/, /^total$/, /^tid$/]);
    const statusIdx = headerIndex(headers, [/status/, /kommentar/]);
    const shootingIndices = headers.map((header, index) => (/^(l|s|skytte|shoot|bom)/.test(header) ? index : -1)).filter(index => index >= 0);

    if (nameIdx < 0 || clubIdx < 0) return;

    let className = clean($(table).prevAll('h1,h2,h3,h4,h5,.class-name,.card-title').first().text());
    if (!className) className = clean($(table).find('caption').text());
    if (!className) className = 'Okänd klass';

    $(table).find('tbody tr').each((__, tr) => {
      const cells = $(tr).find('td').map((___, td) => clean($(td).text())).get();
      if (!cells.length) return;
      const athleteName = cells[nameIdx] ?? '';
      const clubName = cells[clubIdx] ?? '';
      if (!athleteName || !clubName || /namn/i.test(athleteName)) return;
      const placeText = placeIdx >= 0 ? cells[placeIdx] ?? '' : '';
      const rowText = cells.join(' ');
      const shooting = parseShooting(shootingIndices.map(index => cells[index] ?? ''));
      results.push({
        className,
        place: parseInteger(placeText),
        bib: bibIdx >= 0 ? parseInteger(cells[bibIdx] ?? '') : null,
        athleteName,
        clubName,
        status: parseStatus(statusIdx >= 0 ? cells[statusIdx] ?? rowText : rowText, placeText),
        totalTimeMs: totalIdx >= 0 ? parseTimeMs(cells[totalIdx] ?? '') : null,
        shooting: shooting.misses,
        shootingHits: shooting.hits,
        shootingShots: shooting.shots,
        raw: { headers, cells },
      });
    });
  });

  if (!results.length) warnings.push('Inga resultat kunde läsas ur HTML-tabellerna.');
  return { title, results, sourceUsed, warnings };
}

function collectObjects(value: unknown, output: Record<string, unknown>[]) {
  if (Array.isArray(value)) for (const item of value) collectObjects(item, output);
  else if (value && typeof value === 'object') {
    output.push(value as Record<string, unknown>);
    for (const item of Object.values(value as Record<string, unknown>)) collectObjects(item, output);
  }
}

function stringValue(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) if (typeof obj[key] === 'string' || typeof obj[key] === 'number') return clean(String(obj[key]));
  return '';
}

function parseJson(value: unknown, sourceUsed: string): ImportedRace {
  const root = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const klassResults = Array.isArray(root.klassResults) ? root.klassResults : [];
  const results: ImportedResult[] = [];

  for (const klassValue of klassResults) {
    if (!klassValue || typeof klassValue !== 'object') continue;
    const klass = klassValue as Record<string, unknown>;
    const className = stringValue(klass, ['klassName', 'className', 'ClassName']) || 'Okänd klass';
    const participants = Array.isArray(klass.participants) ? klass.participants : [];

    for (const participantValue of participants) {
      if (!participantValue || typeof participantValue !== 'object') continue;
      const participant = participantValue as Record<string, unknown>;
      const athleteName = stringValue(participant, ['name', 'athleteName', 'fullName']);
      const clubName = stringValue(participant, ['club', 'clubName', 'organization']);
      if (!athleteName || !clubName) continue;

      const placeText = stringValue(participant, ['place', 'rank']);
      const prone = stringValue(participant, ['misses']);
      const standing = stringValue(participant, ['missesStanding']);
      const shooting = parseShooting([prone, standing]);

      results.push({
        className,
        place: parseInteger(placeText),
        bib: parseInteger(stringValue(participant, ['bib', 'startNumber'])),
        athleteName,
        clubName,
        status: parseStatus(stringValue(participant, ['status', 'comment']), placeText),
        totalTimeMs: parseTimeMs(stringValue(participant, ['totalTime', 'raceTime'])),
        shooting: shooting.misses,
        shootingHits: shooting.hits,
        shootingShots: shooting.shots,
        raw: participant,
      });
    }
  }

  // Fallback for possible older/generic BiathlonTiming JSON shapes.
  if (!results.length) {
    const objects: Record<string, unknown>[] = [];
    collectObjects(value, objects);
    for (const obj of objects) {
      const athleteName = stringValue(obj, ['name', 'Name', 'athleteName', 'AthleteName', 'fullName', 'FullName']);
      const clubName = stringValue(obj, ['club', 'Club', 'clubName', 'ClubName', 'organization', 'Organisation']);
      const className = stringValue(obj, ['class', 'Class', 'className', 'ClassName', 'klassName', 'category', 'Category']);
      if (!athleteName || !clubName || !className) continue;
      const placeText = stringValue(obj, ['place', 'Place', 'rank', 'Rank']);
      const shooting = parseShooting([
        stringValue(obj, ['misses', 'Misses', 'shooting', 'Shooting']),
        stringValue(obj, ['missesStanding', 'MissesStanding']),
      ]);
      results.push({
        className,
        place: parseInteger(placeText),
        bib: parseInteger(stringValue(obj, ['bib', 'Bib', 'startNumber', 'StartNumber'])),
        athleteName,
        clubName,
        status: parseStatus(stringValue(obj, ['status', 'Status']), placeText),
        totalTimeMs: parseTimeMs(stringValue(obj, ['totalTime', 'TotalTime', 'time', 'Time'])),
        shooting: shooting.misses,
        shootingHits: shooting.hits,
        shootingShots: shooting.shots,
        raw: obj,
      });
    }
  }

  const title = stringValue(root, ['name', 'raceName', 'title']) || null;
  return { title, results, sourceUsed, warnings: results.length ? [] : ['Inga resultat kunde läsas ur JSON-svaret.'] };
}

async function fetchSource(url: string) {
  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
    headers: {
      accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
      'user-agent': 'Mozilla/5.0 (compatible; SydCupImporter/1.0; +https://skidskytte-cup.vercel.app)',
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const contentType = response.headers.get('content-type') ?? '';
  const body = await response.text();
  if (/json/i.test(contentType) || /^[\s]*[\[{]/.test(body)) {
    try { return parseJson(JSON.parse(body), url); } catch { /* continue as HTML */ }
  }
  return parseHtml(body, url);
}

export async function importBiathlonTiming(raceId: string, sourceUrl: string): Promise<ImportedRace> {
  const candidates = [
    `https://biathlontiming-cdn-endpoint.azureedge.net/rest/results/${encodeURIComponent(raceId)}`,
    sourceUrl,
  ];
  const errors: string[] = [];
  for (const candidate of [...new Set(candidates)]) {
    try {
      const parsed = await fetchSource(candidate);
      if (parsed.results.length) return parsed;
      errors.push(`${candidate}: ${parsed.warnings.join(' ')}`);
    } catch (error) {
      errors.push(`${candidate}: ${error instanceof Error ? error.message : 'okänt fel'}`);
    }
  }
  throw new Error(`BiathlonTiming kunde nås men inga resultat kunde tolkas. ${errors.join(' | ')}`);
}
