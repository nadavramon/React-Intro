import { Schema, model, InferSchemaType, Types } from 'mongoose';

const welcomeEmailSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true }, // better-auth user.id (string), the idempotency key
    email: { type: String, required: true },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    attempts: { type: Number, default: 0 }, // transient-send-failure counter (NOT a redelivery counter)
    sentAt: { type: Date },
    lastError: { type: String },
  },
  { timestamps: true },
);

export type WelcomeEmailDoc = InferSchemaType<typeof welcomeEmailSchema> & {
  _id: Types.ObjectId;
};

export const WelcomeEmailModel = model('WelcomeEmail', welcomeEmailSchema);
