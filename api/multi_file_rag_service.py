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
            print(f"PPTX Processing: Opening file {file_path}")
            
            # Check if file exists and is accessible
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"PPTX file not found: {file_path}")
            
            # Try to open the presentation
            try:
                prs = Presentation(file_path)
                print(f"PPTX Processing: Successfully opened presentation with {len(prs.slides)} slides")
            except Exception as pptx_error:
                print(f"PPTX Processing: Error opening presentation: {str(pptx_error)}")
                # Check if this might be a .ppt file disguised as .pptx
                if "Package not found" in str(pptx_error) or "not a valid" in str(pptx_error).lower():
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Invalid PowerPoint file. This might be an older .ppt format or corrupted file. "
                               f"Please try: 1) Converting to .pptx format, 2) Re-saving in PowerPoint, or 3) Using a different file. "
                               f"Error: {str(pptx_error)}"
                    )
                else:
                    raise HTTPException(status_code=400, detail=f"PowerPoint processing failed: {str(pptx_error)}")
            
            slide_texts = []
            total_slides = len(prs.slides)
            
            for slide_num, slide in enumerate(prs.slides, 1):
                try:
                    slide_text = f"[Slide {slide_num}]\n"
                    shape_count = 0
                    
                    # Extract text from shapes with better error handling
                    for shape in slide.shapes:
                        try:
                            if hasattr(shape, "text") and shape.text.strip():
                                slide_text += shape.text.strip() + "\n"
                                shape_count += 1
                        except Exception as shape_error:
                            print(f"PPTX Processing: Error reading shape on slide {slide_num}: {str(shape_error)}")
                            continue
                    
                    # Only add slides that have content beyond the slide header
                    if slide_text.strip() != f"[Slide {slide_num}]":
                        slide_texts.append(slide_text)
                        print(f"PPTX Processing: Slide {slide_num} extracted with {shape_count} text shapes")
                    else:
                        print(f"PPTX Processing: Slide {slide_num} has no extractable text")
                        
                except Exception as slide_error:
                    print(f"PPTX Processing: Error processing slide {slide_num}: {str(slide_error)}")
                    continue
            
            print(f"PPTX Processing: Extracted text from {len(slide_texts)} out of {total_slides} slides")
            
            # Handle case where no text was extracted
            if not slide_texts:
                # Create a placeholder entry so the file doesn't fail completely
                slide_texts = [f"[PowerPoint File: {os.path.basename(file_path)}]\n[No extractable text found in {total_slides} slides - may contain only images or complex layouts]"]
                print(f"PPTX Processing: No text extracted, created placeholder content")
            
            metadata = {
                "num_slides": total_slides,
                "num_text_slides": len(slide_texts),
                "total_text_length": sum(len(text) for text in slide_texts),
                "extraction_method": "python-pptx",
                "processing_notes": f"Processed {total_slides} slides, extracted text from {len(slide_texts)} slides"
            }
            
            print(f"PPTX Processing: Successfully completed. Metadata: {metadata}")
            return slide_texts, metadata
            
        except HTTPException:
            # Re-raise HTTP exceptions as-is
            raise
        except Exception as e:
            print(f"PPTX Processing: Unexpected error: {str(e)}")
            raise HTTPException(status_code=400, detail=f"PowerPoint processing failed: {str(e)}")


