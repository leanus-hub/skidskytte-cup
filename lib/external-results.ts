export type ExternalResultRow = {
  sourceRow: number;
  athleteName: string;
  clubName: string | null;
  className: string | null;
  place: number | null;
  status: string | null;
  shooting: number[];
  shootingHits: number | null;
  shootingShots: number | null;
  raw: Record<string, string>;
};

const clean = (value: string) => value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const key = (value: string) => clean(value).toLocaleLowerCase('sv-SE').replace(/[._ -]+/g, '');

function delimiterFor(line: string) {
  const candidates = [';', '\t', ','];
  return candidates.sort((a,b) => line.split(b).length - line.split(a).length)[0];
}

function splitLine(line: string, delimiter: string) {
  const out: string[] = [];
  let value = '', quoted = false;
  for (let i=0;i<line.length;i++) {
    const ch=line[i];
    if (ch === '"') {
      if (quoted && line[i+1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === delimiter && !quoted) { out.push(clean(value)); value=''; }
    else value += ch;
  }
  out.push(clean(value));
  return out;
}

function integer(value: string | undefined) {
  const v=clean(value??'');
  return /^\d+$/.test(v) ? Number(v) : null;
}

function shooting(value: string | undefined) {
  const v=clean(value??'');
  if (!v) return [] as number[];
  const values = v.includes(' ') || v.includes('-') || v.includes('/')
    ? v.split(/[\s\-/]+/).filter(Boolean).map(Number)
    : /^\d+$/.test(v) ? v.split('').map(Number) : [];
  return values.every(n => Number.isInteger(n) && n >= 0 && n <= 5) ? values : [];
}

export function parseExternalCsv(input: string): ExternalResultRow[] {
  const lines=input.replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim());
  if (lines.length < 2) throw new Error('Filen saknar resultat.');
  const delimiter=delimiterFor(lines[0]);
  const headers=splitLine(lines[0],delimiter);
  const index=new Map(headers.map((h,i)=>[key(h),i]));
  const col=(names:string[]) => names.map(n=>index.get(key(n))).find(i=>i!==undefined) ?? -1;
  const athlete=col(['åkare','akare','namn','name','athlete','athletename']);
  const club=col(['klubb','club','förening','forening','organisation','organization']);
  const klass=col(['klass','class','category']);
  const place=col(['placering','plats','place','rank']);
  const stat=col(['status']);
  const shoot=col(['skytte','shooting','bom','misses']);
  if (athlete < 0) throw new Error('Filen måste innehålla en kolumn för åkarnamn.');

  return lines.slice(1).map((line,rowIndex)=>{
    const cells=splitLine(line,delimiter);
    const athleteName=clean(cells[athlete]??'');
    if (!athleteName) throw new Error(`Rad ${rowIndex+2} saknar åkarnamn.`);
    const misses=shoot>=0?shooting(cells[shoot]):[];
    const shots=misses.length?misses.length*5:null;
    const hits=shots===null?null:shots-misses.reduce((sum,n)=>sum+n,0);
    const raw=Object.fromEntries(headers.map((h,i)=>[h,cells[i]??'']));
    return {
      sourceRow:rowIndex+2, athleteName,
      clubName:club>=0?clean(cells[club]??'')||null:null,
      className:klass>=0?clean(cells[klass]??'')||null:null,
      place:place>=0?integer(cells[place]):null,
      status:stat>=0?clean(cells[stat]??'')||null:null,
      shooting:misses, shootingHits:hits, shootingShots:shots, raw,
    };
  });
}
