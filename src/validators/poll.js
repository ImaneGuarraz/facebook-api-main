import { z } from 'zod';

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');
const questionText = z.string().trim().min(1).max(300);
const optionText = z.string().trim().min(1).max(200);

const questionSchema = z
  .object({
    text: questionText,
    options: z.array(optionText).min(2).max(12),
  })
  .strict();

export const createPollSchema = z
  .object({
    questions: z.array(questionSchema).min(1).max(20),
  })
  .strict();

export const answerPollSchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            questionId: objectId,
            optionId: objectId,
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
  .refine(
    (body) => new Set(body.choices.map((choice) => choice.questionId)).size === body.choices.length,
    {
      message: 'Each question is answered once',
      path: ['choices'],
    },
  );
