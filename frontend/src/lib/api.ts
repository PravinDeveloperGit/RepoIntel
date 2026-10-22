import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ri_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally — redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ri_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Auth ─────────────────────────────────────────────────────
export const authAPI = {
  register: (data: { email: string; password: string; displayName: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

// ── Repositories ─────────────────────────────────────────────
export const repoAPI = {
  list: (page = 1, limit = 20) =>
    api.get('/repositories', { params: { page, limit } }),
  get: (id: string) => api.get(`/repositories/${id}`),
  create: (data: { name: string; description?: string }) =>
    api.post('/repositories', data),
  delete: (id: string) => api.delete(`/repositories/${id}`),
  upload: (id: string, file: File) => {
    const form = new FormData();
    form.append('archive', file);
    return api.post(`/repositories/${id}/upload`, form);
  },
  reindex: (id: string) => api.post(`/repositories/${id}/index`),
  indexStatus: (id: string) => api.get(`/repositories/${id}/index-status`),
  statistics: (id: string) => api.get(`/repositories/${id}/statistics`),
};

// ── Search ────────────────────────────────────────────────────
export const searchAPI = {
  search: (params: {
    query: string;
    repositoryId: string;
    mode?: string;
    topK?: number;
    languageFilter?: string;
    pathFilter?: string;
    rerankerEnabled?: boolean;
    contextExpansion?: boolean;
  }) => api.post('/search', params),
  history: (page = 1, limit = 20) =>
    api.get('/search/history', { params: { page, limit } }),
};

// ── Q&A ───────────────────────────────────────────────────────
export const qaAPI = {
  ask: (data: {
    question: string;
    repositoryId: string;
    conversationId?: string;
    topK?: number;
  }) => api.post('/qa/ask', data),
  conversations: () => api.get('/qa/conversations'),
  conversation: (id: string) => api.get(`/qa/conversations/${id}`),
};

// ── Feedback ─────────────────────────────────────────────────
export const feedbackAPI = {
  submit: (data: {
    searchId: string;
    chunkId: string;
    feedback: 'positive' | 'negative';
    category?: string;
  }) => api.post('/feedback', data),
  summary: (repositoryId?: string) =>
    api.get('/feedback/summary', { params: repositoryId ? { repositoryId } : {} }),
};

// ── Evaluation ────────────────────────────────────────────────
export const evalAPI = {
  createRun: (data: {
    systemVariant: string;
    datasetName?: string;
    repositoryId?: string;
    config?: Record<string, unknown>;
  }) => api.post('/evaluation/runs', data),
  runs: () => api.get('/evaluation/runs'),
  run: (runId: string) => api.get(`/evaluation/runs/${runId}`),
  compare: () => api.get('/evaluation/compare'),
};

// ── Source ────────────────────────────────────────────────────
export const sourceAPI = {
  files: (repoId: string) =>
    api.get(`/source/repositories/${repoId}/files`),
  source: (repoId: string, path: string, startLine?: number, endLine?: number) =>
    api.get(`/source/repositories/${repoId}/source`, {
      params: { path, startLine, endLine },
    }),
  symbols: (repoId: string, params?: Record<string, string>) =>
    api.get(`/source/repositories/${repoId}/symbols`, { params }),
  relationships: (repoId: string, path?: string) =>
    api.get(`/source/repositories/${repoId}/relationships`, {
      params: path ? { path } : {},
    }),
};
