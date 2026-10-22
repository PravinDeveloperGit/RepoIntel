import mongoose, { Schema, Document, Types } from 'mongoose';

export type IndexStatus =
  | 'none'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export interface IRepository extends Document {
  ownerId: Types.ObjectId;
  name: string;
  description: string;
  sourceType: 'upload';
  languages: string[];
  indexStatus: IndexStatus;
  indexVersion: number;
  fileCount: number;
  chunkCount: number;
  indexStats: {
    totalFiles: number;
    processedFiles: number;
    skippedFiles: number;
    parseFailures: number;
    embeddingModel: string;
    indexDurationMs: number;
    indexedAt: Date | null;
  };
  storagePath: string;
  createdAt: Date;
  updatedAt: Date;
}

const repositorySchema = new Schema<IRepository>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    sourceType: { type: String, enum: ['upload'], default: 'upload' },
    languages: [{ type: String }],
    indexStatus: {
      type: String,
      enum: ['none', 'pending', 'processing', 'completed', 'failed'],
      default: 'none',
    },
    indexVersion: { type: Number, default: 0 },
    fileCount: { type: Number, default: 0 },
    chunkCount: { type: Number, default: 0 },
    indexStats: {
      totalFiles: { type: Number, default: 0 },
      processedFiles: { type: Number, default: 0 },
      skippedFiles: { type: Number, default: 0 },
      parseFailures: { type: Number, default: 0 },
      embeddingModel: { type: String, default: '' },
      indexDurationMs: { type: Number, default: 0 },
      indexedAt: { type: Date, default: null },
    },
    storagePath: { type: String, default: '' },
  },
  { timestamps: true }
);

repositorySchema.index({ ownerId: 1 });
repositorySchema.index({ ownerId: 1, name: 1 });

export const Repository = mongoose.model<IRepository>(
  'Repository',
  repositorySchema
);
