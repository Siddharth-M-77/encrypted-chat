import mongoose from 'mongoose';

const { Schema } = mongoose;

// Delivery state tracked separately for each recipient.
const statusSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
    deliveredAt: Date,
    readAt: Date,
  },
  { _id: false }
);

// The server only ever stores ciphertext. `type` is routing metadata; the real payload is inside the ciphertext.
const messageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    ciphertext: { type: String, required: true, maxlength: 20000 },
    nonce: { type: String, required: true, maxlength: 64 },
    // Copy encrypted to the sender's own key so they can read history on other devices (direct chats).
    ciphertextForSender: { type: String, maxlength: 20000 },
    nonceForSender: { type: String, maxlength: 64 },
    keyVersion: { type: Number, default: 1 },
    type: { type: String, enum: ['text', 'image', 'file', 'audio'], default: 'text' },
    replyTo: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    status: [statusSchema],
    deletedForEveryone: { type: Boolean, default: false },
    deletedFor: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

messageSchema.index({ conversationId: 1, _id: -1 }); // cursor pagination
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ 'status.userId': 1, 'status.status': 1 }); // unread / undelivered lookups

export const Message = mongoose.model('Message', messageSchema);
