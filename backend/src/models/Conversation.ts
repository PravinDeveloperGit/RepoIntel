import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IConversation extends Document {
  userId: Types.ObjectId;
  repositoryId: Types.ObjectId;
  title: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    evidenceChunkIds: string[];
    citations: Array<{
      filePath: string;
      startLine: number;
      endLine: number;
      chunkId: string;
    }>;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    repositoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Repository',
      required: true,
    },
    title: { type: String, default: 'New Conversation' },
    messages: [
      {
        role: { type: String, enum: ['user', 'assistant'], required: true },
        content: { type: String, required: true },
        evidenceChunkIds: [{ type: String }],
        citations: [
          {
            filePath: { type: String },
            startLine: { type: Number },
            endLine: { type: Number },
            chunkId: { type: String },
          },
        ],
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

conversationSchema.index({ userId: 1, repositoryId: 1, updatedAt: -1 });

export const Conversation = mongoose.model<IConversation>(
  'Conversation',
  conversationSchema
);
