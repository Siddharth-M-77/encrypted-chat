import mongoose from 'mongoose';

const { Schema } = mongoose;

// Metadata for an encrypted blob. The server never knows the real name, type or contents of the file.
const fileSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    storagePath: { type: String, required: true }, // opaque key understood by the storage backend
    size: { type: Number, required: true },
    mimeType: { type: String, default: 'application/octet-stream', enum: ['application/octet-stream'] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const File = mongoose.model('File', fileSchema);
