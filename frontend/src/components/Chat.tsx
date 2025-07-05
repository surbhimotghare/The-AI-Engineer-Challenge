'use client'

import { useState, useEffect, useRef } from 'react'
import {
  VStack,
  Box,
  useToast,
  Select,
  Button,
  useDisclosure,
  HStack,
  Text,
  Badge,
  Divider,
  ButtonGroup,
  Icon,
  Flex,
  Collapse,
  useColorModeValue,
  Alert,
  AlertIcon,
  AlertDescription,
} from '@chakra-ui/react'
import { FiMessageCircle, FiFileText, FiChevronDown, FiChevronUp, FiCheck, FiX } from 'react-icons/fi'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import ApiKeyModal from './ApiKeyModal'
import PDFUpload from './PDFUpload'
import { sendChatMessage, sendRAGChatMessage, getPDFStatus, type PDFInfo } from '../lib/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  isRAG?: boolean
  sources?: string[]
}

type ChatMode = 'regular' | 'rag'

const AVAILABLE_MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
]

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].value)
  const [apiKey, setApiKey] = useState('')
  const [chatMode, setChatMode] = useState<ChatMode>('regular')
  const [currentPDF, setCurrentPDF] = useState<PDFInfo | null>(null)
  const [showPDFSection, setShowPDFSection] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const toast = useToast()

  // Color mode values
  const borderColor = useColorModeValue('gray.200', 'gray.600')
  const bgColor = useColorModeValue('white', 'gray.800')

  useEffect(() => {
    const storedApiKey = localStorage.getItem('openai_api_key')
    if (storedApiKey) {
      setApiKey(storedApiKey)
    } else {
      onOpen()
    }
  }, [onOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Check PDF status on component mount
  useEffect(() => {
    const checkPDFStatus = async () => {
      try {
        const status = await getPDFStatus()
        if (status.is_indexed && status.pdf_info) {
          setCurrentPDF(status.pdf_info)
        }
      } catch (error) {
        console.error('Error checking PDF status:', error)
      }
    }
    checkPDFStatus()
  }, [])

  const handleSendMessage = async (content: string) => {
    if (!apiKey) {
      onOpen()
      return
    }

    // If in RAG mode but no PDF is loaded, show warning
    if (chatMode === 'rag' && !currentPDF) {
      toast({
        title: 'No PDF Loaded',
        description: 'Please upload a PDF document first to use RAG chat mode.',
        status: 'warning',
        duration: 5000,
        isClosable: true,
      })
      return
    }

    const userMessage: Message = { role: 'user', content }
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    try {
      const assistantMessage: Message = { 
        role: 'assistant', 
        content: '', 
        isStreaming: true,
        isRAG: chatMode === 'rag'
      }
      setMessages(prev => [...prev, assistantMessage])

      let accumulatedContent = ''
      
      if (chatMode === 'regular') {
        // Regular chat mode
        await sendChatMessage(
          {
            developer_message: "You are a helpful AI assistant.",
            user_message: content,
            model: selectedModel,
            api_key: apiKey,
          },
          (chunk) => {
            if (chunk && chunk.trim()) {
              accumulatedContent += chunk
              setMessages(prev => {
                const newMessages = [...prev]
                const lastMessage = newMessages[newMessages.length - 1]
                if (lastMessage.role === 'assistant') {
                  lastMessage.content = accumulatedContent
                }
                return newMessages
              })
            }
          }
        )
      } else {
        // RAG chat mode
        await sendRAGChatMessage(
          {
            question: content,
            k: 5,
            api_key: apiKey,
          },
          (chunk) => {
            if (chunk && chunk.trim()) {
              accumulatedContent += chunk
              setMessages(prev => {
                const newMessages = [...prev]
                const lastMessage = newMessages[newMessages.length - 1]
                if (lastMessage.role === 'assistant') {
                  lastMessage.content = accumulatedContent
                }
                return newMessages
              })
            }
          }
        )
      }

      setMessages(prev => {
        const newMessages = [...prev]
        const lastMessage = newMessages[newMessages.length - 1]
        if (lastMessage.role === 'assistant') {
          lastMessage.isStreaming = false
        }
        return newMessages
      })
    } catch (error) {
      const errorMessage = chatMode === 'rag' 
        ? 'Failed to send RAG message. Please check your PDF is uploaded and try again.'
        : 'Failed to send message. Please try again.'
      
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setIsLoading(false)
    }
  }

  const handleApiKeySubmit = (key: string) => {
    setApiKey(key)
    localStorage.setItem('openai_api_key', key)
    onClose()
    
    // Show success feedback
    toast({
      title: 'API Key Updated',
      description: 'Your OpenAI API key has been saved and validated.',
      status: 'success',
      duration: 3000,
      isClosable: true,
    })
  }

  const handlePDFUploadSuccess = (pdfInfo: PDFInfo) => {
    setCurrentPDF(pdfInfo)
    // Auto-switch to RAG mode when PDF is uploaded
    setChatMode('rag')
    toast({
      title: 'Ready for RAG Chat',
      description: 'Your PDF has been processed. You can now ask questions about it!',
      status: 'success',
      duration: 5000,
      isClosable: true,
    })
  }

  const handlePDFUploadError = (error: string) => {
    console.error('PDF upload error:', error)
    // Error handling is already done in PDFUpload component
  }

  const handleClearPDF = () => {
    setCurrentPDF(null)
    setChatMode('regular')
  }

  const renderChatModeToggle = () => (
    <ButtonGroup size="sm" isAttached variant="outline">
      <Button
        onClick={() => setChatMode('regular')}
        colorScheme={chatMode === 'regular' ? 'blue' : 'gray'}
        leftIcon={<FiMessageCircle />}
      >
        Regular Chat
      </Button>
      <Button
        onClick={() => setChatMode('rag')}
        colorScheme={chatMode === 'rag' ? 'blue' : 'gray'}
        leftIcon={<FiFileText />}
        isDisabled={!currentPDF}
      >
        PDF Chat
      </Button>
    </ButtonGroup>
  )

  const renderPDFStatus = () => {
    if (!currentPDF) return null
    
    return (
      <Box
        p={3}
        bg={useColorModeValue('blue.50', 'blue.900')}
        borderRadius="md"
        border="1px solid"
        borderColor={useColorModeValue('blue.200', 'blue.600')}
      >
        <HStack justify="space-between">
          <HStack spacing={2}>
            <Icon as={FiFileText} color="blue.500" />
            <Text fontSize="sm" fontWeight="medium">
              {currentPDF.filename}
            </Text>
            <Badge colorScheme="blue" size="sm">
              {currentPDF.num_pages} pages
            </Badge>
            <Badge colorScheme="green" size="sm">
              {currentPDF.num_chunks} chunks
            </Badge>
          </HStack>
          <Text fontSize="xs" color="gray.500">
            Ready for questions
          </Text>
        </HStack>
      </Box>
    )
  }

  const renderChatHeader = () => (
    <Box mb={4}>
      <HStack justify="space-between" align="center" mb={4}>
        <HStack spacing={4}>
          <Select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            maxW="200px"
          >
            {AVAILABLE_MODELS.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </Select>
          <Button 
            onClick={onOpen} 
            size="md"
            variant={apiKey ? "outline" : "solid"}
            colorScheme={apiKey ? "green" : "blue"}
            leftIcon={apiKey ? <Icon as={FiCheck} /> : <Icon as={FiX} />}
          >
            {apiKey ? 'API Key Set ✓' : 'Set API Key'}
          </Button>
        </HStack>
        
        {renderChatModeToggle()}
      </HStack>

      {/* API Key Status Alert */}
      {!apiKey && (
        <Alert status="warning" borderRadius="md" mb={4}>
          <AlertIcon />
          <AlertDescription>
            Please set your OpenAI API key to start chatting. 
            <Button
              variant="link"
              colorScheme="orange"
              ml={2}
              onClick={onOpen}
              size="sm"
            >
              Click here to add your key
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {currentPDF && renderPDFStatus()}
      
      {/* PDF Upload Section */}
      <Box mt={4}>
        <Button
          onClick={() => setShowPDFSection(!showPDFSection)}
          variant="ghost"
          size="sm"
          leftIcon={showPDFSection ? <FiChevronUp /> : <FiChevronDown />}
        >
          {showPDFSection ? 'Hide' : 'Show'} PDF Upload
        </Button>
        <Collapse in={showPDFSection}>
          <Box mt={3} p={4} border="1px solid" borderColor={borderColor} borderRadius="md" bg={bgColor}>
            <PDFUpload
              apiKey={apiKey}
              onUploadSuccess={handlePDFUploadSuccess}
              onUploadError={handlePDFUploadError}
            />
          </Box>
        </Collapse>
      </Box>
    </Box>
  )

  return (
    <Box h="calc(100vh - 200px)" display="flex" flexDirection="column">
      {renderChatHeader()}

      <VStack
        flex={1}
        overflowY="auto"
        spacing={4}
        align="stretch"
        mb={4}
        p={4}
        borderRadius="md"
        bg="gray.50"
      >
        {messages.length === 0 && (
          <Box textAlign="center" py={8}>
            <Text color="gray.500" fontSize="lg">
              {chatMode === 'regular' 
                ? 'Start a conversation with the AI assistant'
                : currentPDF 
                  ? `Ask questions about "${currentPDF.filename}"`
                  : 'Upload a PDF document to start asking questions about it'
              }
            </Text>
          </Box>
        )}
        
        {messages.map((message, index) => (
          <ChatMessage key={index} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </VStack>

      <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />

      <ApiKeyModal
        isOpen={isOpen}
        onClose={onClose}
        onSubmit={handleApiKeySubmit}
        initialApiKey={apiKey}
      />
    </Box>
  )
} 