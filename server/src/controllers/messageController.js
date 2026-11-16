import { ok } from '../utils/response.js';
import * as messages from '../services/messageService.js';

export async function remove(req, res) {
  await messages.deleteMessage(req.user, req.valid.params.id, req.valid.query);
  ok(res, null, 'Message deleted');
}
