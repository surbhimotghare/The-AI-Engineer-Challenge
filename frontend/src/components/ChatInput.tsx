'use client'

import { useState, KeyboardEvent } from 'react'
import {
  Input,
  InputGroup,
  InputRightElement,
  Button,
  Box,
  useColorModeValue,
} from '@chakra-ui/react'

interface ChatInputProps {
  onSendMessage: (message: string) => void
  isLoading: boolean
}

export default function ChatInput({ onSendMessage, isLoading }: ChatInputProps) {
  const [message, setMessage] = useState('')

  // Librarian-themed colors
  const inputBg = useColorModeValue('white', 'gray.700')
  const inputBorder = useColorModeValue('amber.300', 'amber.600')
  const inputFocusBorder = useColorModeValue('amber.500', 'amber.400')
  const placeholderColor = useColorModeValue('gray.500', 'gray.400')

  const handleSend = () => {
    if (message.trim() && !isLoading) {
      onSendMessage(message.trim())
      setMessage('')
    }
  }

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Box>
      <InputGroup size="lg">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask the librarian anything... 📚"
          disabled={isLoading}
          pr="5rem"
          bg={inputBg}
          borderColor={inputBorder}
          focusBorderColor={inputFocusBorder}
          _placeholder={{ color: placeholderColor }}
          borderRadius="xl"
          shadow="sm"
        />
        <InputRightElement width="5rem">
          <Button
            h="2rem"
            size="sm"
            onClick={handleSend}
            isLoading={isLoading}
            disabled={!message.trim() || isLoading}
            colorScheme="amber"
            borderRadius="lg"
            loadingText="..."
          >
            📤 Send
          </Button>
        </InputRightElement>
      </InputGroup>
    </Box>
  )
} 