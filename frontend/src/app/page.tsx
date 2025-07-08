'use client'

import dynamic from 'next/dynamic'
import { Box, Container, VStack } from '@chakra-ui/react'

// Dynamically import the CoursePilot component with no SSR
const CoursePilot = dynamic(() => import('../components/CoursePilot'), {
  ssr: false
})

export default function HomePage() {
  return (
    <Box minH="100vh" bg="gray.50">
      <CoursePilot />
    </Box>
  )
} 