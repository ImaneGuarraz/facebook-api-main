import { z } from 'zod';

const name = z.string().trim().min(1).max(80);
const description = z.string().trim().max(2000);
const location = z.string().trim().min(1).max(200);
const photoUrl = z.url();
const visibility = z.enum(['public', 'private']);
const date = z.iso.datetime();
const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');

function datesInOrder(body) {
  if (!body.startDate || !body.endDate) {
    return true;
  }

  return new Date(body.startDate) < new Date(body.endDate);
}

const dateOrder = {
  message: 'startDate must be before endDate',
  path: ['endDate'],
};

export const createEventSchema = z
  .object({
    name,
    description: description.optional(),
    startDate: date,
    endDate: date,
    location,
    coverPhoto: photoUrl.optional(),
    visibility,
    shoppingListEnabled: z.boolean().optional(),
    carpoolingEnabled: z.boolean().optional(),
  })
  .strict()
  .refine(datesInOrder, dateOrder);

export const updateEventSchema = z
  .object({
    name: name.optional(),
    description: description.optional(),
    startDate: date.optional(),
    endDate: date.optional(),
    location: location.optional(),
    coverPhoto: photoUrl.optional(),
    visibility: visibility.optional(),
    shoppingListEnabled: z.boolean().optional(),
    carpoolingEnabled: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required',
  })
  .refine(datesInOrder, dateOrder);

export const userIdSchema = z
  .object({
    userId: objectId,
  })
  .strict();
