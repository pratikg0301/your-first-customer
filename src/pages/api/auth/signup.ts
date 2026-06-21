import type { APIRoute } from 'astro';
import { hashPassword, generateToken, sessionCookie, SESSION_TTL } from '@/lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any).runtime?.env as Env;
    const { email, password } = await request.json() as { email: string; password: string };

    if (!email || !password || password.length < 8) {
      return Response.json({ error: 'Email and password (min 8 chars) are required' }, { status: 400 });
    }

    const existing = await env.DB.prepare('SELECT id FROM accounts WHERE email = ?').bind(email).first();
    if (existing) {
      return Response.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    const accountId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);

    await env.DB.prepare(
      'INSERT INTO accounts (id, email, password_hash) VALUES (?, ?, ?)'
    ).bind(accountId, email, passwordHash).run();

    const token = generateToken();
    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL;

    await env.DB.prepare(
      'INSERT INTO account_sessions (token, account_id, expires_at) VALUES (?, ?, ?)'
    ).bind(token, accountId, expiresAt).run();

    return Response.json(
      { accountId, email },
      { headers: { 'Set-Cookie': sessionCookie(token) } }
    );
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

interface Env { DB: D1Database; }
