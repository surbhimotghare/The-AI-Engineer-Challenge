'use client'

import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  useToast,
  Progress,
  Flex,
  Icon,
  Badge,
  List,
  ListItem,
  ListIcon,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Divider,
  Heading,
  Card,
  CardHeader,
  CardBody,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  CircularProgress,
  CircularProgressLabel,
  IconButton,
  Tooltip,
  useColorModeValue,
} from '@chakra-ui/react';
import { 
  FiUploadCloud, 
  FiFile, 
  FiFileText, 
  FiImage, 
  FiBarChart,
  FiCheck,
  FiX,
  FiTrash2,
  FiBook,
  FiMonitor,
  FiDatabase,
  FiInfo
} from 'react-icons/fi';
import { uploadCourseMaterials, getCourseStatus } from '../lib/api';
import type { CourseUploadResponse, CourseStatusResponse, FileInfo } from '../lib/api';

interface MultiFileUploadProps {
  apiKey: string;
  onUploadComplete?: (response: CourseUploadResponse) => void;
  onError?: (error: string) => void;
}

const SUPPORTED_FILE_TYPES = {
  'application/pdf': { icon: FiFile, label: 'PDF', color: 'red', description: 'Research papers, syllabi, readings' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { icon: FiMonitor, label: 'PPTX', color: 'orange', description: 'Lecture slides, presentations' },
  'text/plain': { icon: FiFileText, label: 'TXT', color: 'blue', description: 'Notes, outlines, reading lists' },
  'image/png': { icon: FiImage, label: 'PNG', color: 'green', description: 'Charts, diagrams, screenshots' },
  'image/jpeg': { icon: FiImage, label: 'JPG', color: 'green', description: 'Photos, diagrams, graphs' },
  'image/jpg': { icon: FiImage, label: 'JPG', color: 'green', description: 'Photos, diagrams, graphs' },
  'text/csv': { icon: FiBarChart, label: 'CSV', color: 'purple', description: 'Grade data, analytics, datasets' },
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export default function MultiFileUpload({ apiKey, onUploadComplete, onError }: MultiFileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [courseStatus, setCourseStatus] = useState<CourseStatusResponse | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  // Color mode values
  const bgColor = useColorModeValue('gray.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const cardBg = useColorModeValue('white', 'gray.800');

  // Load course status on mount
  React.useEffect(() => {
    loadCourseStatus();
  }, []);

  const loadCourseStatus = useCallback(async () => {
    try {
      const status = await getCourseStatus();
      setCourseStatus(status);
    } catch (error) {
      console.error('Error loading course status:', error);
    }
  }, []);

  const validateFile = (file: File): string | null => {
    if (!Object.keys(SUPPORTED_FILE_TYPES).includes(file.type)) {
      return `Unsupported file type: ${file.type}. Please upload PDF, PPTX, TXT, PNG, JPG, or CSV files.`;
    }
    
    if (file.size > MAX_FILE_SIZE) {
      return `File "${file.name}" is too large. Maximum size is 50MB.`;
    }
    
    return null;
  };

  const handleFileSelect = (selectedFiles: FileList) => {
    const fileArray = Array.from(selectedFiles);
    const validFiles: File[] = [];
    const errors: string[] = [];

    fileArray.forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(error);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      toast({
        title: 'File Validation Error',
        description: errors.join('\n'),
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      handleFileSelect(droppedFiles);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearFiles = () => {
    setFiles([]);
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast({
        title: 'No Files Selected',
        description: 'Please select course materials to upload.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const response = await uploadCourseMaterials(files, apiKey);
      
      toast({
        title: 'Course Materials Uploaded Successfully!',
        description: `Processed ${response.processed_files.length} files with ${response.total_chunks} chunks.`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      // Clear uploaded files
      setFiles([]);
      
      // Refresh course status
      await loadCourseStatus();
      
      if (onUploadComplete) {
        onUploadComplete(response);
      }
      
      if (response.failed_files.length > 0) {
        toast({
          title: 'Some Files Failed to Process',
          description: `${response.failed_files.length} files had processing errors.`,
          status: 'warning',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      toast({
        title: 'Upload Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const getFileIcon = (file: File) => {
    const fileType = SUPPORTED_FILE_TYPES[file.type as keyof typeof SUPPORTED_FILE_TYPES];
    return fileType ? fileType.icon : FiFile;
  };

  const getFileColor = (file: File) => {
    const fileType = SUPPORTED_FILE_TYPES[file.type as keyof typeof SUPPORTED_FILE_TYPES];
    return fileType ? fileType.color : 'gray';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <VStack spacing={6} align="stretch">
      {/* Header */}
      <Card bg={cardBg} shadow="sm">
        <CardHeader>
          <HStack>
            <Icon as={FiBook} boxSize={6} color="blue.500" />
            <Heading size="md" color="blue.600">
              CoursePilot - Upload Course Materials
            </Heading>
          </HStack>
        </CardHeader>
      </Card>

      {/* Course Status */}
      {courseStatus && (
        <Card bg={cardBg} shadow="sm">
          <CardBody>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
              <Stat>
                <StatLabel>Total Files</StatLabel>
                <StatNumber>{courseStatus.total_files}</StatNumber>
                <StatHelpText>Course materials uploaded</StatHelpText>
              </Stat>
              <Stat>
                <StatLabel>Vector Database</StatLabel>
                <StatNumber>{courseStatus.vector_db_size}</StatNumber>
                <StatHelpText>Chunks indexed</StatHelpText>
              </Stat>
              <Stat>
                <StatLabel>Status</StatLabel>
                <StatNumber color={courseStatus.is_indexed ? 'green.500' : 'gray.500'}>
                  {courseStatus.is_indexed ? 'Ready' : 'Empty'}
                </StatNumber>
                <StatHelpText>
                  {courseStatus.is_indexed ? 'Ready for teaching' : 'No materials yet'}
                </StatHelpText>
              </Stat>
            </SimpleGrid>
          </CardBody>
        </Card>
      )}

      {/* Supported File Types */}
      <Card bg={cardBg} shadow="sm">
        <CardHeader>
          <Heading size="sm">Supported Educational Materials</Heading>
        </CardHeader>
        <CardBody>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={3}>
            {Object.entries(SUPPORTED_FILE_TYPES).map(([mimeType, info]) => (
              <HStack key={mimeType} spacing={3}>
                <Icon as={info.icon} color={`${info.color}.500`} />
                <VStack align="start" spacing={0}>
                  <Text fontWeight="medium">{info.label}</Text>
                  <Text fontSize="sm" color="gray.500">
                    {info.description}
                  </Text>
                </VStack>
              </HStack>
            ))}
          </SimpleGrid>
        </CardBody>
      </Card>

      {/* Upload Area */}
      <Card bg={cardBg} shadow="sm">
        <CardBody>
          <Box
            border="2px dashed"
            borderColor={isDragOver ? 'blue.300' : borderColor}
            borderRadius="lg"
            p={8}
            textAlign="center"
            bg={isDragOver ? 'blue.50' : bgColor}
            cursor="pointer"
            transition="all 0.2s"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.pptx,.txt,.png,.jpg,.jpeg,.csv"
              onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
              style={{ display: 'none' }}
            />
            
            <VStack spacing={4}>
              <Icon as={FiUploadCloud} boxSize={12} color="blue.500" />
              <VStack spacing={1}>
                <Text fontSize="lg" fontWeight="medium">
                  Upload Course Materials
                </Text>
                <Text color="gray.500">
                  Drag and drop files here, or click to select
                </Text>
                <Text fontSize="sm" color="gray.400">
                  PDF, PPTX, TXT, PNG, JPG, CSV • Max 50MB each
                </Text>
              </VStack>
            </VStack>
          </Box>
        </CardBody>
      </Card>

      {/* Selected Files */}
      {files.length > 0 && (
        <Card bg={cardBg} shadow="sm">
          <CardHeader>
            <Flex justify="space-between" align="center">
              <Heading size="sm">Selected Files ({files.length})</Heading>
              <Button size="sm" variant="ghost" onClick={clearFiles}>
                Clear All
              </Button>
            </Flex>
          </CardHeader>
          <CardBody>
            <List spacing={3}>
              {files.map((file, index) => (
                <ListItem key={index}>
                  <Flex justify="space-between" align="center">
                    <HStack spacing={3}>
                      <Icon as={getFileIcon(file)} color={`${getFileColor(file)}.500`} />
                      <VStack align="start" spacing={0}>
                        <Text fontWeight="medium">{file.name}</Text>
                        <Text fontSize="sm" color="gray.500">
                          {formatFileSize(file.size)}
                        </Text>
                      </VStack>
                      <Badge colorScheme={getFileColor(file)}>
                        {SUPPORTED_FILE_TYPES[file.type as keyof typeof SUPPORTED_FILE_TYPES]?.label}
                      </Badge>
                    </HStack>
                    <IconButton
                      size="sm"
                      aria-label="Remove file"
                      icon={<FiX />}
                      onClick={() => removeFile(index)}
                      variant="ghost"
                    />
                  </Flex>
                </ListItem>
              ))}
            </List>
          </CardBody>
        </Card>
      )}

      {/* Upload Progress */}
      {uploading && (
        <Card bg={cardBg} shadow="sm">
          <CardBody>
            <VStack spacing={4}>
              <CircularProgress isIndeterminate color="blue.500" size="60px">
                <CircularProgressLabel>
                  <Icon as={FiUploadCloud} />
                </CircularProgressLabel>
              </CircularProgress>
              <VStack spacing={1}>
                <Text fontWeight="medium">Processing Course Materials...</Text>
                <Text fontSize="sm" color="gray.500">
                  Extracting text, generating embeddings, and indexing content
                </Text>
              </VStack>
            </VStack>
          </CardBody>
        </Card>
      )}

      {/* Upload Button */}
      <Button
        colorScheme="blue"
        size="lg"
        leftIcon={<FiUploadCloud />}
        onClick={handleUpload}
        isLoading={uploading}
        loadingText="Processing Materials..."
        isDisabled={files.length === 0}
      >
        Upload Course Materials ({files.length})
      </Button>
    </VStack>
  );
} 