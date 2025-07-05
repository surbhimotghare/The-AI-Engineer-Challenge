"""
Retrieval-Augmented Generation (RAG) Service

This module provides a complete RAG implementation for PDF document processing
and question-answering using the aimakerspace library components.

Components:
- PDFLoader: Text extraction from PDF files
- CharacterTextSplitter: Document chunking for optimal retrieval
- VectorDatabase: Vector storage and similarity search
- EmbeddingModel: OpenAI embedding generation
- ChatOpenAI: Context-aware response generation

Author: AI RAG Chat API
Version: 1.0.0
"""

import os
import asyncio
import tempfile
from typing import List, Optional, Dict, Any, AsyncGenerator
from pathlib import Path
from fastapi import UploadFile, HTTPException

# Import aimakerspace utilities
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from aimakerspace.text_utils import PDFLoader, CharacterTextSplitter
from aimakerspace.vectordatabase import VectorDatabase
from aimakerspace.openai_utils.embedding import EmbeddingModel
from aimakerspace.openai_utils.chatmodel import ChatOpenAI
from aimakerspace.openai_utils.prompts import SystemRolePrompt, UserRolePrompt


class RAGManager:
    """
    Comprehensive Retrieval-Augmented Generation Manager.
    
    This class orchestrates the complete RAG pipeline for PDF document processing
    and question-answering. It provides lazy initialization of OpenAI components
    to avoid API key requirements at startup.
    
    Features:
    - PDF upload and text extraction
    - Intelligent text chunking with overlap
    - Vector embedding generation and storage
    - Similarity-based context retrieval
    - Context-aware response generation
    - Streaming and complete response modes
    
    Attributes:
        chunk_size (int): Size of text chunks for processing
        chunk_overlap (int): Overlap between chunks for context preservation
        embedding_model_name (str): OpenAI embedding model identifier
        chat_model_name (str): OpenAI chat model identifier
        is_indexed (bool): Whether a PDF is currently indexed
        current_pdf_info (Optional[Dict]): Metadata about the current PDF
    """
    
    def __init__(
        self, 
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        embedding_model_name: str = "text-embedding-3-small",
        chat_model_name: str = "gpt-4o-mini"
    ) -> None:
        """
        Initialize the RAG Manager with configurable parameters.
        
        Args:
            chunk_size: Size of text chunks for processing (default: 1000)
            chunk_overlap: Overlap between chunks for context preservation (default: 200)
            embedding_model_name: OpenAI embedding model to use (default: text-embedding-3-small)
            chat_model_name: OpenAI chat model to use (default: gpt-4o-mini)
            
        Raises:
            AssertionError: If chunk_size <= chunk_overlap
        """
        if chunk_size <= chunk_overlap:
            raise ValueError("chunk_size must be greater than chunk_overlap")
            
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.embedding_model_name = embedding_model_name
        self.chat_model_name = chat_model_name
        
        # Initialize text splitter (doesn't require API key)
        self.text_splitter = CharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )
        
        # Lazy-loaded components (initialized when API key is available)
        self.embedding_model: Optional[EmbeddingModel] = None
        self.vector_db: Optional[VectorDatabase] = None
        self.chat_model: Optional[ChatOpenAI] = None
        
        # Document processing state
        self.current_pdf_info: Optional[Dict[str, Any]] = None
        self.is_indexed: bool = False
        
        # RAG-optimized prompt templates
        self._initialize_prompts()
    
    def _initialize_prompts(self) -> None:
        """Initialize the RAG prompt templates for consistent responses."""
        self.system_prompt = SystemRolePrompt(
            """You are a helpful AI assistant that answers questions based on the provided context from a PDF document.

INSTRUCTIONS:
- Answer questions using ONLY the information provided in the context
- If the answer is not in the context, say "I don't have information about that in the provided document"
- Be specific and cite relevant parts of the context when possible
- If the context contains multiple relevant pieces of information, synthesize them clearly
- Maintain a helpful and conversational tone
- Do not make assumptions or add information not present in the context

CONTEXT FROM PDF:
{context}"""
        )
        
        self.user_prompt = UserRolePrompt("{question}")
    
    def _ensure_models_initialized(self) -> None:
        """
        Initialize OpenAI models if not already initialized.
        
        This method provides lazy initialization to avoid requiring API keys
        at class instantiation time.
        
        Raises:
            Exception: If OpenAI API key is not set in environment
        """
        if self.embedding_model is None:
            self.embedding_model = EmbeddingModel(self.embedding_model_name)
            
        if self.vector_db is None:
            self.vector_db = VectorDatabase(embedding_model=self.embedding_model)
            
        if self.chat_model is None:
            self.chat_model = ChatOpenAI(model_name=self.chat_model_name)
    
    async def upload_and_process_pdf(self, file: UploadFile) -> Dict[str, Any]:
        """
        Upload and process a PDF file through the complete RAG pipeline.
        
        This method handles the entire PDF processing workflow:
        1. File validation (PDF format only)
        2. Text extraction using PyPDF2
        3. Text chunking with specified overlap
        4. Vector embedding generation
        5. Vector database storage
        
        Args:
            file: FastAPI UploadFile object containing the PDF
            
        Returns:
            Dict containing processing status and metadata:
            - status: "success" or "error"
            - message: Human-readable status message
            - pdf_info: PDF metadata (filename, pages, chunks, etc.)
            
        Raises:
            HTTPException: For invalid files or processing errors
        """
        try:
            # Validate file format
            if not file.filename or not file.filename.lower().endswith('.pdf'):
                raise HTTPException(
                    status_code=400, 
                    detail="Invalid file format. Only PDF files are supported."
                )
            
            # Ensure OpenAI models are initialized
            self._ensure_models_initialized()
            
            # Create temporary file for PDF processing
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
                content = await file.read()
                tmp_file.write(content)
                tmp_file_path = tmp_file.name
            
            try:
                # Extract text from PDF
                pdf_loader = PDFLoader(tmp_file_path)
                documents = pdf_loader.load_documents()
                
                # Validate extracted content
                if not documents or not any(doc.strip() for doc in documents):
                    raise HTTPException(
                        status_code=400, 
                        detail="PDF appears to be empty or contains no extractable text. "
                               "Please ensure the PDF contains text (not just images)."
                    )
                
                # Split text into chunks for optimal retrieval
                chunks = self.text_splitter.split_texts(documents)
                
                if not chunks:
                    raise HTTPException(
                        status_code=400,
                        detail="Failed to create text chunks from PDF content."
                    )
                
                # Build vector database with embeddings
                self.vector_db = VectorDatabase(embedding_model=self.embedding_model)
                await self.vector_db.abuild_from_list(chunks)
                
                # Update processing state
                self.current_pdf_info = {
                    "filename": file.filename,
                    "content_length": len(content),
                    "num_pages": len(documents),
                    "num_chunks": len(chunks),
                    "total_text_length": sum(len(doc) for doc in documents)
                }
                self.is_indexed = True
                
                return {
                    "status": "success",
                    "message": f"PDF '{file.filename}' processed and indexed successfully. "
                              f"Created {len(chunks)} searchable chunks from {len(documents)} pages.",
                    "pdf_info": self.current_pdf_info
                }
                
            finally:
                # Clean up temporary file
                if os.path.exists(tmp_file_path):
                    os.unlink(tmp_file_path)
                
        except HTTPException:
            # Re-raise HTTP exceptions as-is
            raise
        except Exception as e:
            # Wrap unexpected errors
            raise HTTPException(
                status_code=500, 
                detail=f"Unexpected error processing PDF: {str(e)}"
            )
    
    async def query_pdf(self, question: str, k: int = 5) -> Dict[str, Any]:
        """
        Query the indexed PDF using RAG for complete responses.
        
        This method implements the RAG query pipeline:
        1. Validate that a PDF is indexed
        2. Retrieve relevant text chunks using similarity search
        3. Construct context-aware prompts
        4. Generate AI response using chat completion
        
        Args:
            question: User's question about the PDF content
            k: Number of relevant chunks to retrieve (1-10)
            
        Returns:
            Dict containing:
            - answer: AI-generated response based on PDF content
            - sources: List of relevant text chunks used for context
            - context_used: Whether PDF context was found and used
            - num_sources: Number of source chunks retrieved
            
        Raises:
            HTTPException: If no PDF is indexed or processing fails
        """
        if not self.is_indexed:
            raise HTTPException(
                status_code=400, 
                detail="No PDF is currently indexed. Please upload and index a PDF first using /api/upload-pdf."
            )
        
        try:
            # Ensure models are initialized
            self._ensure_models_initialized()
            
            # Retrieve relevant chunks using similarity search
            relevant_chunks = self.vector_db.search_by_text(
                question, 
                k=k, 
                return_as_text=True
            )
            
            # Handle case where no relevant content is found
            if not relevant_chunks:
                return {
                    "answer": "I couldn't find relevant information in the document to answer your question. "
                             "Try rephrasing your question or asking about different topics covered in the PDF.",
                    "sources": [],
                    "context_used": False,
                    "num_sources": 0
                }
            
            # Prepare context from retrieved chunks
            context = "\n\n".join([
                f"Section {i+1}:\n{chunk}" 
                for i, chunk in enumerate(relevant_chunks)
            ])
            
            # Generate messages for chat completion
            system_message = self.system_prompt.create_message(context=context)
            user_message = self.user_prompt.create_message(question=question)
            
            # Get response from chat model
            response = self.chat_model.run([system_message, user_message])
            
            return {
                "answer": response,
                "sources": relevant_chunks,
                "context_used": True,
                "num_sources": len(relevant_chunks)
            }
            
        except HTTPException:
            # Re-raise HTTP exceptions as-is
            raise
        except Exception as e:
            # Wrap unexpected errors
            raise HTTPException(
                status_code=500, 
                detail=f"Error querying PDF: {str(e)}"
            )
    
    async def stream_query_pdf(self, question: str, k: int = 5) -> AsyncGenerator[str, None]:
        """
        Stream a response to a PDF query using RAG.
        
        This method provides the same RAG functionality as query_pdf but streams
        the response in real-time for better user experience.
        
        Args:
            question: User's question about the PDF content
            k: Number of relevant chunks to retrieve (1-10)
            
        Yields:
            str: Streaming response chunks from the AI model
            
        Raises:
            HTTPException: If no PDF is indexed or processing fails
        """
        if not self.is_indexed:
            raise HTTPException(
                status_code=400, 
                detail="No PDF is currently indexed. Please upload and index a PDF first using /api/upload-pdf."
            )
        
        try:
            # Ensure models are initialized
            self._ensure_models_initialized()
            
            # Retrieve relevant chunks using similarity search
            relevant_chunks = self.vector_db.search_by_text(
                question, 
                k=k, 
                return_as_text=True
            )
            
            # Handle case where no relevant content is found
            if not relevant_chunks:
                yield ("I couldn't find relevant information in the document to answer your question. "
                       "Try rephrasing your question or asking about different topics covered in the PDF.")
                return
            
            # Prepare context from retrieved chunks
            context = "\n\n".join([
                f"Section {i+1}:\n{chunk}" 
                for i, chunk in enumerate(relevant_chunks)
            ])
            
            # Generate messages for chat completion
            system_message = self.system_prompt.create_message(context=context)
            user_message = self.user_prompt.create_message(question=question)
            
            # Stream response from chat model
            async for chunk in self.chat_model.astream([system_message, user_message]):
                yield chunk
                
        except HTTPException:
            # Re-raise HTTP exceptions as-is
            raise
        except Exception as e:
            # Yield error message for streaming context
            yield f"Error querying PDF: {str(e)}"
    
    def get_pdf_status(self) -> Dict[str, Any]:
        """
        Get the current PDF processing status and metadata.
        
        Returns:
            Dict containing:
            - is_indexed: Whether a PDF is currently indexed and ready
            - pdf_info: PDF metadata if available (filename, pages, chunks, etc.)
            - vector_db_size: Number of text chunks in the vector database
        """
        vector_db_size = 0
        if self.vector_db is not None and hasattr(self.vector_db, 'vectors'):
            vector_db_size = len(self.vector_db.vectors)
        
        return {
            "is_indexed": self.is_indexed,
            "pdf_info": self.current_pdf_info,
            "vector_db_size": vector_db_size
        }
    
    def clear_pdf_index(self) -> Dict[str, str]:
        """
        Clear the current PDF index and reset the RAG system.
        
        This operation:
        - Removes all PDF content from memory
        - Clears the vector database
        - Resets processing status to false
        - Preserves model instances for reuse
        
        Returns:
            Dict containing operation status and message
        """
        try:
            # Reset vector database if embedding model exists
            if self.embedding_model is not None:
                self.vector_db = VectorDatabase(embedding_model=self.embedding_model)
            else:
                self.vector_db = None
                
            # Reset state
            self.current_pdf_info = None
            self.is_indexed = False
            
            return {
                "status": "success", 
                "message": "PDF index cleared successfully. Ready for new document upload."
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Error clearing PDF index: {str(e)}"
            }


