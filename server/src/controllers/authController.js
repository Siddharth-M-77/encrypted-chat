import { ok } from '../utils/response.js';
import { createNonce, verifySiwe } from '../services/authService.js';
import { COOKIE_NAME, cookieOptions, signToken } from '../utils/token.js';

export async function getNonce(req, res) {
  const nonce = await createNonce(req.valid.query.address);
  ok(res, { nonce });
}

export async function verify(req, res) {
  const user = await verifySiwe(req.valid.body);
  res.cookie(COOKIE_NAME, signToken(user._id), cookieOptions());
  ok(res, { user: user.toSelf() }, 'Signed in');
}

export async function me(req, res) {
  ok(res, { user: req.user.toSelf() });
}

export async function logout(_req, res) {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie(COOKIE_NAME, opts);
  ok(res, null, 'Signed out');
}
