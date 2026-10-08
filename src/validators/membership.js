import { z } from 'zod';

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');

export const createInvitationSchema = z
  .object({
    userId: objectId,
  })
  .strict();

export const updateMemberSchema = z
  .object({
    role: z.enum(['member', 'admin', 'superadmin']),
  })
  .strict();
