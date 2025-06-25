

export interface User {
  id: string;
  email: string;
  name: string;
  apiKey?: string;
  tokensUsed: number;
  tokenLimit: number;
}

export interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
}