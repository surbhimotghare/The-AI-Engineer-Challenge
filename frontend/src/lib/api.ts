// API integration for AI RAG Chat Application

// API Base URL Configuration
const getApiBaseUrl = () => {
  // In development, use localhost:8000
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:8000';
  }
  
  // In production, use relative URLs (same domain) - this prevents CORS issues
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  
  // Default to relative URLs for production deployment
  return '';
};

const API_BASE_URL = getApiBaseUrl();

// Type definitions
export interface PDFInfo {
  filename: string;
  content_length: number;
  num_pages: number;
  num_chunks: number;
  total_text_length: number;
}

export interface ChatRequest {
  developer_message: string;
  user_message: string;
  model: string;
  api_key: string;
}

export interface RAGChatRequest {
  question: string;
  k?: number;
  api_key: string;
}

export interface PDFStatusResponse {
  is_indexed: boolean;
  pdf_info: PDFInfo | null;
  vector_db_size: number;
}

// Chat API Functions
export const sendChatMessage = async (
  request: ChatRequest,
  onChunk: (chunk: string) => void
): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Chat request failed: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader available');
    }

    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      if (chunk) {
        onChunk(chunk);
      }
    }
  } catch (error) {
    console.error('Error in sendChatMessage:', error);
    throw error;
  }
};

// RAG Chat API Functions
export const sendRAGChatMessage = async (
  request: RAGChatRequest,
  onChunk: (chunk: string) => void
): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/rag-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `RAG chat request failed: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader available');
    }

    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      if (chunk) {
        onChunk(chunk);
      }
    }
  } catch (error) {
    console.error('Error in sendRAGChatMessage:', error);
    throw error;
  }
};

// PDF Status API
export const getPDFStatus = async (): Promise<PDFStatusResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/pdf-status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`PDF status request failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error in getPDFStatus:', error);
    throw error;
  }
};

// PDF Management APIs (for completeness)
export const clearPDFIndex = async (): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/clear-pdf`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Clear PDF request failed: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error in clearPDFIndex:', error);
    throw error;
  }
};

// Health check
export const checkHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    return response.ok;
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}; 