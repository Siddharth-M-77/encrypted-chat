import mongoose from 'mongoose';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    walletAddress: { type: String, required: true, unique: true, lowercase: true, index: true },
    // Optional unique handle. `sparse` lets many users have no username at all.
    username: { type: String, lowercase: true, trim: true, minlength: 3, maxlength: 20, unique: true, sparse: true },
    displayName: { type: String, trim: true, maxlength: 40, default: '' },
    avatarUrl: { type: String, trim: true, maxlength: 500, default: '' },
    bio: { type: String, trim: true, maxlength: 160, default: '' },

    // E2EE material (populated in Phase 2). Backup is an already-encrypted blob; the server cannot read it.
    publicKey: { type: String, default: null },
    encryptedPrivateKeyBackup: { type: String, default: null, select: false },
    keySalt: { type: String, default: null, select: false },

    lastSeen: { type: Date, default: Date.now },
    blockedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Shape returned to other users (never includes key backups or block list).
userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    walletAddress: this.walletAddress,
    username: this.username ?? null,
    displayName: this.displayName,
    avatarUrl: this.avatarUrl,
    bio: this.bio,
    publicKey: this.publicKey,
    lastSeen: this.lastSeen,
    createdAt: this.createdAt,
  };
};

// Shape returned to the user themselves.
userSchema.methods.toSelf = function toSelf() {
  return {
    ...this.toPublic(),
    blockedUsers: (this.blockedUsers || []).map(String),
    hasKeys: Boolean(this.publicKey),
  };
};

export const User = mongoose.model('User', userSchema);
