# Overview

Receiptify is a UK-focused, eco-friendly digital receipt management application designed to consolidate and organize receipts from multiple sources. The platform emphasizes environmental impact by reducing paper waste while providing comprehensive receipt tracking, categorization, and analytics. Built as a modern web application with a mobile-first approach, it simulates a mobile app experience through responsive design and intuitive navigation.

The application features receipt ingestion from various sources (QR codes, camera scans, webhooks), comprehensive receipt management with search and filtering capabilities, loyalty card integration, environmental impact tracking, and detailed analytics. The system is architected to handle multiple receipt sources including POS systems, Open Banking APIs, and manual uploads.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client application is built using React with TypeScript in a single-page application (SPA) architecture. The UI framework leverages shadcn/ui components built on top of Radix UI primitives for accessibility and consistency. Styling is handled through Tailwind CSS with a custom design system featuring eco-friendly green color schemes.

Navigation uses Wouter for lightweight client-side routing, simulating a mobile app experience with bottom navigation. State management is handled through TanStack Query for server state and local React state for UI interactions. The application is designed mobile-first with a constrained max-width container to simulate a mobile device.

## Backend Architecture
The backend follows a REST API architecture built with Express.js and TypeScript. The server implements a modular route structure with separation of concerns between routing, storage operations, and business logic. Error handling is centralized with structured error responses and comprehensive logging.

The application uses an in-memory storage abstraction that can be extended to work with different database implementations. This design allows for easy migration to different storage solutions while maintaining consistent interfaces.

## Data Architecture
Database schema is designed using Drizzle ORM with PostgreSQL as the target database. The schema includes comprehensive models for users, merchants, receipts, receipt items, loyalty cards, subscriptions, warranties, eco metrics, comments, and splits.

The data model supports complex receipt structures with line items, merchant information, location data, payment methods, and environmental tracking. Schema validation is implemented using Zod with type-safe insert and update operations.

## File Upload and Processing
The system supports multiple file upload mechanisms including multipart form uploads for camera-captured receipts and webhook endpoints for automated receipt ingestion. File processing includes OCR capabilities for extracting receipt data from images.

## UI Component System
The application uses a comprehensive design system built with shadcn/ui components, providing consistent styling, accessibility features, and reusable UI patterns. Components are organized in atomic design principles with base UI components, composite components, and page-level layouts.

# External Dependencies

## Database and ORM
- **Drizzle ORM**: Type-safe database operations with PostgreSQL support
- **Neon Database**: Serverless PostgreSQL database through @neondatabase/serverless
- **connect-pg-simple**: PostgreSQL session store for Express sessions

## Frontend Libraries
- **React**: Core UI library with TypeScript support
- **TanStack Query**: Server state management and caching
- **Wouter**: Lightweight client-side routing
- **React Hook Form**: Form state management with validation
- **Date-fns**: Date manipulation and formatting utilities

## UI and Styling
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Accessible component primitives for complex UI patterns
- **Lucide React**: Icon library for consistent iconography
- **Class Variance Authority**: Type-safe component variants
- **Embla Carousel**: Touch-friendly carousel components

## Development and Build Tools
- **Vite**: Fast build tool and development server
- **TypeScript**: Static type checking and enhanced developer experience
- **ESBuild**: Fast JavaScript bundler for production builds
- **PostCSS**: CSS processing with Autoprefixer support

## File Handling
- **Multer**: Multipart form data handling for file uploads
- **File upload processing**: Support for image-based receipt capture and processing

## Validation and Utilities
- **Zod**: Runtime type validation and schema definition
- **clsx**: Conditional CSS class utility
- **cmdk**: Command palette and search interface utilities

The application is configured for deployment on Replit with specific development tooling including runtime error overlays and development banners for the Replit environment.