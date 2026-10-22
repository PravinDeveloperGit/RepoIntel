import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { Repository } from '../models/Repository';
import { Conversation } from '../models/Conversation';
import { AppError } from '../middleware/errorHandler';

export const qaRouter = Router();
qaRouter.use(authenticate);

const askSchema = z.object({
  question: z.string().min(1).max(1000),
  repositoryId: z.string(),
  conversationId: z.string().optional(),
  topK: z.number().int().min(1).max(20).default(8),
});

// POST /api/qa/ask
qaRouter.post(
  '/ask',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { question, repositoryId, conversationId, topK } =
        askSchema.parse(req.body);

      const repo = await Repository.findOne({
        _id: repositoryId,
        ownerId: req.userId,
      });
      if (!repo) throw new AppError('Repository not found.', 404);
      if (repo.indexStatus !== 'completed') {
        throw new AppError('Repository must be indexed before Q&A.', 400);
      }

      // Load conversation if continuing
      let conversation = conversationId
        ? await Conversation.findOne({
            _id: conversationId,
            userId: req.userId,
            repositoryId,
          })
        : null;

      if (!conversation) {
        conversation = await Conversation.create({
          userId: req.userId,
          repositoryId,
          title: question.slice(0, 80),
          messages: [],
        });
      }

      // Add user message
      conversation.messages.push({
        role: 'user',
        content: question,
        evidenceChunkIds: [],
        citations: [],
        createdAt: new Date(),
      });

      const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      const aiResponse = await axios.post(`${aiUrl}/qa`, {
        question,
        repository_id: repositoryId,
        top_k: topK,
      });

      const { answer, citations, evidenceChunkIds, evidenceSufficient } =
        aiResponse.data;

      // Add assistant message
      conversation.messages.push({
        role: 'assistant',
        content: answer,
        evidenceChunkIds: evidenceChunkIds || [],
        citations: citations || [],
        createdAt: new Date(),
      });

      await conversation.save();

      res.json({
        conversationId: conversation._id,
        answer,
        citations,
        evidenceSufficient,
        evidenceChunkIds,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/qa/conversations
qaRouter.get(
  '/conversations',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const conversations = await Conversation.find({
        userId: req.userId,
      })
        .sort({ updatedAt: -1 })
        .limit(20)
        .select('title repositoryId updatedAt createdAt');

      res.json({ conversations });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/qa/conversations/:id
qaRouter.get(
  '/conversations/:id',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const conversation = await Conversation.findOne({
        _id: req.params.id,
        userId: req.userId,
      });
      if (!conversation) throw new AppError('Conversation not found.', 404);
      res.json({ conversation });
    } catch (err) {
      next(err);
    }
  }
);
