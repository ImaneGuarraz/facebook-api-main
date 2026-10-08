import mongoose from 'mongoose';

function sameId(left, right) {
  return String(left?._id ?? left) === String(right?._id ?? right);
}

function userIdList(validate) {
  return {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    required: true,
    validate,
  };
}

const eventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    coverPhoto: {
      type: String,
    },
    visibility: {
      type: String,
      enum: ['public', 'private'],
      required: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    organizers: userIdList({
      validator(organizers) {
        const ids = organizers.map((user) => String(user));
        return organizers.length > 0 && new Set(ids).size === ids.length;
      },
      message: 'Organizers must be unique and include at least one',
    }),
    participants: userIdList({
      validator(participants) {
        const ids = participants.map((user) => String(user));
        return new Set(ids).size === ids.length;
      },
      message: 'Participants must be unique',
    }),
    shoppingListEnabled: {
      type: Boolean,
      default: false,
    },
    carpoolingEnabled: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

eventSchema.index({ organizers: 1 });
eventSchema.index({ participants: 1 });
eventSchema.index({ group: 1 });
eventSchema.index({ startDate: 1 });

eventSchema.methods.isOrganizer = function isOrganizer(userId) {
  return this.organizers.some((user) => sameId(user, userId));
};

eventSchema.methods.isParticipant = function isParticipant(userId) {
  return this.participants.some((user) => sameId(user, userId));
};

eventSchema.methods.toProfile = function toProfile() {
  return {
    id: this.id,
    name: this.name,
    description: this.description,
    startDate: this.startDate,
    endDate: this.endDate,
    location: this.location,
    coverPhoto: this.coverPhoto ?? null,
    visibility: this.visibility,
    group: this.group ? String(this.group) : null,
    createdBy: this.createdBy.toPublic(),
    organizers: this.organizers.map((user) => user.toPublic()),
    participants: this.participants.map((user) => user.toPublic()),
    shoppingListEnabled: this.shoppingListEnabled,
    carpoolingEnabled: this.carpoolingEnabled,
  };
};

const Event = mongoose.model('Event', eventSchema);

export default Event;
