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
} from '@chakra-ui/react'
import { FiSend, FiMessageCircle, FiSearch, FiBook } from 'react-icons/fi'

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
}

export default function ChatInterface({ apiKey, selectedDocIds, onDocumentsChange }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [chatMode, setChatMode] = useState<'rag' | 'chat'>('rag')
  const [systemMessage, setSystemMessage] = useState('You are a helpful AI assistant that provides clear and concise answers.')
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const toast = useToast()

  // Librarian-themed colors
  const bgColor = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.600')
  const userMessageBg = useColorModeValue('blue.50', 'blue.900')
  const assistantMessageBg = useColorModeValue('gray.50', 'gray.700')

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
            model: 'gpt-4o-mini'
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
        title: 'Chat Error',
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
    const messageBg = isUser ? userMessageBg : assistantMessageBg
    const alignSelf = isUser ? 'flex-end' : 'flex-start'
    const maxW = '70%'

    return (
      <Box
        key={message.id}
        alignSelf={alignSelf}
        maxW={maxW}
        bg={messageBg}
        p={4}
        borderRadius="lg"
        border="1px solid"
        borderColor={borderColor}
      >
        <VStack align="start" spacing={2}>
          {/* Message header */}
          <HStack spacing={2} w="full">
            <Icon 
              as={isUser ? FiMessageCircle : FiSearch} 
              color={isUser ? 'blue.500' : 'green.500'} 
            />
            <Text fontSize="sm" fontWeight="medium">
              {isUser ? 'You' : message.mode === 'rag' ? 'RAG Assistant' : 'AI Assistant'}
            </Text>
            <Badge size="sm" colorScheme={message.mode === 'rag' ? 'green' : 'blue'}>
              {message.mode.toUpperCase()}
            </Badge>
            <Text fontSize="xs" color="gray.500" ml="auto">
              {message.timestamp.toLocaleTimeString()}
            </Text>
          </HStack>

          {/* Message content */}
          <Text whiteSpace="pre-wrap">{message.content}</Text>

          {/* RAG sources */}
          {message.mode === 'rag' && message.sources && message.sources.length > 0 && (
            <Box w="full" mt={2}>
              <Text fontSize="xs" fontWeight="medium" color="gray.600" mb={1}>
                📚 Sources ({message.sources.length}):
              </Text>
              <VStack align="start" spacing={1}>
                {message.sources.slice(0, 3).map((source, index) => (
                  <Text key={index} fontSize="xs" color="gray.500" noOfLines={2}>
                    {source.substring(0, 150)}...
                  </Text>
                ))}
                {message.sources.length > 3 && (
                  <Text fontSize="xs" color="gray.400">
                    ... and {message.sources.length - 3} more sources
                  </Text>
                )}
              </VStack>
            </Box>
          )}
        </VStack>
      </Box>
    )
  }

  return (
    <Box h="600px" bg={bgColor} borderRadius="lg" border="1px solid" borderColor={borderColor}>
      <VStack h="full" spacing={0}>
        {/* Header */}
        <Box w="full" p={4} borderBottom="1px solid" borderColor={borderColor}>
          <HStack justify="space-between">
            <HStack spacing={3}>
              <Icon as={FiMessageCircle} color="blue.500" />
              <Text fontWeight="medium">Chat Assistant</Text>
              {selectedDocIds.length > 0 && (
                <Badge colorScheme="green" size="sm">
                  {selectedDocIds.length} doc{selectedDocIds.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </HStack>
            <Button size="sm" variant="ghost" onClick={clearChat}>
              Clear Chat
            </Button>
          </HStack>
        </Box>

        {/* Chat Mode Tabs */}
        <Box w="full" px={4} pt={2}>
          <Tabs size="sm" variant="enclosed" onChange={(index) => setChatMode(index === 0 ? 'rag' : 'chat')}>
            <TabList>
              <Tab>
                <HStack spacing={1}>
                  <Icon as={FiSearch} />
                  <Text>RAG Mode</Text>
                </HStack>
              </Tab>
              <Tab>
                <HStack spacing={1}>
                  <Icon as={FiMessageCircle} />
                  <Text>Chat Mode</Text>
                </HStack>
              </Tab>
            </TabList>
          </Tabs>
        </Box>

        {/* Messages Area */}
        <VStack 
          flex={1} 
          w="full" 
          p={4} 
          spacing={4} 
          overflowY="auto"
          align="stretch"
        >
          {messages.length === 0 ? (
            <Box textAlign="center" py={8}>
              <Icon as={FiMessageCircle} w={12} h={12} color="gray.400" mb={4} />
              <Text color="gray.500" mb={2}>
                {chatMode === 'rag' 
                  ? 'Ask questions about your selected documents'
                  : 'Start a conversation with the AI assistant'
                }
              </Text>
              {chatMode === 'rag' && selectedDocIds.length === 0 && (
                <Alert status="warning" size="sm">
                  <AlertIcon />
                  <AlertDescription>
                    Select documents from the Document Library to use RAG mode
                  </AlertDescription>
                </Alert>
              )}
            </Box>
          ) : (
            messages.map(renderMessage)
          )}
          
          {isLoading && (
            <Box alignSelf="flex-start" maxW="70%">
              <HStack spacing={2} p={4} bg={assistantMessageBg} borderRadius="lg">
                <Icon as={FiSearch} color="green.500" />
                <Text fontSize="sm" color="gray.600">
                  {chatMode === 'rag' ? 'Searching documents...' : 'Thinking...'}
                </Text>
              </HStack>
            </Box>
          )}
          
          <div ref={messagesEndRef} />
        </VStack>

        {/* Input Area */}
        <Box w="full" p={4} borderTop="1px solid" borderColor={borderColor}>
          <HStack spacing={3}>
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                chatMode === 'rag' 
                  ? `Ask about your ${selectedDocIds.length} selected document${selectedDocIds.length !== 1 ? 's' : ''}...`
                  : 'Type your message...'
              }
              resize="none"
              rows={1}
              disabled={isLoading}
            />
            <Button
              colorScheme="blue"
              onClick={handleSendMessage}
              isLoading={isLoading}
              disabled={!inputValue.trim()}
              px={6}
            >
              <Icon as={FiSend} />
            </Button>
          </HStack>
          
          {chatMode === 'chat' && (
            <Box mt={2}>
              <Text fontSize="xs" color="gray.500" mb={1}>
                System Message:
              </Text>
              <Textarea
                value={systemMessage}
                onChange={(e) => setSystemMessage(e.target.value)}
                size="sm"
                placeholder="Set the AI's personality and behavior..."
                resize="none"
                rows={2}
              />
            </Box>
          )}
        </Box>
      </VStack>
    </Box>
  )
} 