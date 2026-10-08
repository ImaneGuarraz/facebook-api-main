import { Router } from 'express';

import {
  addOrganizer,
  createEvent,
  createEventInvitation,
  deleteEvent,
  getEvent,
  joinEvent,
  listEvents,
  removeOrganizer,
  removeParticipant,
  updateEvent,
} from '../controllers/eventController.js';
import {
  answerPoll,
  createPoll,
  deletePoll,
  getPoll,
  listPolls,
} from '../controllers/pollController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { createEventSchema, updateEventSchema, userIdSchema } from '../validators/event.js';
import { answerPollSchema, createPollSchema } from '../validators/poll.js';

const router = Router();

router.use(authenticate);

router.post('/', validate(createEventSchema), createEvent);
router.get('/', listEvents);
router.post('/:id/organizers', validate(userIdSchema), addOrganizer);
router.delete('/:id/organizers/:userId', removeOrganizer);
router.post('/:id/participants', joinEvent);
router.delete('/:id/participants/:userId', removeParticipant);
router.post('/:id/invitations', validate(userIdSchema), createEventInvitation);
router.post('/:id/polls', validate(createPollSchema), createPoll);
router.get('/:id/polls', listPolls);
router.put('/:id/polls/:pollId/answers', validate(answerPollSchema), answerPoll);
router.get('/:id/polls/:pollId', getPoll);
router.delete('/:id/polls/:pollId', deletePoll);
router.get('/:id', getEvent);
router.patch('/:id', validate(updateEventSchema), updateEvent);
router.delete('/:id', deleteEvent);

export default router;
