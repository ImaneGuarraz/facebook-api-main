import mongoose from 'mongoose';

const joinRequestSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

joinRequestSchema.index({ group: 1, user: 1 }, { unique: true });

const JoinRequest = mongoose.model('JoinRequest', joinRequestSchema);

export default JoinRequest;
