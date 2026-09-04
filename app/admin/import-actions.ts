'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) redirect('/admin/login?error=not-admin');
  return supabase;
}

function normalizeName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('sv-SE')
    .replace(/&/g, ' och ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeClubName(value: string) {
  return normalizeName(value).replace(/^foreningen\s+/, '').replace(/\s+(idrottsforening|skidklubb)$/, '').replace(/\s+/g, '');
}

function normalizeClassName(value: string) {
  const canonical = value.replace(/(\d)\s*[.–—]\s*(\d)/g, '$1-$2')
    .replace(/\s+(massstart|sprint|distans|kortdistans|individuell|jaktstart|stafett|supersprint)(\s+.*)?$/i, '')
    .replace(/\s+/g, ' ').trim();
  return normalizeName(canonical).replace(/\s+/g, '');
}

function addUnique<T extends { id: string }>(map: Map<string, T | null>, key: string, row: T) {
  if (!key) return;
  const current = map.get(key);
  if (current === undefined) map.set(key, row);
  else if (current && current.id !== row.id) map.set(key, null);
}

type PlannedResult = {
  row: Awaited<ReturnType<typeof import('@/lib/biathlontiming').importBiathlonTiming>>['results'][number];
  classId: string;
  clubId: string;
  athleteKey: string;
  existingAthleteId: string | null;
};

export async function importRaceResultsSafe(formData: FormData) {
  const supabase = await requireAdmin();
  const databaseRaceId = text(formData, 'race_id');
  if (!databaseRaceId) redirect('/admin?section=import&error=missing-race-id');

  const { data: race, error: raceError } = await supabase.from('races')
    .select('id,external_race_id,source_url').eq('id', databaseRaceId).single();
  if (raceError || !race) redirect('/admin?section=import&error=race-not-found');

  await supabase.from('races').update({ import_status: 'processing', import_error: null }).eq('id', race.id);

  let importedCount = 0;
  let outsideCount = 0;
  try {
    const { importBiathlonTiming } = await import('@/lib/biathlontiming');
    const imported = await importBiathlonTiming(race.external_race_id, race.source_url);

    const [{ data: clubs, error: clubsError }, { data: classes, error: classesError }, { data: athletes, error: athletesError }, { data: oldResults, error: oldResultsError }] = await Promise.all([
      supabase.from('clubs').select('id,name,short_name,aliases,region_id'),
      supabase.from('classes').select('id,name,aliases').eq('is_official', true),
      supabase.from('athletes').select('id,full_name,club_id'),
      supabase.from('results').select('class_id,athlete_id').eq('race_id', race.id),
    ]);
    if (clubsError) throw clubsError;
    if (classesError) throw classesError;
    if (athletesError) throw athletesError;
    if (oldResultsError) throw oldResultsError;

    const clubMap = new Map<string, (typeof clubs)[number] | null>();
    for (const club of clubs ?? []) for (const alias of [club.name, club.short_name, ...(club.aliases ?? [])]) if (alias) addUnique(clubMap, normalizeClubName(alias), club);
    const classMap = new Map<string, (typeof classes)[number] | null>();
    for (const cls of classes ?? []) for (const alias of [cls.name, ...(cls.aliases ?? [])]) if (alias) addUnique(classMap, normalizeClassName(alias), cls);
    const athleteMap = new Map<string, (typeof athletes)[number] | null>();
    for (const athlete of athletes ?? []) addUnique(athleteMap, `${normalizeName(athlete.full_name)}|${athlete.club_id}`, athlete);

    // PRE-FLIGHT: resolve and validate every source row before creating athletes or writing results.
    const plan: PlannedResult[] = [];
    const sourceKeys = new Set<string>();
    const incomingExistingKeys = new Set<string>();
    for (const row of imported.results) {
      const cls = classMap.get(normalizeClassName(row.className));
      if (cls === null) throw new Error(`Tvetydig klass: ${row.className}. Flera officiella klasser matchar.`);
      if (!cls) throw new Error(`Okänd klass: ${row.className}. Lägg till namnet som klassalias och importera igen.`);

      const club = clubMap.get(normalizeClubName(row.clubName));
      if (club === null) throw new Error(`Tvetydig klubb: ${row.clubName}. Lös klubbnamnet i admin innan import.`);
      if (!club) throw new Error(`Okänd klubb: ${row.clubName}. Lägg till namnet som alias på rätt klubb och importera igen.`);
      if (!club.region_id) outsideCount += 1;

      const athleteKey = `${normalizeName(row.athleteName)}|${club.id}`;
      const athlete = athleteMap.get(athleteKey);
      if (athlete === null) throw new Error(`Tvetydig åkare: ${row.athleteName} i ${club.name}. Flera befintliga åkare matchar.`);

      const sourceKey = `${cls.id}|${athleteKey}`;
      if (sourceKeys.has(sourceKey)) throw new Error(`Dubblett i källresultatet: ${row.athleteName}, ${row.className}, ${club.name}. Ingen data har skrivits.`);
      sourceKeys.add(sourceKey);
      if (athlete) incomingExistingKeys.add(`${cls.id}|${athlete.id}`);
      plan.push({ row, classId: cls.id, clubId: club.id, athleteKey, existingAthleteId: athlete?.id ?? null });
    }

    // Never silently delete a result that existed in an earlier import.
    const missingOldResults = (oldResults ?? []).filter(result => !incomingExistingKeys.has(`${result.class_id}|${result.athlete_id}`));
    if (missingOldResults.length > 0) {
      throw new Error(`${missingOldResults.length} tidigare importerade resultat saknas i BiathlonTiming-källan. Importen stoppades utan radering. Kontrollera tävlingen innan återimport.`);
    }

    // SAVE: only reached after the complete source has passed pre-flight.
    const athleteIds = new Map<string, string>();
    for (const item of plan) {
      let athleteId = item.existingAthleteId ?? athleteIds.get(item.athleteKey);
      if (!athleteId) {
        const { data: created, error } = await supabase.from('athletes')
          .insert({ full_name: item.row.athleteName, club_id: item.clubId }).select('id').single();
        if (error || !created) throw error ?? new Error(`Åkaren ${item.row.athleteName} kunde inte sparas.`);
        const createdAthleteId = created.id;
        athleteId = createdAthleteId;
        athleteIds.set(item.athleteKey, createdAthleteId);
      }

      const { error } = await supabase.from('results').upsert({
        race_id: race.id, class_id: item.classId, athlete_id: athleteId,
        bib: item.row.bib, place: item.row.place, status: item.row.status,
        total_time_ms: item.row.totalTimeMs, shooting: item.row.shooting,
        shooting_hits: item.row.shootingHits, shooting_shots: item.row.shootingShots,
        source_class_name: item.row.className, source_club_name: item.row.clubName,
      }, { onConflict: 'race_id,class_id,athlete_id' });
      if (error) throw error;
      importedCount += 1;
    }

    await supabase.from('races').update({
      import_status: 'success', import_error: null, imported_result_count: importedCount,
      imported_at: new Date().toISOString(),
    }).eq('id', race.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Okänt importfel';
    await supabase.from('races').update({ import_status: 'error', import_error: message }).eq('id', race.id);
    redirect(`/admin?section=import&error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/');
  revalidatePath('/admin');
  redirect(`/admin?section=import&success=import-complete&count=${importedCount}&outside=${outsideCount}`);
}
