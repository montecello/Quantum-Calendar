import os
import json
from pymongo import MongoClient
from urllib.parse import parse_qs

def handler(event, context):
    """Vercel serverless function for KJV data API"""
    try:
        # Get environment variables
        mongodb_uri = os.environ.get('MONGODB_URI')
        database_name = os.environ.get('DATABASE_NAME', 'quantum-calendar')
        kjv_collection = os.environ.get('KJV_COLLECTION', 'verses')

        # Parse query parameters
        query_params = event.get('queryStringParameters', {}) or {}

        # If MongoDB is not configured, try to serve static file
        if not mongodb_uri:
            return fallback_to_static()

        # Connect to MongoDB
        client = MongoClient(mongodb_uri)
        db = client[database_name]
        collection = db[kjv_collection]

        # Build query
        query = {}

        if 'book' in query_params:
            query['book'] = {'$regex': f'^{query_params["book"]}$', '$options': 'i'}
        if 'chapter' in query_params:
            query['chapter'] = int(query_params['chapter'])
        if 'verse' in query_params:
            query['verse'] = int(query_params['verse'])
        if 'search' in query_params:
            query['text'] = {'$regex': query_params['search'], '$options': 'i'}

        # Get limit
        limit = int(query_params.get('limit', 100))

        # Execute query
        results = list(collection.find(query, {'_id': 0}).limit(limit))

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': json.dumps(results)
        }

    except Exception as e:
        print(f"Error in kjv-data API: {str(e)}")
        return fallback_to_static()

def fallback_to_static():
    """Fallback to static JSON file if MongoDB is not available"""
    try:
        # Try to load static file
        static_path = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'static', 'data', 'kjv_verses.json')
        if os.path.exists(static_path):
            with open(static_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps(data)
            }
        else:
            return {
                'statusCode': 503,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'MongoDB not configured and static file not found'})
            }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': f'Fallback failed: {str(e)}'})
        }