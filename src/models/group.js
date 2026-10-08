import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['member', 'admin', 'superadmin'],
      required: true,
    },
  },
  { _id: false },
);

const groupSchema = new mongoose.Schema(
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
    icon: {
      type: String,
    },
    coverPhoto: {
      type: String,
    },
    visibility: {
      type: String,
      enum: ['public', 'private', 'secret'],
      required: true,
    },
    membersCanPost: {
      type: Boolean,
      default: true,
    },
    membersCanCreateEvents: {
      type: Boolean,
      default: true,
    },
    members: {
      type: [memberSchema],
      required: true,
      validate: {
        validator(members) {
          const ids = members.map((member) => String(member.user));
          const unique = new Set(ids).size === ids.length;
          const hasSuperadmin = members.some((member) => member.role === 'superadmin');
          return unique && hasSuperadmin;
        },
        message: 'Members must be unique and include a superadmin',
      },
    },
  },
  { timestamps: true },
);

groupSchema.index({ 'members.user': 1 });

groupSchema.methods.memberRole = function memberRole(userId) {
  const member = this.members.find((entry) => entry.user.equals(userId));
  return member ? member.role : null;
};

groupSchema.methods.toProfile = function toProfile({ role = null, includeMembers = false } = {}) {
  const profile = {
    id: this.id,
    name: this.name,
    description: this.description,
    icon: this.icon ?? null,
    coverPhoto: this.coverPhoto ?? null,
    visibility: this.visibility,
    membersCanPost: this.membersCanPost,
    membersCanCreateEvents: this.membersCanCreateEvents,
    role,
  };

  if (includeMembers) {
    profile.members = this.members.map((member) => ({
      user: member.user.toPublic(),
      role: member.role,
    }));
  }

  return profile;
};

const Group = mongoose.model('Group', groupSchema);

export default Group;
