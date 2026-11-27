import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { digest } from './store.js';
import { missionProgress } from '../src/core/missions.js';

const derive = promisify(scrypt);
const saltSize = 16;
const work = { N: 65536, r: 8, p: 2, maxmem: 96 * 1024 * 1024 };
const lifetime = 30 * 24 * 60 * 60;
const cookie = 'valdoria_session';
export const tokenPattern = /^[a-f0-9]{48}$/;
export const aliasPattern = /^[\p{L}\p{N}][\p{L}\p{N} .’-]{1,25}$/u;

export function credentials(input) {
  const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
  const password = input.password;
  if (!/^[a-z0-9_]{3,24}$/.test(username) || typeof password !== 'string' ||
      password.length < 8 || password.length > 128) {
    throw Object.assign(new Error('Use de 3 a 24 letras sem acento, números ou _ no usuário e de 8 a 128 caracteres na senha.'), {status:400});
  }
  return {username,password};
}

export async function passwordRecord(password) {
  const salt = randomBytes(saltSize).toString('hex');
  const hash = await derive(password, Buffer.from(salt,'hex'), 64, work);
  return {salt,hash:hash.toString('hex')};
}

export async function matchesPassword(password, record) {
  const salt = Buffer.from(record?.salt ?? '00'.repeat(saltSize),'hex');
  const expected = Buffer.from(record?.hash ?? '00'.repeat(64),'hex');
  const actual = await derive(password, salt, 64, work);
  return timingSafeEqual(actual,expected) && Boolean(record);
}

export function readSession(request) {
  const value = (request.headers.cookie || '').match(/(?:^|;\s*)valdoria_session=([a-f0-9]{48})(?:;|$)/)?.[1];
  return value ? digest(value) : null;
}

export function newSession() {
  const token = randomBytes(24).toString('hex');
  return {token,record:{key:digest(token),expiresAt:Date.now()+lifetime*1000}};
}

export function sessionCookie(request, env, token='') {
  const secure = env.SESSION_SECURE === 'true' || request.socket.encrypted;
  return `${cookie}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? lifetime : 0}${secure ? '; Secure' : ''}`;
}

export function publicAccount(profile) {
  return {id:profile._id,alias:profile.alias,username:profile.username || null,
    revision:profile.revision,hasKingdom:Boolean(profile.state),published:Boolean(profile.published),progress:missionProgress(profile.missions)};
}
