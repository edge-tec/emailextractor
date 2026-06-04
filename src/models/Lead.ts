import mongoose, { Schema, Document, models } from 'mongoose';

export interface ILead extends Document {
  user_id: mongoose.Types.ObjectId | string;
  sender_email: string;
  message_id: string;
  created_at: Date;
}

const LeadSchema = new Schema<ILead>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  sender_email: { type: String, required: true },
  message_id: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
});

// Create a compound unique index to prevent duplicate sender_emails per user
// A user should not have the same sender_email extracted multiple times.
LeadSchema.index({ user_id: 1, sender_email: 1 }, { unique: true });

// Optionally, we could also create an index on message_id if we want to ensure 
// we don't process the same message twice, but the uniqueness is really about the sender email.
// Wait, the requirements state: "Store only unique sender emails... Prevent duplicates across all emails".
// The above compound index satisfies this. 

export default models.Lead || mongoose.model<ILead>('Lead', LeadSchema);
