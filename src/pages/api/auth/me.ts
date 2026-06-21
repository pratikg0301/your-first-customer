import type { APIRoute } from 'astro';
import { SESSION_COOKIE } from '@/lib/auth';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any).runtime?.env as Env;
    const cookie = request.headers.get('cookie') ?? '';
    const token = cookie.split(';').map(c => c.trim()).find(c => c.startsWith(`${SESSION_COOKIE}=`))?.split('=')[1];

    if (!token) return Response.json({ account: null });

    const now = Math.floor(Date.now() / 1000);
    const row = await env.DB.prepare(
      `SELECT a.id, a.email FROM account_sessions s
       JOIN accounts a ON a.id = s.account_id
       WHERE s.token = ? AND s.expires_at > ?`
    ).bind(token, now).first<{ id: string; email: string }>();

    return Response.json({ account: row ?? null });
  } catch (err) {
    return Response.json({ account: null });
  }
};

interface Env { DB: D1Database; }
