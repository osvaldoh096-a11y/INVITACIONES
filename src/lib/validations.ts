import { z } from 'zod';

// --- Auth (equipo interno) ---
export const loginSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});
export type LoginFormData = z.infer<typeof loginSchema>;

export const createTeammateSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  name: z.string().optional(),
});
export type CreateTeammateFormData = z.infer<typeof createTeammateSchema>;

// --- Eventos ---
export const eventSessionSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'El título es requerido'),
  date: z.coerce.date({ required_error: 'La fecha es requerida' }),
  time: z.string().min(1, 'La hora es requerida'),
  location: z.string().min(1, 'El lugar es requerido'),
  address: z.string().optional(),
});
export type EventSessionFormData = z.infer<typeof eventSessionSchema>;

export const eventProjectSchema = z.object({
  clientName: z.string().min(1, 'El nombre del cliente es requerido'),
  eventName: z.string().min(1, 'El nombre del evento es requerido'),
  eventType: z.string().default('boda'),
  eventDate: z.coerce
    .date()
    .optional()
    .nullable()
    .refine((date) => !date || date.getTime() > Date.now(), {
      message: 'La fecha del evento debe ser posterior a hoy',
    }),
  location: z.string().optional(),
  isPublished: z.boolean().optional(),
  accessPassword: z.string().optional(),
  sessions: z.array(eventSessionSchema).optional(),
});
export type EventProjectFormData = z.infer<typeof eventProjectSchema>;

// --- RSVP (enviado públicamente desde Framer) ---
export const rsvpSubmitSchema = z.object({
  fullName: z.string().min(1, 'El nombre es requerido'),
  phone: z.string().optional(),
  email: z.string().email('Correo inválido').optional().or(z.literal('')),
  attending: z.boolean(),
  companionsCount: z.coerce.number().int().min(0).max(20).default(0),
  companionNames: z.string().optional(),
  dietaryRestrictions: z.string().optional(),
  message: z.string().optional(),
});
export type RsvpSubmitFormData = z.infer<typeof rsvpSubmitSchema>;

// --- Tipos de entidades (reflejan el esquema de Prisma) ---
export interface EventSession {
  id: string;
  title: string;
  date: Date;
  time: string;
  location: string;
  address: string | null;
  order: number;
  eventId: string;
}

export interface EventProject {
  id: string;
  eventCode: string;
  clientName: string;
  eventName: string;
  eventType: string;
  eventDate: Date | null;
  location: string | null;
  isPublished: boolean;
  accessPassword: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  sessions?: EventSession[];
}

export interface RSVP {
  id: string;
  eventId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  attending: boolean;
  companionsCount: number;
  companionNames: string | null;
  dietaryRestrictions: string | null;
  message: string | null;
  syncedToSheets: boolean;
  createdAt: Date;
}
