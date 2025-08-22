import { z } from 'zod';

export const LoginSchema = z.object({
  username: z.string().min(1, 'username is required'),
  password: z.string().min(1, 'password is required'),
}).strict();

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, 'newPassword must be at least 6 characters'),
}).strict();

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
}).strict();

