import { z } from 'zod';

export const testSchema = z.object({
    username: z.string().min(3, "Мінімум 3 символи"),
    bio: z.string().min(10, "Опис має бути довшим за 10 символів"),
    role: z.string().min(1, "Обери роль зі списку"),
});

export type TestFormValues = z.infer<typeof testSchema>
