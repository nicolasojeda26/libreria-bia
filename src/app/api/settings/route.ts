import { NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';
import { getAdminUser, unauthorized } from '@/lib/auth';

const NOTICE_MAX_LENGTH = 160;

export async function GET() {
  return NextResponse.json({ notice: await getSetting('notice') });
}

export async function PUT(request: Request) {
  if (!(await getAdminUser())) return unauthorized();
  try {
    const body = await request.json();
    const notice = String(body.notice ?? '').replace(/\s+/g, ' ').trim().slice(0, NOTICE_MAX_LENGTH);
    await setSetting('notice', notice);
    return NextResponse.json({ notice });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'No se pudo guardar el aviso' }, { status: 500 });
  }
}
