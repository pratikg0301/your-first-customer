import type { APIRoute } from 'astro';
import { SESSION_COOKIE } from '@/lib/auth';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any).runtime?.env as Env;
    const cookie = request.headers.get('cookie') ?? '';
    const token = cookie.split(';').map(c => c.trim()).find(c => c.startsWith(`${SESSION_COOKIE}=`))?.split('=')[1];

    if (!token) return Response.json({ sessions: [] });

    const now = Math.floor(Date.now() / 1000);
    const account = await env.DB.prepare(
      `SELECT a.id FROM account_sessions s JOIN accounts a ON a.id = s.account_id
       WHERE s.token = ? AND s.expires_at > ?`
    ).bind(token, now).first<{ id: string }>();

    if (!account) return Response.json({ sessions: [] });

    const sessions = await env.DB.prepare(
      `SELECT s.id, s.name, s.stage, s.score, s.created_at, s.updated_at
       FROM sessions s
       JOIN founders f ON f.id = s.founder_id
       WHERE f.account_id = ?
       ORDER BY s.updated_at DESC`
    ).bind(account.id).all<{
      id: string; name: string; stage: string; score: number | null;
      created_at: number; updated_at: number;
    }>();

    return Response.json({ sessions: sessions.results ?? [] });
  } catch (err) {
    return Response.json({ sessions: [], error: String(err) });
  }
};

interface Env { DB: D1Database; }
