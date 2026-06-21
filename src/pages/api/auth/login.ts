import type { APIRoute } from 'astro';
import { verifyPassword, generateToken, sessionCookie, SESSION_TTL } from '@/lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any).runtime?.env as Env;
    const { email, password } = await request.json() as { email: string; password: string };

    const account = await env.DB.prepare(
      'SELECT id, password_hash FROM accounts WHERE email = ?'
    ).bind(email).first<{ id: string; password_hash: string }>();

    if (!account || !(await verifyPassword(password, account.password_hash))) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = generateToken();
    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL;

    await env.DB.prepare(
      'INSERT INTO account_sessions (token, account_id, expires_at) VALUES (?, ?, ?)'
    ).bind(token, account.id, expiresAt).run();

    return Response.json(
      { accountId: account.id, email },
      { headers: { 'Set-Cookie': sessionCookie(token) } }
    );
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

interface Env { DB: D1Database; }
