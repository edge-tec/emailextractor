import mongoose, { Schema, Document, models } from 'mongoose';

export interface IUser extends Document {
  google_id: string;
  email: string;
  name: string;
  access_token: string;
  refresh_token: string;
  created_at: Date;
}

const UserSchema = new Schema<IUser>({
  google_id: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  access_token: { type: String },
  refresh_token: { type: String },
  created_at: { type: Date, default: Date.now },
});

// Avoid OverwriteModelError in Next.js development mode
export default models.User || mongoose.model<IUser>('User', UserSchema);
