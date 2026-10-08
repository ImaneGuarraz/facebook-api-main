import { Router } from 'express';

import {
  acceptEventInvitation,
  declineEventInvitation,
} from '../controllers/eventInvitationController.js';
import { authenticate } from '../middlewares/authenticate.js';

const router = Router();

router.use(authenticate);

router.post('/:id/accept', acceptEventInvitation);
router.post('/:id/decline', declineEventInvitation);

export default router;
