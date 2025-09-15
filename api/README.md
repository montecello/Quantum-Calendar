# Quantum Calendar API Functions

This directory contains Vercel serverless functions for the Quantum Calendar application.

## Available Endpoints

### `/api/health`
- **Method:** GET
- **Description:** Health check endpoint
- **Response:** JSON with status and MongoDB connection info

### `/api/strongs-data`
- **Method:** GET
- **Description:** Strong's Hebrew dictionary data
- **Query Parameters:**
  - `strongs_num` (int): Specific Strong's number
  - `language` (str): Language filter (heb, grk)
  - `search` (str): Search term for word/transliteration/definitions
  - `limit` (int): Maximum results (default: 100)
- **Fallback:** Static JSON file if MongoDB unavailable

### `/api/kjv-data`
- **Method:** GET
- **Description:** KJV Bible verses data
- **Query Parameters:**
  - `book` (str): Book name
  - `chapter` (int): Chapter number
  - `verse` (int): Verse number
  - `search` (str): Search in verse text
  - `limit` (int): Maximum results (default: 100)
- **Fallback:** Static JSON file if MongoDB unavailable

### `/api/timezone`
- **Method:** GET
- **Description:** Timezone lookup by coordinates
- **Query Parameters:**
  - `lat` (float): Latitude
  - `lon` (float): Longitude
- **Response:** JSON with timezone string

## Environment Variables

Required environment variables for MongoDB Atlas:
- `MONGODB_URI`: MongoDB Atlas connection string
- `DATABASE_NAME`: Database name (default: quantum-calendar)
- `STRONG_COLLECTION`: Strong's collection name (default: strongs)
- `KJV_COLLECTION`: KJV collection name (default: verses)

## Deployment

These functions are automatically deployed by Vercel when pushed to the main branch. Each function runs in its own serverless environment with access to the specified dependencies.