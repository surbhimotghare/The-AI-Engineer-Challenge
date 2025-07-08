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
import { FiCheck, FiAlertCircle, FiKey } from 'react-icons/fi'

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
        title: 'API Key Required',
        description: 'Please enter your OpenAI API key to enable CoursePilot features.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    if (!validateApiKey(trimmedKey)) {
      toast({
        title: 'Invalid API Key Format',
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
        title: 'API Key Verified!',
        description: 'Your OpenAI API key has been validated. CoursePilot is ready to help!',
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
        title: 'Invalid API Key',
        description: 'Your API key appears to be invalid or expired. Please check your credentials and try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
    
    setIsValidating(false)
  }

  const handleClose = () => {
    if (!isValidating && initialApiKey) {
      onClose()
    }
  }

  const getValidationColor = () => {
    switch (validationStatus) {
      case 'valid': return 'green'
      case 'invalid': return 'red'
      default: return 'blue'
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
    <Modal isOpen={isOpen} onClose={handleClose} closeOnOverlayClick={!isValidating && !!initialApiKey}>
      <ModalOverlay />
      <ModalContent bg={useColorModeValue('white', 'gray.800')} borderRadius="xl">
        <form onSubmit={handleSubmit}>
          <ModalHeader bg={useColorModeValue('blue.50', 'blue.900')} borderTopRadius="xl">
            <HStack>
              <Icon as={FiKey} color={useColorModeValue('blue.600', 'blue.300')} boxSize={5} />
              <Text color={useColorModeValue('blue.800', 'blue.200')}>
                🔑 Configure OpenAI API Key
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
          {!isValidating && initialApiKey && <ModalCloseButton />}
          <ModalBody pb={6} pt={6}>
            <VStack spacing={4}>
              <Text fontSize="sm" color={useColorModeValue('gray.600', 'gray.300')} textAlign="center">
                Enter your OpenAI API key to enable AI-powered course material processing and educational chat features.
              </Text>

              <FormControl isRequired>
                <FormLabel color={useColorModeValue('blue.800', 'blue.200')}>
                  OpenAI API Key
                </FormLabel>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder="sk-..."
                  isDisabled={isValidating}
                  borderColor={validationStatus === 'invalid' ? 'red.300' : useColorModeValue('blue.300', 'blue.600')}
                  focusBorderColor={validationStatus === 'valid' ? 'green.400' : useColorModeValue('blue.500', 'blue.400')}
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
                    🎉 API key validated! CoursePilot is ready to assist with your educational materials.
                  </AlertDescription>
                </Alert>
              )}

              {validationStatus === 'invalid' && (
                <Alert status="error" borderRadius="md">
                  <AlertIcon />
                  <AlertDescription>
                    ❌ Invalid or expired API key. Please check your credentials and try again.
                  </AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                colorScheme={validationStatus === 'valid' ? 'green' : 'blue'}
                width="full"
                isLoading={isValidating}
                loadingText="Validating API Key..."
                isDisabled={!apiKey.trim()}
                size="lg"
              >
                {validationStatus === 'valid' ? '✅ API Key Verified!' : '🔑 Validate & Save API Key'}
              </Button>
            </VStack>
          </ModalBody>
        </form>
      </ModalContent>
    </Modal>
  )
} 