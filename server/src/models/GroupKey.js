import mongoose from 'mongoose';

const { Schema } = mongoose;

// One row per (group, member, key version): the group key sealed for that member with nacl.box.
const groupKeySchema = new Schema({
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  keyVersion: { type: Number, required: true },
  encryptedKey: { type: String, required: true, maxlength: 128 },
  nonce: { type: String, required: true, maxlength: 64 },
  // Public key of whoever sealed it; the member needs it to open the box.
  encryptedByPublicKey: { type: String, required: true, maxlength: 64 },
});

groupKeySchema.index({ conversationId: 1, userId: 1, keyVersion: 1 }, { unique: true });
groupKeySchema.index({ userId: 1 });

export const GroupKey = mongoose.model('GroupKey', groupKeySchema);
