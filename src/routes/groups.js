import { Router } from 'express';

import { createGroupEvent, inviteGroupMembers } from '../controllers/eventController.js';
import {
  createGroup,
  deleteGroup,
  getGroup,
  listGroups,
  updateGroup,
} from '../controllers/groupController.js';
import {
  acceptJoinRequest,
  createInvitation,
  joinGroup,
  listJoinRequests,
  rejectJoinRequest,
  removeMember,
  updateMember,
} from '../controllers/membershipController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { createEventSchema } from '../validators/event.js';
import { createGroupSchema, updateGroupSchema } from '../validators/group.js';
import { createInvitationSchema, updateMemberSchema } from '../validators/membership.js';

const router = Router();

router.use(authenticate);

router.post('/', validate(createGroupSchema), createGroup);
router.get('/', listGroups);
router.post('/:id/join', joinGroup);
router.get('/:id/join-requests', listJoinRequests);
router.post('/:id/join-requests/:userId/accept', acceptJoinRequest);
router.post('/:id/join-requests/:userId/reject', rejectJoinRequest);
router.post('/:id/invitations', validate(createInvitationSchema), createInvitation);
router.post('/:id/events', validate(createEventSchema), createGroupEvent);
router.post('/:id/events/:eventId/invite-members', inviteGroupMembers);
router.patch('/:id/members/:userId', validate(updateMemberSchema), updateMember);
router.delete('/:id/members/:userId', removeMember);
router.get('/:id', getGroup);
router.patch('/:id', validate(updateGroupSchema), updateGroup);
router.delete('/:id', deleteGroup);

export default router;
