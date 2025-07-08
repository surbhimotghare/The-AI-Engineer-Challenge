// API integration for AI RAG Chat Application

// API Base URL Configuration
const getApiBaseUrl = () => {
  // In development, use localhost:8000
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    console.log('API Base URL: Using localhost for development');
    return 'http://localhost:8000';
  }
  
  // Force relative URLs in production (always use empty string)
  console.log('API Base URL: Using relative URLs (empty string) for production');
  return '';
};

const API_BASE_URL = getApiBaseUrl();
console.log('Final API_BASE_URL:', API_BASE_URL);

// Type definitions
export interface PDFInfo {
  filename: string;
  content_length: number;
  num_pages: number;
  num_chunks: number;
  total_text_length: number;
}

// Course Materials Types
export interface FileInfo {
  filename: string;
  file_type: string;
  file_size: number;
  num_chunks: number;
  processing_metadata: Record<string, any>;
}

export interface CourseUploadResponse {
  status: string;
  message: string;
  processed_files: FileInfo[];
  failed_files: Array<{ filename: string; error: string; status: string }>;
  total_chunks: number;
  is_indexed: boolean;
}

export interface CourseStatusResponse {
  is_indexed: boolean;
  total_files: number;
  course_materials: Record<string, FileInfo>;
  vector_db_size: number;
  supported_file_types: string[];
}

export interface CourseResponse {
  answer: string;
  sources: string[];
  context_used: boolean;
  num_sources?: number;
  educational_guidance: string;
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

export interface CourseChatRequest {
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

// Course Materials API Functions
export const uploadCourseMaterials = async (
  files: File[],
  apiKey: string,
  onProgress?: (progress: number) => void
): Promise<CourseUploadResponse> => {
  try {
    const formData = new FormData();
    
    // Add all files to form data
    files.forEach(file => {
      formData.append('files', file);
    });
    formData.append('api_key', apiKey);

    const response = await fetch(`${API_BASE_URL}/api/upload-course-materials`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `Upload failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error in uploadCourseMaterials:', error);
    throw error;
  }
};

export const sendCourseChatMessage = async (
  request: CourseChatRequest,
  onChunk: (chunk: string) => void
): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/course-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `Course chat request failed: ${response.statusText}`);
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
    console.error('Error in sendCourseChatMessage:', error);
    throw error;
  }
};

export const getCourseChatComplete = async (
  request: CourseChatRequest
): Promise<CourseResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/course-chat-complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `Course chat complete request failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error in getCourseChatComplete:', error);
    throw error;
  }
};

export const getCourseStatus = async (): Promise<CourseStatusResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/course-status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Course status request failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error in getCourseStatus:', error);
    throw error;
  }
};

export const clearCourseMaterials = async (): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/clear-course-materials`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Clear course materials request failed: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error in clearCourseMaterials:', error);
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