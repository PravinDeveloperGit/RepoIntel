import mongoose, { Schema, Document } from 'mongoose';

export interface IEvaluationRun extends Omit<Document, 'errors'> {
  runId: string;
  datasetName: string;
  datasetVersion: string;
  splitId: string;
  systemVariant: string; // A, B, C, D, E
  config: Record<string, unknown>;
  metrics: {
    successAt1: number | null;
    successAt5: number | null;
    successAt10: number | null;
    mrr: number | null;
    precisionAt5: number | null;
    precisionAt10: number | null;
    avgLatencyMs: number | null;
    p50LatencyMs: number | null;
    p90LatencyMs: number | null;
    p99LatencyMs: number | null;
    llmCallCount: number | null;
    estimatedCostUsd: number | null;
  };
  sampleCount: number;
  errorCount: number;
  embeddingModel: string;
  rerankerModel: string;
  randomSeed: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  errors: string[];
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number;
  createdAt: Date;
}

const evaluationRunSchema = new Schema<IEvaluationRun>(
  {
    runId: { type: String, required: true, unique: true },
    datasetName: { type: String, required: true },
    datasetVersion: { type: String, default: 'v1' },
    splitId: { type: String, default: 'test' },
    systemVariant: { type: String, required: true },
    config: { type: Schema.Types.Mixed, default: {} },
    metrics: {
      successAt1: { type: Number, default: null },
      successAt5: { type: Number, default: null },
      successAt10: { type: Number, default: null },
      mrr: { type: Number, default: null },
      precisionAt5: { type: Number, default: null },
      precisionAt10: { type: Number, default: null },
      avgLatencyMs: { type: Number, default: null },
      p50LatencyMs: { type: Number, default: null },
      p90LatencyMs: { type: Number, default: null },
      p99LatencyMs: { type: Number, default: null },
      llmCallCount: { type: Number, default: null },
      estimatedCostUsd: { type: Number, default: null },
    },
    sampleCount: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },
    embeddingModel: { type: String, default: '' },
    rerankerModel: { type: String, default: '' },
    randomSeed: { type: Number, default: 42 },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      default: 'pending',
    },
    errors: [{ type: String }],
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    durationMs: { type: Number, default: 0 },
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

evaluationRunSchema.index({ systemVariant: 1, createdAt: -1 });

export const EvaluationRun = mongoose.model<IEvaluationRun>(
  'EvaluationRun',
  evaluationRunSchema
);
