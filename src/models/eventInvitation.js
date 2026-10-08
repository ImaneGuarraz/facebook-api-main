import mongoose from 'mongoose';

const eventInvitationSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending',
      required: true,
    },
  },
  { timestamps: true },
);

eventInvitationSchema.index(
  { event: 1, user: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);

const EventInvitation = mongoose.model('EventInvitation', eventInvitationSchema);

export default EventInvitation;
