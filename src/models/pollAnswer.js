import mongoose from 'mongoose';

const choiceSchema = new mongoose.Schema(
  {
    question: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    option: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
  },
  { _id: false },
);

const pollAnswerSchema = new mongoose.Schema(
  {
    poll: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Poll',
      required: true,
    },
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
    choices: {
      type: [choiceSchema],
      required: true,
      validate: {
        validator(choices) {
          return choices.length >= 1;
        },
        message: 'An answer needs one choice per question',
      },
    },
  },
  { timestamps: true },
);

pollAnswerSchema.index({ poll: 1, user: 1 }, { unique: true });
pollAnswerSchema.index({ event: 1, user: 1 });

const PollAnswer = mongoose.model('PollAnswer', pollAnswerSchema);

export default PollAnswer;
