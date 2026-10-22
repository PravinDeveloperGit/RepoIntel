import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'oklch(17% 0.03 265)',
              color: 'oklch(92% 0.01 265)',
              border: '1px solid oklch(33% 0.03 265)',
            },
            success: {
              iconTheme: { primary: 'oklch(70% 0.19 155)', secondary: 'oklch(17% 0.03 265)' },
            },
            error: {
              iconTheme: { primary: 'oklch(65% 0.22 15)', secondary: 'oklch(17% 0.03 265)' },
            },
          }}
        />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
