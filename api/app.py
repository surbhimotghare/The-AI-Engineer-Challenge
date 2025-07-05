# Import required FastAPI components for building the API
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
# Import Pydantic for data validation and settings management
from pydantic import BaseModel
# Import OpenAI client for interacting with OpenAI's API
from openai import OpenAI
import os
from typing import Optional, Dict, Any

# Import RAG service functions
from rag_service import (
    upload_pdf, 
    query_pdf, 
    stream_query_pdf,
    get_pdf_status,
    clear_pdf_index
)

# Initialize FastAPI application with a title
app = FastAPI(title="OpenAI Chat API with RAG")

# Configure CORS (Cross-Origin Resource Sharing) middleware
# This allows the API to be accessed from different domains/origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows requests from any origin
    allow_credentials=True,  # Allows cookies to be included in requests
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers in requests
)

# Define the data model for chat requests using Pydantic
# This ensures incoming request data is properly validated
class ChatRequest(BaseModel):
    developer_message: str  # Message from the developer/system
    user_message: str      # Message from the user
    model: Optional[str] = "gpt-4.1-mini"  # Optional model selection with default
    api_key: str          # OpenAI API key for authentication

# Define the data model for RAG chat requests
class RAGChatRequest(BaseModel):
    question: str         # User's question about the PDF
    k: Optional[int] = 5  # Number of relevant chunks to retrieve
    api_key: str          # OpenAI API key for authentication

# Define the data model for PDF upload response
class PDFUploadResponse(BaseModel):
    status: str
    message: str
    pdf_info: Optional[Dict[str, Any]] = None

# Define the data model for PDF status response
class PDFStatusResponse(BaseModel):
    is_indexed: bool
    pdf_info: Optional[Dict[str, Any]] = None
    vector_db_size: int

# Define the data model for RAG response
class RAGResponse(BaseModel):
    answer: str
    sources: list
    context_used: bool
    num_sources: Optional[int] = None

# Define the main chat endpoint that handles POST requests
@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        # Initialize OpenAI client with the provided API key
        client = OpenAI(api_key=request.api_key)
        
        # Create an async generator function for streaming responses
        async def generate():
            # Create a streaming chat completion request
            stream = client.chat.completions.create(
                model=request.model,
                messages=[
                    {"role": "developer", "content": request.developer_message},
                    {"role": "user", "content": request.user_message}
                ],
                stream=True  # Enable streaming response
            )
            
            # Yield each chunk of the response as it becomes available
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content

        # Return a streaming response to the client
        return StreamingResponse(generate(), media_type="text/plain")
    
    except Exception as e:
        # Handle any errors that occur during processing
        raise HTTPException(status_code=500, detail=str(e))

# PDF Upload endpoint - handles file upload and processing
@app.post("/api/upload-pdf", response_model=PDFUploadResponse)
async def upload_pdf_endpoint(file: UploadFile = File(...), api_key: str = Form(...)):
    """
    Upload and process a PDF file for RAG indexing.
    
    Args:
        file: PDF file to upload and process
        api_key: OpenAI API key for embeddings
        
    Returns:
        Upload status and PDF metadata
    """
    try:
        # Set the OpenAI API key in environment for RAG service
        os.environ["OPENAI_API_KEY"] = api_key
        
        result = await upload_pdf(file)
        return PDFUploadResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading PDF: {str(e)}")

# RAG Chat endpoint - handles questions about the indexed PDF
@app.post("/api/rag-chat")
async def rag_chat(request: RAGChatRequest):
    """
    Chat with the indexed PDF using RAG.
    
    Args:
        request: RAG chat request with question and parameters
        
    Returns:
        Streaming response with RAG-generated answer
    """
    try:
        # Set the OpenAI API key in environment for RAG service
        os.environ["OPENAI_API_KEY"] = request.api_key
        
        # Create an async generator function for streaming RAG responses
        async def generate_rag():
            async for chunk in stream_query_pdf(request.question, request.k):
                yield chunk

        # Return a streaming response to the client
        return StreamingResponse(generate_rag(), media_type="text/plain")
    
    except Exception as e:
        # Handle any errors that occur during processing
        raise HTTPException(status_code=500, detail=str(e))

# RAG Chat endpoint (non-streaming) - for getting complete responses
@app.post("/api/rag-chat-complete", response_model=RAGResponse)
async def rag_chat_complete(request: RAGChatRequest):
    """
    Get a complete RAG response (non-streaming) with source information.
    
    Args:
        request: RAG chat request with question and parameters
        
    Returns:
        Complete RAG response with sources and metadata
    """
    try:
        # Set the OpenAI API key in environment for RAG service
        os.environ["OPENAI_API_KEY"] = request.api_key
        
        result = await query_pdf(request.question, request.k)
        return RAGResponse(**result)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# PDF Status endpoint - checks the current PDF indexing status
@app.get("/api/pdf-status", response_model=PDFStatusResponse)
async def pdf_status():
    """
    Get the current PDF processing status.
    
    Returns:
        PDF indexing status and metadata
    """
    try:
        result = get_pdf_status()
        return PDFStatusResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Clear PDF Index endpoint - clears the current PDF index
@app.delete("/api/clear-pdf")
async def clear_pdf():
    """
    Clear the current PDF index and reset the RAG system.
    
    Returns:
        Status message confirming the index was cleared
    """
    try:
        result = clear_pdf_index()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Define a health check endpoint to verify API status
@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

# Entry point for running the application directly
if __name__ == "__main__":
    import uvicorn
    # Start the server on all network interfaces (0.0.0.0) on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
