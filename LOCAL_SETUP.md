# Local Development Setup

This project now runs entirely in local development mode without Replit authentication.

## Prerequisites

1. **PostgreSQL** - Install and run PostgreSQL locally
   - Default connection: `postgresql://postgres:postgres@localhost:5432/quantedge`
   - Or create your own database and update `DATABASE_URL` in `.env`

2. **Node.js** - Version 18+ recommended

## Setup Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Create Database**
   ```bash
   # Using psql
   createdb quantedge
   
   # Or using PostgreSQL command line
   psql -U postgres -c "CREATE DATABASE quantedge;"
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/quantedge
   PORT=5001
   NODE_ENV=development
   
   # Optional: For AI chat features
   OPENAI_API_KEY=your_openai_api_key_here
   XAI_API_KEY=your_xai_api_key_here
   ```

4. **Run Database Migrations**
   ```bash
   npm run db:push
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

## Authentication

The application runs in **local development mode** with automatic authentication:
- No login required
- A mock user is automatically created/used: `local-dev-user`
- All routes are accessible without authentication

## Database Connection

The project now uses **local PostgreSQL** instead of Neon:
- Connection: Standard PostgreSQL connection string
- Driver: `pg` (node-postgres)
- ORM: Drizzle ORM with `node-postgres` adapter

## Changes Made

- ✅ Removed Replit authentication
- ✅ Updated database connection from Neon to local PostgreSQL
- ✅ Removed all Replit references from UI
- ✅ Updated OpenAI client to use standard environment variables
- ✅ Added local development mode with auto-login

