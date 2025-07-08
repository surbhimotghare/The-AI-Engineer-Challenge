'use client'

import React from 'react';
import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Heading,
  VStack,
  HStack,
  Text,
  Icon,
  Badge,
  Button,
  SimpleGrid,
  Flex,
  useColorModeValue,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  List,
  ListItem,
  ListIcon,
  Divider,
  useToast,
} from '@chakra-ui/react';
import {
  FiFile,
  FiFileText,
  FiImage,
  FiBarChart,
  FiMonitor,
  FiTrash2,
  FiCheck,
  FiClock,
  FiAlertCircle,
  FiDatabase,
  FiFolder,
  FiDownload,
} from 'react-icons/fi';
import { clearCourseMaterials } from '../lib/api';
import type { CourseStatusResponse, FileInfo } from '../lib/api';

interface CourseMaterialsListProps {
  courseStatus: CourseStatusResponse | null;
  onClearComplete?: () => void;
  onError?: (error: string) => void;
}

const getFileIcon = (fileType: string) => {
  if (fileType.includes('pdf')) return FiFile;
  if (fileType.includes('pptx')) return FiMonitor;
  if (fileType.includes('txt') || fileType.includes('text')) return FiFileText;
  if (fileType.includes('image') || fileType.includes('png') || fileType.includes('jpg') || fileType.includes('jpeg')) return FiImage;
  if (fileType.includes('csv')) return FiBarChart;
  return FiFile;
};

