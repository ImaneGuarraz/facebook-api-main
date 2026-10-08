import { Router } from 'express';

import { getMe, updateMe } from '../controllers/userController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { updateMeSchema } from '../validators/user.js';

const router = Router();

router.get('/me', authenticate, getMe);
router.patch('/me', authenticate, validate(updateMeSchema), updateMe);

export default router;
