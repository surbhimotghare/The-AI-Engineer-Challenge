'use client'

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  VStack,
  HStack,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Card,
  CardBody,
  Heading,
  Icon,
  Text,
  Badge,
  Flex,
  useColorModeValue,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Button,
  Divider,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  useToast,
} from '@chakra-ui/react';
import { 
  FiBook, 
  FiUpload, 
  FiMessageCircle, 
  FiSettings,
  FiDatabase,
  FiFileText,
  FiUsers,
  FiTrendingUp,
  FiTarget,
  FiBook as FiBookOpen,
  FiAward,
  FiBookmark
} from 'react-icons/fi';
import MultiFileUpload from './MultiFileUpload';
import CourseChat from './CourseChat';
import CourseMaterialsList from './CourseMaterialsList';
import ApiKeyModal from './ApiKeyModal';
import { getCourseStatus } from '../lib/api';
import type { CourseStatusResponse, CourseUploadResponse } from '../lib/api';

interface CoursePilotProps {
  className?: string;
}

export default function CoursePilot({ className }: CoursePilotProps) {
  const [apiKey, setApiKey] = useState<string>('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [courseStatus, setCourseStatus] = useState<CourseStatusResponse | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

  // Color mode values
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  useEffect(() => {
    // Check for stored API key
    const storedApiKey = localStorage.getItem('openai_api_key');
    if (storedApiKey) {
      setApiKey(storedApiKey);
    } else {
      setShowApiKeyModal(true);
    }
    
    loadCourseStatus();
  }, []);

  const loadCourseStatus = async () => {
    try {
      setIsLoading(true);
      const status = await getCourseStatus();
      setCourseStatus(status);
    } catch (error) {
      console.error('Error loading course status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApiKeySubmit = (key: string) => {
    setApiKey(key);
    localStorage.setItem('openai_api_key', key);
    setShowApiKeyModal(false);
    toast({
      title: 'API Key Saved',
      description: 'Your OpenAI API key has been saved successfully.',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const handleUploadComplete = (response: CourseUploadResponse) => {
    loadCourseStatus();
    toast({
      title: 'Upload Complete!',
      description: `Successfully processed ${response.processed_files.length} files. View them in Manage Materials.`,
      status: 'success',
      duration: 5000,
      isClosable: true,
    });
    // Switch to manage materials tab after successful upload
    setActiveTab(2);
  };

  const handleError = (error: string) => {
    toast({
      title: 'Error',
      description: error,
      status: 'error',
      duration: 5000,
      isClosable: true,
    });
  };

  const resetApiKey = () => {
    localStorage.removeItem('openai_api_key');
    setApiKey('');
    setShowApiKeyModal(true);
  };

  const getStatusColor = (status: CourseStatusResponse | null) => {
    if (!status) return 'gray';
    if (status.is_indexed && status.total_files > 0) return 'green';
    if (status.total_files > 0) return 'yellow';
    return 'gray';
  };

  const getStatusText = (status: CourseStatusResponse | null) => {
    if (!status) return 'Loading...';
    if (status.is_indexed && status.total_files > 0) return 'Ready for Teaching';
    if (status.total_files > 0) return 'Processing...';
    return 'No Materials';
  };

  return (
    <Container maxW="container.xl" py={6} className={className}>
      <VStack spacing={6} align="stretch">
        {/* API Key Configuration Banner */}
        {!apiKey && (
          <Alert status="warning" borderRadius="lg" shadow="md">
            <AlertIcon />
            <Box flex="1">
              <AlertTitle>🔑 API Key Required</AlertTitle>
              <AlertDescription>
                CoursePilot needs an OpenAI API key to process course materials and provide educational assistance.
              </AlertDescription>
            </Box>
            <Button
              colorScheme="blue"
              size="md"
              onClick={() => setShowApiKeyModal(true)}
              leftIcon={<FiSettings />}
            >
              Configure API Key
            </Button>
          </Alert>
        )}

        {/* Header */}
        <Card bg={cardBg} shadow="lg" borderWidth="1px" borderColor={borderColor}>
          <CardBody>
            <Flex align="center" justify="space-between" wrap="wrap" gap={4}>
              <HStack spacing={4}>
                <Icon as={FiBook} boxSize={12} color="blue.500" />
                <VStack align="start" spacing={1}>
                  <Heading size="lg" color="blue.600">
                    CoursePilot
                  </Heading>
                  <Text color="gray.600" fontSize="md">
                    AI-Powered Faculty Teaching Copilot
                  </Text>
                  <Text color="gray.500" fontSize="sm">
                    Upload course materials and create intelligent educational assistance
                  </Text>
                </VStack>
              </HStack>
              
              <VStack spacing={2} align="end">
                <Badge 
                  colorScheme={getStatusColor(courseStatus)} 
                  variant="solid" 
                  px={3} 
                  py={1}
                  borderRadius="full"
                >
                  {getStatusText(courseStatus)}
                </Badge>
                <HStack spacing={2}>
                  <Badge 
                    colorScheme={apiKey ? 'green' : 'red'} 
                    variant="outline"
                    px={2}
                    py={1}
                  >
                    {apiKey ? '🔑 API Key Set' : '🔑 No API Key'}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<FiSettings />}
                    onClick={resetApiKey}
                    colorScheme="blue"
                  >
                    {apiKey ? 'Change API Key' : 'Set API Key'}
                  </Button>
                </HStack>
              </VStack>
            </Flex>
          </CardBody>
        </Card>

        {/* Main Content Tabs */}
        <Card bg={cardBg} shadow="lg" borderWidth="1px" borderColor={borderColor}>
          <CardBody p={0}>
            <Tabs 
              index={activeTab} 
              onChange={setActiveTab}
              variant="enclosed"
              colorScheme="blue"
              size="lg"
            >
              <TabList borderColor={borderColor}>
                <Tab>
                  <HStack>
                    <Icon as={FiUpload} />
                    <Text>Upload Materials</Text>
                  </HStack>
                </Tab>
                <Tab>
                  <HStack>
                    <Icon as={FiMessageCircle} />
                    <Text>Educational Chat</Text>
                  </HStack>
                </Tab>
                <Tab>
                  <HStack>
                    <Icon as={FiDatabase} />
                    <Text>Manage Materials</Text>
                  </HStack>
                </Tab>
              </TabList>

              <TabPanels>
                {/* Upload Tab */}
                <TabPanel p={6}>
                  <VStack spacing={4} align="stretch">
                    <Box>
                      <Heading size="md" mb={2} color="blue.600">
                        Course Materials Upload
                      </Heading>
                      <Text color="gray.600" mb={6}>
                        Upload syllabi, lecture slides, readings, charts, and datasets to create your intelligent course assistant.
                      </Text>
                    </Box>
                    
                    {!apiKey ? (
                      <Alert status="warning" borderRadius="md">
                        <AlertIcon />
                        <Box>
                          <AlertTitle>OpenAI API Key Required</AlertTitle>
                          <AlertDescription>
                            Please configure your OpenAI API key to enable file processing and AI features.
                          </AlertDescription>
                        </Box>
                      </Alert>
                    ) : (
                      <MultiFileUpload
                        apiKey={apiKey}
                        onUploadComplete={handleUploadComplete}
                        onError={handleError}
                      />
                    )}
                  </VStack>
                </TabPanel>

                {/* Chat Tab */}
                <TabPanel p={6}>
                  <VStack spacing={4} align="stretch">
                    <Box>
                      <Heading size="md" mb={2} color="blue.600">
                        Educational Assistant
                      </Heading>
                      <Text color="gray.600" mb={6}>
                        Ask questions about your course materials. Get explanations, study guidance, and pedagogical insights.
                      </Text>
                    </Box>
                    
                    {!apiKey ? (
                      <Alert status="warning" borderRadius="md">
                        <AlertIcon />
                        <Box>
                          <AlertTitle>OpenAI API Key Required</AlertTitle>
                          <AlertDescription>
                            Please configure your OpenAI API key to enable AI chat features.
                          </AlertDescription>
                        </Box>
                      </Alert>
                    ) : (
                      <CourseChat
                        apiKey={apiKey}
                        onError={handleError}
                        isDisabled={!courseStatus?.is_indexed}
                      />
                    )}
                  </VStack>
                </TabPanel>

                {/* Manage Materials Tab */}
                <TabPanel p={6}>
                  <VStack spacing={4} align="stretch">
                    <Box>
                      <Heading size="md" mb={2} color="blue.600">
                        Course Materials Management
                      </Heading>
                      <Text color="gray.600" mb={6}>
                        View, organize, and manage your uploaded course materials and processing status.
                      </Text>
                    </Box>
                    
                    <CourseMaterialsList
                      courseStatus={courseStatus}
                      onClearComplete={loadCourseStatus}
                      onError={handleError}
                    />
                  </VStack>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </CardBody>
        </Card>

        {/* Educational Features Info */}
        <Card bg={cardBg} shadow="sm" borderWidth="1px" borderColor={borderColor}>
          <CardBody>
            <VStack spacing={4} align="stretch">
              <Heading size="sm" color="blue.600">
                CoursePilot Features
              </Heading>
              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                <HStack spacing={3}>
                  <Icon as={FiAward} color="blue.500" boxSize={6} />
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="medium">Pedagogical AI</Text>
                    <Text fontSize="sm" color="gray.600">
                      Educational responses with learning guidance
                    </Text>
                  </VStack>
                </HStack>
                <HStack spacing={3}>
                  <Icon as={FiBookmark} color="green.500" boxSize={6} />
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="medium">Source Attribution</Text>
                    <Text fontSize="sm" color="gray.600">
                      Track answers back to specific materials
                    </Text>
                  </VStack>
                </HStack>
                <HStack spacing={3}>
                  <Icon as={FiTrendingUp} color="purple.500" boxSize={6} />
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="medium">Multi-Modal Support</Text>
                    <Text fontSize="sm" color="gray.600">
                      PDFs, slides, images, CSV data analysis
                    </Text>
                  </VStack>
                </HStack>
              </SimpleGrid>
            </VStack>
          </CardBody>
        </Card>
      </VStack>

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        onSubmit={handleApiKeySubmit}
        initialApiKey={apiKey}
      />
    </Container>
  );
} 