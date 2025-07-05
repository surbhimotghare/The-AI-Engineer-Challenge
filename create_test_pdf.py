#!/usr/bin/env python3
"""
Create a test PDF file for RAG testing.
"""

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.units import inch

def create_test_pdf():
    """Create a test PDF with sample content about AI and machine learning."""
    
    filename = "test_ai_document.pdf"
    
    # Create the PDF document
    doc = SimpleDocTemplate(filename, pagesize=letter)
    
    # Create content
    story = []
    styles = getSampleStyleSheet()
    
    # Title
    title = Paragraph("Artificial Intelligence and Machine Learning Guide", styles['Title'])
    story.append(title)
    story.append(Spacer(1, 20))
    
    # Introduction
    intro_text = """
    <b>Introduction to Artificial Intelligence</b><br/><br/>
    Artificial Intelligence (AI) is a branch of computer science that aims to create machines 
    capable of performing tasks that typically require human intelligence. These tasks include 
    learning, reasoning, problem-solving, perception, and language understanding.
    """
    intro = Paragraph(intro_text, styles['Normal'])
    story.append(intro)
    story.append(Spacer(1, 15))
    
    # Machine Learning Section
    ml_text = """
    <b>What is Machine Learning?</b><br/><br/>
    Machine Learning is a subset of AI that enables computers to learn and improve from 
    experience without being explicitly programmed. It focuses on the development of algorithms 
    that can analyze data, identify patterns, and make predictions or decisions.
    
    <br/><br/>There are three main types of machine learning:
    <br/>• <b>Supervised Learning:</b> Uses labeled data to train models
    <br/>• <b>Unsupervised Learning:</b> Finds patterns in unlabeled data
    <br/>• <b>Reinforcement Learning:</b> Learns through interaction with an environment
    """
    ml_paragraph = Paragraph(ml_text, styles['Normal'])
    story.append(ml_paragraph)
    story.append(Spacer(1, 15))
    
    # Deep Learning Section
    dl_text = """
    <b>Deep Learning</b><br/><br/>
    Deep Learning is a specialized subset of machine learning that uses neural networks 
    with multiple layers (hence "deep") to model and understand complex patterns in data. 
    It has revolutionized fields like computer vision, natural language processing, and 
    speech recognition.
    
    <br/><br/>Key applications include:
    <br/>• Image recognition and computer vision
    <br/>• Natural language processing and chatbots
    <br/>• Speech recognition and synthesis
    <br/>• Autonomous vehicles and robotics
    """
    dl_paragraph = Paragraph(dl_text, styles['Normal'])
    story.append(dl_paragraph)
    story.append(Spacer(1, 15))
    
    # RAG Section
    rag_text = """
    <b>Retrieval-Augmented Generation (RAG)</b><br/><br/>
    RAG is a technique that combines information retrieval with text generation. It allows 
    AI models to access external knowledge bases to provide more accurate and up-to-date 
    information in their responses.
    
    <br/><br/>RAG works by:
    <br/>1. <b>Indexing:</b> Converting documents into searchable vector representations
    <br/>2. <b>Retrieval:</b> Finding relevant information based on user queries
    <br/>3. <b>Generation:</b> Using retrieved context to generate accurate responses
    
    <br/><br/>This approach is particularly useful for building AI assistants that need to 
    answer questions about specific documents or knowledge bases.
    """
    rag_paragraph = Paragraph(rag_text, styles['Normal'])
    story.append(rag_paragraph)
    story.append(Spacer(1, 15))
    
    # Future of AI Section
    future_text = """
    <b>The Future of AI</b><br/><br/>
    The future of AI holds immense potential across various industries:
    
    <br/><br/>• <b>Healthcare:</b> AI-powered diagnostics and personalized medicine
    <br/>• <b>Education:</b> Personalized learning and intelligent tutoring systems
    <br/>• <b>Finance:</b> Fraud detection and algorithmic trading
    <br/>• <b>Transportation:</b> Autonomous vehicles and smart traffic management
    <br/>• <b>Entertainment:</b> Content recommendation and creation
    
    <br/><br/>As AI continues to evolve, it will become increasingly integrated into our 
    daily lives, making tasks more efficient and opening new possibilities for innovation.
    """
    future_paragraph = Paragraph(future_text, styles['Normal'])
    story.append(future_paragraph)
    
    # Build the PDF
    doc.build(story)
    
    print(f"Test PDF created: {filename}")
    return filename

if __name__ == "__main__":
    create_test_pdf() 