const getFileColor = (fileType: string) => {
  if (fileType.includes('pdf')) return 'red';
  if (fileType.includes('pptx')) return 'orange';
  if (fileType.includes('txt') || fileType.includes('text')) return 'blue';
  if (fileType.includes('image') || fileType.includes('png') || fileType.includes('jpg') || fileType.includes('jpeg')) return 'green';
  if (fileType.includes('csv')) return 'purple';
  return 'gray';
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileTypeLabel = (fileType: string): string => {
  if (fileType.includes('pdf')) return 'PDF';
  if (fileType.includes('pptx')) return 'PPTX';
  if (fileType.includes('txt') || fileType.includes('text')) return 'TXT';
  if (fileType.includes('png')) return 'PNG';
  if (fileType.includes('jpg') || fileType.includes('jpeg')) return 'JPG';
  if (fileType.includes('csv')) return 'CSV';
  return fileType.toUpperCase();
};

export default function CourseMaterialsList({ 
  courseStatus, 
  onClearComplete, 
  onError 
}: CourseMaterialsListProps) {
  const [isClearing, setIsClearing] = React.useState(false);
  const toast = useToast();

  // Color mode values
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const bgColor = useColorModeValue('gray.50', 'gray.700');

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to delete all course materials? This action cannot be undone.')) {
      return;
    }

    setIsClearing(true);
    try {
      await clearCourseMaterials();
      toast({
        title: 'Course Materials Cleared',
        description: 'All course materials have been successfully deleted.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      if (onClearComplete) {
        onClearComplete();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to clear materials';
      toast({
        title: 'Clear Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsClearing(false);
    }
  };

  if (!courseStatus) {
    return null;
  }

  if (!courseStatus.is_indexed && courseStatus.total_files === 0) {
    return (
      <Card bg={cardBg} shadow="sm" borderWidth="1px" borderColor={borderColor}>
        <CardBody>
          <Alert status="info" borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle>No Course Materials Yet</AlertTitle>
              <AlertDescription>
                Upload your first course materials to get started with CoursePilot.
              </AlertDescription>
            </Box>
          </Alert>
        </CardBody>
      </Card>
    );
  }

  const materialEntries = Object.entries(courseStatus.course_materials || {});

  return (
    <Card bg={cardBg} shadow="sm" borderWidth="1px" borderColor={borderColor}>
      <CardHeader>
        <Flex justify="space-between" align="center">
          <HStack spacing={3}>
            <Icon as={FiFolder} boxSize={6} color="blue.500" />
            <VStack align="start" spacing={0}>
              <Heading size="md" color="blue.600">
                Course Materials
              </Heading>
              <Text fontSize="sm" color="gray.500">
                {courseStatus.total_files} files • {courseStatus.vector_db_size} chunks indexed
              </Text>
            </VStack>
          </HStack>
          
          {courseStatus.total_files > 0 && (
            <Button
              size="sm"
              colorScheme="red"
              variant="outline"
              leftIcon={<FiTrash2 />}
              onClick={handleClearAll}
              isLoading={isClearing}
              loadingText="Clearing..."
            >
              Clear All Materials
            </Button>
          )}
        </Flex>
      </CardHeader>
      
      <CardBody pt={0}>
        <VStack spacing={4} align="stretch">
          {/* Summary Stats */}
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
            <Stat size="sm">
              <StatLabel>Total Files</StatLabel>
              <StatNumber fontSize="lg">{courseStatus.total_files}</StatNumber>
              <StatHelpText>Uploaded materials</StatHelpText>
            </Stat>
            <Stat size="sm">
              <StatLabel>Knowledge Base</StatLabel>
              <StatNumber fontSize="lg">{courseStatus.vector_db_size}</StatNumber>
              <StatHelpText>Indexed chunks</StatHelpText>
            </Stat>
            <Stat size="sm">
              <StatLabel>File Types</StatLabel>
              <StatNumber fontSize="lg">{courseStatus.supported_file_types.length}</StatNumber>
              <StatHelpText>Supported formats</StatHelpText>
            </Stat>
            <Stat size="sm">
              <StatLabel>Status</StatLabel>
              <StatNumber fontSize="lg" color={courseStatus.is_indexed ? 'green.500' : 'orange.500'}>
                {courseStatus.is_indexed ? 'Ready' : 'Processing'}
              </StatNumber>
              <StatHelpText>
                {courseStatus.is_indexed ? 'Chat enabled' : 'Indexing files...'}
              </StatHelpText>
            </Stat>
          </SimpleGrid>

          {materialEntries.length > 0 && (
            <>
              <Divider />
              
              {/* File List */}
              <VStack spacing={3} align="stretch">
                <Heading size="sm" color="gray.600">
                  Uploaded Files ({materialEntries.length})
                </Heading>
                
                <List spacing={3}>
                  {materialEntries.map(([filename, fileInfo]: [string, FileInfo]) => (
                    <ListItem key={filename}>
                      <Card bg={bgColor} p={4} shadow="sm">
                        <Flex justify="space-between" align="center">
                          <HStack spacing={4} flex="1" minW="0">
                            <Icon 
                              as={getFileIcon(fileInfo.file_type)} 
                              color={`${getFileColor(fileInfo.file_type)}.500`} 
                              boxSize={8}
                            />
                            
                            <VStack align="start" spacing={1} flex="1" minW="0">
                              <Text fontWeight="medium" isTruncated maxW="100%">
                                {filename}
                              </Text>
                              <HStack spacing={3} fontSize="sm" color="gray.500">
                                <Badge 
                                  colorScheme={getFileColor(fileInfo.file_type)} 
                                  size="sm"
                                >
                                  {getFileTypeLabel(fileInfo.file_type)}
                                </Badge>
                                <Text>{formatFileSize(fileInfo.file_size)}</Text>
                                <Text>{fileInfo.num_chunks} chunks</Text>
                              </HStack>
                            </VStack>
                          </HStack>
                          
                          <VStack spacing={1} align="end">
                            <Badge 
                              colorScheme="green" 
                              variant="subtle"
                            >
                              <HStack spacing={1}>
                                <Icon as={FiCheck} boxSize={3} />
                                <Text fontSize="xs">Processed</Text>
                              </HStack>
                            </Badge>
                            {fileInfo.processing_metadata && (
                              <Text fontSize="xs" color="gray.500">
                                {Object.keys(fileInfo.processing_metadata).length} metadata fields
                              </Text>
                            )}
                          </VStack>
                        </Flex>
                      </Card>
                    </ListItem>
                  ))}
                </List>
              </VStack>
            </>
          )}

          {/* Processing Status */}
          {!courseStatus.is_indexed && courseStatus.total_files > 0 && (
            <Alert status="info" borderRadius="md">
              <AlertIcon />
              <Box>
                <AlertTitle>Processing Course Materials</AlertTitle>
                <AlertDescription>
                  Your files are being processed and indexed. Chat will be available once processing is complete.
                </AlertDescription>
              </Box>
            </Alert>
          )}
        </VStack>
      </CardBody>
    </Card>
  );
} 