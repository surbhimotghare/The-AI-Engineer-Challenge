'use client'

import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  Textarea,
  useToast,
  Avatar,
  Flex,
  Badge,
  Card,
  CardBody,
  Heading,
  Icon,
  Divider,
  useColorModeValue,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Collapse,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListIcon,
  Code,
  UnorderedList,
} from '@chakra-ui/react';
import { 
  FiSend, 
  FiUser, 
  FiBook, 
  FiChevronDown,
  FiChevronUp,
  FiBookOpen,
  FiFileText,
  FiImage,
  FiBarChart,
  FiMonitor,
  FiFile,
  FiMessageCircle,
  FiInfo,
  FiTarget,
  FiUsers,
  FiClock,
  FiTrendingUp
} from 'react-icons/fi';
import { sendCourseChatMessage, getCourseChatComplete, getCourseStatus } from '../lib/api';
import type { CourseResponse, CourseStatusResponse } from '../lib/api';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: string[];
  educationalGuidance?: string;
  isStreaming?: boolean;
}

interface CourseChatProps {
  apiKey: string;
  isDisabled?: boolean;
  onError?: (error: string) => void;
  refreshTrigger?: number; // Add refresh trigger prop
}

const EDUCATIONAL_PROMPTS = [
  "Help me understand the key concepts from today's lecture",
  "What are the main learning objectives for this unit?",
  "Can you explain this topic in simpler terms?",
  "What should I focus on for the upcoming exam?",
  "How does this concept connect to previous lessons?",
  "What are some real-world applications of this material?",
  "Can you provide study tips for this subject?",
  "What questions should I ask myself to test my understanding?",
];

