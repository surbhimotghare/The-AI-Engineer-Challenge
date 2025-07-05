'use client'

import { Box, Text, useColorModeValue, Badge, HStack, Icon, VStack, Collapse, Button } from '@chakra-ui/react'
import { FiFileText, FiMessageCircle, FiChevronDown, FiChevronUp } from 'react-icons/fi'
import { useState } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  isRAG?: boolean
  sources?: string[]
}

interface ChatMessageProps {
  message: Message
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const [showSources, setShowSources] = useState(false)
  
  const isRAG = message.isRAG && message.role === 'assistant'
  
  const bgColor = useColorModeValue(
    message.role === 'user' 
      ? 'blue.50' 
      : isRAG 
        ? 'green.50' 
        : 'gray.50',
    message.role === 'user' 
      ? 'blue.900' 
      : isRAG 
        ? 'green.900' 
        : 'gray.700'
  )
  
  const borderColor = useColorModeValue(
    message.role === 'user' 
      ? 'blue.200' 
      : isRAG 
        ? 'green.200' 
        : 'gray.200',
    message.role === 'user' 
      ? 'blue.700' 
      : isRAG 
        ? 'green.700' 
        : 'gray.600'
  )

  const renderMessageHeader = () => {
    if (message.role === 'user') return null
    
    return (
      <HStack spacing={2} mb={2}>
        <Icon 
          as={isRAG ? FiFileText : FiMessageCircle} 
          color={isRAG ? 'green.500' : 'blue.500'} 
          size="sm"
        />
        <Badge 
          colorScheme={isRAG ? 'green' : 'blue'} 
          size="sm"
        >
          {isRAG ? 'PDF Chat' : 'Regular Chat'}
        </Badge>
      </HStack>
    )
  }

  const renderSources = () => {
    if (!isRAG || !message.sources || message.sources.length === 0) return null
    
    return (
      <Box mt={3} pt={3} borderTop="1px solid" borderColor={borderColor}>
        <Button
          onClick={() => setShowSources(!showSources)}
          variant="ghost"
          size="xs"
          leftIcon={showSources ? <FiChevronUp /> : <FiChevronDown />}
          color={useColorModeValue('green.600', 'green.300')}
        >
          {showSources ? 'Hide' : 'Show'} Sources ({message.sources.length})
        </Button>
        
        <Collapse in={showSources}>
          <VStack align="start" spacing={2} mt={2}>
            {message.sources.map((source, index) => (
              <Box
                key={index}
                p={2}
                bg={useColorModeValue('green.100', 'green.800')}
                borderRadius="sm"
                borderLeft="3px solid"
                borderColor={useColorModeValue('green.400', 'green.500')}
                fontSize="xs"
                w="full"
              >
                <Text fontWeight="semibold" color={useColorModeValue('green.700', 'green.300')}>
                  Source {index + 1}:
                </Text>
                <Text color={useColorModeValue('green.600', 'green.200')} mt={1}>
                  {source.length > 200 ? `${source.substring(0, 200)}...` : source}
                </Text>
              </Box>
            ))}
          </VStack>
        </Collapse>
      </Box>
    )
  }

  return (
    <Box
      alignSelf={message.role === 'user' ? 'flex-end' : 'flex-start'}
      maxW="80%"
      bg={bgColor}
      p={4}
      borderRadius="lg"
      borderWidth="1px"
      borderColor={borderColor}
      position="relative"
    >
      {renderMessageHeader()}
      
      <Text
        whiteSpace="pre-wrap"
        wordBreak="break-word"
      >
        {message.content}
        {message.isStreaming && (
          <Text as="span" opacity={0.5}>
            ▋
          </Text>
        )}
      </Text>
      
      {renderSources()}
    </Box>
  )
} 