import mongoose from 'mongoose';

const { Schema } = mongoose;

const conversationSchema = new Schema(
  {
    type: { type: String, enum: ['direct', 'group'], required: true },
    participants: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], index: true },
    name: { type: String, trim: true, maxlength: 60 },
    avatarUrl: { type: String, trim: true, maxlength: 500 },
    admins: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastMessage: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    keyVersion: { type: Number, default: 1 },
    // Set when a member left: an admin client must rotate the group key so the leaver cannot read new messages.
    rotationPending: { type: Boolean, default: false },
    // "<smallerId>:<largerId>" for direct chats. The unique sparse index makes duplicate 1:1 conversations impossible.
    directKey: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1, updatedAt: -1 });

export const directKeyFor = (a, b) => [String(a), String(b)].sort().join(':');

export const Conversation = mongoose.model('Conversation', conversationSchema);
