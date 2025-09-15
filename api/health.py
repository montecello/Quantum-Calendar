import json
import os

def handler(event, context):
    """Vercel serverless function for health check"""
    try:
        # Check MongoDB connection
        mongodb_status = "disconnected"
        try:
            from pymongo import MongoClient
            mongodb_uri = os.environ.get('MONGODB_URI')
            if mongodb_uri:
                client = MongoClient(mongodb_uri, serverSelectionTimeoutMS=5000)
                client.admin.command('ping')
                mongodb_status = "connected"
        except:
            mongodb_status = "error"

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'status': 'healthy',
                'mongodb': mongodb_status,
                'timestamp': '2025-09-15T00:00:00Z',
                'version': '1.0.0'
            })
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'status': 'unhealthy',
                'error': str(e)
            })
        }