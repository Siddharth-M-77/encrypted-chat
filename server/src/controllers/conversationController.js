import { ok } from '../utils/response.js';
import * as conversations from '../services/conversationService.js';
import * as messages from '../services/messageService.js';
import * as groups from '../services/groupService.js';

export async function list(req, res) {
  ok(res, await conversations.listConversations(req.user, req.valid.query));
}

export async function createDirect(req, res) {
  ok(res, { conversation: await conversations.createDirect(req.user, req.valid.body.userId) }, 'OK', 200);
}

export async function listMessages(req, res) {
  ok(res, await messages.listMessages(req.valid.params.id, req.user._id, req.valid.query));
}

export async function createGroup(req, res) {
  ok(res, { conversation: await groups.createGroup(req.user, req.valid.body) }, 'Group created', 201);
}
export async function updateGroup(req, res) {
  ok(res, { conversation: await groups.updateGroup(req.user, req.valid.params.id, req.valid.body) });
}
export async function addMembers(req, res) {
  ok(res, { conversation: await groups.addMembers(req.user, req.valid.params.id, req.valid.body) });
}
export async function removeMember(req, res) {
  const { id, userId } = req.valid.params;
  ok(res, { conversation: await groups.removeMember(req.user, id, userId, req.valid.body) });
}
export async function leave(req, res) {
  await groups.leaveGroup(req.user, req.valid.params.id);
  ok(res, null, 'Left group');
}
export async function rotateKeys(req, res) {
  await groups.rotateKeys(req.user, req.valid.params.id, req.valid.body);
  ok(res, null, 'Key rotated');
}
export async function getKeys(req, res) {
  ok(res, { keys: await groups.getKeys(req.user._id, req.valid.params.id) });
}
export async function allKeys(req, res) {
  ok(res, { keys: await groups.getAllKeys(req.user._id) });
}
