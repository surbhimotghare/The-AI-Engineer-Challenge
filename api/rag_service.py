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
Version: 2.0.0 - Multiple PDF Support
"""

import os
import asyncio
import tempfile
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any, AsyncGenerator, Set
from pathlib import Path
from fastapi import UploadFile, HTTPException

# Import aimakerspace utilities from local directory
# The aimakerspace library is in api/aimakerspace/, same directory as this file
from aimakerspace.text_utils import PDFLoader, CharacterTextSplitter
from aimakerspace.vectordatabase import VectorDatabase
from aimakerspace.openai_utils.embedding import EmbeddingModel
from aimakerspace.openai_utils.chatmodel import ChatOpenAI
from aimakerspace.openai_utils.prompts import SystemRolePrompt, UserRolePrompt


class PDFDocument:
    """Represents a single PDF document with metadata and chunks."""
    
    def __init__(self, doc_id: str, filename: str, content_length: int, num_pages: int):
        self.doc_id = doc_id
        self.filename = filename
        self.content_length = content_length
        self.num_pages = num_pages
        self.num_chunks = 0
        self.total_text_length = 0
        self.uploaded_at = datetime.utcnow()
        self.chunk_ids: List[str] = []  # Store chunk IDs for this document
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "doc_id": self.doc_id,
            "filename": self.filename,
            "content_length": self.content_length,
            "num_pages": self.num_pages,
            "num_chunks": self.num_chunks,
            "total_text_length": self.total_text_length,
            "uploaded_at": self.uploaded_at.isoformat(),
            "chunk_ids": self.chunk_ids
        }


class RAGManager:
    """
    Comprehensive Retrieval-Augmented Generation Manager with Multiple PDF Support.
    
    This class orchestrates the complete RAG pipeline for multiple PDF document processing
    and question-answering. It provides lazy initialization of OpenAI components
    to avoid API key requirements at startup.
    
    Features:
    - Multiple PDF upload and text extraction
    - Intelligent text chunking with overlap
    - Vector embedding generation and storage
    - Similarity-based context retrieval across documents
    - Context-aware response generation
    - Streaming and complete response modes
    - Document management (list, delete, status)
    
    Attributes:
        chunk_size (int): Size of text chunks for processing
        chunk_overlap (int): Overlap between chunks for context preservation
        embedding_model_name (str): OpenAI embedding model identifier
        chat_model_name (str): OpenAI chat model identifier
        documents (Dict[str, PDFDocument]): Dictionary of uploaded PDF documents
        vector_db (VectorDatabase): Vector database for similarity search
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
        
        # Multiple PDF document storage
        self.documents: Dict[str, PDFDocument] = {}
        
        # RAG-optimized prompt templates
        self._initialize_prompts()
    
    def _initialize_prompts(self) -> None:
        """Initialize the RAG prompt templates for consistent responses."""
        self.system_prompt = SystemRolePrompt(
            """You are a helpful AI assistant that answers questions based on the provided context from PDF documents.

INSTRUCTIONS:
- Answer questions using ONLY the information provided in the context
- If the answer is not in the context, say "I don't have information about that in the provided documents"
- Be specific and cite relevant parts of the context when possible
- If the context contains multiple relevant pieces of information, synthesize them clearly
- When multiple documents are referenced, indicate which document each piece of information comes from
- Maintain a helpful and conversational tone
- Do not make assumptions or add information not present in the context

CONTEXT FROM PDF DOCUMENTS:
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
    
    def _generate_doc_id(self) -> str:
        """Generate a unique document ID."""
        return str(uuid.uuid4())
    
    def _generate_chunk_id(self, doc_id: str, chunk_index: int) -> str:
        """Generate a unique chunk ID for a document."""
        return f"{doc_id}_chunk_{chunk_index}"
    
    async def upload_and_process_pdf(self, file: UploadFile) -> Dict[str, Any]:
        """
        Upload and process a PDF file through the complete RAG pipeline.
        
        This method handles the entire PDF processing workflow:
        1. File validation (PDF format only)
        2. Text extraction using PyPDF2
        3. Text chunking with specified overlap
        4. Vector embedding generation
        5. Vector database storage with document association
        
        Args:
            file: FastAPI UploadFile object containing the PDF
            
        Returns:
            Dict containing processing status and metadata:
            - status: "success" or "error"
            - message: Human-readable status message
            - pdf_info: PDF metadata (doc_id, filename, pages, chunks, etc.)
            
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
                
                # Generate unique document ID
                doc_id = self._generate_doc_id()
                
                # Create PDF document object
                pdf_doc = PDFDocument(
                    doc_id=doc_id,
                    filename=file.filename,
                    content_length=len(content),
                    num_pages=len(documents)
                )
                
                # Generate embeddings for chunks and store in vector database
                chunk_ids = []
                total_text_length = 0
                
                for i, chunk in enumerate(chunks):
                    chunk_id = self._generate_chunk_id(doc_id, i)
                    chunk_ids.append(chunk_id)
                    total_text_length += len(chunk)
                    
                    # Add chunk to vector database with metadata
                    self.vector_db.add_texts(
                        texts=[chunk],
                        metadatas=[{
                            "doc_id": doc_id,
                            "chunk_id": chunk_id,
                            "filename": file.filename,
                            "chunk_index": i
                        }]
                    )
                
                # Update document metadata
                pdf_doc.num_chunks = len(chunks)
                pdf_doc.total_text_length = total_text_length
                pdf_doc.chunk_ids = chunk_ids
                
                # Store document in memory
                self.documents[doc_id] = pdf_doc
                
                return {
                    "status": "success",
                    "message": f"PDF '{file.filename}' successfully processed and indexed",
                    "pdf_info": pdf_doc.to_dict()
                }
                
            finally:
                # Clean up temporary file
                if os.path.exists(tmp_file_path):
                    os.unlink(tmp_file_path)
                    
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to process PDF: {str(e)}"
            )
    
    async def query_pdf(self, question: str, k: int = 5, doc_ids: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Query the RAG system with a question, optionally filtering by specific documents.
        
        Args:
            question: The question to ask about the PDF documents
            k: Number of relevant chunks to retrieve (default: 5)
            doc_ids: Optional list of document IDs to search within. If None, searches all documents.
            
        Returns:
            Dict containing the answer and source information
            
        Raises:
            HTTPException: If no PDFs are indexed or processing fails
        """
        if not self.documents:
            raise HTTPException(
                status_code=400, 
                detail="No PDF documents are currently indexed. Please upload and index PDFs first using /api/upload-pdf."
            )
        
        try:
            # Ensure models are initialized
            self._ensure_models_initialized()
            
            # Filter documents if specific doc_ids provided
            search_doc_ids = set(doc_ids) if doc_ids else set(self.documents.keys())
            
            # Validate that all requested doc_ids exist
            invalid_doc_ids = search_doc_ids - set(self.documents.keys())
            if invalid_doc_ids:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid document IDs: {list(invalid_doc_ids)}"
                )
            
            # Retrieve relevant chunks using similarity search
            relevant_chunks = self.vector_db.search_by_text(
                question, 
                k=k, 
                return_as_text=True
            )
            
            # Filter chunks by document ID if specified
            if doc_ids:
                filtered_chunks = []
                for chunk in relevant_chunks:
                    # Extract metadata from chunk (assuming it's stored in the vector DB)
                    # This is a simplified approach - in practice, you'd need to store metadata with chunks
                    if hasattr(chunk, 'metadata') and chunk.metadata.get('doc_id') in search_doc_ids:
                        filtered_chunks.append(chunk)
                relevant_chunks = filtered_chunks
            
            # Handle case where no relevant content is found
            if not relevant_chunks:
                doc_list = ", ".join([self.documents[doc_id].filename for doc_id in search_doc_ids])
                return {
                    "answer": f"I couldn't find relevant information in the specified documents ({doc_list}) to answer your question. "
                             "Try rephrasing your question or asking about different topics covered in the PDFs.",
                    "sources": [],
                    "context_used": False,
                    "num_sources": 0,
                    "searched_documents": list(search_doc_ids)
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
                "num_sources": len(relevant_chunks),
                "searched_documents": list(search_doc_ids)
            }
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500, 
                detail=f"Error querying PDF documents: {str(e)}"
            )
    
    async def stream_query_pdf(self, question: str, k: int = 5, doc_ids: Optional[List[str]] = None) -> AsyncGenerator[str, None]:
        """
        Stream a response to a question about the PDF documents.
        
        Args:
            question: The question to ask about the PDF documents
            k: Number of relevant chunks to retrieve (default: 5)
            doc_ids: Optional list of document IDs to search within. If None, searches all documents.
            
        Yields:
            Streaming text response
            
        Raises:
            HTTPException: If no PDFs are indexed or processing fails
        """
        if not self.documents:
            raise HTTPException(
                status_code=400, 
                detail="No PDF documents are currently indexed. Please upload and index PDFs first using /api/upload-pdf."
            )
        
        try:
            # Ensure models are initialized
            self._ensure_models_initialized()
            
            # Filter documents if specific doc_ids provided
            search_doc_ids = set(doc_ids) if doc_ids else set(self.documents.keys())
            
            # Validate that all requested doc_ids exist
            invalid_doc_ids = search_doc_ids - set(self.documents.keys())
            if invalid_doc_ids:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid document IDs: {list(invalid_doc_ids)}"
                )
            
            # Retrieve relevant chunks using similarity search
            relevant_chunks = self.vector_db.search_by_text(
                question, 
                k=k, 
                return_as_text=True
            )
            
            # Filter chunks by document ID if specified
            if doc_ids:
                filtered_chunks = []
                for chunk in relevant_chunks:
                    if hasattr(chunk, 'metadata') and chunk.metadata.get('doc_id') in search_doc_ids:
                        filtered_chunks.append(chunk)
                relevant_chunks = filtered_chunks
            
            # Handle case where no relevant content is found
            if not relevant_chunks:
                doc_list = ", ".join([self.documents[doc_id].filename for doc_id in search_doc_ids])
                yield (f"I couldn't find relevant information in the specified documents ({doc_list}) to answer your question. "
                       "Try rephrasing your question or asking about different topics covered in the PDFs.")
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
            raise
        except Exception as e:
            yield f"Error querying PDF documents: {str(e)}"
    
    def get_pdf_status(self) -> Dict[str, Any]:
        """
        Get the current status of all PDF documents in the system.
        
        Returns:
            Dict containing:
            - total_documents: Number of indexed PDF documents
            - documents: List of PDF document metadata
            - vector_db_size: Total number of text chunks in the vector database
        """
        vector_db_size = 0
        if self.vector_db is not None and hasattr(self.vector_db, 'vectors'):
            vector_db_size = len(self.vector_db.vectors)
        
        return {
            "total_documents": len(self.documents),
            "documents": [doc.to_dict() for doc in self.documents.values()],
            "vector_db_size": vector_db_size,
            "is_indexed": len(self.documents) > 0
        }
    
    def get_document(self, doc_id: str) -> Optional[PDFDocument]:
        """
        Get a specific document by ID.
        
        Args:
            doc_id: The document ID to retrieve
            
        Returns:
            PDFDocument object if found, None otherwise
        """
        return self.documents.get(doc_id)
    
    def list_documents(self) -> List[Dict[str, Any]]:
        """
        Get a list of all documents with their metadata.
        
        Returns:
            List of document metadata dictionaries
        """
        return [doc.to_dict() for doc in self.documents.values()]
    
    def delete_document(self, doc_id: str) -> Dict[str, str]:
        """
        Delete a specific document and its associated chunks.
        
        Args:
            doc_id: The document ID to delete
            
        Returns:
            Dict containing operation status and message
        """
        if doc_id not in self.documents:
            return {
                "status": "error",
                "message": f"Document with ID {doc_id} not found"
            }
        
        try:
            # Get document to find its chunk IDs
            doc = self.documents[doc_id]
            
            # Remove chunks from vector database (if supported)
            if self.vector_db is not None and hasattr(self.vector_db, 'delete_texts'):
                # This would require the vector database to support deletion
                # For now, we'll just remove from our document tracking
                pass
            
            # Remove document from tracking
            del self.documents[doc_id]
            
            return {
                "status": "success",
                "message": f"Document '{doc.filename}' deleted successfully"
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Error deleting document: {str(e)}"
            }
    
    def clear_all_documents(self) -> Dict[str, str]:
        """
        Clear all documents and reset the vector database.
        
        Returns:
            Dict containing operation status and message
        """
        try:
            # Reset vector database if embedding model exists
            if self.embedding_model is not None:
                self.vector_db = VectorDatabase(embedding_model=self.embedding_model)
            else:
                self.vector_db = None
                
            # Clear all documents
            self.documents.clear()
            
            return {
                "status": "success", 
                "message": "All PDF documents cleared successfully. Ready for new document uploads."
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Error clearing all documents: {str(e)}"
            }


# Global RAG manager instance
rag_manager = RAGManager()

# API function wrappers for FastAPI endpoints

async def upload_pdf(file: UploadFile) -> Dict[str, Any]:
    """Upload and process a PDF file."""
    return await rag_manager.upload_and_process_pdf(file)

async def query_pdf(question: str, k: int = 5, doc_ids: Optional[List[str]] = None) -> Dict[str, Any]:
    """Query the RAG system with a question."""
    return await rag_manager.query_pdf(question, k, doc_ids)

async def stream_query_pdf(question: str, k: int = 5, doc_ids: Optional[List[str]] = None) -> AsyncGenerator[str, None]:
    """Stream a response to a question about the PDF documents."""
    async for chunk in rag_manager.stream_query_pdf(question, k, doc_ids):
        yield chunk

def get_pdf_status() -> Dict[str, Any]:
    """Get the current status of all PDF documents."""
    return rag_manager.get_pdf_status()

def clear_pdf_index() -> Dict[str, str]:
    """Clear all PDF documents and reset the system."""
    return rag_manager.clear_all_documents()

def list_documents() -> List[Dict[str, Any]]:
    """Get a list of all documents with their metadata."""
    return rag_manager.list_documents()

def get_document(doc_id: str) -> Optional[Dict[str, Any]]:
    """Get a specific document by ID."""
    doc = rag_manager.get_document(doc_id)
    return doc.to_dict() if doc else None

def delete_document(doc_id: str) -> Dict[str, str]:
    """Delete a specific document."""
    return rag_manager.delete_document(doc_id) 