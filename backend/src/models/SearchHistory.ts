import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISearchHistory extends Document {
  userId: Types.ObjectId;
  repositoryId: Types.ObjectId;
  query: string;
  retrievalConfig: {
    mode: string;
    topK: number;
    rerankerEnabled: boolean;
    contextExpansion: boolean;
    languageFilter?: string;
    pathFilter?: string;
  };
  resultCount: number;
  durationMs: number;
  createdAt: Date;
}

const searchHistorySchema = new Schema<ISearchHistory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    repositoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Repository',
      required: true,
    },
    query: { type: String, required: true },
    retrievalConfig: {
      mode: { type: String, default: 'hybrid' },
      topK: { type: Number, default: 10 },
      rerankerEnabled: { type: Boolean, default: true },
      contextExpansion: { type: Boolean, default: false },
      languageFilter: { type: String },
      pathFilter: { type: String },
    },
    resultCount: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
  },
  { timestamps: true }
);

searchHistorySchema.index({ userId: 1, createdAt: -1 });
searchHistorySchema.index({ repositoryId: 1 });

export const SearchHistory = mongoose.model<ISearchHistory>(
  'SearchHistory',
  searchHistorySchema
);
