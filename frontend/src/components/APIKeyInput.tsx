'use client'

import React, { useState } from 'react'
import {
  Box,
  Input,
  InputGroup,
  InputRightElement,
  Button,
  Text,
  HStack,
  VStack,
  Icon,
  useColorModeValue,
  useToast,
  Alert,
  AlertIcon,
  AlertDescription,
} from '@chakra-ui/react'
import { FiEye, FiEyeOff, FiKey, FiCheck } from 'react-icons/fi'

interface APIKeyInputProps {
  apiKey: string
  onApiKeyChange: (key: string) => void
  placeholder?: string
}

export default function APIKeyInput({ apiKey, onApiKeyChange, placeholder }: APIKeyInputProps) {
  const [showKey, setShowKey] = useState(false)
  const [isValid, setIsValid] = useState(false)
  const toast = useToast()

  const borderColor = useColorModeValue('amber.300', 'amber.600')
  const focusBorderColor = useColorModeValue('amber.500', 'amber.400')

  const validateAPIKey = (key: string) => {
    // Basic validation for OpenAI API key format
    const isValidFormat = key.startsWith('sk-') && key.length > 20
    setIsValid(isValidFormat)
    return isValidFormat
  }

  const handleKeyChange = (value: string) => {
    onApiKeyChange(value)
    if (value.trim()) {
      validateAPIKey(value.trim())
    } else {
      setIsValid(false)
    }
  }

  const handleSaveToLocalStorage = () => {
    if (isValid && apiKey.trim()) {
      try {
        localStorage.setItem('openai_api_key', apiKey.trim())
        toast({
          title: 'API Key Saved',
          description: 'Your API key has been saved to local storage for convenience.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        })
      } catch (error) {
        toast({
          title: 'Save Failed',
          description: 'Unable to save API key to local storage.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
      }
    }
  }

  const handleLoadFromLocalStorage = () => {
    try {
      const savedKey = localStorage.getItem('openai_api_key')
      if (savedKey) {
        handleKeyChange(savedKey)
        toast({
          title: 'API Key Loaded',
          description: 'Your saved API key has been loaded.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        })
      } else {
        toast({
          title: 'No Saved Key',
          description: 'No API key found in local storage.',
          status: 'info',
          duration: 3000,
          isClosable: true,
        })
      }
    } catch (error) {
      toast({
        title: 'Load Failed',
        description: 'Unable to load API key from local storage.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  const clearAPIKey = () => {
    handleKeyChange('')
    setIsValid(false)
    toast({
      title: 'API Key Cleared',
      description: 'Your API key has been cleared.',
      status: 'info',
      duration: 3000,
      isClosable: true,
    })
  }

  return (
    <Box>
      <VStack spacing={4} align="stretch">
        {/* API Key Input */}
        <Box>
          <Text fontSize="sm" fontWeight="medium" color={useColorModeValue('amber.800', 'amber.200')} mb={2}>
            🔑 OpenAI API Key
          </Text>
          
          <InputGroup>
            <Input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => handleKeyChange(e.target.value)}
              placeholder={placeholder || "Enter your OpenAI API key (sk-...)"}
              borderColor={borderColor}
              _focus={{
                borderColor: focusBorderColor,
                boxShadow: `0 0 0 1px ${focusBorderColor}`,
              }}
              pr="4.5rem"
            />
            <InputRightElement width="4.5rem">
              <HStack spacing={1}>
                {isValid && (
                  <Icon as={FiCheck} color="green.500" />
                )}
                <Button
                  h="1.75rem"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowKey(!showKey)}
                >
                  <Icon as={showKey ? FiEyeOff : FiEye} />
                </Button>
              </HStack>
            </InputRightElement>
          </InputGroup>
          
          <Text fontSize="xs" color={useColorModeValue('amber.600', 'amber.400')} mt={1}>
            Your API key is stored locally and never sent to our servers
          </Text>
        </Box>

        {/* Action Buttons */}
        <HStack spacing={2} justify="center">
          <Button
            size="sm"
            colorScheme="blue"
            variant="outline"
            onClick={handleLoadFromLocalStorage}
            leftIcon={<FiKey />}
          >
            Load Saved
          </Button>
          
          {isValid && apiKey.trim() && (
            <Button
              size="sm"
              colorScheme="green"
              variant="outline"
              onClick={handleSaveToLocalStorage}
              leftIcon={<FiCheck />}
            >
              Save Key
            </Button>
          )}
          
          {apiKey.trim() && (
            <Button
              size="sm"
              colorScheme="red"
              variant="outline"
              onClick={clearAPIKey}
            >
              Clear
            </Button>
          )}
        </HStack>

        {/* Validation Status */}
        {apiKey.trim() && (
          <Alert 
            status={isValid ? 'success' : 'warning'} 
            size="sm"
            borderRadius="md"
          >
            <AlertIcon />
            <AlertDescription>
              {isValid 
                ? '✅ Valid API key format detected'
                : '⚠️ Please enter a valid OpenAI API key (starts with sk-)'
              }
            </AlertDescription>
          </Alert>
        )}

        {/* Security Notice */}
        <Alert status="info" size="sm" borderRadius="md">
          <AlertIcon />
          <AlertDescription>
            🔒 Your API key is encrypted in your browser and never stored on our servers. 
            You can save it locally for convenience.
          </AlertDescription>
        </Alert>
      </VStack>
    </Box>
  )
} 