export default function CourseChat({ apiKey, isDisabled, onError, refreshTrigger }: CourseChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [courseStatus, setCourseStatus] = useState<CourseStatusResponse | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true); // Add loading state
  const [statusLoadError, setStatusLoadError] = useState<string | null>(null); // Add error state
  const [showSources, setShowSources] = useState<Record<string, boolean>>({});
  const [currentStreamingId, setCurrentStreamingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Color mode values
  const bgColor = useColorModeValue('gray.50', 'gray.700');
  const cardBg = useColorModeValue('white', 'gray.800');
  const userBg = useColorModeValue('blue.500', 'blue.600');
  const assistantBg = useColorModeValue('gray.100', 'gray.700');

  useEffect(() => {
    loadCourseStatus();
  }, []);

  // Add effect to refresh when parent triggers update
  useEffect(() => {
    if (refreshTrigger) {
      loadCourseStatus();
    }
  }, [refreshTrigger]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadCourseStatus = async () => {
    try {
      setIsLoadingStatus(true);
      setStatusLoadError(null);
      const status = await getCourseStatus();
      setCourseStatus(status);
    } catch (error) {
      console.error('Error loading course status:', error);
      setStatusLoadError('Failed to load course status');
      // Set a default empty state so UI doesn't stay loading
      setCourseStatus({
        is_indexed: false,
        total_files: 0,
        course_materials: {},
        vector_db_size: 0,
        supported_file_types: []
      });
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getSourceIcon = (source: string) => {
    if (source.includes('.pdf')) return FiFile;
    if (source.includes('.pptx')) return FiMonitor;
    if (source.includes('.txt')) return FiFileText;
    if (source.includes('.png') || source.includes('.jpg') || source.includes('.jpeg')) return FiImage;
    if (source.includes('.csv')) return FiBarChart;
    return FiBookOpen;
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    if (!courseStatus?.is_indexed) {
      toast({
        title: 'No Course Materials',
        description: 'Please upload course materials first to enable educational chat.',
        status: 'warning',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    const assistantMessageId = (Date.now() + 1).toString();
    setCurrentStreamingId(assistantMessageId);

    // Add empty assistant message for streaming
    const assistantMessage: Message = {
      id: assistantMessageId,
      type: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      let accumulatedContent = '';
      
      await sendCourseChatMessage(
        {
          question: inputMessage,
          k: 5,
          api_key: apiKey,
        },
        (chunk) => {
          accumulatedContent += chunk;
          setMessages(prev => 
            prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, content: accumulatedContent }
                : msg
            )
          );
        }
      );

      // Get complete response with sources
      try {
        const completeResponse = await getCourseChatComplete({
          question: inputMessage,
          k: 5,
          api_key: apiKey,
        });

        // Update message with complete response and sources
        setMessages(prev => 
          prev.map(msg => 
            msg.id === assistantMessageId 
              ? { 
                  ...msg, 
                  content: completeResponse.answer,
                  sources: completeResponse.sources,
                  educationalGuidance: completeResponse.educational_guidance,
                  isStreaming: false
                }
              : msg
          )
        );
      } catch (completeError) {
        console.error('Error getting complete response:', completeError);
        // Keep the streamed content if complete response fails
        setMessages(prev => 
          prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, isStreaming: false }
              : msg
          )
        );
      }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      
      toast({
        title: 'Chat Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });

      // Remove the failed message
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
      
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsLoading(false);
      setCurrentStreamingId(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleSources = (messageId: string) => {
    setShowSources(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  const handlePromptClick = (prompt: string) => {
    setInputMessage(prompt);
  };

  const formatMessageContent = (content: string) => {
    // Simple markdown-like formatting
    return content
      .split('\n')
      .map((line, index) => (
        <Text key={index} mb={line.trim() === '' ? 2 : 0}>
          {line || '\u00A0'}
        </Text>
      ));
  };

  if (isLoadingStatus) {
    return (
      <Card bg={cardBg} shadow="sm">
        <CardBody>
          <Flex align="center" justify="center" py={8}>
            <Spinner size="lg" color="blue.500" />
            <Text ml={4}>Loading course status...</Text>
          </Flex>
        </CardBody>
      </Card>
    );
  }

  if (statusLoadError) {
    return (
      <Card bg={cardBg} shadow="sm">
        <CardBody>
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle>Failed to Load Course Status</AlertTitle>
              <AlertDescription>
                {statusLoadError}. Please try again later or check your API key.
              </AlertDescription>
            </Box>
          </Alert>
        </CardBody>
      </Card>
    );
  }

  if (!courseStatus) {
    return (
      <Card bg={cardBg} shadow="sm">
        <CardBody>
          <Flex align="center" justify="center" py={8}>
            <Spinner size="lg" color="blue.500" />
            <Text ml={4}>No course status data available.</Text>
          </Flex>
        </CardBody>
      </Card>
    );
  }

  if (!courseStatus.is_indexed) {
    return (
      <Card bg={cardBg} shadow="sm">
        <CardBody>
          <Alert status="info" borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle>No Course Materials Available</AlertTitle>
              <AlertDescription>
                Please upload course materials (PDF, PPTX, TXT, images, or CSV files) to enable educational chat.
              </AlertDescription>
            </Box>
          </Alert>
        </CardBody>
      </Card>
    );
  }

  return (
    <VStack spacing={4} align="stretch">
      {/* Header */}
      <Card bg={cardBg} shadow="sm">
        <CardBody>
          <Flex align="center" justify="space-between">
            <HStack>
              <Icon as={FiMessageCircle} boxSize={6} color="blue.500" />
              <VStack align="start" spacing={0}>
                <Heading size="md" color="blue.600">
                  CoursePilot Educational Chat
                </Heading>
                <Text fontSize="sm" color="gray.500">
                  Ask questions about your course materials • {courseStatus.total_files} files indexed
                </Text>
              </VStack>
            </HStack>
            <Badge colorScheme="green" variant="subtle">
              {courseStatus.vector_db_size} chunks ready
            </Badge>
          </Flex>
        </CardBody>
      </Card>

      {/* Educational Prompts */}
      {messages.length === 0 && (
        <Card bg={cardBg} shadow="sm">
          <CardBody>
            <VStack spacing={3} align="stretch">
              <HStack>
                <Icon as={FiInfo} color="yellow.500" />
                <Heading size="sm">Suggested Educational Questions</Heading>
              </HStack>
              <UnorderedList spacing={2}>
                {EDUCATIONAL_PROMPTS.slice(0, 4).map((prompt, index) => (
                  <ListItem
                    key={index}
                    cursor="pointer"
                    color="blue.600"
                    _hover={{ color: 'blue.800', textDecoration: 'underline' }}
                    onClick={() => handlePromptClick(prompt)}
                  >
                    {prompt}
                  </ListItem>
                ))}
              </UnorderedList>
            </VStack>
          </CardBody>
        </Card>
      )}

      {/* Messages */}
      <Box
        bg={bgColor}
        borderRadius="lg"
        p={4}
        maxH="500px"
        overflowY="auto"
        border="1px solid"
        borderColor={useColorModeValue('gray.200', 'gray.600')}
      >
        <VStack spacing={4} align="stretch">
          {messages.map((message) => (
            <Flex
              key={message.id}
              justify={message.type === 'user' ? 'flex-end' : 'flex-start'}
              align="flex-start"
            >
              {message.type === 'assistant' && (
                <Avatar
                  size="sm"
                  bg="blue.500"
                  icon={<FiBook />}
                  mr={3}
                  mt={1}
                />
              )}
              
              <Box
                maxW="80%"
                bg={message.type === 'user' ? userBg : assistantBg}
                color={message.type === 'user' ? 'white' : useColorModeValue('gray.800', 'white')}
                p={4}
                borderRadius="lg"
                shadow="sm"
              >
                <VStack spacing={2} align="stretch">
                  <Box>
                    {formatMessageContent(message.content)}
                    {message.isStreaming && (
                      <Flex align="center" mt={2}>
                        <Spinner size="sm" color="blue.500" />
                        <Text ml={2} fontSize="sm" color="gray.500">
                          Thinking...
                        </Text>
                      </Flex>
                    )}
                  </Box>
                  
                  {/* Sources */}
                  {message.sources && message.sources.length > 0 && (
                    <Box>
                      <Button
                        size="xs"
                        variant="ghost"
                        leftIcon={showSources[message.id] ? <FiChevronUp /> : <FiChevronDown />}
                        onClick={() => toggleSources(message.id)}
                        color={message.type === 'user' ? 'white' : 'gray.600'}
                      >
                        Sources ({message.sources.length})
                      </Button>
                      <Collapse in={showSources[message.id]}>
                        <Box mt={2} p={2} bg={useColorModeValue('gray.50', 'gray.600')} borderRadius="md">
                          <List spacing={1}>
                            {message.sources.map((source, index) => (
                              <ListItem key={index} fontSize="sm">
                                <ListIcon as={getSourceIcon(source)} color="blue.500" />
                                <Code fontSize="xs">{source}</Code>
                              </ListItem>
                            ))}
                          </List>
                        </Box>
                      </Collapse>
                    </Box>
                  )}
                  
                  {/* Educational Guidance */}
                  {message.educationalGuidance && (
                    <Box
                      p={3}
                      bg={useColorModeValue('blue.50', 'blue.900')}
                      borderRadius="md"
                      borderLeft="4px solid"
                      borderLeftColor="blue.500"
                    >
                      <HStack mb={2}>
                        <Icon as={FiTarget} color="blue.500" />
                        <Text fontSize="sm" fontWeight="medium" color="blue.600">
                          Learning Guidance
                        </Text>
                      </HStack>
                      <Text fontSize="sm" color="blue.700">
                        {message.educationalGuidance}
                      </Text>
                    </Box>
                  )}
                </VStack>
              </Box>
              
              {message.type === 'user' && (
                <Avatar
                  size="sm"
                  bg="gray.500"
                  icon={<FiUser />}
                  ml={3}
                  mt={1}
                />
              )}
            </Flex>
          ))}
          <div ref={messagesEndRef} />
        </VStack>
      </Box>

      {/* Input Area */}
      <Card bg={cardBg} shadow="sm">
        <CardBody>
          <HStack spacing={3}>
            <Textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question about your course materials..."
              rows={2}
              resize="none"
              isDisabled={isDisabled || isLoading}
              bg={bgColor}
            />
            <Button
              colorScheme="blue"
              size="lg"
              onClick={handleSendMessage}
              isLoading={isLoading}
              loadingText="Thinking..."
              isDisabled={isDisabled || !inputMessage.trim() || isLoading}
              leftIcon={<FiSend />}
            >
              Send
            </Button>
          </HStack>
        </CardBody>
      </Card>
    </VStack>
  );
} 