class PPTProcessor(FileProcessor):
    """PowerPoint processor for older .ppt format files"""
    
    @staticmethod
    def extract_text(file_path: str) -> Tuple[List[str], Dict[str, Any]]:
        """Extract text from older .ppt PowerPoint files"""
        try:
            print(f"PPT Processing: Attempting to process older PowerPoint file {file_path}")
            
            # Check if file exists
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"PPT file not found: {file_path}")
            
            # Try LibreOffice conversion approach first (if available)
            import subprocess
            import shutil
            
            # Check if LibreOffice is available
            libreoffice_cmd = None
            for cmd in ['libreoffice', 'soffice']:
                if shutil.which(cmd):
                    libreoffice_cmd = cmd
                    break
            
            if libreoffice_cmd:
                print(f"PPT Processing: Found LibreOffice, attempting conversion")
                try:
                    # Create a temporary directory for conversion
                    import tempfile
                    with tempfile.TemporaryDirectory() as temp_dir:
                        # Convert .ppt to .pptx using LibreOffice
                        result = subprocess.run([
                            libreoffice_cmd, '--headless', '--invisible', '--nodefault', '--nolockcheck',
                            '--nologo', '--norestore', '--convert-to', 'pptx',
                            '--outdir', temp_dir, file_path
                        ], capture_output=True, text=True, timeout=30)
                        
                        if result.returncode == 0:
                            # Find the converted file
                            converted_files = [f for f in os.listdir(temp_dir) if f.endswith('.pptx')]
                            if converted_files:
                                converted_path = os.path.join(temp_dir, converted_files[0])
                                print(f"PPT Processing: Successfully converted to {converted_path}")
                                
                                # Process the converted file using PPTXProcessor
                                return PPTXProcessor.extract_text(converted_path)
                        
                        print(f"PPT Processing: LibreOffice conversion failed: {result.stderr}")
                except subprocess.TimeoutExpired:
                    print(f"PPT Processing: LibreOffice conversion timed out")
                except Exception as conversion_error:
                    print(f"PPT Processing: LibreOffice conversion error: {str(conversion_error)}")
            
            # If LibreOffice conversion fails or is not available, provide helpful message
            print(f"PPT Processing: Creating fallback content for .ppt file")
            
            # Create helpful placeholder content
            filename = os.path.basename(file_path)
            file_size = os.path.getsize(file_path)
            
            placeholder_text = f"""[PowerPoint File (Legacy Format): {filename}]

This is an older PowerPoint (.ppt) file that requires special processing.

File Information:
- Filename: {filename}
- File Size: {file_size} bytes
- Format: Microsoft PowerPoint 97-2003 (.ppt)

To extract text content from this file, please:
1. Open the file in Microsoft PowerPoint or LibreOffice Impress
2. Save it as a newer .pptx format
3. Re-upload the .pptx file

Alternatively, you can:
- Use PowerPoint's "Save As" and choose "PowerPoint Presentation (.pptx)"
- Use Google Slides to open and re-export the file
- Use LibreOffice Impress to convert the format

The system will then be able to extract and index the text content for educational chat."""

            texts = [placeholder_text]
            
            metadata = {
                "num_slides": "Unknown (legacy format)",
                "file_size": file_size,
                "format": "PowerPoint 97-2003 (.ppt)",
                "extraction_method": "placeholder (conversion required)",
                "processing_notes": "Legacy .ppt format requires conversion to .pptx for text extraction",
                "recommendations": [
                    "Convert to .pptx format",
                    "Re-save in modern PowerPoint",
                    "Use LibreOffice Impress for conversion"
                ]
            }
            
            print(f"PPT Processing: Created placeholder content with conversion guidance")
            return texts, metadata
            
        except Exception as e:
            print(f"PPT Processing: Error: {str(e)}")
            raise HTTPException(
                status_code=400, 
                detail=f"Unable to process .ppt file. Please convert to .pptx format first. "
                       f"You can do this by opening the file in PowerPoint and saving as .pptx format. "
                       f"Error: {str(e)}"
            )


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


