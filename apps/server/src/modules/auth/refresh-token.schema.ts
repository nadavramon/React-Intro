import { Schema, model, Types, InferSchemaType } from 'mongoose';

const refreshTokenSchema = new Schema(
  {
    token: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshTokenDoc = InferSchemaType<typeof refreshTokenSchema> & {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
};

export const RefreshTokenModel = model('RefreshToken', refreshTokenSchema);
