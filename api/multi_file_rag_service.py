"""
CoursePilot: Multi-File RAG Service for Educational Content

This module provides a comprehensive RAG implementation for educational document processing
supporting multiple file formats commonly used in academic settings.

Supported File Types:
- PDF: Research papers, syllabi, readings, textbook chapters
- PPTX: Lecture slides, presentations
- TXT: Simple notes, reading lists, course outlines
- Images (PNG/JPG/JPEG): Charts, diagrams, graphs, whiteboard photos
- CSV: Grade data, student performance analytics, survey results

Author: CoursePilot RAG System
Version: 2.0.0
"""

import os
import asyncio
import tempfile
import pandas as pd
from typing import List, Optional, Dict, Any, AsyncGenerator, Tuple
from pathlib import Path
from fastapi import UploadFile, HTTPException
from PIL import Image
import pytesseract
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE

# Import aimakerspace utilities
from aimakerspace.text_utils import PDFLoader, CharacterTextSplitter
from aimakerspace.vectordatabase import VectorDatabase
from aimakerspace.openai_utils.embedding import EmbeddingModel
from aimakerspace.openai_utils.chatmodel import ChatOpenAI
from aimakerspace.openai_utils.prompts import SystemRolePrompt, UserRolePrompt


class FileProcessor:
    """Base class for file processing"""
    
    @staticmethod
    def get_file_info(file_path: str, file_type: str) -> Dict[str, Any]:
        """Get basic file information"""
        file_size = os.path.getsize(file_path)
        return {
            "filename": os.path.basename(file_path),
            "file_type": file_type,
            "file_size": file_size
        }


class PDFProcessor(FileProcessor):
    """Enhanced PDF processor with educational context"""
    
    @staticmethod
    def extract_text(file_path: str) -> Tuple[List[str], Dict[str, Any]]:
        """Extract text from PDF with metadata"""
        try:
            pdf_loader = PDFLoader(file_path)
            documents = pdf_loader.load_documents()
            
            # Count pages (approximate based on document chunks)
            num_pages = len(documents)
            total_text = " ".join(documents)
            
            metadata = {
                "num_pages": num_pages,
                "total_text_length": len(total_text),
                "extraction_method": "PyPDF2"
            }
            
            return documents, metadata
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"PDF processing failed: {str(e)}")


class PPTXProcessor(FileProcessor):
    """PowerPoint processor for lecture slides"""
    
    @staticmethod
    def extract_text(file_path: str) -> Tuple[List[str], Dict[str, Any]]:
        """Extract text from PowerPoint slides"""
        try:
            prs = Presentation(file_path)
            slide_texts = []
            
            for slide_num, slide in enumerate(prs.slides, 1):
                slide_text = f"[Slide {slide_num}]\n"
                
                # Extract text from shapes
                for shape in slide.shapes:
                    if hasattr(shape, "text") and shape.text.strip():
                        slide_text += shape.text.strip() + "\n"
                
                if slide_text.strip() != f"[Slide {slide_num}]":
                    slide_texts.append(slide_text)
            
            metadata = {
                "num_slides": len(prs.slides),
                "num_text_slides": len(slide_texts),
                "total_text_length": sum(len(text) for text in slide_texts),
                "extraction_method": "python-pptx"
            }
            
            return slide_texts, metadata
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"PowerPoint processing failed: {str(e)}")


class ImageProcessor(FileProcessor):
    """Image processor with OCR for educational diagrams"""
    
    @staticmethod
    def extract_text(file_path: str) -> Tuple[List[str], Dict[str, Any]]:
        """Extract text from images using OCR"""
        try:
            # Open and process image
            image = Image.open(file_path)
            
            # Perform OCR
            extracted_text = pytesseract.image_to_string(image)
            
            # Format the extracted text
            if extracted_text.strip():
                formatted_text = f"[Image: {os.path.basename(file_path)}]\n{extracted_text.strip()}"
                texts = [formatted_text]
            else:
                texts = [f"[Image: {os.path.basename(file_path)}]\n[No text detected in image]"]
            
            metadata = {
                "image_size": image.size,
                "image_mode": image.mode,
                "text_length": len(extracted_text),
                "extraction_method": "pytesseract OCR"
            }
            
            return texts, metadata
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Image processing failed: {str(e)}")


