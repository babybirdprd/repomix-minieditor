// Shared types for backend

export type Provider = 'openai' | 'openrouter' | 'gemini';

export interface PromptRequest {
  provider: Provider;
  apiKey: string;
  baseUrl?: string;
  prompt: string;
}

export interface PromptResponse {
  response?: string;
  error?: string;
}
