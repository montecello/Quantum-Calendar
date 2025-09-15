import os
import json

def handler(event, context):
    """Vercel serverless function for KJV data API"""
    try:
        # Parse query parameters
        query_params = event.get('queryStringParameters', {}) or {}

        # Always serve static file for now (simpler deployment)
        return serve_static_data()

    except Exception as e:
        print(f"Error in kjv-data API: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': f'API error: {str(e)}'})
        }

def serve_static_data():
    """Serve static JSON data"""
    try:
        # Load static file
        current_dir = os.path.dirname(__file__)
        static_path = os.path.join(current_dir, '..', 'frontend', 'static', 'data', 'kjv_verses.json')

        print(f"Looking for KJV static file at: {static_path}")

        if os.path.exists(static_path):
            print("KJV static file found, loading...")
            with open(static_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # Apply any query filters if needed
            filtered_data = data

            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                'body': json.dumps(filtered_data)
            }
        else:
            print(f"KJV static file not found at: {static_path}")
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'KJV data file not found'})
            }
    except Exception as e:
        print(f"Error loading KJV static data: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': f'Failed to load KJV data: {str(e)}'})
        }