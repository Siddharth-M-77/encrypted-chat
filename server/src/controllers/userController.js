import { ok } from '../utils/response.js';
import * as users from '../services/userService.js';
import * as blocks from '../services/blockActions.js';

export async function search(req, res) {
  ok(res, { users: await users.searchUsers(req.user, req.valid.query.q) });
}

export async function getById(req, res) {
  ok(res, { user: await users.getUserById(req.user, req.valid.params.id) });
}

export async function updateMe(req, res) {
  ok(res, { user: await users.updateProfile(req.user, req.valid.body) }, 'Profile updated');
}

export async function getKeys(req, res) {
  ok(res, await users.getOwnKeys(req.user._id));
}

export async function putKeys(req, res) {
  ok(res, { user: await users.saveKeys(req.user._id, req.valid.body) }, 'Keys saved');
}

export async function block(req, res) {
  ok(res, { user: await blocks.blockUser(req.user, req.valid.params.id) }, 'User blocked');
}
export async function unblock(req, res) {
  ok(res, { user: await blocks.unblockUser(req.user, req.valid.params.id) }, 'User unblocked');
}
export async function blocked(req, res) {
  ok(res, { users: await blocks.listBlocked(req.user) });
}
