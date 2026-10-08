import { Router } from 'express';

import {
  acceptGroupInvitation,
  declineGroupInvitation,
} from '../controllers/groupInvitationController.js';
import { authenticate } from '../middlewares/authenticate.js';

const router = Router();

router.use(authenticate);

router.post('/:id/accept', acceptGroupInvitation);
router.post('/:id/decline', declineGroupInvitation);

export default router;
