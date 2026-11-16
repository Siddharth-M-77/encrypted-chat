import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { COOKIE_NAME, verifyToken } from '../utils/token.js';

// Resolve the authenticated user from the JWT cookie. The client never tells us who it is.
export async function authenticate(req, _res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next(ApiError.unauthorized('Not authenticated'));
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return next(ApiError.unauthorized('Session expired'));
  }
  const user = await User.findById(payload.sub);
  if (!user) return next(ApiError.unauthorized('User no longer exists'));
  req.user = user;
  next();
}
