'use client'

import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  Button,
  VStack,
  useToast,
  Text,
  Alert,
  AlertIcon,
  AlertDescription,
  HStack,
  Icon,
  FormHelperText,
  useColorModeValue,
} from '@chakra-ui/react'
import { useState } from 'react'
import { FiCheck, FiAlertCircle, FiBook } from 'react-icons/fi'

interface ApiKeyModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (apiKey: string) => void
  initialApiKey: string
}

export default function ApiKeyModal({
  isOpen,
  onClose,
  onSubmit,
  initialApiKey,
}: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState(initialApiKey)
  const [isValidating, setIsValidating] = useState(false)
  const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle')
  const toast = useToast()

  const validateApiKey = (key: string): boolean => {
    // OpenAI API keys start with 'sk-' and are typically 51 characters long
    const trimmedKey = key.trim()
    return trimmedKey.startsWith('sk-') && trimmedKey.length >= 40
  }

  const handleApiKeyChange = (value: string) => {
    setApiKey(value)
    setValidationStatus('idle')
  }

  const testApiKey = async (key: string): Promise<boolean> => {
    try {
      // Test the API key with a simple health check or model list request
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
      })
      
      return response.ok
    } catch (error) {
      console.error('API key validation error:', error)
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const trimmedKey = apiKey.trim()
    
    if (!trimmedKey) {
      toast({
        title: 'Library Card Required',
        description: 'Please present your library card (API key) to access the collection.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    if (!validateApiKey(trimmedKey)) {
      toast({
        title: 'Invalid Library Card Format',
        description: 'OpenAI API keys should start with "sk-" and be at least 40 characters long.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      setValidationStatus('invalid')
      return
    }

    setIsValidating(true)
    setValidationStatus('idle')

    // Test the API key
    const isValid = await testApiKey(trimmedKey)
    
    if (isValid) {
      setValidationStatus('valid')
      onSubmit(trimmedKey)
      
      toast({
        title: 'Library Access Granted!',
        description: 'Your library card has been validated. Welcome to the digital collection!',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
      
      // Close modal after a brief delay to show success state
      setTimeout(() => {
        onClose()
      }, 1000)
    } else {
      setValidationStatus('invalid')
      toast({
        title: 'Invalid Library Card',
        description: 'Your library card appears to be invalid or expired. Please check your credentials and try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
    
    setIsValidating(false)
  }

  const handleClose = () => {
    if (!isValidating) {
      onClose()
    }
  }

  const getValidationColor = () => {
    switch (validationStatus) {
      case 'valid': return 'green'
      case 'invalid': return 'red'
      default: return 'amber'
    }
  }

  const getValidationIcon = () => {
    switch (validationStatus) {
      case 'valid': return FiCheck
      case 'invalid': return FiAlertCircle
      default: return null
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} closeOnOverlayClick={!isValidating}>
      <ModalOverlay />
      <ModalContent bg={useColorModeValue('white', 'gray.800')} borderRadius="xl">
        <form onSubmit={handleSubmit}>
          <ModalHeader bg={useColorModeValue('amber.50', 'amber.900')} borderTopRadius="xl">
            <HStack>
              <Icon as={FiBook} color={useColorModeValue('amber.600', 'amber.300')} boxSize={5} />
              <Text color={useColorModeValue('amber.800', 'amber.200')}>
                📚 Library Card Registration
              </Text>
              {validationStatus !== 'idle' && (
                <Icon 
                  as={getValidationIcon()} 
                  color={`${getValidationColor()}.500`}
                  boxSize={5}
                />
              )}
            </HStack>
          </ModalHeader>
          {!isValidating && <ModalCloseButton />}
          <ModalBody pb={6} pt={6}>
            <VStack spacing={4}>
              <Text fontSize="sm" color={useColorModeValue('gray.600', 'gray.300')} textAlign="center">
                Present your OpenAI API key to access the digital library collection and chat with documents.
              </Text>

              <FormControl isRequired>
                <FormLabel color={useColorModeValue('amber.800', 'amber.200')}>
                  Library Card (API Key)
                </FormLabel>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder="sk-..."
                  isDisabled={isValidating}
                  borderColor={validationStatus === 'invalid' ? 'red.300' : useColorModeValue('amber.300', 'amber.600')}
                  focusBorderColor={validationStatus === 'valid' ? 'green.400' : useColorModeValue('amber.500', 'amber.400')}
                  bg={useColorModeValue('white', 'gray.700')}
                />
                <FormHelperText>
                  Enter your OpenAI API key. You can find this in your OpenAI dashboard under API keys.
                </FormHelperText>
              </FormControl>

              {validationStatus === 'valid' && (
                <Alert status="success" borderRadius="md" bg={useColorModeValue('green.50', 'green.900')}>
                  <AlertIcon />
                  <AlertDescription>
                    🎉 Library card validated! Access granted to the digital collection.
                  </AlertDescription>
                </Alert>
              )}

              {validationStatus === 'invalid' && (
                <Alert status="error" borderRadius="md">
                  <AlertIcon />
                  <AlertDescription>
                    ❌ Invalid or expired library card. Please check your credentials and try again.
                  </AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                colorScheme={validationStatus === 'valid' ? 'green' : 'amber'}
                width="full"
                isLoading={isValidating}
                loadingText="Validating Library Card..."
                isDisabled={!apiKey.trim()}
                size="lg"
              >
                {validationStatus === 'valid' ? '✅ Library Access Granted!' : '🔑 Validate & Register Library Card'}
              </Button>
            </VStack>
          </ModalBody>
        </form>
      </ModalContent>
    </Modal>
  )
} 