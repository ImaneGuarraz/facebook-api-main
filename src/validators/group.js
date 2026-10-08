import { z } from 'zod';

const name = z.string().trim().min(1).max(80);
const description = z.string().trim().max(2000);
const visibility = z.enum(['public', 'private', 'secret']);
const photoUrl = z.url();

export const createGroupSchema = z
  .object({
    name,
    description: description.optional(),
    icon: photoUrl.optional(),
    coverPhoto: photoUrl.optional(),
    visibility,
    membersCanPost: z.boolean().optional(),
    membersCanCreateEvents: z.boolean().optional(),
  })
  .strict();

export const updateGroupSchema = z
  .object({
    name: name.optional(),
    description: description.optional(),
    icon: photoUrl.optional(),
    coverPhoto: photoUrl.optional(),
    visibility: visibility.optional(),
    membersCanPost: z.boolean().optional(),
    membersCanCreateEvents: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required',
  });
