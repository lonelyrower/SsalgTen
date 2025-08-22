import { z } from 'zod';

export const CreateUserSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'OPERATOR', 'VIEWER']).optional(),
  active: z.boolean().optional(),
}).strict();

export const UpdateUserSchema = z.object({
  username: z.string().min(1).optional(),
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  avatar: z.string().url().optional(),
  role: z.enum(['ADMIN', 'OPERATOR', 'VIEWER']).optional(),
  active: z.boolean().optional(),
}).strict();

export const CreateNodeSchema = z.object({
  name: z.string().min(1),
  hostname: z.string().optional(),
  country: z.string().min(1),
  city: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  ipv4: z.string().optional(),
  ipv6: z.string().optional(),
  provider: z.string().min(1),
  datacenter: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
}).strict();

export const UpdateNodeSchema = z.object({
  name: z.string().min(1).optional(),
  hostname: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  ipv4: z.string().optional(),
  ipv6: z.string().optional(),
  provider: z.string().optional(),
  datacenter: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['ONLINE', 'OFFLINE', 'UNKNOWN']).optional(),
}).strict();

