'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  Button,
  useToast,
  Icon,
  Flex,
  Badge,
  useColorModeValue,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Textarea,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Select,
  Divider,
  Heading,
  Container,
  Avatar,
  ButtonGroup,
  InputGroup,
  InputRightElement,
} from '@chakra-ui/react'
import { FiSend, FiMessageCircle, FiSearch, FiBook, FiUsers, FiBookOpen, FiCheck, FiX } from 'react-icons/fi'

interface Message {
  id: string
  content: string
  sender: 'user' | 'assistant'
  timestamp: Date
  mode: 'rag' | 'chat'
  sources?: string[]
  searchedDocuments?: string[]
}

interface ChatInterfaceProps {
  apiKey: string
  selectedDocIds: string[]
  onDocumentsChange: (docIds: string[]) => void
  onApiKeyChange?: (key: string) => void
}

const AVAILABLE_MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
]

export default function ChatInterface({ apiKey, selectedDocIds, onDocumentsChange, onApiKeyChange }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [chatMode, setChatMode] = useState<'rag' | 'chat'>('rag')
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].value)
  const [systemMessage, setSystemMessage] = useState('You are a wise, friendly librarian with extensive knowledge. You help patrons find information, answer questions, and provide thoughtful guidance. Use warm, welcoming language as if you\'re speaking to a visitor in your library.')
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
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
  const userMessageBg = useColorModeValue('blue.50', 'blue.900')
  const assistantMessageBg = useColorModeValue('amber.50', 'amber.900')
  const ragMessageBg = useColorModeValue('green.50', 'green.900')

  // API base URL logic
  const getApiBaseUrl = () => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      return 'http://localhost:8000'
    }
    return ''
  }

  const API_BASE_URL = getApiBaseUrl()

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addMessage = (content: string, sender: 'user' | 'assistant', mode: 'rag' | 'chat', sources?: string[], searchedDocuments?: string[]) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      content,
      sender,
      timestamp: new Date(),
      mode,
      sources,
      searchedDocuments,
    }
    setMessages(prev => [...prev, newMessage])
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage = inputValue.trim()
    setInputValue('')
    setIsLoading(true)

    // Add user message
    addMessage(userMessage, 'user', chatMode)

    try {
      if (chatMode === 'rag') {
        // RAG mode - requires documents
        if (selectedDocIds.length === 0) {
          addMessage(
            'Please select at least one document from the Document Library to use RAG mode.',
            'assistant',
            'rag'
          )
          return
        }

        // Make RAG request
        const response = await fetch(`${API_BASE_URL}/api/rag-chat-complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question: userMessage,
            api_key: apiKey,
            doc_ids: selectedDocIds,
            k: 5
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to get RAG response')
        }

        const result = await response.json()
        
        addMessage(
          result.answer,
          'assistant',
          'rag',
          result.sources,
          result.searched_documents
        )

      } else {
        // Regular chat mode
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            developer_message: systemMessage,
            user_message: userMessage,
            api_key: apiKey,
            model: selectedModel
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to get chat response')
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

        let assistantMessage = ''
        addMessage(assistantMessage, 'assistant', 'chat')

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = new TextDecoder().decode(value)
          assistantMessage += chunk

          // Update the last message
          setMessages(prev => {
            const newMessages = [...prev]
            if (newMessages.length > 0) {
              newMessages[newMessages.length - 1].content = assistantMessage
            }
            return newMessages
          })
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred'
      addMessage(
        `Sorry, I encountered an error: ${errorMessage}`,
        'assistant',
        chatMode
      )
      
      toast({
        title: 'Librarian Notice',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const clearChat = () => {
    setMessages([])
  }

  const renderMessage = (message: Message) => {
    const isUser = message.sender === 'user'
    const isRAG = message.mode === 'rag' && message.sender === 'assistant'
    
    const messageBg = isUser 
      ? userMessageBg 
      : isRAG 
        ? ragMessageBg 
        : assistantMessageBg
    
    const borderColor = useColorModeValue(
      isUser 
        ? 'blue.200' 
        : isRAG 
          ? 'green.200' 
          : 'amber.200',
      isUser 
        ? 'blue.700' 
        : isRAG 
          ? 'green.700' 
          : 'amber.600'
    )
    
    const textColor = useColorModeValue(
      isUser 
        ? 'blue.900' 
        : isRAG 
          ? 'green.900' 
          : 'amber.900',
      isUser 
        ? 'blue.100' 
        : isRAG 
          ? 'green.100' 
          : 'amber.100'
    )

    const alignSelf = isUser ? 'flex-end' : 'flex-start'
    const maxW = '70%'

    return (
      <Box
        key={message.id}
        alignSelf={alignSelf}
        maxW={maxW}
        bg={messageBg}
        p={4}
        borderRadius="xl"
        border="1px solid"
        borderColor={borderColor}
        shadow="sm"
      >
        <VStack align="start" spacing={2}>
          {/* Message header */}
          <HStack spacing={2} w="full">
            <Avatar 
              size="xs" 
              name={isUser ? "Visitor" : "Librarian"}
              bg={isUser ? 'blue.500' : isRAG ? 'green.500' : accentColor}
              color="white"
              icon={<Icon as={isUser ? FiMessageCircle : isRAG ? FiBookOpen : FiBook} />}
            />
            <Text fontSize="xs" fontWeight="medium" color={textColor}>
              {isUser ? 'Library Visitor' : '📚 Digital Librarian'}
            </Text>
            <Badge 
              size="sm" 
              colorScheme={isUser ? 'blue' : isRAG ? 'green' : 'amber'}
              variant="subtle"
            >
              {isUser ? 'Visitor' : isRAG ? 'Document Expert' : 'General Knowledge'}
            </Badge>
            <Text fontSize="xs" color="gray.500" ml="auto">
              {message.timestamp.toLocaleTimeString()}
            </Text>
          </HStack>

          {/* Message content */}
          <Text whiteSpace="pre-wrap" color={textColor} lineHeight="1.6">
            {message.content}
          </Text>

          {/* RAG sources */}
          {isRAG && message.sources && message.sources.length > 0 && (
            <Box w="full" pt={2}>
              <Text fontSize="xs" color="gray.600" mb={1}>
                📖 Sources from documents:
              </Text>
              <VStack align="start" spacing={1}>
                {message.sources.map((source, index) => (
                  <Text key={index} fontSize="xs" color="gray.500" fontStyle="italic">
                    • {source}
                  </Text>
                ))}
              </VStack>
            </Box>
          )}
        </VStack>
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
            onClick={() => onApiKeyChange?.('')} 
            size="md"
            variant={apiKey ? "outline" : "solid"}
            colorScheme={apiKey ? "green" : "amber"}
            leftIcon={apiKey ? <Icon as={FiCheck} /> : <Icon as={FiX} />}
            borderColor={apiKey ? "green.300" : "amber.300"}
          >
            {apiKey ? 'Library Access ✓' : 'Set Library Card'}
          </Button>
        </HStack>
        
        <ButtonGroup size="sm" isAttached variant="outline">
          <Button
            onClick={() => setChatMode('rag')}
            colorScheme={chatMode === 'rag' ? 'green' : 'gray'}
            leftIcon={<FiBookOpen />}
            bg={chatMode === 'rag' ? 'green.100' : 'white'}
            borderColor={chatMode === 'rag' ? 'green.300' : 'gray.300'}
          >
            Document Discussion
          </Button>
          <Button
            onClick={() => setChatMode('chat')}
            colorScheme={chatMode === 'chat' ? 'amber' : 'gray'}
            leftIcon={<FiUsers />}
            bg={chatMode === 'chat' ? 'amber.100' : 'white'}
            borderColor={chatMode === 'chat' ? 'amber.300' : 'gray.300'}
          >
            General Inquiry
          </Button>
        </ButtonGroup>
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
              onClick={() => onApiKeyChange?.('')}
              size="sm"
            >
              Get Library Card
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Document Selection Status */}
      {chatMode === 'rag' && (
        <Box mt={4}>
          {selectedDocIds.length > 0 ? (
            <Alert status="success" borderRadius="md" bg={useColorModeValue('green.50', 'green.900')}>
              <AlertIcon />
              <AlertDescription>
                📖 Ready to discuss {selectedDocIds.length} selected document{selectedDocIds.length !== 1 ? 's' : ''}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert status="warning" borderRadius="md" bg={useColorModeValue('orange.50', 'orange.900')}>
              <AlertIcon />
              <AlertDescription>
                Please select documents from the Document Library to use RAG mode
              </AlertDescription>
            </Alert>
          )}
        </Box>
      )}
    </Box>
  )

  const getWelcomeMessage = () => {
    if (chatMode === 'rag') {
      return selectedDocIds.length > 0 
        ? `I've reviewed your ${selectedDocIds.length} selected document${selectedDocIds.length !== 1 ? 's' : ''} and I'm ready to discuss their contents with you. What would you like to know?`
        : 'Please select documents from the Document Library to discuss their contents together.'
    } else {
      return "Welcome to the library! I'm here to help with any questions you might have. Feel free to ask about any topic."
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
          
          {messages.map(renderMessage)}
          <div ref={messagesEndRef} />
        </VStack>

        <Box mt={4}>
          <InputGroup size="lg">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                chatMode === 'rag' 
                  ? `Ask about your ${selectedDocIds.length} selected document${selectedDocIds.length !== 1 ? 's' : ''}... 📚`
                  : 'Ask the librarian anything... 📚'
              }
              disabled={isLoading}
              pr="5rem"
              bg={useColorModeValue('white', 'gray.700')}
              borderColor={useColorModeValue('amber.300', 'amber.600')}
              focusBorderColor={useColorModeValue('amber.500', 'amber.400')}
              borderRadius="xl"
              shadow="sm"
            />
            <InputRightElement width="5rem">
              <Button
                h="2rem"
                size="sm"
                onClick={handleSendMessage}
                isLoading={isLoading}
                disabled={!inputValue.trim() || isLoading}
                colorScheme="amber"
                borderRadius="lg"
                loadingText="..."
              >
                📤 Send
              </Button>
            </InputRightElement>
          </InputGroup>
        </Box>
      </Container>
    </Box>
  )
} 