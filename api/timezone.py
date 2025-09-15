import json
import os

def handler(event, context):
    """Vercel serverless function for timezone lookup"""
    try:
        # Parse query parameters
        query_params = event.get('queryStringParameters', {}) or {}

        lat = query_params.get('lat')
        lon = query_params.get('lon')

        if not lat or not lon:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'Missing lat/lon parameters'})
            }

        # For now, return a simple timezone based on longitude
        # In production, you'd want to use a proper timezone library
        lon_float = float(lon)

        # Simple timezone estimation based on longitude
        if lon_float < -120:
            tz = 'America/Los_Angeles'
        elif lon_float < -90:
            tz = 'America/Denver'
        elif lon_float < -75:
            tz = 'America/New_York'
        elif lon_float < 0:
            tz = 'Atlantic/Reykjavik'
        elif lon_float < 15:
            tz = 'Europe/London'
        elif lon_float < 30:
            tz = 'Europe/Paris'
        elif lon_float < 60:
            tz = 'Asia/Dubai'
        elif lon_float < 120:
            tz = 'Asia/Shanghai'
        else:
            tz = 'Pacific/Auckland'

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'tz': tz})
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': str(e)})
        }