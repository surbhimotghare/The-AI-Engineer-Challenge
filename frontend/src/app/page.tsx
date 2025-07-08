'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Container,
  VStack,
  HStack,
  Text,
  useColorModeValue,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Divider,
  Badge,
  Flex,
  Icon,
  useToast,
} from '@chakra-ui/react'
import { FiBook, FiMessageCircle, FiSettings } from 'react-icons/fi'

import PDFLibrary from '@/components/PDFLibrary'
import ChatInterface from '@/components/ChatInterface'
import APIKeyInput from '@/components/APIKeyInput'

export default function Home() {
  const [apiKey, setApiKey] = useState('')
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState(0)
  const toast = useToast()

  // Librarian-themed colors
  const bgColor = useColorModeValue('amber.50', 'gray.900')
  const cardBg = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('amber.200', 'amber.700')

  const handleApiKeyChange = (key: string) => {
    setApiKey(key)
    // Clear selected documents when API key changes
    setSelectedDocIds([])
  }

  const handleDocumentSelect = (docIds: string[]) => {
    setSelectedDocIds(docIds)
    
    // Show feedback for document selection
    if (docIds.length > selectedDocIds.length) {
      toast({
        title: 'Document Selected',
        description: `${docIds.length} document${docIds.length !== 1 ? 's' : ''} ready for chat`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  const handleTabChange = (index: number) => {
    setActiveTab(index)
  }

  return (
    <Box minH="100vh" bg={bgColor}>
      <Container maxW="7xl" py={8}>
        <VStack spacing={8} align="stretch">
          {/* Header */}
          <Box textAlign="center" py={8}>
            <HStack justify="center" spacing={3} mb={4}>
              <Icon as={FiBook} w={8} h={8} color="amber.500" />
              <Text fontSize="3xl" fontWeight="bold" color={useColorModeValue('amber.800', 'amber.200')}>
                AI Library Assistant
              </Text>
            </HStack>
            <Text fontSize="lg" color={useColorModeValue('amber.600', 'amber.400')} maxW="2xl" mx="auto">
              Your intelligent document library with multi-PDF RAG capabilities. 
              Upload, organize, and chat with your entire collection.
            </Text>
          </Box>

          {/* API Key Input */}
          <Box bg={cardBg} p={6} borderRadius="xl" border="1px solid" borderColor={borderColor}>
            <APIKeyInput 
              apiKey={apiKey} 
              onApiKeyChange={handleApiKeyChange}
              placeholder="Enter your OpenAI API key to access the library..."
            />
          </Box>

          {/* Main Content Tabs */}
          <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} overflow="hidden">
            <Tabs index={activeTab} onChange={handleTabChange} variant="enclosed">
              <TabList bg={useColorModeValue('amber.100', 'amber.900')}>
                <Tab>
                  <HStack spacing={2}>
                    <Icon as={FiBook} />
                    <Text>Document Library</Text>
                    {selectedDocIds.length > 0 && (
                      <Badge colorScheme="green" borderRadius="full" px={2}>
                        {selectedDocIds.length}
                      </Badge>
                    )}
                  </HStack>
                </Tab>
                <Tab>
                  <HStack spacing={2}>
                    <Icon as={FiMessageCircle} />
                    <Text>Chat Assistant</Text>
                    {selectedDocIds.length === 0 && (
                      <Badge colorScheme="orange" borderRadius="full" px={2}>
                        Select Docs
                      </Badge>
                    )}
                  </HStack>
                </Tab>
              </TabList>

              <TabPanels>
                {/* Document Library Tab */}
                <TabPanel p={6}>
                  <PDFLibrary
                    apiKey={apiKey}
                    onDocumentSelect={handleDocumentSelect}
                    selectedDocIds={selectedDocIds}
                  />
                </TabPanel>

                {/* Chat Interface Tab */}
                <TabPanel p={6}>
                  {selectedDocIds.length === 0 ? (
                    <Box textAlign="center" py={12}>
                      <Icon as={FiBook} w={16} h={16} color="gray.400" mb={4} />
                      <Text fontSize="lg" color="gray.500" mb={2}>
                        No Documents Selected
                      </Text>
                      <Text color="gray.400" mb={6}>
                        Go to the Document Library tab to upload and select PDFs for chat.
                      </Text>
                      <Badge colorScheme="blue" fontSize="sm" p={2}>
                        💡 Tip: You can select multiple documents to search across your entire collection
                      </Badge>
                    </Box>
                  ) : (
                    <VStack spacing={4} align="stretch">
                      {/* Selected Documents Info */}
                      <Box bg={useColorModeValue('blue.50', 'blue.900')} p={4} borderRadius="lg">
                        <HStack justify="space-between" align="center">
                          <VStack align="start" spacing={1}>
                            <Text fontSize="sm" fontWeight="medium" color="blue.700">
                              📚 Selected Documents ({selectedDocIds.length})
                            </Text>
                            <Text fontSize="xs" color="blue.600">
                              Chat will search across all selected documents
                            </Text>
                          </VStack>
                          <Badge colorScheme="blue">
                            Multi-PDF RAG
                          </Badge>
                        </HStack>
                      </Box>

                      {/* Chat Interface */}
                      <ChatInterface 
                        apiKey={apiKey}
                        selectedDocIds={selectedDocIds}
                        onDocumentsChange={handleDocumentSelect}
                      />
                    </VStack>
                  )}
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Box>

          {/* Footer */}
          <Box textAlign="center" py={4}>
            <Text fontSize="sm" color={useColorModeValue('gray.600', 'gray.400')}>
              🚀 Powered by AI • Built with Next.js & FastAPI • Enhanced with Multi-PDF RAG
            </Text>
          </Box>
        </VStack>
      </Container>
    </Box>
  )
} 