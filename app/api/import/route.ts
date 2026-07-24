import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({ url: z.string().url() });

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const parsed = schema.safeParse({ url: form.get('url') });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Ogiltig länk.' }, { status: 400 });
  }

  const url = new URL(parsed.data.url);
  const raceId = url.searchParams.get('raceId');

  if (url.hostname !== 'results.biathlontiming.se' || !raceId) {
    return NextResponse.json(
      { error: 'Ange en giltig BiathlonTiming-länk med raceId.' },
      { status: 400 },
    );
  }

  return NextResponse.json({
    message: 'Länken är giltig. Databasimport aktiveras tillsammans med administratörsinloggningen.',
    raceId,
  });
}
