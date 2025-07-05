'use client'

import React, { useState, useCallback } from 'react'
import {
  Box,
  Button,
  Text,
  VStack,
  HStack,
  Progress,
  useToast,
  Icon,
  Flex,
  Badge,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  CloseButton,
  useColorModeValue,
} from '@chakra-ui/react'
import { FiUpload, FiFile, FiCheck, FiX, FiTrash2 } from 'react-icons/fi'

interface PDFInfo {
  filename: string
  content_length: number
  num_pages: number
  num_chunks: number
  total_text_length: number
}

interface PDFUploadProps {
  apiKey: string
  onUploadSuccess: (pdfInfo: PDFInfo) => void
  onUploadError: (error: string) => void
}

interface UploadState {
  isUploading: boolean
  progress: number
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'error'
  currentPDF: PDFInfo | null
  error: string | null
}

export default function PDFUpload({ apiKey, onUploadSuccess, onUploadError }: PDFUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    status: 'idle',
    currentPDF: null,
    error: null,
  })

  const toast = useToast()

  // Librarian-themed colors for consistency
  const bgColor = useColorModeValue('amber.50', 'gray.700')
  const borderColor = useColorModeValue('amber.300', 'amber.600')
  const hoverBorderColor = useColorModeValue('amber.400', 'amber.300')
  const activeBorderColor = useColorModeValue('amber.500', 'amber.400')

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = Array.from(e.dataTransfer.files)
    const pdfFile = files.find((file: File) => file.type === 'application/pdf')
    
    if (pdfFile) {
      handleFileUpload(pdfFile)
    } else {
      toast({
        title: 'Invalid File Type',
        description: 'Please upload a PDF file.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
  }, [toast])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }, [])

  const handleFileUpload = async (file: File) => {
    // Debug logging to help identify the issue
    console.log('PDFUpload: apiKey prop value:', apiKey)
    console.log('PDFUpload: apiKey type:', typeof apiKey)
    console.log('PDFUpload: apiKey length:', apiKey?.length)
    
    if (!apiKey || apiKey.trim() === '') {
      console.log('PDFUpload: API key validation failed - no key provided')
      toast({
        title: 'Library Access Required',
        description: 'Please present your library card (API key) to add documents to the collection.',
        status: 'warning',
        duration: 5000,
        isClosable: true,
      })
      return
    }

    console.log('PDFUpload: API key validation passed, proceeding with upload')

    setUploadState(prev => ({
      ...prev,
      isUploading: true,
      status: 'uploading',
      progress: 0,
      error: null,
    }))

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('api_key', apiKey.trim())

      const API_BASE_URL = (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) 
        ? process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '') 
        : 'http://localhost:8000'
      
      // Simulate progress for upload phase
      setUploadState(prev => ({ ...prev, progress: 30 }))
      
      const response = await fetch(`${API_BASE_URL}/api/upload-pdf`, {
        method: 'POST',
        body: formData,
      })

      setUploadState(prev => ({ ...prev, progress: 60, status: 'processing' }))

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to upload PDF')
      }

      const result = await response.json()
      
      setUploadState(prev => ({ ...prev, progress: 100, status: 'success' }))

      if (result.status === 'success' && result.pdf_info) {
        setUploadState(prev => ({
          ...prev,
          currentPDF: result.pdf_info,
        }))
        
        onUploadSuccess(result.pdf_info)
        
        toast({
          title: 'Document Successfully Added',
          description: `📚 "${result.pdf_info.filename}" has been catalogued and added to your collection.`,
          status: 'success',
          duration: 5000,
          isClosable: true,
        })
      } else {
        throw new Error('Document upload succeeded but cataloguing information unavailable')
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      
      setUploadState(prev => ({
        ...prev,
        isUploading: false,
        status: 'error',
        error: errorMessage,
        progress: 0,
      }))

      onUploadError(errorMessage)
      
      toast({
        title: 'Cataloguing Failed',
        description: `Unable to add document to collection: ${errorMessage}`,
        status: 'error',
        duration: 7000,
        isClosable: true,
      })
    } finally {
      setTimeout(() => {
        setUploadState(prev => ({ ...prev, isUploading: false }))
      }, 1000)
    }
  }

  const handleClearPDF = async () => {
    try {
      const API_BASE_URL = (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) 
        ? process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '') 
        : 'http://localhost:8000'
      
      const response = await fetch(`${API_BASE_URL}/api/clear-pdf`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setUploadState(prev => ({
          ...prev,
          status: 'idle',
          currentPDF: null,
          error: null,
          progress: 0,
        }))
        
        toast({
          title: 'Collection Cleared',
          description: 'Document removed from collection. You may add a new document.',
          status: 'info',
          duration: 5000,
          isClosable: true,
        })
      }
    } catch (error) {
      toast({
        title: 'Collection Error',
        description: 'Unable to clear document collection.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const renderUploadArea = () => (
    <Box
      border="2px dashed"
      borderColor={dragActive ? activeBorderColor : borderColor}
      borderRadius="lg"
      p={8}
      textAlign="center"
      bg={dragActive ? useColorModeValue('amber.100', 'amber.900') : bgColor}
      transition="all 0.2s"
      cursor="pointer"
      _hover={{
        borderColor: hoverBorderColor,
        bg: useColorModeValue('amber.75', 'gray.600'),
      }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => document.getElementById('file-upload')?.click()}
    >
      <VStack spacing={4}>
        <Icon as={FiUpload} w={10} h={10} color={useColorModeValue('amber.500', 'amber.300')} />
        <VStack spacing={2}>
          <Text fontSize="lg" fontWeight="medium" color={useColorModeValue('amber.800', 'amber.200')}>
            📚 Add Document to Collection
          </Text>
          <Text fontSize="sm" color={useColorModeValue('amber.600', 'amber.400')}>
            Drop your PDF here or click to browse • Max 50MB
          </Text>
        </VStack>
        <Button colorScheme="amber" variant="outline" size="sm">
          Select Document
        </Button>
      </VStack>
      <input
        id="file-upload"
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </Box>
  )

  const renderProgress = () => (
    <VStack spacing={4} w="full">
      <HStack justify="space-between" w="full">
        <Text fontSize="sm" fontWeight="medium" color={useColorModeValue('amber.800', 'amber.200')}>
          {uploadState.status === 'uploading' ? '📤 Uploading Document...' : '⚙️ Cataloguing Document...'}
        </Text>
        <Text fontSize="sm" color={useColorModeValue('amber.600', 'amber.400')}>
          {uploadState.progress}%
        </Text>
      </HStack>
      <Progress
        value={uploadState.progress}
        size="lg"
        colorScheme="amber"
        w="full"
        borderRadius="md"
      />
      <Text fontSize="xs" color={useColorModeValue('amber.600', 'amber.400')} textAlign="center">
        {uploadState.status === 'uploading' 
          ? 'Transferring document to library servers...' 
          : 'Processing text and creating searchable index...'}
      </Text>
    </VStack>
  )

  const renderPDFStatus = () => {
    if (!uploadState.currentPDF) return null

    return (
      <Alert status="success" borderRadius="md" bg={useColorModeValue('green.50', 'green.900')}>
        <AlertIcon />
        <Box flex="1">
          <AlertTitle fontSize="sm">📖 Document Ready!</AlertTitle>
          <AlertDescription fontSize="xs">
            <VStack align="start" spacing={1} mt={2}>
              <HStack spacing={4}>
                <Badge colorScheme="green">
                  <Icon as={FiFile} mr={1} />
                  {uploadState.currentPDF.filename}
                </Badge>
                <Badge colorScheme="amber">
                  {uploadState.currentPDF.num_pages} pages
                </Badge>
                <Badge colorScheme="blue">
                  {uploadState.currentPDF.num_chunks} sections
                </Badge>
              </HStack>
              <Text fontSize="xs" color={useColorModeValue('green.600', 'green.400')}>
                📊 Size: {formatFileSize(uploadState.currentPDF.content_length)} • 
                Text: {uploadState.currentPDF.total_text_length.toLocaleString()} characters indexed
              </Text>
            </VStack>
          </AlertDescription>
        </Box>
        <CloseButton
          alignSelf="flex-start"
          position="relative"
          right={-1}
          top={-1}
          onClick={handleClearPDF}
        />
      </Alert>
    )
  }

  const renderError = () => {
    if (!uploadState.error) return null

    return (
      <Alert status="error" borderRadius="md">
        <AlertIcon />
        <Box flex="1">
          <AlertTitle fontSize="sm">❌ Cataloguing Failed</AlertTitle>
          <AlertDescription fontSize="xs">
            {uploadState.error}
          </AlertDescription>
        </Box>
        <CloseButton
          alignSelf="flex-start"
          position="relative"
          right={-1}
          top={-1}
          onClick={() => setUploadState(prev => ({ ...prev, error: null, status: 'idle' }))}
        />
      </Alert>
    )
  }

  return (
    <Box w="full">
      <VStack spacing={4} align="stretch">
        {/* Header */}
        <Flex justify="space-between" align="center">
          <Text fontSize="lg" fontWeight="semibold" color={useColorModeValue('amber.800', 'amber.200')}>
            📚 Document Collection
          </Text>
          {uploadState.currentPDF && (
            <Button
              size="sm"
              variant="ghost"
              colorScheme="red"
              leftIcon={<FiTrash2 />}
              onClick={handleClearPDF}
            >
              Remove
            </Button>
          )}
        </Flex>

        {/* Content */}
        {uploadState.status === 'idle' && renderUploadArea()}
        {(uploadState.status === 'uploading' || uploadState.status === 'processing') && renderProgress()}
        {uploadState.status === 'success' && renderPDFStatus()}
        {uploadState.status === 'error' && renderError()}
      </VStack>
    </Box>
  )
} 