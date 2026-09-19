'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) redirect('/admin/login?error=not-admin');
  return supabase;
}

async function requireOpenCup(supabase: Awaited<ReturnType<typeof requireAdmin>>, cupId: string, returnTo: string) {
  const { data: cup, error } = await supabase.from('cups').select('lifecycle_status').eq('id', cupId).single();
  if (error || !cup) redirect(`${returnTo}&error=cup-not-found`);
  if (cup.lifecycle_status === 'completed') redirect(`${returnTo}&error=cup-completed`);
}

async function requireOpenRaceCup(supabase: Awaited<ReturnType<typeof requireAdmin>>, raceId: string, returnTo: string) {
  const { data: race, error } = await supabase.from('races').select('cup_id').eq('id', raceId).single();
  if (error || !race) redirect(`${returnTo}&error=race-not-found`);
  await requireOpenCup(supabase, race.cup_id, returnTo);
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = text(formData, 'email');
  const password = text(formData, 'password');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect('/admin/login?error=login');
  redirect('/admin');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}

export async function createSeason(formData: FormData) {
  const supabase = await requireAdmin();
  const name = text(formData, 'name');
  const startsOn = text(formData, 'starts_on');
  const endsOn = text(formData, 'ends_on');
  const isActive = text(formData, 'is_active') === 'true';
  if (!name || !startsOn || !endsOn) redirect('/admin?section=season&error=season-fields');
  const { error } = await supabase.from('seasons').insert({ name, starts_on: startsOn, ends_on: endsOn, is_active: isActive });
  if (error) redirect(`/admin?section=season&error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin');
  redirect('/admin?section=season&success=season-created');
}

export async function createCup(formData: FormData) {
  const supabase = await requireAdmin();
  const seasonId = text(formData, 'season_id');
  const name = text(formData, 'name');
  const cupType = text(formData, 'cup_type');
  const regionId = text(formData, 'region_id');
  const rulesetId = text(formData, 'ruleset_id');

  if (!seasonId || !name || !['sommar', 'vinter'].includes(cupType) || !regionId || !rulesetId) {
    redirect('/admin?section=cup&error=cup-fields');
  }

  const { error } = await supabase.from('cups').insert({
    season_id: seasonId,
    name,
    cup_type: cupType,
    competition_scope: 'region',
    region_id: regionId,
    ruleset_id: rulesetId,
    min_races_for_prize: (await supabase.from('cup_rulesets').select('min_races_for_prize').eq('id', rulesetId).single()).data?.min_races_for_prize ?? 3,
    active: true,
  });

  if (error) redirect(`/admin?section=cup&error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin');
  redirect('/admin?section=cup&success=cup-created');
}

export async function updateCupSettings(formData: FormData) {
  const supabase = await requireAdmin();
  const cupId=text(formData,'cup_id'), name=text(formData,'name'), rulesetId=text(formData,'ruleset_id');
  const minRaces=Number(text(formData,'min_races_for_prize')||'3');
  const active=text(formData,'active')==='true';
  const lifecycleStatus=text(formData,'lifecycle_status')||'ongoing';
  if(!cupId||!name||!rulesetId||!Number.isInteger(minRaces)||minRaces<0||!['planned','ongoing','completed'].includes(lifecycleStatus)) redirect('/admin?section=cup&error=cup-settings');
  const {data:currentCup}=await supabase.from('cups').select('lifecycle_status,ruleset_id').eq('id',cupId).single();
  if(currentCup?.lifecycle_status==='completed' && rulesetId!==currentCup.ruleset_id) redirect(`/admin?section=cup&edit=${encodeURIComponent(cupId)}&error=completed-ruleset-locked`);
  const {error}=await supabase.from('cups').update({name,ruleset_id:rulesetId,min_races_for_prize:minRaces,active,lifecycle_status:lifecycleStatus}).eq('id',cupId);
  if(error) redirect(`/admin?section=cup&edit=${encodeURIComponent(cupId)}&error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin'); revalidatePath('/');
  redirect(`/admin?section=cup&edit=${encodeURIComponent(cupId)}&success=cup-updated`);
}

export async function createPlannedRaces(formData: FormData) {
  const supabase = await requireAdmin();
  const cupId = text(formData, 'cup_id');
  const raw = text(formData, 'races_json');
  if (!cupId || !raw) redirect('/admin?section=plan&error=plan-fields');
  await requireOpenCup(supabase, cupId, `/admin?section=plan&cup=${encodeURIComponent(cupId)}`);

  let rows: { name:string; race_date?:string; location?:string; organizer_club_id?:string }[] = [];
  try { rows = JSON.parse(raw); } catch { redirect('/admin?section=plan&error=invalid-plan'); }
  rows = rows.filter(row => row.name?.trim());
  if (!rows.length) redirect('/admin?section=plan&error=no-races');

  const { data: lastRace } = await supabase.from('races').select('sort_order').eq('cup_id', cupId).order('sort_order', { ascending:false }).limit(1).maybeSingle();
  const start = lastRace?.sort_order ?? 0;
  const payload = rows.map((row,index) => ({
    cup_id: cupId,
    name: row.name.trim(),
    race_date: row.race_date || null,
    location: row.location?.trim() || null,
    organizer_club_id: row.organizer_club_id || null,
    external_race_id: null,
    source_url: null,
    sort_order: start + index + 1,
    status: 'draft',
    import_status: 'not_imported',
  }));
  const { error } = await supabase.from('races').insert(payload);
  if (error) redirect(`/admin?section=plan&cup=${encodeURIComponent(cupId)}&error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin');
  redirect(`/admin?section=plan&cup=${encodeURIComponent(cupId)}&success=plan-saved`);
}

export async function updatePlannedRace(formData: FormData) {
  const supabase = await requireAdmin();
  const raceId = text(formData, 'race_id');
  const cupId = text(formData, 'cup_id');
  const name = text(formData, 'name');
  const raceDate = text(formData, 'race_date') || null;
  const location = text(formData, 'location') || null;
  const organizerClubId = text(formData, 'organizer_club_id') || null;
  const sourceUrl = text(formData, 'source_url');
  const cancelled = text(formData, 'cancelled') === 'true';
  if (!raceId || !cupId || !name) redirect('/admin?section=plan&error=race-fields');
  const { data: cup } = await supabase.from('cups').select('lifecycle_status').eq('id', cupId).single();
  const completed = cup?.lifecycle_status === 'completed';
  const { data: existingRace } = await supabase.from('races').select('race_date,location,organizer_club_id,source_url,status').eq('id', raceId).eq('cup_id', cupId).single();
  if (!existingRace) redirect('/admin?section=plan&error=race-not-found');
  if (completed) {
    const metadataOnly = raceDate === (existingRace.race_date ?? null)
      && location === (existingRace.location ?? null)
      && organizerClubId === (existingRace.organizer_club_id ?? null)
      && sourceUrl === (existingRace.source_url ?? '')
      && cancelled === (existingRace.status === 'cancelled');
    if (!metadataOnly) redirect(`/admin?section=plan&cup=${encodeURIComponent(cupId)}&error=completed-metadata-only`);
  }

  let externalRaceId: string | null = null;
  let normalizedSourceUrl: string | null = null;
  if (sourceUrl) {
    try {
      const parsed = new URL(sourceUrl);
      externalRaceId = parsed.searchParams.get('raceId')?.trim() ?? null;
      if (!/^results\d*\.biathlontiming\.se$/i.test(parsed.hostname) || !externalRaceId) throw new Error();
      normalizedSourceUrl = sourceUrl;
    } catch { redirect(`/admin?section=plan&cup=${encodeURIComponent(cupId)}&error=invalid-race-url`); }
  }

  const { data: current } = await supabase.from('races').select('status').eq('id', raceId).single();
  const status = cancelled ? 'cancelled' : current?.status === 'published' ? 'published' : 'draft';
  const { error } = await supabase.from('races').update({
    name, race_date: raceDate, location, organizer_club_id: organizerClubId,
    source_url: normalizedSourceUrl, external_race_id: externalRaceId, status,
  }).eq('id', raceId).eq('cup_id', cupId);
  if (error) redirect(`/admin?section=plan&cup=${encodeURIComponent(cupId)}&error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin'); revalidatePath('/');
  redirect(`/admin?section=plan&cup=${encodeURIComponent(cupId)}&success=race-updated`);
}

export async function movePlannedRace(formData: FormData) {
  const supabase = await requireAdmin();
  const raceId = text(formData, 'race_id'), cupId = text(formData, 'cup_id'), direction = text(formData, 'direction');
  if (!raceId || !cupId || !['up','down'].includes(direction)) redirect('/admin?section=plan&error=move-fields');
  await requireOpenCup(supabase, cupId, `/admin?section=plan&cup=${encodeURIComponent(cupId)}`);
  const { data } = await supabase.from('races').select('id,sort_order').eq('cup_id',cupId).order('sort_order');
  const rows = data ?? [], index = rows.findIndex(r=>r.id===raceId), target = direction==='up'?index-1:index+1;
  if (index>=0 && target>=0 && target<rows.length) {
    const a=rows[index], b=rows[target];
    const temp = -1000000 - Math.abs(a.sort_order ?? 0);
    const e1=await supabase.from('races').update({sort_order:temp}).eq('id',a.id);
    const e2=await supabase.from('races').update({sort_order:a.sort_order}).eq('id',b.id);
    const e3=await supabase.from('races').update({sort_order:b.sort_order}).eq('id',a.id);
    if(e1.error||e2.error||e3.error) redirect(`/admin?section=plan&cup=${encodeURIComponent(cupId)}&error=move-failed`);
  }
  revalidatePath('/admin'); redirect(`/admin?section=plan&cup=${encodeURIComponent(cupId)}&success=race-moved`);
}

export async function deletePlannedRace(formData: FormData) {
  const supabase = await requireAdmin();
  const raceId = text(formData, 'race_id');
  const cupId = text(formData, 'cup_id');
  if (!raceId || !cupId) redirect('/admin?section=plan&error=delete-fields');
  await requireOpenCup(supabase, cupId, `/admin?section=plan&cup=${encodeURIComponent(cupId)}`);

  const { data: race, error: raceError } = await supabase
    .from('races')
    .select('id,cup_id,status,import_status,external_race_id,source_url')
    .eq('id', raceId).eq('cup_id', cupId).single();
  if (raceError || !race) redirect(`/admin?section=plan&cup=${encodeURIComponent(cupId)}&error=race-not-found`);

  const { count, error: countError } = await supabase
    .from('results').select('id', { count:'exact', head:true }).eq('race_id', raceId);
  if (countError) redirect(`/admin?section=plan&cup=${encodeURIComponent(cupId)}&error=${encodeURIComponent(countError.message)}`);

  const safeToDelete = race.status === 'draft'
    && race.import_status === 'not_imported'
    && !race.external_race_id
    && !race.source_url
    && (count ?? 0) === 0;
  if (!safeToDelete) redirect(`/admin?section=plan&cup=${encodeURIComponent(cupId)}&error=race-cannot-delete`);

  const { error } = await supabase.from('races').delete().eq('id', raceId).eq('cup_id', cupId);
  if (error) redirect(`/admin?section=plan&cup=${encodeURIComponent(cupId)}&error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin'); revalidatePath('/');
  redirect(`/admin?section=plan&cup=${encodeURIComponent(cupId)}&success=race-deleted`);
}

export async function createRace(formData: FormData) {
  const supabase = await requireAdmin();
  const cupId = text(formData, 'cup_id');
  const name = text(formData, 'name');
  const raceDate = text(formData, 'race_date') || null;
  const sourceUrl = text(formData, 'source_url');
  let raceId = '';

  try {
    const parsed = new URL(sourceUrl);
    raceId = parsed.searchParams.get('raceId')?.trim() ?? '';
    const isBiathlonTimingHost = /^results\d*\.biathlontiming\.se$/i.test(parsed.hostname);
    if (!isBiathlonTimingHost || !raceId) throw new Error();
  } catch {
    redirect('/admin?section=race&error=invalid-race-url');
  }

  if (!cupId || !name) redirect('/admin?section=race&error=race-fields');

  const { data: lastRace } = await supabase
    .from('races')
    .select('sort_order')
    .eq('cup_id', cupId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from('races').insert({
    cup_id: cupId,
    external_race_id: raceId,
    source_url: sourceUrl,
    name,
    race_date: raceDate,
    sort_order: (lastRace?.sort_order ?? 0) + 1,
    status: 'draft',
  });

  if (error) redirect(`/admin?section=race&error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin');
  redirect('/admin?section=race&success=race-created');
}

export async function setRaceStatus(formData: FormData) {
  const supabase = await requireAdmin();
  const raceId = text(formData, 'race_id');
  const status = text(formData, 'status');

  if (!raceId || !['draft', 'published'].includes(status)) {
    redirect('/admin?error=invalid-race-status');
  }
  await requireOpenRaceCup(supabase, raceId, '/admin?section=import');

  const { error } = await supabase.from('races').update({ status }).eq('id', raceId);
  if (error) redirect(`/admin?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/');
  revalidatePath('/admin');
  redirect(`/admin?section=import&success=${status === 'published' ? 'race-published' : 'race-unpublished'}`);
}

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('sv-SE')
    .replace(/&/g, ' och ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalClubName(value: string) {
  return normalizeName(value)
    .replace(/^foreningen\s+/, '')
    .replace(/\s+(idrottsforening|skidklubb)$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeClubName(value: string) {
  return canonicalClubName(value).replace(/\s+/g, '');
}

function canonicalClassName(value: string) {
  return value
    .replace(/(\d)\s*[.–—]\s*(\d)/g, '$1-$2')
    .replace(/\s+(massstart|sprint|distans|kortdistans|individuell|jaktstart|stafett|supersprint)(\s+.*)?$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeClassName(value: string) {
  return normalizeName(canonicalClassName(value)).replace(/\s+/g, '');
}

function addUniqueName<T extends { id: string; name: string }>(map: Map<string, T | null>, key: string, row: T) {
  if (!key) return;
  const existing = map.get(key);
  if (existing === undefined) map.set(key, row);
  else if (existing && existing.id !== row.id) map.set(key, null);
}

export async function addClassAlias(formData: FormData) {
  const supabase = await requireAdmin();
  const classId = text(formData, 'class_id');
  const alias = text(formData, 'alias');
  if (!classId || !alias) redirect('/admin?section=classes&error=class-alias-fields');

  const { data: classRow, error: readError } = await supabase
    .from('classes')
    .select('id,name,aliases')
    .eq('id', classId)
    .single();
  if (readError || !classRow) redirect('/admin?section=classes&error=class-not-found');

  const aliases = Array.from(new Set([...(classRow.aliases ?? []), alias]))
    .filter(value => normalizeClassName(value) !== normalizeClassName(classRow.name));
  const { error } = await supabase.from('classes').update({ aliases }).eq('id', classId);
  if (error) redirect(`/admin?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/admin');
  redirect('/admin?section=classes&success=class-alias-added');
}

export async function createClub(formData: FormData) {
  const supabase = await requireAdmin();
  const name = text(formData, 'name');
  const shortName = text(formData, 'short_name');
  const regionId = text(formData, 'region_id');
  if (!name || !regionId) redirect('/admin?section=clubs&error=club-create-fields');

  const { data: clubs, error: readError } = await supabase
    .from('clubs')
    .select('id,name,short_name,aliases');
  if (readError) redirect(`/admin?section=clubs&error=${encodeURIComponent(readError.message)}`);

  const requestedKeys = new Set([name, shortName].filter(Boolean).map(normalizeClubName));
  const duplicate = (clubs ?? []).find(club =>
    [club.name, club.short_name, ...(club.aliases ?? [])]
      .filter(Boolean)
      .some(value => requestedKeys.has(normalizeClubName(String(value))))
  );
  if (duplicate) redirect(`/admin?section=clubs&club=${encodeURIComponent(duplicate.id)}&error=club-duplicate`);

  const { data: created, error } = await supabase
    .from('clubs')
    .insert({
      name,
      short_name: shortName || null,
      region_id: regionId,
      active: true,
      aliases: [],
    })
    .select('id')
    .single();
  if (error || !created) redirect(`/admin?section=clubs&error=${encodeURIComponent(error?.message ?? 'club-create-failed')}`);

  revalidatePath('/');
  revalidatePath('/admin');
  redirect(`/admin?section=clubs&region=${encodeURIComponent(regionId)}&club=${encodeURIComponent(created.id)}&success=club-created`);
}

export async function updateClubRegion(formData: FormData) {
  const supabase = await requireAdmin();
  const clubId = text(formData, 'club_id');
  const regionId = text(formData, 'region_id');
  if (!clubId || !regionId) redirect('/admin?section=clubs&error=club-region-fields');
  const { error } = await supabase.from('clubs').update({ region_id: regionId }).eq('id', clubId);
  if (error) redirect(`/admin?section=clubs&error=${encodeURIComponent(error.message)}`);
  const returnRegion = text(formData, 'return_region');
  revalidatePath('/');
  revalidatePath('/admin');
  redirect(`/admin?section=clubs&region=${encodeURIComponent(returnRegion)}&club=${encodeURIComponent(clubId)}&success=club-region-updated`);
}

export async function addClubAlias(formData: FormData) {
  const supabase = await requireAdmin();
  const clubId = text(formData, 'club_id');
  const alias = text(formData, 'alias');
  if (!clubId || !alias) redirect('/admin?section=clubs&error=club-alias-fields');
  const { data: club, error: readError } = await supabase.from('clubs').select('id,name,aliases').eq('id', clubId).single();
  if (readError || !club) redirect('/admin?section=clubs&error=club-not-found');
  const aliases = Array.from(new Set([...(club.aliases ?? []), alias])).filter(value => normalizeName(value) !== normalizeName(club.name));
  const { error } = await supabase.from('clubs').update({ aliases }).eq('id', clubId);
  if (error) redirect(`/admin?section=clubs&error=${encodeURIComponent(error.message)}`);
  const returnRegion = text(formData, 'return_region');
  revalidatePath('/admin');
  redirect(`/admin?section=clubs&region=${encodeURIComponent(returnRegion)}&club=${encodeURIComponent(clubId)}&success=club-alias-added`);
}

export async function importRaceResults(formData: FormData) {
  const supabase = await requireAdmin();
  const databaseRaceId = text(formData, 'race_id');
  if (!databaseRaceId) redirect('/admin?section=import&error=missing-race-id');

  const { data: race, error: raceError } = await supabase
    .from('races')
    .select('id,cup_id,external_race_id,source_url')
    .eq('id', databaseRaceId)
    .single();
  if (raceError || !race) redirect('/admin?section=import&error=race-not-found');

  const { importBiathlonTiming } = await import('@/lib/biathlontiming');

  await supabase.from('races').update({ import_status: 'processing', import_error: null }).eq('id', race.id);

  let importedCountForRedirect = 0;
  let outsideCountForRedirect = 0;
  try {
    const imported = await importBiathlonTiming(race.external_race_id, race.source_url);
    const { data: clubs, error: clubsError } = await supabase.from('clubs').select('id,name,short_name,aliases,region_id,active');
    if (clubsError) throw clubsError;
    type ClubRow = { id: string; name: string; short_name: string | null; aliases: string[] | null; region_id: string | null; active: boolean };
    const clubMap = new Map<string, ClubRow | null>();
    for (const club of clubs ?? []) {
      for (const alias of [club.name, club.short_name, ...(club.aliases ?? [])]) {
        if (alias) addUniqueName(clubMap, normalizeClubName(alias), club);
      }
    }

    type ClassRow = { id: string; name: string; aliases: string[] | null };
    const { data: existingClasses, error: classesError } = await supabase
      .from('classes')
      .select('id,name,aliases')
      .eq('is_official', true);
    if (classesError) throw classesError;

    const classMap = new Map<string, ClassRow | null>();
    for (const classRow of existingClasses ?? []) {
      for (const alias of [classRow.name, ...(classRow.aliases ?? [])]) {
        if (alias) addUniqueName(classMap, normalizeClassName(alias), classRow);
      }
    }

    type AthleteRow = { id: string; full_name: string; club_id: string };
    const { data: existingAthletes, error: athletesError } = await supabase
      .from('athletes')
      .select('id,full_name,club_id');
    if (athletesError) throw athletesError;

    const athleteMap = new Map<string, AthleteRow | null>();
    for (const athlete of existingAthletes ?? []) {
      const key = `${normalizeName(athlete.full_name)}|${athlete.club_id}`;
      const existing = athleteMap.get(key);
      if (existing === undefined) athleteMap.set(key, athlete);
      else if (existing && existing.id !== athlete.id) athleteMap.set(key, null);
    }

    const classCache = new Map<string, string>();
    const athleteCache = new Map<string, string>();
    let importedCount = 0;
    let outsideClubCount = 0;

    for (const row of imported.results) {
      const classKey = normalizeClassName(row.className);
      let classId = classCache.get(classKey);
      if (!classId) {
        const matchedClass = classMap.get(classKey);
        if (matchedClass === null) {
          throw new Error(`Tvetydig klass: ${row.className}. Flera officiella klasser matchar samma normaliserade namn.`);
        }
        if (!matchedClass) {
          throw new Error(`Okänd klass: ${row.className}. Lägg till namnet som alias under Klassalias och importera igen.`);
        }
        classId = matchedClass.id;
        classCache.set(classKey, matchedClass.id);
      }
      if (!classId) throw new Error(`Klassen ${row.className} saknar id.`);

      const clubKey = normalizeClubName(row.clubName);
      const club = clubMap.get(clubKey);
      if (club === null) {
        throw new Error(`Tvetydig klubb: ${row.clubName}. Flera klubbar matchar samma normaliserade namn. Lös klubbnamnet i admin innan import.`);
      }
      if (!club) {
        throw new Error(`Okänd klubb: ${row.clubName}. Lägg till namnet som alias på rätt klubb i admin och importera igen.`);
      }
      if (!club.region_id) outsideClubCount += 1;

      const athleteKey = `${normalizeName(row.athleteName)}|${club.id}`;
      let athleteId = athleteCache.get(athleteKey);
      if (!athleteId) {
        const matchedAthlete = athleteMap.get(athleteKey);
        if (matchedAthlete === null) {
          throw new Error(`Tvetydig åkare: ${row.athleteName} i ${club.name}. Flera befintliga åkare matchar samma normaliserade namn.`);
        }
        if (matchedAthlete) athleteId = matchedAthlete.id;
        else {
          const { data: createdAthlete, error } = await supabase
            .from('athletes').insert({ full_name: row.athleteName, club_id: club.id }).select('id,full_name,club_id').single();
          if (error) throw error;
          athleteId = createdAthlete.id;
          athleteMap.set(athleteKey, createdAthlete);
        }
        if (!athleteId) throw new Error(`Åkaren ${row.athleteName} kunde inte sparas.`);
        athleteCache.set(athleteKey, athleteId);
      }
      if (!athleteId) throw new Error(`Åkaren ${row.athleteName} saknar id.`);

      const { error: resultError } = await supabase.from('results').upsert({
        race_id: race.id,
        class_id: classId,
        athlete_id: athleteId,
        bib: row.bib,
        place: row.place,
        status: row.status,
        total_time_ms: row.totalTimeMs,
        shooting: row.shooting,
        shooting_hits: row.shootingHits,
        shooting_shots: row.shootingShots,
        source_class_name: row.className,
        source_club_name: row.clubName,
      }, { onConflict: 'race_id,class_id,athlete_id' });
      if (resultError) throw resultError;
      importedCount += 1;
    }

    importedCountForRedirect = importedCount;
    outsideCountForRedirect = outsideClubCount;
    await supabase.from('races').update({
      import_status: 'success',
      import_error: null,
      imported_at: new Date().toISOString(),
    }).eq('id', race.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Okänt importfel';
    await supabase.from('races').update({ import_status: 'error', import_error: message }).eq('id', race.id);
    redirect(`/admin?section=import&error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/');
  revalidatePath('/admin');
  redirect(`/admin?section=import&success=import-complete&count=${importedCountForRedirect}&outside=${outsideCountForRedirect}`);
}


export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient();
  const email = text(formData, 'email');
  if (!email) redirect('/admin/login?error=reset-email');

  const headerStore = await headers();
  const requestOrigin = headerStore.get('origin');
  const forwardedHost = headerStore.get('x-forwarded-host');
  const origin = requestOrigin ?? (forwardedHost
    ? `${headerStore.get('x-forwarded-proto') ?? 'https'}://${forwardedHost}`
    : '');
  const redirectTo = origin ? `${origin}/auth/callback?next=/admin/reset-password` : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
  if (error) redirect('/admin/login?error=reset-failed');
  redirect('/admin/login?success=reset-sent');
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  const password = text(formData, 'password');
  const confirmPassword = text(formData, 'confirm_password');
  if (password.length < 8 || password !== confirmPassword) {
    redirect('/admin/reset-password?error=password');
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect('/admin/reset-password?error=update');
  redirect('/admin?success=password-updated');
}

export async function setAdminRole(formData: FormData) {
  const supabase = await requireAdmin();
  const profileId = text(formData, 'profile_id');
  const makeAdmin = text(formData, 'make_admin') === 'true';
  if (!profileId) redirect('/admin?section=admins&error=missing-profile');

  const { data: { user } } = await supabase.auth.getUser();
  if (!makeAdmin && user?.id === profileId) {
    redirect('/admin?section=admins&error=cannot-remove-yourself');
  }

  const { error } = await supabase.from('profiles').update({ is_admin: makeAdmin }).eq('id', profileId);
  if (error) redirect(`/admin?section=admins&error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin');
  redirect(`/admin?section=admins&success=${makeAdmin ? 'admin-added' : 'admin-removed'}`);
}


export async function inviteAdmin(formData: FormData) {
  const supabase = await requireAdmin();
  const email = text(formData, 'email').toLowerCase();
  if (!email) redirect('/admin?section=admins&error=missing-email');

  const headerStore = await headers();
  const requestOrigin = headerStore.get('origin');
  const forwardedHost = headerStore.get('x-forwarded-host');
  const origin = requestOrigin ?? (forwardedHost
    ? `${headerStore.get('x-forwarded-proto') ?? 'https'}://${forwardedHost}`
    : '');
  const emailRedirectTo = origin ? `${origin}/auth/callback?next=/admin` : undefined;

  const { error: inviteError } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      ...(emailRedirectTo ? { emailRedirectTo } : {}),
    },
  });
  if (inviteError) redirect(`/admin?section=admins&error=${encodeURIComponent(inviteError.message)}`);

  const { data: invitedProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .ilike('display_name', email)
    .maybeSingle();
  if (profileError) redirect(`/admin?section=admins&error=${encodeURIComponent(profileError.message)}`);
  if (!invitedProfile) redirect('/admin?section=admins&error=invite-profile-not-created');

  const { error: roleError } = await supabase.from('profiles').update({ is_admin: true }).eq('id', invitedProfile.id);
  if (roleError) redirect(`/admin?section=admins&error=${encodeURIComponent(roleError.message)}`);

  revalidatePath('/admin');
  redirect('/admin?section=admins&success=admin-invited');
}


export async function cloneRuleset(formData: FormData) {
  const supabase = await requireAdmin();
  const sourceId = text(formData, 'source_ruleset_id');
  const name = text(formData, 'name');
  const code = text(formData, 'code').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!sourceId || !name || !code) redirect('/admin?section=rules&error=ruleset-fields');

  const { data: source, error: sourceError } = await supabase.from('cup_rulesets')
    .select('description,points_by_place,participation_points,drop_schedule,min_races_for_prize,club_points_use_all,medal_league_enabled')
    .eq('id', sourceId).single();
  if (sourceError || !source) redirect('/admin?section=rules&error=ruleset-source');

  const { data: created, error } = await supabase.from('cup_rulesets').insert({
    code, name, description: source.description, points_by_place: source.points_by_place,
    participation_points: source.participation_points, drop_schedule: source.drop_schedule,
    min_races_for_prize: source.min_races_for_prize, club_points_use_all: source.club_points_use_all,
    medal_league_enabled: source.medal_league_enabled, active: true,
  }).select('id').single();
  if (error || !created) redirect(`/admin?section=rules&error=${encodeURIComponent(error?.message ?? 'ruleset-create')}`);

  const { data: classRules } = await supabase.from('cup_ruleset_class_rules')
    .select('class_id,scoring_mode,fixed_points,medal_eligible').eq('ruleset_id', sourceId);
  if (classRules?.length) {
    const { error: classError } = await supabase.from('cup_ruleset_class_rules').insert(
      classRules.map(r => ({ ...r, ruleset_id: created.id }))
    );
    if (classError) redirect(`/admin?section=rules&ruleset=${created.id}&error=${encodeURIComponent(classError.message)}`);
  }
  revalidatePath('/admin');
  redirect(`/admin?section=rules&ruleset=${created.id}&success=ruleset-created`);
}

export async function updateRulesetClassRule(formData: FormData) {
  const supabase = await requireAdmin();
  const rulesetId = text(formData, 'ruleset_id'), classId = text(formData, 'class_id');
  const scoringMode = text(formData, 'scoring_mode');
  const fixedRaw = text(formData, 'fixed_points');
  const fixedPoints: number | null = scoringMode === 'fixed' ? Number(fixedRaw) : null;
  const medalEligible = text(formData, 'medal_eligible') === 'true';
  if (!rulesetId || !classId || !['standard','fixed','none'].includes(scoringMode) ||
      (scoringMode === 'fixed' && (!Number.isFinite(fixedPoints) || fixedPoints < 0))) {
    redirect(`/admin?section=rules&ruleset=${encodeURIComponent(rulesetId)}&error=class-rule-fields`);
  }
  const { count } = await supabase.from('cups').select('id',{count:'exact',head:true})
    .eq('ruleset_id',rulesetId).eq('lifecycle_status','completed');
  if ((count ?? 0) > 0) redirect(`/admin?section=rules&ruleset=${rulesetId}&error=ruleset-locked`);

  const { error } = await supabase.from('cup_ruleset_class_rules').upsert({
    ruleset_id: rulesetId, class_id: classId, scoring_mode: scoringMode,
    fixed_points: fixedPoints, medal_eligible: medalEligible,
  }, { onConflict: 'ruleset_id,class_id' });
  if (error) redirect(`/admin?section=rules&ruleset=${rulesetId}&error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin'); revalidatePath('/');
  redirect(`/admin?section=rules&ruleset=${rulesetId}&success=ruleset-updated`);
}

export async function updateFeedbackItem(formData: FormData) {
  const supabase = await requireAdmin();
  const id=text(formData,'id'), status=text(formData,'status'), priority=text(formData,'priority');
  const adminNote=text(formData,'admin_note') || null, roadmapRef=text(formData,'roadmap_ref') || null;
  if(!id || !['new','planned','in_progress','done','rejected'].includes(status) || !['low','normal','high','critical'].includes(priority))
    redirect('/admin?section=feedback&error=feedback-fields');
  const {error}=await supabase.from('feedback_items').update({status,priority,admin_note:adminNote,roadmap_ref:roadmapRef}).eq('id',id);
  if(error) redirect(`/admin?section=feedback&error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin'); redirect('/admin?section=feedback&success=feedback-updated');
}
