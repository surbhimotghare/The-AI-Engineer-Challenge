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
  Heading,
  Container,
  Avatar,
} from '@chakra-ui/react'
import { FiMessageCircle, FiBook, FiChevronDown, FiChevronUp, FiCheck, FiX, FiBookOpen, FiUsers } from 'react-icons/fi'
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
  const [isApiKeyLoaded, setIsApiKeyLoaded] = useState(false)
  const [chatMode, setChatMode] = useState<ChatMode>('regular')
  const [currentPDF, setCurrentPDF] = useState<PDFInfo | null>(null)
  const [showPDFSection, setShowPDFSection] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const toast = useToast()

  // Librarian-themed colors
  const bgGradient = useColorModeValue(
    'linear(to-br, amber.50, orange.50, red.50)',
    'linear(to-br, gray.900, amber.900, orange.900)'
  )
  const librarianCardBg = useColorModeValue('white', 'gray.800')
  const librarianCardBorder = useColorModeValue('amber.200', 'amber.600')
  const chatAreaBg = useColorModeValue('amber.25', 'gray.700')
  const warmText = useColorModeValue('amber.800', 'amber.200')
  const accentColor = useColorModeValue('amber.600', 'amber.400')

  useEffect(() => {
    const storedApiKey = localStorage.getItem('openai_api_key')
    if (storedApiKey) {
      console.log('Chat: Loading API key from localStorage, length:', storedApiKey.length)
      setApiKey(storedApiKey)
    } else {
      console.log('Chat: No API key found in localStorage, opening modal')
      onOpen()
    }
    setIsApiKeyLoaded(true)
  }, [onOpen])

  // Debug effect to track API key changes
  useEffect(() => {
    console.log('Chat: API key state changed, new length:', apiKey?.length || 0)
  }, [apiKey])

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
        title: 'No Document in Collection',
        description: 'Please add a document to the library first to discuss its contents.',
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
        // Regular chat mode - librarian persona
        await sendChatMessage(
          {
            developer_message: "You are a wise, friendly librarian with extensive knowledge. You help patrons find information, answer questions, and provide thoughtful guidance. Use warm, welcoming language as if you're speaking to a visitor in your library.",
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
        // RAG chat mode - document-specific librarian
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
        ? 'I apologize, but I encountered an issue accessing the document. Please ensure your document is properly uploaded and try again.'
        : 'I apologize, but I encountered an issue processing your request. Please try again.'
      
      toast({
        title: 'Librarian Notice',
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
    console.log('Chat: Setting API key, length:', key?.length)
    setApiKey(key)
    localStorage.setItem('openai_api_key', key)
    onClose()
    
    // Show success feedback
    toast({
      title: 'Library Access Granted',
      description: 'Your credentials have been validated. Welcome to the library!',
      status: 'success',
      duration: 3000,
      isClosable: true,
    })
    
    console.log('Chat: API key state updated, new value length:', key?.length)
  }

  const handlePDFUploadSuccess = (pdfInfo: PDFInfo) => {
    setCurrentPDF(pdfInfo)
    // Auto-switch to RAG mode when PDF is uploaded
    setChatMode('rag')
    toast({
      title: 'Document Added to Collection',
      description: `"${pdfInfo.filename}" has been catalogued and is ready for discussion!`,
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
        colorScheme={chatMode === 'regular' ? 'amber' : 'gray'}
        leftIcon={<FiUsers />}
        bg={chatMode === 'regular' ? 'amber.100' : 'white'}
        borderColor={chatMode === 'regular' ? 'amber.300' : 'gray.300'}
      >
        General Inquiry
      </Button>
      <Button
        onClick={() => setChatMode('rag')}
        colorScheme={chatMode === 'rag' ? 'amber' : 'gray'}
        leftIcon={<FiBookOpen />}
        isDisabled={!currentPDF}
        bg={chatMode === 'rag' ? 'amber.100' : 'white'}
        borderColor={chatMode === 'rag' ? 'amber.300' : 'gray.300'}
      >
        Document Discussion
      </Button>
    </ButtonGroup>
  )

  const renderPDFStatus = () => {
    if (!currentPDF) return null
    
    return (
      <Box
        p={3}
        bg={useColorModeValue('green.50', 'green.900')}
        borderRadius="lg"
        border="1px solid"
        borderColor={useColorModeValue('green.200', 'green.600')}
      >
        <HStack justify="space-between">
          <HStack spacing={2}>
            <Icon as={FiBook} color="green.500" />
            <Text fontSize="sm" fontWeight="medium" color={useColorModeValue('green.800', 'green.200')}>
              📖 {currentPDF.filename}
            </Text>
            <Badge colorScheme="green" size="sm">
              {currentPDF.num_pages} pages
            </Badge>
            <Badge colorScheme="blue" size="sm">
              {currentPDF.num_chunks} sections
            </Badge>
          </HStack>
          <Text fontSize="xs" color={useColorModeValue('green.600', 'green.300')}>
            Ready for discussion
          </Text>
        </HStack>
      </Box>
    )
  }

  const renderLibrarianHeader = () => (
    <Box
      bg={librarianCardBg}
      borderRadius="xl"
      p={6}
      border="2px solid"
      borderColor={librarianCardBorder}
      shadow="lg"
      mb={6}
    >
      <HStack spacing={4} align="center">
        <Avatar
          size="lg"
          name="Library Assistant"
          bg={accentColor}
          color="white"
          icon={<FiBook fontSize="1.5rem" />}
        />
        <VStack align="start" spacing={1}>
          <Heading size="lg" color={warmText}>
            📚 Digital Library Assistant
          </Heading>
          <Text color={useColorModeValue('gray.600', 'gray.300')} fontSize="md">
            Your friendly neighborhood librarian, ready to help with research and questions
          </Text>
        </VStack>
      </HStack>
      
      <Divider my={4} borderColor={librarianCardBorder} />
      
      <HStack justify="space-between" align="center">
        <HStack spacing={4}>
          <Select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            maxW="200px"
            bg={useColorModeValue('white', 'gray.700')}
            borderColor={useColorModeValue('amber.300', 'amber.600')}
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
            colorScheme={apiKey ? "green" : "amber"}
            leftIcon={apiKey ? <Icon as={FiCheck} /> : <Icon as={FiX} />}
            borderColor={apiKey ? "green.300" : "amber.300"}
          >
            {apiKey ? 'Library Access ✓' : 'Set Library Card'}
          </Button>
        </HStack>
        
        {renderChatModeToggle()}
      </HStack>

      {/* API Key Status Alert */}
      {!apiKey && (
        <Alert status="warning" borderRadius="md" mt={4} bg={useColorModeValue('orange.50', 'orange.900')}>
          <AlertIcon />
          <AlertDescription>
            Please present your library card (API key) to access the digital collection. 
            <Button
              variant="link"
              colorScheme="orange"
              ml={2}
              onClick={onOpen}
              size="sm"
            >
              Get Library Card
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {currentPDF && (
        <Box mt={4}>
          {renderPDFStatus()}
        </Box>
      )}
      
      {/* PDF Upload Section */}
      <Box mt={4}>
        <Button
          onClick={() => setShowPDFSection(!showPDFSection)}
          variant="ghost"
          size="sm"
          leftIcon={showPDFSection ? <FiChevronUp /> : <FiChevronDown />}
          color={accentColor}
        >
          {showPDFSection ? 'Hide' : 'Show'} Document Collection
        </Button>
        <Collapse in={showPDFSection}>
          <Box mt={3} p={4} border="1px solid" borderColor={librarianCardBorder} borderRadius="md" bg={useColorModeValue('amber.25', 'gray.700')}>
            {isApiKeyLoaded && apiKey && apiKey.length > 0 ? (
              <PDFUpload
                apiKey={apiKey}
                onUploadSuccess={handlePDFUploadSuccess}
                onUploadError={handlePDFUploadError}
              />
            ) : (
              <Alert status="warning" borderRadius="md">
                <AlertIcon />
                <AlertDescription>
                  {!isApiKeyLoaded ? 'Loading library system...' : 'Please present your library card first to add documents.'}
                  {isApiKeyLoaded && (
                    <Button
                      variant="link"
                      colorScheme="orange"
                      ml={2}
                      onClick={onOpen}
                      size="sm"
                    >
                      Get Library Card
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </Box>
        </Collapse>
      </Box>
    </Box>
  )

  const getWelcomeMessage = () => {
    if (chatMode === 'regular') {
      return "Welcome to the library! I'm here to help with any questions you might have. Feel free to ask about any topic."
    } else {
      return currentPDF 
        ? `I've reviewed "${currentPDF.filename}" and I'm ready to discuss its contents with you. What would you like to know?`
        : 'Please add a document to the collection so we can discuss its contents together.'
    }
  }

  return (
    <Box minH="100vh" bgGradient={bgGradient} p={6}>
      <Container maxW="4xl">
        {renderLibrarianHeader()}

        <VStack
          flex={1}
          h="500px"
          overflowY="auto"
          spacing={4}
          align="stretch"
          p={4}
          borderRadius="xl"
          bg={chatAreaBg}
          border="1px solid"
          borderColor={librarianCardBorder}
          shadow="inner"
        >
          {messages.length === 0 && (
            <Box textAlign="center" py={8}>
              <Icon as={FiBook} w={12} h={12} color={accentColor} mb={4} />
              <Text color={warmText} fontSize="lg" fontWeight="medium">
                {getWelcomeMessage()}
              </Text>
            </Box>
          )}
          
          {messages.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </VStack>

        <Box mt={4}>
          <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
        </Box>

        <ApiKeyModal
          isOpen={isOpen}
          onClose={onClose}
          onSubmit={handleApiKeySubmit}
          initialApiKey={apiKey}
        />
      </Container>
    </Box>
  )
} 