class CSVProcessor(FileProcessor):
    """CSV processor for educational data analysis"""
    
    @staticmethod
    def extract_text(file_path: str) -> Tuple[List[str], Dict[str, Any]]:
        """Extract insights from CSV data"""
        try:
            # Read CSV file
            df = pd.read_csv(file_path)
            
            # Generate data summary
            summary_text = f"[CSV Data: {os.path.basename(file_path)}]\n"
            summary_text += f"Dataset Shape: {df.shape[0]} rows, {df.shape[1]} columns\n"
            summary_text += f"Columns: {', '.join(df.columns.tolist())}\n\n"
            
            # Add basic statistics for numeric columns
            numeric_cols = df.select_dtypes(include=['number']).columns
            if len(numeric_cols) > 0:
                summary_text += "Numeric Column Statistics:\n"
                for col in numeric_cols:
                    summary_text += f"- {col}: Mean={df[col].mean():.2f}, Std={df[col].std():.2f}\n"
            
            # Add sample data
            summary_text += f"\nSample Data (first 3 rows):\n{df.head(3).to_string()}\n"
            
            texts = [summary_text]
            
            metadata = {
                "num_rows": df.shape[0],
                "num_columns": df.shape[1],
                "columns": df.columns.tolist(),
                "numeric_columns": numeric_cols.tolist(),
                "extraction_method": "pandas analysis"
            }
            
            return texts, metadata
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"CSV processing failed: {str(e)}")


class TXTProcessor(FileProcessor):
    """Text file processor for simple notes"""
    
    @staticmethod
    def extract_text(file_path: str) -> Tuple[List[str], Dict[str, Any]]:
        """Extract text from plain text files"""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read()
            
            # Format the content
            formatted_text = f"[Text File: {os.path.basename(file_path)}]\n{content}"
            texts = [formatted_text]
            
            metadata = {
                "text_length": len(content),
                "line_count": content.count('\n') + 1,
                "extraction_method": "direct text read"
            }
            
            return texts, metadata
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Text file processing failed: {str(e)}")