# Global RAG manager instance for API endpoints
rag_manager = RAGManager()


# Convenience functions for API endpoints
async def upload_pdf(file: UploadFile) -> Dict[str, Any]:
    """
    Convenience function for PDF upload endpoint.
    
    Args:
        file: FastAPI UploadFile object
        
    Returns:
        Processing result from RAGManager
    """
    return await rag_manager.upload_and_process_pdf(file)


async def query_pdf(question: str, k: int = 5) -> Dict[str, Any]:
    """
    Convenience function for complete RAG query endpoint.
    
    Args:
        question: User's question about the PDF
        k: Number of relevant chunks to retrieve
        
    Returns:
        Complete RAG response with sources and metadata
    """
    return await rag_manager.query_pdf(question, k)


async def stream_query_pdf(question: str, k: int = 5) -> AsyncGenerator[str, None]:
    """
    Convenience function for streaming RAG query endpoint.
    
    Args:
        question: User's question about the PDF
        k: Number of relevant chunks to retrieve
        
    Yields:
        Streaming response chunks
    """
    async for chunk in rag_manager.stream_query_pdf(question, k):
        yield chunk


def get_pdf_status() -> Dict[str, Any]:
    """
    Convenience function for PDF status endpoint.
    
    Returns:
        Current PDF processing status and metadata
    """
    return rag_manager.get_pdf_status()


def clear_pdf_index() -> Dict[str, str]:
    """
    Convenience function for PDF index clearing endpoint.
    
    Returns:
        Operation status and message
    """
    return rag_manager.clear_pdf_index() 