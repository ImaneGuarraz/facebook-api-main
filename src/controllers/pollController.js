import Poll from '../models/poll.js';
import PollAnswer from '../models/pollAnswer.js';
import { rejectInvalidId, objectIdPattern } from './groupAccess.js';
import { loadEvent } from './eventAccess.js';

function validationError(res, path, message) {
  res.status(400).json({
    message: 'Validation failed',
    details: [{ path, message }],
  });
}

function isDuplicateKey(error) {
  return error?.code === 11000;
}

function choicesFor(answer) {
  return answer.choices.map((choice) => ({
    questionId: String(choice.question),
    optionId: String(choice.option),
  }));
}

function tally(answers, userId) {
  const counts = new Map();
  const mine = new Map();

  for (const answer of answers) {
    if (String(answer.user) === String(userId)) {
      mine.set(String(answer.poll), choicesFor(answer));
    }

    for (const choice of answer.choices) {
      const key = String(choice.option);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return { counts, mine };
}

async function presentMany(polls, userId) {
  if (polls.length === 0) {
    return [];
  }

  const answers = await PollAnswer.find({
    $or: polls.map((poll) => ({ poll: poll._id })),
  });
  const { counts, mine } = tally(answers, userId);

  return polls.map((poll) =>
    poll.toProfile({
      counts,
      myChoices: mine.get(String(poll._id)) ?? null,
    }),
  );
}

async function presentOne(poll, userId) {
  const [profile] = await presentMany([poll], userId);
  return profile;
}

function questionsFrom(body) {
  return body.questions.map((question) => ({
    text: question.text,
    options: question.options.map((text) => ({ text })),
  }));
}

function readChoices(poll, body, res) {
  if (body.choices.length !== poll.questions.length) {
    validationError(res, 'choices', 'Every question needs exactly one answer');
    return null;
  }

  const choices = [];

  for (const choice of body.choices) {
    const question = poll.questions.id(choice.questionId);

    if (!question) {
      validationError(res, 'choices', 'Unknown question');
      return null;
    }

    const option = question.options.id(choice.optionId);

    if (!option) {
      validationError(res, 'choices', 'Unknown option');
      return null;
    }

    choices.push({ question: question._id, option: option._id });
  }

  return choices;
}

async function loadPoll(req, res) {
  const loaded = await loadEvent(req, res, { populate: false });

  if (!loaded) {
    return null;
  }

  if (!objectIdPattern.test(req.params.pollId)) {
    rejectInvalidId(res, 'pollId');
    return null;
  }

  const poll = await Poll.findById(req.params.pollId);

  if (!poll || !poll.event.equals(loaded.event._id)) {
    res.status(404).json({ message: 'Resource not found' });
    return null;
  }

  return { ...loaded, poll };
}

export async function deletePollsForEvents(eventIds) {
  if (eventIds.length === 0) {
    return;
  }

  const match = { $or: eventIds.map((eventId) => ({ event: eventId })) };
  await PollAnswer.deleteMany(match);
  await Poll.deleteMany(match);
}

export async function createPoll(req, res, next) {
  try {
    const loaded = await loadEvent(req, res, { populate: false });

    if (!loaded) {
      return;
    }

    if (!loaded.isOrganizer) {
      res.status(403).json({ message: 'Insufficient role' });
      return;
    }

    const poll = await Poll.create({
      event: loaded.event._id,
      createdBy: req.user._id,
      questions: questionsFrom(req.body),
    });

    await poll.populate('createdBy');
    res.status(201).json(await presentOne(poll, req.user._id));
  } catch (error) {
    next(error);
  }
}

export async function listPolls(req, res, next) {
  try {
    const loaded = await loadEvent(req, res, { populate: false });

    if (!loaded) {
      return;
    }

    const polls = await Poll.find({ event: loaded.event._id })
      .sort({ createdAt: 1 })
      .populate('createdBy');

    res.json(await presentMany(polls, req.user._id));
  } catch (error) {
    next(error);
  }
}

export async function getPoll(req, res, next) {
  try {
    const loaded = await loadPoll(req, res);

    if (!loaded) {
      return;
    }

    await loaded.poll.populate('createdBy');
    res.json(await presentOne(loaded.poll, req.user._id));
  } catch (error) {
    next(error);
  }
}

export async function deletePoll(req, res, next) {
  try {
    const loaded = await loadPoll(req, res);

    if (!loaded) {
      return;
    }

    if (!loaded.isOrganizer) {
      res.status(403).json({ message: 'Insufficient role' });
      return;
    }

    await PollAnswer.deleteMany({ poll: loaded.poll._id });
    await loaded.poll.deleteOne();
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function answerPoll(req, res, next) {
  try {
    const loaded = await loadPoll(req, res);

    if (!loaded) {
      return;
    }

    if (!loaded.isParticipant) {
      res.status(403).json({ message: 'Insufficient role' });
      return;
    }

    const choices = readChoices(loaded.poll, req.body, res);

    if (!choices) {
      return;
    }

    const existing = await PollAnswer.findOne({
      poll: loaded.poll._id,
      user: req.user._id,
    });

    if (existing) {
      existing.choices = choices;
      await existing.save();
    } else {
      try {
        await PollAnswer.create({
          poll: loaded.poll._id,
          event: loaded.event._id,
          user: req.user._id,
          choices,
        });
      } catch (error) {
        if (!isDuplicateKey(error)) {
          throw error;
        }

        await PollAnswer.updateOne(
          { poll: loaded.poll._id, user: req.user._id },
          { choices },
        );
      }
    }

    await loaded.poll.populate('createdBy');
    res.json(await presentOne(loaded.poll, req.user._id));
  } catch (error) {
    next(error);
  }
}
