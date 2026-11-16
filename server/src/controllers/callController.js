import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { ok } from '../utils/response.js';

const TTL_SECONDS = 60 * 60;

// coturn "TURN REST API" credentials: username = "<expiry>:<userId>", password = base64(HMAC-SHA1(secret, username)).
// They expire on their own, so nothing needs to be stored or revoked.
export function iceServers(req, res) {
  const servers = [{ urls: (env.STUN_URL || 'stun:stun.l.google.com:19302').split(',').map((u) => u.trim()) }];
  if (env.TURN_SECRET && env.TURN_URL) {
    const username = `${Math.floor(Date.now() / 1000) + TTL_SECONDS}:${req.user._id}`;
    const credential = crypto.createHmac('sha1', env.TURN_SECRET).update(username).digest('base64');
    servers.push({ urls: env.TURN_URL.split(',').map((u) => u.trim()), username, credential });
  }
  ok(res, { iceServers: servers, ttl: TTL_SECONDS });
}
