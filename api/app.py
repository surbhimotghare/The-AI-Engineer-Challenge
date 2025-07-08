# Import required FastAPI components for building the API
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
# Import Pydantic for data validation and settings management
from pydantic import BaseModel, Field
# Import OpenAI client for interacting with OpenAI's API
from openai import OpenAI
import os
from typing import Optional, Dict, Any, List

# Test endpoint first - simple response without complex imports
app = FastAPI(
    title="AI RAG Chat API",
    description="A comprehensive RAG API with PDF processing",
    version="1.0.0"
)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/test")
async def test_endpoint():
    """Simple test endpoint to verify basic functionality."""
    return {"status": "ok", "message": "Backend is working", "test": True}

# Try to import RAG service functions with error handling
RAG_IMPORT_ERROR = None
try:
    from rag_service import (
        upload_pdf, 
        query_pdf, 
        stream_query_pdf,
        get_pdf_status,
        clear_pdf_index
    )
    RAG_IMPORTS_SUCCESS = True
except Exception as e:
    RAG_IMPORTS_SUCCESS = False
    RAG_IMPORT_ERROR = str(e)

@app.get("/api/debug")
async def debug_endpoint():
    """Debug endpoint to check import status."""
    return {
        "rag_imports_success": RAG_IMPORTS_SUCCESS,
        "rag_import_error": RAG_IMPORT_ERROR,
        "python_version": "3.9+",
        "fastapi_working": True
    }

# Enhanced Pydantic models with comprehensive documentation
class ChatRequest(BaseModel):
    """Request model for traditional chat completions."""
    
    developer_message: str = Field(
        ...,
        description="System message that sets the context and behavior for the AI assistant",
        example="You are a helpful AI assistant that provides clear and concise answers."
    )
    user_message: str = Field(
        ...,
        description="The user's message or question to be answered",
        example="Explain quantum computing in simple terms."
    )
    model: Optional[str] = Field(
        default="gpt-4o-mini",
        description="OpenAI model to use for chat completion",
        example="gpt-4o-mini"
    )
    api_key: str = Field(
        ...,
        description="OpenAI API key for authentication",
        example="sk-..."
    )

class RAGChatRequest(BaseModel):
    """Request model for RAG-enhanced chat with PDF context."""
    
    question: str = Field(
        ...,
        description="Question to ask about the uploaded PDF document",
        example="What are the main topics covered in this document?"
    )
    k: Optional[int] = Field(
        default=5,
        description="Number of relevant text chunks to retrieve for context (1-10)",
        example=5,
        ge=1,
        le=10
    )
    api_key: str = Field(
        ...,
        description="OpenAI API key for authentication",
        example="sk-..."
    )

class PDFInfo(BaseModel):
    """PDF document metadata."""
    
    filename: str = Field(..., description="Original filename of the uploaded PDF")
    content_length: int = Field(..., description="File size in bytes")
    num_pages: int = Field(..., description="Number of pages in the PDF")
    num_chunks: int = Field(..., description="Number of text chunks created for indexing")
    total_text_length: int = Field(..., description="Total character count of extracted text")

class PDFUploadResponse(BaseModel):
    """Response model for PDF upload and processing."""
    
    status: str = Field(..., description="Processing status", example="success")
    message: str = Field(..., description="Human-readable status message")
    pdf_info: Optional[PDFInfo] = Field(None, description="PDF metadata and processing details")

class PDFStatusResponse(BaseModel):
    """Response model for PDF processing status."""
    
    is_indexed: bool = Field(..., description="Whether a PDF is currently indexed and ready for queries")
    pdf_info: Optional[PDFInfo] = Field(None, description="PDF metadata if a document is indexed")
    vector_db_size: int = Field(..., description="Number of text chunks in the vector database")

class RAGResponse(BaseModel):
    """Response model for RAG chat completion."""
    
    answer: str = Field(..., description="AI-generated answer based on PDF content")
    sources: List[str] = Field(..., description="List of relevant text chunks used for context")
    context_used: bool = Field(..., description="Whether PDF context was found and used")
    num_sources: Optional[int] = Field(None, description="Number of source chunks retrieved")

class HealthResponse(BaseModel):
    """Health check response."""
    
    status: str = Field(..., description="API health status", example="ok")

class ClearResponse(BaseModel):
    """Response for PDF index clearing."""
    
    status: str = Field(..., description="Operation status", example="success")
    message: str = Field(..., description="Operation result message")

