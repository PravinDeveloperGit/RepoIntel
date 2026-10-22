import mongoose, { Schema, Document, Types } from 'mongoose';

export type JobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface IIndexingJob extends Omit<Document, 'errors'> {
  repositoryId: Types.ObjectId;
  ownerId: Types.ObjectId;
  status: JobStatus;
  progress: number; // 0-100
  totalFiles: number;
  processedFiles: number;
  skippedFiles: number;
  chunkCount: number;
  parseFailures: number;
  errors: string[];
  embeddingModel: string;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number;
  createdAt: Date;
  updatedAt: Date;
}

const indexingJobSchema = new Schema<IIndexingJob>(
  {
    repositoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Repository',
      required: true,
    },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
      default: 'pending',
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    totalFiles: { type: Number, default: 0 },
    processedFiles: { type: Number, default: 0 },
    skippedFiles: { type: Number, default: 0 },
    chunkCount: { type: Number, default: 0 },
    parseFailures: { type: Number, default: 0 },
    errors: [{ type: String }],
    embeddingModel: { type: String, default: '' },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    durationMs: { type: Number, default: 0 },
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

indexingJobSchema.index({ repositoryId: 1 });
indexingJobSchema.index({ ownerId: 1, status: 1 });

export const IndexingJob = mongoose.model<IIndexingJob>(
  'IndexingJob',
  indexingJobSchema
);
