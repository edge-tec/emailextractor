import mongoose, { Schema, Document, models } from 'mongoose';

export interface IUser extends Document {
  email: string;
  app_password?: string;
  created_at: Date;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  app_password: { type: String }, // Encrypted App Password
  created_at: { type: Date, default: Date.now },
});

// Avoid OverwriteModelError in Next.js development mode
export default models.User || mongoose.model<IUser>('User', UserSchema);
