# Multi Land - Online Learning Platform

## Overview
A cutting-edge online learning platform delivering personalized, interactive educational experiences with robust video content management and multilingual support for English, Russian, and Georgian languages.

## Project Architecture

### Tech Stack
- **Frontend**: React + TypeScript with Wouter routing
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM (HTTP adapter for stability)
- **Storage**: AWS S3 for video/file uploads
- **Payments**: Stripe integration
- **Video Streaming**: HTML5 video player + YouTube integration
- **UI**: Tailwind CSS + shadcn/ui components
- **Webinars**: Agora.io SDK for up to 2,000 attendees

### Key Features
- Multi-language support (EN/RU/GE)
- Email-only auth for users, admin has password
- Direct "Buy Now" course purchasing
- Progress tracking and completion certificates
- YouTube video integration with custom naming
- Advanced webinar system with scheduling
- Admin dashboard for content and user management
- PWA-ready for mobile app deployment

## Recent Changes

### YouTube Video Name Feature (July 19, 2025)
- **Added**: YouTube video custom naming capability
- **Database**: Added `youtube_name` column to `contents` table
- **Schema**: Updated shared schema with `youtubeName` field
- **Backend**: Modified routes and storage to handle YouTube names
- **Frontend**: Added YouTube name input field in admin content editor
- **UI**: Updated lesson viewer to display custom YouTube names when available
- **Bug Fix**: Fixed content manager not showing YouTube video badge (only showed "Text")
- **Bug Fix**: Fixed content editor not loading existing YouTube data when editing
- **Testing**: Verified database saves and retrieves YouTube names correctly

### Previous Fixes
- Fixed YouTube video integration bug preventing saved URLs from displaying
- Resolved database connection pool exhaustion with HTTP adapter
- Implemented comprehensive webinar system
- Enhanced video upload capabilities with S3 integration

## User Preferences
- Simple, clean design with black and green color scheme
- Direct purchase model without cart complexity  
- Mobile-optimized video playback
- Supports large video uploads (up to 10GB)
- YouTube restricted visibility video integration preferred
- Focus on stability over real-time features (WebSocket disabled)

## Technical Notes
- Database uses HTTP adapter for stability (no connection pooling issues)
- WebSocket connections permanently disabled to preserve resources
- YouTube integration supports both full URLs and video IDs
- All video content stored on AWS S3 with presigned URLs
- Progressive web app approach using Capacitor for mobile deployment