class SimpleTextSplitter:
    """Simple fallback text splitter for when aimakerspace fails"""
    
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        
    def split_texts(self, texts: List[str]) -> List[str]:
        """Split a list of texts into chunks"""
        chunks = []
        for text in texts:
            chunks.extend(self.split(text))
        return chunks
    
    def split(self, text: str) -> List[str]:
        """Split a single text into chunks"""
        if not isinstance(text, str):
            text = str(text)
        
        chunks = []
        step = self.chunk_size - self.chunk_overlap
        
        for i in range(0, len(text), step):
            chunk = text[i:i + self.chunk_size]
            if chunk.strip():  # Only add non-empty chunks
                chunks.append(chunk)
        return chunks


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
        
        # Enhanced chunk tracking for selective deletion
        self.file_chunks: Dict[str, List[str]] = {}  # filename -> list of chunks
        self.chunk_to_file: Dict[int, str] = {}  # chunk_index -> filename
        
        # File processors
        self.processors = {
            'pdf': PDFProcessor(),
            'pptx': PPTXProcessor(),
            'ppt': PPTProcessor(),  # Add support for older PowerPoint format
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
                    
                    # Debug logging
                    print(f"Processing file: {file.filename}")
                    print(f"File extension: {file_extension}")
                    print(f"Documents type: {type(documents)}")
                    print(f"Documents length: {len(documents) if hasattr(documents, '__len__') else 'No length'}")
                    print(f"Documents content preview: {str(documents)[:200] if documents else 'Empty'}")
                    
                    # Clean up temporary file
                    os.unlink(tmp_file_path)
                    
                    # Validate extracted content
                    if not documents or not any(doc.strip() for doc in documents):
                        raise HTTPException(
                            status_code=400,
                            detail=f"File {file.filename} appears to be empty or contains no extractable content."
                        )
                    
                    # Ensure documents is a list of strings
                    if not isinstance(documents, list):
                        documents = [str(documents)]
                    
                    # Ensure all items in documents are strings
                    documents = [str(doc) for doc in documents if doc is not None]
                    
                    print(f"After validation - Documents type: {type(documents)}, Length: {len(documents)}")
                    
                    # Additional debugging for split_texts
                    print(f"About to call split_texts with documents:")
                    for i, doc in enumerate(documents):
                        print(f"  Document {i}: type={type(doc)}, length={len(doc) if hasattr(doc, '__len__') else 'N/A'}")
                        if isinstance(doc, str):
                            print(f"    First 100 chars: {repr(doc[:100])}")
                        else:
                            print(f"    Value: {repr(doc)}")
                    
                    # Validate that all documents are strings
                    if not all(isinstance(doc, str) for doc in documents):
                        raise ValueError("All documents must be strings for text splitting")
                    
                    # Split documents into chunks
                    try:
                        file_chunks = self.text_splitter.split_texts(documents)
                        print(f"Successfully split into {len(file_chunks)} chunks")
                    except Exception as split_error:
                        print(f"Error during text splitting: {str(split_error)}")
                        print(f"Error type: {type(split_error)}")
                        # Fallback to SimpleTextSplitter if CharacterTextSplitter fails
                        print("Falling back to SimpleTextSplitter due to CharacterTextSplitter error.")
                        simple_splitter = SimpleTextSplitter(chunk_size=self.chunk_size, chunk_overlap=self.chunk_overlap)
                        file_chunks = simple_splitter.split_texts(documents)
                        print(f"Successfully split into {len(file_chunks)} chunks using SimpleTextSplitter")
                    
                    # Add source attribution to chunks
                    attributed_chunks = []
                    for chunk in file_chunks:
                        attributed_chunk = f"[Source: {file.filename}]\n{chunk}"
                        attributed_chunks.append(attributed_chunk)
                    
                    # Track chunks for this specific file
                    self.file_chunks[file.filename] = attributed_chunks
                    
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
                # Build mapping from chunk index to filename
                chunk_index = 0
                for filename in self.file_chunks:
                    file_chunks_count = len(self.file_chunks[filename])
                    for i in range(file_chunks_count):
                        self.chunk_to_file[chunk_index] = filename
                        chunk_index += 1
                
                self.vector_db = await self.vector_db.abuild_from_list(all_chunks)
                self.is_indexed = True
                print(f"Vector database built with {len(all_chunks)} chunks from {len(self.file_chunks)} files")
            
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
            relevant_chunks = self.vector_db.search_by_text(question, k=k, return_as_text=True)
            
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
            
            response = self.chat_model.run([system_message, user_message])
            
            # Extract sources from chunks
            sources = []
            for chunk in relevant_chunks:
                if chunk.startswith("[Source:"):
                    source_line = chunk.split('\n')[0]
                    sources.append(source_line.replace("[Source: ", "").replace("]", ""))
            
            return {
                "answer": response,
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
            relevant_chunks = self.vector_db.search_by_text(question, k=k, return_as_text=True)
            
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
                yield chunk
                    
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
        self.file_chunks = {}
        self.chunk_to_file = {}
        self.is_indexed = False
        
        if self.vector_db:
            self.vector_db.vectors = []
        
        return {
            "status": "success",
            "message": "All course materials have been cleared. Ready for new uploads."
        }
    
    async def delete_individual_file(self, filename: str) -> Dict[str, Any]:
        """Delete a specific file from course materials and selectively remove its chunks"""
        try:
            # Check if file exists
            if filename not in self.course_materials:
                raise HTTPException(
                    status_code=404,
                    detail=f"File '{filename}' not found in course materials."
                )
            
            # Remove the file from course materials
            removed_file = self.course_materials.pop(filename)
            
            # If no files left, clear everything
            if not self.course_materials:
                self.is_indexed = False
                self.file_chunks = {}
                self.chunk_to_file = {}
                if self.vector_db:
                    self.vector_db.vectors = []
                print(f"No files remaining after deleting '{filename}'. System cleared.")
                return {
                    "status": "success",
                    "message": f"File '{filename}' deleted. No course materials remaining.",
                    "removed_file": removed_file,
                    "remaining_files": 0,
                    "is_indexed": False
                }
            
            # Remove chunks for this file and rebuild vector database efficiently
            await self._remove_file_chunks_and_rebuild(filename)
            
            print(f"File '{filename}' deleted. Remaining files: {list(self.course_materials.keys())}")
            
            return {
                "status": "success",
                "message": f"File '{filename}' deleted successfully. Remaining files are still indexed and searchable.",
                "removed_file": removed_file,
                "remaining_files": len(self.course_materials),
                "is_indexed": self.is_indexed
            }
            
        except HTTPException:
            # Re-raise HTTP exceptions
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error deleting file '{filename}': {str(e)}"
            )
    
    async def _remove_file_chunks_and_rebuild(self, filename: str) -> None:
        """Remove chunks for a specific file and rebuild vector database with remaining chunks"""
        try:
            print(f"Removing chunks for file: {filename}")
            
            # Remove file from chunk tracking
            if filename in self.file_chunks:
                del self.file_chunks[filename]
            
            # Rebuild vector database with remaining chunks
            remaining_chunks = []
            for remaining_filename in self.file_chunks:
                remaining_chunks.extend(self.file_chunks[remaining_filename])
            
            if remaining_chunks:
                # Ensure models are initialized
                self._ensure_models_initialized()
                
                # Rebuild chunk-to-file mapping
                self.chunk_to_file = {}
                chunk_index = 0
                for remaining_filename in self.file_chunks:
                    file_chunks_count = len(self.file_chunks[remaining_filename])
                    for i in range(file_chunks_count):
                        self.chunk_to_file[chunk_index] = remaining_filename
                        chunk_index += 1
                
                # Rebuild vector database with remaining chunks
                self.vector_db = VectorDatabase(embedding_model=self.embedding_model)
                await self.vector_db.abuild_from_list(remaining_chunks)
                self.is_indexed = True
                
                print(f"Vector database rebuilt with {len(remaining_chunks)} chunks from {len(self.file_chunks)} remaining files")
            else:
                # No chunks remaining
                self.is_indexed = False
                self.chunk_to_file = {}
                if self.vector_db:
                    self.vector_db.vectors = []
            
        except Exception as e:
            print(f"Error rebuilding vector database after deleting {filename}: {str(e)}")
            # Fallback: mark as not indexed
            self.is_indexed = False
            self.chunk_to_file = {}
            if self.vector_db:
                self.vector_db.vectors = []


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

async def delete_course_material(filename: str) -> Dict[str, Any]:
    """Delete a specific course material file"""
    return await course_rag_manager.delete_individual_file(filename) 