// @deno-types="npm:@types/ws@8.18.1"
import WebSocket from 'npm:ws@8.18.3';
import { makeHandler, createDatabaseLimiter } from '../_shared/router.ts';
import type { SocketLike } from '../_shared/audio.ts';

const env = (name: string) => Deno.env.get(name);
Deno.serve(makeHandler(env, (url, key) => new WebSocket(url, {
  headers: { Authorization: `Bearer ${key}` },
}) as unknown as SocketLike, createDatabaseLimiter(env)));