class MultiFileRAGManager:
    """
    Enhanced RAG Manager for Multiple File Types in Educational Context
    
    This class orchestrates the complete RAG pipeline for educational content processing
    and question-answering across multiple file formats commonly used in academic settings.
    
    Features:
    - Multi-file upload and processing (PDF, PPTX, TXT, Images, CSV)
    - Educational context and pedagogical responses
    - Source attribution with file and location references
    - Academic tone and teaching-focused prompts
    - Batch processing and course material organization
    """
    
    def __init__(
        self,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        embedding_model_name: str = "text-embedding-3-small",
        chat_model_name: str = "gpt-4o-mini"
    ) -> None:
        """Initialize the Multi-File RAG Manager"""
        
        if chunk_size <= chunk_overlap:
            raise ValueError("chunk_size must be greater than chunk_overlap")
        
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.embedding_model_name = embedding_model_name
        self.chat_model_name = chat_model_name
        
        # Initialize text splitter
        self.text_splitter = CharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )
        
        # Lazy-loaded components
        self.embedding_model: Optional[EmbeddingModel] = None
        self.vector_db: Optional[VectorDatabase] = None
        self.chat_model: Optional[ChatOpenAI] = None
        
        # Course materials state
        self.course_materials: Dict[str, Dict[str, Any]] = {}
        self.is_indexed: bool = False
        
        # File processors
        self.processors = {
            'pdf': PDFProcessor(),
            'pptx': PPTXProcessor(),
            'txt': TXTProcessor(),
            'png': ImageProcessor(),
            'jpg': ImageProcessor(),
            'jpeg': ImageProcessor(),
            'csv': CSVProcessor()
        }
        
        # Initialize educational prompts
        self._initialize_educational_prompts()
    
    def _initialize_educational_prompts(self) -> None:
        """Initialize educational and pedagogical prompt templates"""
        self.system_prompt = SystemRolePrompt(
            """You are CoursePilot, an AI teaching assistant designed to help professors and students with course materials.

ROLE: You are a knowledgeable and supportive educational assistant that helps clarify complex concepts, provides additional context, and guides learning based on uploaded course materials.

INSTRUCTIONS:
- Answer questions using ONLY the information provided in the course materials
- Maintain an educational, supportive, and encouraging tone
- Break down complex concepts into understandable explanations
- Provide specific citations to source materials (file names, slide numbers, pages)
- If information isn't in the materials, guide students to appropriate resources
- Suggest follow-up questions to deepen understanding
- Adapt explanations to different learning levels when appropriate
- Frame responses in pedagogical terms that support learning objectives

COURSE MATERIALS CONTEXT:
{context}

Remember: Your goal is to enhance learning and understanding, not just provide answers. Help students think critically and connect concepts across different materials."""
        )
        
        self.user_prompt = UserRolePrompt("{question}")
    
    def _ensure_models_initialized(self) -> None:
        """Initialize OpenAI models if not already initialized"""
        if self.embedding_model is None:
            self.embedding_model = EmbeddingModel(self.embedding_model_name)
        
        if self.vector_db is None:
            self.vector_db = VectorDatabase(embedding_model=self.embedding_model)
        
        if self.chat_model is None:
            self.chat_model = ChatOpenAI(model_name=self.chat_model_name)
    
    def _get_file_extension(self, filename: str) -> str:
        """Get lowercase file extension"""
        return Path(filename).suffix.lower().lstrip('.')
    
    def _validate_file_type(self, filename: str) -> str:
        """Validate and return file type"""
        extension = self._get_file_extension(filename)
        
        if extension not in self.processors:
            supported_types = ', '.join(self.processors.keys())
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {extension}. Supported types: {supported_types}"
            )
        
        return extension
    
    async def upload_and_process_files(self, files: List[UploadFile]) -> Dict[str, Any]:
        """
        Upload and process multiple course material files
        
        Args:
            files: List of uploaded files (PDF, PPTX, TXT, Images, CSV)
            
        Returns:
            Dict containing processing status and metadata for all files
        """
        try:
            # Ensure models are initialized
            self._ensure_models_initialized()
            
            processed_files = []
            all_chunks = []
            total_files = len(files)
            
            for file_idx, file in enumerate(files):
                try:
                    # Validate file type
                    file_extension = self._validate_file_type(file.filename)
                    
                    # Create temporary file
                    with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_extension}') as tmp_file:
                        content = await file.read()
                        tmp_file.write(content)
                        tmp_file_path = tmp_file.name
                    
                    # Process file based on type
                    processor = self.processors[file_extension]
                    documents, file_metadata = processor.extract_text(tmp_file_path)
                    
                    # Clean up temporary file
                    os.unlink(tmp_file_path)
                    
                    # Validate extracted content
                    if not documents or not any(doc.strip() for doc in documents):
                        raise HTTPException(
                            status_code=400,
                            detail=f"File {file.filename} appears to be empty or contains no extractable content."
                        )
                    
                    # Split documents into chunks
                    file_chunks = self.text_splitter.split_texts(documents)
                    
                    # Add source attribution to chunks
                    attributed_chunks = []
                    for chunk in file_chunks:
                        attributed_chunk = f"[Source: {file.filename}]\n{chunk}"
                        attributed_chunks.append(attributed_chunk)
                    
                    all_chunks.extend(attributed_chunks)
                    
                    # Store file metadata
                    file_info = {
                        "filename": file.filename,
                        "file_type": file_extension,
                        "file_size": len(content),
                        "num_chunks": len(file_chunks),
                        "processing_metadata": file_metadata
                    }
                    
                    processed_files.append(file_info)
                    self.course_materials[file.filename] = file_info
                    
                except Exception as e:
                    # Log error but continue processing other files
                    error_info = {
                        "filename": file.filename,
                        "error": str(e),
                        "status": "failed"
                    }
                    processed_files.append(error_info)
            
            # Index all chunks in vector database
            if all_chunks:
                self.vector_db.insert_texts(all_chunks)
                self.is_indexed = True
            
            # Prepare response
            successful_files = [f for f in processed_files if "error" not in f]
            failed_files = [f for f in processed_files if "error" in f]
            
            return {
                "status": "success" if successful_files else "error",
                "message": f"Processed {len(successful_files)} files successfully, {len(failed_files)} failed",
                "processed_files": successful_files,
                "failed_files": failed_files,
                "total_chunks": len(all_chunks),
                "is_indexed": self.is_indexed
            }
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Batch processing failed: {str(e)}")
    
    async def query_course_materials(self, question: str, k: int = 5) -> Dict[str, Any]:
        """
        Query course materials with educational context
        
        Args:
            question: Student's question about course materials
            k: Number of relevant chunks to retrieve
            
        Returns:
            Dict containing educational response and source attribution
        """
        try:
            if not self.is_indexed:
                raise HTTPException(
                    status_code=400,
                    detail="No course materials are currently indexed. Please upload course materials first."
                )
            
            # Ensure models are initialized
            self._ensure_models_initialized()
            
            # Retrieve relevant context
            relevant_chunks = self.vector_db.search_by_text(question, k=k)
            
            if not relevant_chunks:
                return {
                    "answer": "I don't have relevant information about that topic in the uploaded course materials. "
                             "Consider asking about topics covered in your syllabus, lectures, or readings.",
                    "sources": [],
                    "context_used": False,
                    "educational_guidance": "Try rephrasing your question or asking about specific concepts from your course materials."
                }
            
            # Format context for educational response
            context = "\n\n".join(relevant_chunks)
            
            # Generate educational response
            system_message = self.system_prompt.create_message(context=context)
            user_message = self.user_prompt.create_message(question=question)
            
            response = self.chat_model.invoke([system_message, user_message])
            
            # Extract sources from chunks
            sources = []
            for chunk in relevant_chunks:
                if chunk.startswith("[Source:"):
                    source_line = chunk.split('\n')[0]
                    sources.append(source_line.replace("[Source: ", "").replace("]", ""))
            
            return {
                "answer": response.content,
                "sources": list(set(sources)),  # Remove duplicates
                "context_used": True,
                "num_sources": len(relevant_chunks),
                "educational_guidance": "Feel free to ask follow-up questions to deepen your understanding!"
            }
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Query processing failed: {str(e)}")
    
    async def stream_query_course_materials(self, question: str, k: int = 5) -> AsyncGenerator[str, None]:
        """
        Stream educational responses about course materials
        
        Args:
            question: Student's question
            k: Number of relevant chunks to retrieve
            
        Yields:
            Streaming response chunks
        """
        try:
            if not self.is_indexed:
                yield "⚠️ No course materials are currently indexed. Please upload course materials first."
                return
            
            # Ensure models are initialized
            self._ensure_models_initialized()
            
            # Retrieve relevant context
            relevant_chunks = self.vector_db.search_by_text(question, k=k)
            
            if not relevant_chunks:
                yield "📚 I don't have relevant information about that topic in the uploaded course materials. "
                yield "Consider asking about topics covered in your syllabus, lectures, or readings."
                return
            
            # Format context
            context = "\n\n".join(relevant_chunks)
            
            # Generate streaming response
            system_message = self.system_prompt.create_message(context=context)
            user_message = self.user_prompt.create_message(question=question)
            
            async for chunk in self.chat_model.astream([system_message, user_message]):
                if chunk.content:
                    yield chunk.content
                    
        except Exception as e:
            yield f"❌ Error processing your question: {str(e)}"
    
    def get_course_status(self) -> Dict[str, Any]:
        """Get current course materials status"""
        return {
            "is_indexed": self.is_indexed,
            "total_files": len(self.course_materials),
            "course_materials": self.course_materials,
            "vector_db_size": len(self.vector_db.vectors) if self.vector_db else 0,
            "supported_file_types": list(self.processors.keys())
        }
    
    def clear_course_materials(self) -> Dict[str, str]:
        """Clear all course materials and reset system"""
        self.course_materials = {}
        self.is_indexed = False
        
        if self.vector_db:
            self.vector_db.vectors = []
        
        return {
            "status": "success",
            "message": "All course materials have been cleared. Ready for new uploads."
        }


# Global instance for API endpoints
course_rag_manager = MultiFileRAGManager()

# API Functions
async def upload_course_materials(files: List[UploadFile]) -> Dict[str, Any]:
    """Upload and process multiple course material files"""
    return await course_rag_manager.upload_and_process_files(files)

async def query_course_materials(question: str, k: int = 5) -> Dict[str, Any]:
    """Query course materials with educational context"""
    return await course_rag_manager.query_course_materials(question, k)

async def stream_query_course_materials(question: str, k: int = 5) -> AsyncGenerator[str, None]:
    """Stream educational responses about course materials"""
    async for chunk in course_rag_manager.stream_query_course_materials(question, k):
        yield chunk

def get_course_status() -> Dict[str, Any]:
    """Get current course materials status"""
    return course_rag_manager.get_course_status()

def clear_course_materials() -> Dict[str, str]:
    """Clear all course materials and reset system"""
    return course_rag_manager.clear_course_materials() 