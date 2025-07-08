'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Button,
  Text,
  VStack,
  HStack,
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
  SimpleGrid,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Stack,
  Divider,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Checkbox,
  CheckboxGroup,
} from '@chakra-ui/react'
import { FiUpload, FiFile, FiTrash2, FiEye, FiSearch, FiPlus } from 'react-icons/fi'

interface PDFInfo {
  doc_id: string
  filename: string
  content_length: number
  num_pages: number
  num_chunks: number
  total_text_length: number
  uploaded_at: string
  chunk_ids: string[]
}

interface PDFLibraryProps {
  apiKey: string
  onDocumentSelect: (selectedDocIds: string[]) => void
  selectedDocIds: string[]
}

interface UploadState {
  isUploading: boolean
  progress: number
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'error'
  error: string | null
}

export default function PDFLibrary({ apiKey, onDocumentSelect, selectedDocIds }: PDFLibraryProps) {
  const [documents, setDocuments] = useState<PDFInfo[]>([])
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    status: 'idle',
    error: null,
  })
  const [isLoading, setIsLoading] = useState(false)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [fileToUpload, setFileToUpload] = useState<File | null>(null)

  const toast = useToast()

  // Librarian-themed colors
  const bgColor = useColorModeValue('amber.50', 'gray.700')
  const borderColor = useColorModeValue('amber.300', 'amber.600')
  const cardBg = useColorModeValue('white', 'gray.800')

  // API base URL logic
  const getApiBaseUrl = () => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      return 'http://localhost:8000'
    }
    return ''
  }

  const API_BASE_URL = getApiBaseUrl()

  // Load documents on component mount
  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/list-documents`)
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents || [])
      } else {
        console.error('Failed to load documents')
      }
    } catch (error) {
      console.error('Error loading documents:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFileToUpload(file)
      onOpen()
    }
  }

  const handleUpload = async () => {
    if (!fileToUpload || !apiKey) return

    setUploadState(prev => ({
      ...prev,
      isUploading: true,
      status: 'uploading',
      progress: 0,
      error: null,
    }))

    try {
      const formData = new FormData()
      formData.append('file', fileToUpload)
      formData.append('api_key', apiKey.trim())

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
        // Add new document to the list
        setDocuments(prev => [...prev, result.pdf_info])
        
        toast({
          title: 'Document Added to Library',
          description: `📚 "${result.pdf_info.filename}" has been added to your collection.`,
          status: 'success',
          duration: 5000,
          isClosable: true,
        })

        // Auto-select the new document
        onDocumentSelect([...selectedDocIds, result.pdf_info.doc_id])
      }

      onClose()
      setFileToUpload(null)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      
      setUploadState(prev => ({
        ...prev,
        isUploading: false,
        status: 'error',
        error: errorMessage,
        progress: 0,
      }))

      toast({
        title: 'Upload Failed',
        description: `Unable to add document: ${errorMessage}`,
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

  const handleDeleteDocument = async (docId: string, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) return

    try {
      const response = await fetch(`${API_BASE_URL}/api/delete-document/${docId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Remove from documents list
        setDocuments(prev => prev.filter(doc => doc.doc_id !== docId))
        
        // Remove from selected documents
        onDocumentSelect(selectedDocIds.filter(id => id !== docId))
        
        toast({
          title: 'Document Removed',
          description: `"${filename}" has been removed from your collection.`,
          status: 'info',
          duration: 5000,
          isClosable: true,
        })
      } else {
        throw new Error('Failed to delete document')
      }
    } catch (error) {
      toast({
        title: 'Delete Failed',
        description: 'Unable to remove document from collection.',
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const renderDocumentCard = (doc: PDFInfo) => {
    const isSelected = selectedDocIds.includes(doc.doc_id)
    
    return (
      <Card 
        key={doc.doc_id} 
        bg={cardBg}
        border="2px solid"
        borderColor={isSelected ? 'green.300' : 'transparent'}
        _hover={{ borderColor: isSelected ? 'green.400' : 'gray.300' }}
        cursor="pointer"
        onClick={() => {
          if (isSelected) {
            onDocumentSelect(selectedDocIds.filter(id => id !== doc.doc_id))
          } else {
            onDocumentSelect([...selectedDocIds, doc.doc_id])
          }
        }}
      >
        <CardHeader pb={2}>
          <Flex justify="space-between" align="center">
            <HStack spacing={2}>
              <Icon as={FiFile} color="blue.500" />
              <Heading size="sm" noOfLines={1}>
                {doc.filename}
              </Heading>
            </HStack>
            <Button
              size="sm"
              variant="ghost"
              colorScheme="red"
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteDocument(doc.doc_id, doc.filename)
              }}
            >
              <Icon as={FiTrash2} />
            </Button>
          </Flex>
        </CardHeader>
        
        <CardBody pt={0}>
          <VStack align="start" spacing={2}>
            <HStack spacing={4} wrap="wrap">
              <Badge colorScheme="blue">{doc.num_pages} pages</Badge>
              <Badge colorScheme="green">{doc.num_chunks} chunks</Badge>
              <Badge colorScheme="purple">{formatFileSize(doc.content_length)}</Badge>
            </HStack>
            
            <Text fontSize="xs" color="gray.500">
              📅 Added: {formatDate(doc.uploaded_at)}
            </Text>
            
            <Text fontSize="xs" color="gray.500">
              📊 {doc.total_text_length.toLocaleString()} characters indexed
            </Text>
            
            {isSelected && (
              <Badge colorScheme="green" size="sm">
                ✓ Selected
              </Badge>
            )}
          </VStack>
        </CardBody>
      </Card>
    )
  }

  const renderUploadModal = () => (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add Document to Library</ModalHeader>
        <ModalBody>
          <VStack spacing={4}>
            {fileToUpload && (
              <Alert status="info">
                <AlertIcon />
                <Box>
                  <AlertTitle>Selected File</AlertTitle>
                  <AlertDescription>
                    {fileToUpload.name} ({formatFileSize(fileToUpload.size)})
                  </AlertDescription>
                </Box>
              </Alert>
            )}
            
            {uploadState.status === 'uploading' || uploadState.status === 'processing' ? (
              <VStack spacing={2} w="full">
                <Text fontSize="sm">
                  {uploadState.status === 'uploading' ? '📤 Uploading...' : '⚙️ Processing...'}
                </Text>
                <Box w="full" bg="gray.200" borderRadius="md" h={2}>
                  <Box 
                    bg="blue.500" 
                    h="full" 
                    borderRadius="md" 
                    transition="width 0.3s"
                    width={`${uploadState.progress}%`}
                  />
                </Box>
              </VStack>
            ) : (
              <Button
                leftIcon={<FiUpload />}
                onClick={() => document.getElementById('file-upload-library')?.click()}
                colorScheme="blue"
                variant="outline"
                w="full"
              >
                Select PDF File
              </Button>
            )}
            
            {uploadState.error && (
              <Alert status="error">
                <AlertIcon />
                <AlertDescription>{uploadState.error}</AlertDescription>
              </Alert>
            )}
          </VStack>
        </ModalBody>
        
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button 
            colorScheme="blue" 
            onClick={handleUpload}
            isLoading={uploadState.isUploading}
            isDisabled={!fileToUpload || uploadState.isUploading}
          >
            Add to Library
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )

  return (
    <Box w="full">
      <VStack spacing={4} align="stretch">
        {/* Header */}
        <Flex justify="space-between" align="center">
          <VStack align="start" spacing={1}>
            <Text fontSize="lg" fontWeight="semibold" color={useColorModeValue('amber.800', 'amber.200')}>
              📚 Document Library
            </Text>
            <Text fontSize="sm" color={useColorModeValue('amber.600', 'amber.400')}>
              {documents.length} document{documents.length !== 1 ? 's' : ''} • {selectedDocIds.length} selected
            </Text>
          </VStack>
          
          <Button
            leftIcon={<FiPlus />}
            colorScheme="amber"
            onClick={() => document.getElementById('file-upload-library')?.click()}
            size="sm"
          >
            Add Document
          </Button>
        </Flex>

        {/* Document Grid */}
        {isLoading ? (
          <Text textAlign="center" color="gray.500">Loading documents...</Text>
        ) : documents.length === 0 ? (
          <Alert status="info">
            <AlertIcon />
            <Box>
              <AlertTitle>No Documents</AlertTitle>
              <AlertDescription>
                Your library is empty. Upload your first PDF to get started!
              </AlertDescription>
            </Box>
          </Alert>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
            {documents.map(renderDocumentCard)}
          </SimpleGrid>
        )}

        {/* Hidden file input */}
        <input
          id="file-upload-library"
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {/* Upload Modal */}
        {renderUploadModal()}
      </VStack>
    </Box>
  )
} 