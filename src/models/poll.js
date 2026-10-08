import mongoose from 'mongoose';

const optionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
  },
});

const questionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
  },
  options: {
    type: [optionSchema],
    required: true,
    validate: {
      validator(options) {
        return options.length >= 2;
      },
      message: 'A question needs at least two options',
    },
  },
});

const pollSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    questions: {
      type: [questionSchema],
      required: true,
      validate: {
        validator(questions) {
          return questions.length >= 1;
        },
        message: 'A poll needs at least one question',
      },
    },
  },
  { timestamps: true },
);

pollSchema.index({ event: 1 });

pollSchema.methods.toProfile = function toProfile({ counts, myChoices }) {
  return {
    id: this.id,
    event: String(this.event),
    createdBy: this.createdBy.toPublic(),
    questions: this.questions.map((question) => ({
      id: question.id,
      text: question.text,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
        count: counts.get(String(option._id)) ?? 0,
      })),
    })),
    myChoices,
  };
};

const Poll = mongoose.model('Poll', pollSchema);

export default Poll;
