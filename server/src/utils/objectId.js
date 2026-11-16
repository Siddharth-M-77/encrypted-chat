import mongoose from 'mongoose';
import { z } from 'zod';

export const isObjectId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v) && mongoose.isValidObjectId(v);
export const zObjectId = z.string().refine(isObjectId, 'Invalid id');
