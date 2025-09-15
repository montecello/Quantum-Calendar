import json
import os

def handler(event, context):
    """Vercel serverless function for health check"""
    try:
        # Check if static files exist
        current_dir = os.path.dirname(__file__)
        strongs_path = os.path.join(current_dir, '..', 'frontend', 'static', 'data', 'strongs_complete.json')
        kjv_path = os.path.join(current_dir, '..', 'frontend', 'static', 'data', 'kjv_verses.json')

        strongs_exists = os.path.exists(strongs_path)
        kjv_exists = os.path.exists(kjv_path)

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'status': 'healthy',
                'static_files': {
                    'strongs_data': 'available' if strongs_exists else 'missing',
                    'kjv_data': 'available' if kjv_exists else 'missing'
                },
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