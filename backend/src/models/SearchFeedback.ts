import mongoose, { Schema, Document, Types } from 'mongoose';

export type FeedbackType = 'positive' | 'negative';
export type FeedbackCategory =
  | 'correct_implementation'
  | 'partially_relevant'
  | 'irrelevant'
  | 'wrong_file'
  | 'missing_context';

export interface ISearchFeedback extends Document {
  userId: Types.ObjectId;
  searchId: Types.ObjectId;
  chunkId: string;
  feedback: FeedbackType;
  category?: FeedbackCategory;
  repositoryId: Types.ObjectId;
  query: string;
  retrievalConfig: Record<string, unknown>;
  createdAt: Date;
}

const searchFeedbackSchema = new Schema<ISearchFeedback>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    searchId: {
      type: Schema.Types.ObjectId,
      ref: 'SearchHistory',
      required: true,
    },
    chunkId: { type: String, required: true },
    feedback: { type: String, enum: ['positive', 'negative'], required: true },
    category: {
      type: String,
      enum: [
        'correct_implementation',
        'partially_relevant',
        'irrelevant',
        'wrong_file',
        'missing_context',
      ],
    },
    repositoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Repository',
      required: true,
    },
    query: { type: String, required: true },
    retrievalConfig: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

searchFeedbackSchema.index({ userId: 1, searchId: 1 });
searchFeedbackSchema.index({ repositoryId: 1, feedback: 1 });

export const SearchFeedback = mongoose.model<ISearchFeedback>(
  'SearchFeedback',
  searchFeedbackSchema
);
