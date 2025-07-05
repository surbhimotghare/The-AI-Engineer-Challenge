'use client'

import { Box, Text, useColorModeValue, Badge, HStack, Icon, VStack, Collapse, Button, Avatar } from '@chakra-ui/react'
import { FiBook, FiUsers, FiChevronDown, FiChevronUp, FiBookOpen } from 'react-icons/fi'
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
  
  // Librarian-themed colors
  const bgColor = useColorModeValue(
    message.role === 'user' 
      ? 'blue.50' 
      : isRAG 
        ? 'green.50' 
        : 'amber.50',
    message.role === 'user' 
      ? 'blue.900' 
      : isRAG 
        ? 'green.900' 
        : 'amber.900'
  )
  
  const borderColor = useColorModeValue(
    message.role === 'user' 
      ? 'blue.200' 
      : isRAG 
        ? 'green.200' 
        : 'amber.200',
    message.role === 'user' 
      ? 'blue.700' 
      : isRAG 
        ? 'green.700' 
        : 'amber.600'
  )

  const textColor = useColorModeValue(
    message.role === 'user' 
      ? 'blue.900' 
      : isRAG 
        ? 'green.900' 
        : 'amber.900',
    message.role === 'user' 
      ? 'blue.100' 
      : isRAG 
        ? 'green.100' 
        : 'amber.100'
  )

  const renderMessageHeader = () => {
    if (message.role === 'user') {
      return (
        <HStack spacing={2} mb={2}>
          <Avatar size="xs" name="Visitor" bg="blue.500" color="white" />
          <Text fontSize="xs" color={useColorModeValue('blue.600', 'blue.300')} fontWeight="medium">
            Library Visitor
          </Text>
        </HStack>
      )
    }
    
    return (
      <HStack spacing={2} mb={2}>
        <Avatar 
          size="xs" 
          name="Librarian" 
          bg={isRAG ? 'green.500' : useColorModeValue('amber.500', 'amber.400')}
          color="white"
          icon={<Icon as={isRAG ? FiBookOpen : FiBook} />}
        />
        <Text fontSize="xs" color={textColor} fontWeight="medium">
          📚 Digital Librarian
        </Text>
        <Badge 
          colorScheme={isRAG ? 'green' : 'amber'} 
          size="sm"
          variant="subtle"
        >
          {isRAG ? 'Document Expert' : 'General Knowledge'}
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
          {showSources ? 'Hide' : 'Show'} Reference Sources ({message.sources.length})
        </Button>
        
        <Collapse in={showSources}>
          <VStack align="start" spacing={2} mt={2}>
            {message.sources.map((source, index) => (
              <Box
                key={index}
                p={3}
                bg={useColorModeValue('green.100', 'green.800')}
                borderRadius="md"
                borderLeft="4px solid"
                borderColor={useColorModeValue('green.400', 'green.500')}
                fontSize="xs"
                w="full"
                shadow="sm"
              >
                <HStack spacing={2} mb={1}>
                  <Icon as={FiBook} color={useColorModeValue('green.600', 'green.300')} />
                  <Text fontWeight="semibold" color={useColorModeValue('green.700', 'green.300')}>
                    📖 Reference {index + 1}:
                  </Text>
                </HStack>
                <Text color={useColorModeValue('green.600', 'green.200')} lineHeight="1.4">
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
      maxW="85%"
      bg={bgColor}
      p={4}
      borderRadius="xl"
      borderWidth="1px"
      borderColor={borderColor}
      position="relative"
      shadow="sm"
    >
      {renderMessageHeader()}
      
      <Text
        whiteSpace="pre-wrap"
        wordBreak="break-word"
        color={textColor}
        lineHeight="1.6"
        fontSize="sm"
      >
        {message.content}
        {message.isStreaming && (
          <Text as="span" opacity={0.6} color={useColorModeValue('amber.500', 'amber.300')}>
            ▋
          </Text>
        )}
      </Text>
      
      {renderSources()}
    </Box>
  )
} 