# API Endpoints with comprehensive documentation

@app.get("/")
async def root():
    """Root endpoint for API information."""
    return {
        "message": "AI RAG Chat API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }

@app.post(
    "/api/chat",
    summary="Traditional Chat Completion",
    description="""
    Traditional OpenAI chat completion with custom system messages.
    
    This endpoint provides streaming responses and does not use PDF context.
    Use this for general-purpose AI chat functionality.
    """,
    response_description="Streaming text response from the AI model",
    tags=["Chat"]
)
async def chat(request: ChatRequest):
    """
    Generate a streaming chat response using OpenAI's chat completion API.
    
    - **developer_message**: Sets the AI's personality and context
    - **user_message**: The user's question or prompt
    - **model**: OpenAI model to use (default: gpt-4o-mini)
    - **api_key**: Your OpenAI API key
    
    Returns a streaming response with AI-generated content.
    """
    try:
        client = OpenAI(api_key=request.api_key)
        
        async def generate():
            stream = client.chat.completions.create(
                model=request.model,
                messages=[
                    {"role": "system", "content": request.developer_message},
                    {"role": "user", "content": request.user_message}
                ],
                stream=True
            )
            
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content

        return StreamingResponse(generate(), media_type="text/plain")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post(
    "/api/upload-pdf",
    response_model=PDFUploadResponse,
    summary="Upload and Process PDF",
    description="""
    Upload a PDF document and process it for RAG queries.
    
    This endpoint:
    1. Validates the uploaded file is a PDF
    2. Extracts text from all pages
    3. Splits text into searchable chunks
    4. Generates vector embeddings
    5. Stores in vector database for similarity search
    
    The PDF will be ready for RAG queries once this process completes.
    """,
    response_description="Upload status and PDF processing metadata",
    tags=["PDF Management"]
)
async def upload_pdf_endpoint(
    file: UploadFile = File(..., description="PDF file to upload and process"),
    api_key: str = Form(..., description="OpenAI API key for generating embeddings")
):
    """
    Upload and process a PDF document for RAG functionality.
    
    **Required:**
    - PDF file (any size, text must be extractable)
    - OpenAI API key for embedding generation
    
    **Processing Steps:**
    1. File validation (PDF format only)
    2. Text extraction using PyPDF2
    3. Text chunking (1000 chars with 200 char overlap)
    4. Vector embedding generation
    5. Storage in searchable vector database
    
    **Returns:**
    - Processing status and metadata
    - PDF information (pages, chunks, text length)
    - Vector database statistics
    """
    if not RAG_IMPORTS_SUCCESS:
        raise HTTPException(
            status_code=500, 
            detail=f"RAG system not available: {RAG_IMPORT_ERROR}"
        )
    
    try:
        # Set the OpenAI API key in environment for RAG service
        os.environ["OPENAI_API_KEY"] = api_key
        
        result = await upload_pdf(file)
        return PDFUploadResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading PDF: {str(e)}")

@app.post(
    "/api/rag-chat",
    summary="RAG Chat (Streaming)",
    description="""
    Ask questions about your uploaded PDF with streaming responses.
    
    This endpoint uses Retrieval-Augmented Generation (RAG) to:
    1. Find relevant text chunks from your PDF
    2. Use them as context for AI response generation
    3. Stream the response in real-time
    
    **Note**: You must upload and index a PDF first using `/api/upload-pdf`.
    """,
    response_description="Streaming AI response based on PDF content",
    tags=["RAG Chat"]
)
async def rag_chat(request: RAGChatRequest):
    """
    Get streaming RAG responses about your uploaded PDF.
    
    **Prerequisites:**
    - PDF must be uploaded and indexed via `/api/upload-pdf`
    - Check status with `/api/pdf-status` if unsure
    
    **Parameters:**
    - **question**: What you want to know about the PDF
    - **k**: Number of relevant text chunks to retrieve (1-10)
    - **api_key**: OpenAI API key for chat completion
    
    **Response:**
    - Streaming text response based on PDF content
    - Will indicate if no relevant information is found
    """
    if not RAG_IMPORTS_SUCCESS:
        raise HTTPException(
            status_code=500, 
            detail=f"RAG system not available: {RAG_IMPORT_ERROR}"
        )
    
    try:
        os.environ["OPENAI_API_KEY"] = request.api_key
        
        async def generate_rag():
            async for chunk in stream_query_pdf(request.question, request.k):
                yield chunk

        return StreamingResponse(generate_rag(), media_type="text/plain")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post(
    "/api/rag-chat-complete",
    response_model=RAGResponse,
    summary="RAG Chat (Complete Response)",
    description="""
    Get complete RAG responses with source attribution.
    
    Unlike the streaming version, this endpoint returns:
    - Complete response text
    - List of source text chunks used
    - Metadata about context retrieval
    
    Useful for debugging, source verification, or applications that need complete responses.
    """,
    response_description="Complete RAG response with sources and metadata",
    tags=["RAG Chat"]
)
async def rag_chat_complete(request: RAGChatRequest):
    """
    Get complete RAG responses with source attribution and metadata.
    
    **Prerequisites:**
    - PDF must be uploaded and indexed via `/api/upload-pdf`
    
    **Returns:**
    - **answer**: AI-generated response based on PDF content
    - **sources**: List of relevant text chunks that were used
    - **context_used**: Whether relevant context was found
    - **num_sources**: Number of source chunks retrieved
    
    **Use Cases:**
    - Debugging RAG performance
    - Verifying source attribution
    - Applications requiring complete responses
    """
    if not RAG_IMPORTS_SUCCESS:
        raise HTTPException(
            status_code=500, 
            detail=f"RAG system not available: {RAG_IMPORT_ERROR}"
        )
    
    try:
        os.environ["OPENAI_API_KEY"] = request.api_key
        
        result = await query_pdf(request.question, request.k)
        return RAGResponse(**result)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get(
    "/api/pdf-status",
    response_model=PDFStatusResponse,
    summary="Check PDF Processing Status",
    description="""
    Check the current status of PDF processing and indexing.
    
    Returns information about:
    - Whether a PDF is currently indexed
    - PDF metadata (filename, pages, chunks)
    - Vector database size and statistics
    
    Use this to verify that your PDF is ready for RAG queries.
    """,
    response_description="Current PDF processing status and metadata",
    tags=["PDF Management"]
)
async def pdf_status():
    """
    Get current PDF processing status and metadata.
    
    **Returns:**
    - **is_indexed**: Whether a PDF is ready for queries
    - **pdf_info**: PDF metadata if available
    - **vector_db_size**: Number of chunks in vector database
    
    **Status Meanings:**
    - `is_indexed: true` - PDF is ready for RAG queries
    - `is_indexed: false` - No PDF uploaded or processing failed
    - `vector_db_size: 0` - No indexed content available
    """
    if not RAG_IMPORTS_SUCCESS:
        raise HTTPException(
            status_code=500, 
            detail=f"RAG system not available: {RAG_IMPORT_ERROR}"
        )
    
    try:
        result = get_pdf_status()
        return PDFStatusResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete(
    "/api/clear-pdf",
    response_model=ClearResponse,
    summary="Clear PDF Index",
    description="""
    Clear the current PDF index and reset the RAG system.
    
    This will:
    - Remove all indexed PDF content
    - Clear the vector database
    - Reset processing status
    
    Use this when you want to upload a new PDF or start fresh.
    """,
    response_description="Confirmation of index clearing",
    tags=["PDF Management"]
)
async def clear_pdf():
    """
    Clear the current PDF index and reset the RAG system.
    
    **Effect:**
    - Removes all PDF content from memory
    - Clears vector database
    - Resets indexing status to false
    
    **Use Cases:**
    - Uploading a new PDF document
    - Starting fresh after processing errors
    - Clearing memory usage
    
    **Note:** This operation cannot be undone.
    """
    if not RAG_IMPORTS_SUCCESS:
        raise HTTPException(
            status_code=500, 
            detail=f"RAG system not available: {RAG_IMPORT_ERROR}"
        )
    
    try:
        result = clear_pdf_index()
        return ClearResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get(
    "/api/health",
    response_model=HealthResponse,
    summary="Health Check",
    description="Simple health check endpoint to verify API availability.",
    response_description="API health status",
    tags=["System"]
)
async def health_check():
    """
    Check API health and availability.
    
    **Returns:**
    - Simple status confirmation
    
    **Use Cases:**
    - Monitoring and alerting
    - Load balancer health checks
    - Service discovery
    """
    return HealthResponse(status="ok")

# Entry point for running the application directly
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
