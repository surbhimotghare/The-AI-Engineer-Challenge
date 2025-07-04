import os
import asyncio
from typing import List, Optional, Dict, Any
from pathlib import Path
import tempfile
from fastapi import UploadFile, HTTPException

# Import aimakerspace utilities
import sys
sys.path.append('..')
from aimakerspace.text_utils import PDFLoader, CharacterTextSplitter
from aimakerspace.vectordatabase import VectorDatabase
from aimakerspace.openai_utils.embedding import EmbeddingModel
from aimakerspace.openai_utils.chatmodel import ChatOpenAI
from aimakerspace.openai_utils.prompts import SystemRolePrompt, UserRolePrompt


class RAGManager:
    """
    Retrieval-Augmented Generation (RAG) Manager for PDF processing and querying.
    
    This class handles the complete RAG pipeline:
    1. PDF upload and text extraction
    2. Text chunking and embedding
    3. Vector storage and retrieval
    4. Context-aware response generation
    """
    
    def __init__(self, 
                 chunk_size: int = 1000,
                 chunk_overlap: int = 200,
                 embedding_model_name: str = "text-embedding-3-small",
                 chat_model_name: str = "gpt-4o-mini"):
        """
        Initialize the RAG Manager with configurable parameters.
        
        Args:
            chunk_size: Size of text chunks for processing
            chunk_overlap: Overlap between chunks for context preservation
            embedding_model_name: OpenAI embedding model to use
            chat_model_name: OpenAI chat model to use
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        
        # Initialize aimakerspace components
        self.text_splitter = CharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )
        self.embedding_model = EmbeddingModel(embedding_model_name)
        self.vector_db = VectorDatabase(embedding_model=self.embedding_model)
        self.chat_model = ChatOpenAI(model_name=chat_model_name)
        
        # PDF processing state
        self.current_pdf_info: Optional[Dict[str, Any]] = None
        self.is_indexed = False
        
        # RAG prompts
        self.system_prompt = SystemRolePrompt(
            """You are a helpful AI assistant that answers questions based on the provided context from a PDF document.

Instructions:
- Answer questions using ONLY the information provided in the context
- If the answer is not in the context, say "I don't have information about that in the provided document"
- Be specific and cite relevant parts of the context when possible
- If the context contains multiple relevant pieces of information, synthesize them clearly
- Maintain a helpful and conversational tone

Context from PDF:
{context}"""
        )
        
        self.user_prompt = UserRolePrompt("{question}")
    
    async def upload_and_process_pdf(self, file: UploadFile) -> Dict[str, Any]:
        """
        Upload and process a PDF file through the complete RAG pipeline.
        
        Args:
            file: FastAPI UploadFile object containing the PDF
            
        Returns:
            Dict containing processing status and metadata
        """
        try:
            # Validate file
            if not file.filename.lower().endswith('.pdf'):
                raise HTTPException(status_code=400, detail="File must be a PDF")
            
            # Create temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
                content = await file.read()
                tmp_file.write(content)
                tmp_file_path = tmp_file.name
            
            try:
                # Extract text from PDF
                pdf_loader = PDFLoader(tmp_file_path)
                documents = pdf_loader.load_documents()
                
                if not documents or not documents[0].strip():
                    raise HTTPException(status_code=400, detail="PDF appears to be empty or text could not be extracted")
                
                # Split text into chunks
                chunks = self.text_splitter.split_texts(documents)
                
                # Build vector database
                self.vector_db = VectorDatabase(embedding_model=self.embedding_model)
                await self.vector_db.abuild_from_list(chunks)
                
                # Update state
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
                    "message": "PDF processed and indexed successfully",
                    "pdf_info": self.current_pdf_info
                }
                
            finally:
                # Clean up temporary file
                os.unlink(tmp_file_path)
                
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")
    
    async def query_pdf(self, question: str, k: int = 5) -> Dict[str, Any]:
        """
        Query the indexed PDF using RAG.
        
        Args:
            question: User's question
            k: Number of relevant chunks to retrieve
            
        Returns:
            Dict containing the answer and source information
        """
        if not self.is_indexed:
            raise HTTPException(status_code=400, detail="No PDF is currently indexed. Please upload and index a PDF first.")
        
        try:
            # Retrieve relevant chunks
            relevant_chunks = self.vector_db.search_by_text(
                question, 
                k=k, 
                return_as_text=True
            )
            
            if not relevant_chunks:
                return {
                    "answer": "I couldn't find relevant information in the document to answer your question.",
                    "sources": [],
                    "context_used": False
                }
            
            # Prepare context
            context = "\n\n".join([f"Section {i+1}:\n{chunk}" for i, chunk in enumerate(relevant_chunks)])
            
            # Generate messages
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
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error querying PDF: {str(e)}")
    
    async def stream_query_pdf(self, question: str, k: int = 5):
        """
        Stream a response to a PDF query using RAG.
        
        Args:
            question: User's question
            k: Number of relevant chunks to retrieve
            
        Yields:
            Streamed response chunks
        """
        if not self.is_indexed:
            raise HTTPException(status_code=400, detail="No PDF is currently indexed. Please upload and index a PDF first.")
        
        try:
            # Retrieve relevant chunks
            relevant_chunks = self.vector_db.search_by_text(
                question, 
                k=k, 
                return_as_text=True
            )
            
            if not relevant_chunks:
                yield "I couldn't find relevant information in the document to answer your question."
                return
            
            # Prepare context
            context = "\n\n".join([f"Section {i+1}:\n{chunk}" for i, chunk in enumerate(relevant_chunks)])
            
            # Generate messages
            system_message = self.system_prompt.create_message(context=context)
            user_message = self.user_prompt.create_message(question=question)
            
            # Stream response from chat model
            async for chunk in self.chat_model.astream([system_message, user_message]):
                yield chunk
                
        except Exception as e:
            yield f"Error querying PDF: {str(e)}"
    
    def get_pdf_status(self) -> Dict[str, Any]:
        """
        Get the current PDF processing status.
        
        Returns:
            Dict containing PDF status and metadata
        """
        return {
            "is_indexed": self.is_indexed,
            "pdf_info": self.current_pdf_info,
            "vector_db_size": len(self.vector_db.vectors) if self.is_indexed else 0
        }
    
    def clear_pdf_index(self) -> Dict[str, str]:
        """
        Clear the current PDF index and reset state.
        
        Returns:
            Dict containing status message
        """
        self.vector_db = VectorDatabase(embedding_model=self.embedding_model)
        self.current_pdf_info = None
        self.is_indexed = False
        
        return {"status": "success", "message": "PDF index cleared successfully"}


# Global RAG manager instance
rag_manager = RAGManager()


# Convenience functions for API endpoints
async def upload_pdf(file: UploadFile) -> Dict[str, Any]:
    """Upload and process a PDF file."""
    return await rag_manager.upload_and_process_pdf(file)


async def query_pdf(question: str, k: int = 5) -> Dict[str, Any]:
    """Query the indexed PDF."""
    return await rag_manager.query_pdf(question, k)


async def stream_query_pdf(question: str, k: int = 5):
    """Stream a response to a PDF query."""
    async for chunk in rag_manager.stream_query_pdf(question, k):
        yield chunk


def get_pdf_status() -> Dict[str, Any]:
    """Get PDF processing status."""
    return rag_manager.get_pdf_status()


def clear_pdf_index() -> Dict[str, str]:
    """Clear the PDF index."""
    return rag_manager.clear_pdf_index() 