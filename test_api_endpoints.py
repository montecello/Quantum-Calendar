#!/usr/bin/env python3
"""
Test script to verify API endpoints are working correctly.
Run this locally before deploying to Vercel to ensure everything works.
"""

import requests
import json
import sys
import os
from datetime import datetime

def test_api_endpoints(base_url="http://localhost:5001"):
    """Test all API endpoints"""
    print(f"🧪 Testing API endpoints at {base_url}")
    print("=" * 60)

    endpoints = [
        "/api/test-mongodb",
        "/api/debug",
        "/api/strongs-data?limit=10",
        "/api/kjv-data?limit=10"
    ]

    results = {}

    for endpoint in endpoints:
        url = f"{base_url}{endpoint}"
        print(f"\n📡 Testing {endpoint}...")

        try:
            response = requests.get(url, timeout=30)
            print(f"   Status: {response.status_code}")

            if response.status_code == 200:
                try:
                    data = response.json()
                    print(f"   ✅ Success - Response type: {type(data)}")

                    # Print key information based on endpoint
                    if endpoint == "/api/test-mongodb":
                        status = data.get('status', 'unknown')
                        print(f"   📊 MongoDB Status: {status}")
                        if 'strongs_count' in data:
                            print(f"   📚 Strong's entries: {data['strongs_count']}")
                        if 'kjv_count' in data:
                            print(f"   📖 KJV verses: {data['kjv_count']}")

                    elif endpoint == "/api/debug":
                        print(f"   🔧 Debug info retrieved")
                        if 'environment_variables' in data:
                            env_vars = data['environment_variables']
                            print(f"   🌍 MONGODB_URI: {'✅' if env_vars.get('MONGODB_URI') else '❌'}")
                            print(f"   🗄️  DATABASE_NAME: {'✅' if env_vars.get('DATABASE_NAME') else '❌'}")

                    elif endpoint in ["/api/strongs-data", "/api/kjv-data"]:
                        if isinstance(data, dict) and 'data' in data:
                            count = data.get('count', len(data.get('data', [])))
                            total = data.get('total', count)
                            source = data.get('source', 'unknown')
                            pagination = data.get('pagination', {})
                            print(f"   📊 Data count: {count}/{total}")
                            print(f"   🔗 Source: {source}")
                            if pagination:
                                current_page = pagination.get('current_page', 1)
                                total_pages = pagination.get('total_pages', 1)
                                has_more = pagination.get('has_more', False)
                                print(f"   📄 Page: {current_page}/{total_pages} ({'more available' if has_more else 'last page'})")
                        elif isinstance(data, list):
                            print(f"   📊 Data count: {len(data)}")
                            print(f"   🔗 Source: direct array")

                    results[endpoint] = {'status': 'success', 'data': data}

                except json.JSONDecodeError:
                    print(f"   ⚠️  Non-JSON response: {response.text[:200]}...")
                    results[endpoint] = {'status': 'non-json', 'text': response.text[:500]}

            else:
                print(f"   ❌ Error {response.status_code}: {response.text[:200]}...")
                results[endpoint] = {'status': 'error', 'code': response.status_code, 'text': response.text[:500]}

        except requests.RequestException as e:
            print(f"   🚨 Request failed: {str(e)}")
            results[endpoint] = {'status': 'request_error', 'error': str(e)}

    print("\n" + "=" * 60)
    print("📋 SUMMARY:")

    success_count = sum(1 for r in results.values() if r['status'] == 'success')
    total_count = len(results)

    print(f"✅ Successful endpoints: {success_count}/{total_count}")

    for endpoint, result in results.items():
        status_emoji = "✅" if result['status'] == 'success' else "❌"
        print(f"   {status_emoji} {endpoint}: {result['status']}")

    if success_count == total_count:
        print("\n🎉 All endpoints are working correctly!")
        return True
    else:
        print("\n⚠️  Some endpoints have issues. Check the details above.")
        return False

def test_static_files():
    """Test that static files exist and are readable"""
    print("\n📁 Testing static files...")

    # Get the project root (directory containing this script)
    project_root = os.path.dirname(os.path.abspath(__file__))
    static_dir = os.path.join(project_root, 'frontend', 'static', 'data')

    print(f"   🔍 Looking for files in: {static_dir}")

    files_to_check = [
        'strongs_complete.json',
        'kjv_verses.json'
    ]

    all_exist = True

    for filename in files_to_check:
        filepath = os.path.join(static_dir, filename)
        print(f"   📄 Checking {filename}...")
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                print(f"   ✅ {filename}: {len(data)} entries")
            except Exception as e:
                print(f"   ❌ {filename}: Error reading - {str(e)}")
                all_exist = False
        else:
            print(f"   ❌ {filename}: File not found at {filepath}")
            print(f"      Expected path: {filepath}")
            all_exist = False

    return all_exist

if __name__ == "__main__":
    print("🚀 API Endpoint Test Script")
    print(f"⏰ Started at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    # Test static files first
    static_ok = test_static_files()

    # Test API endpoints
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5001"
    api_ok = test_api_endpoints(base_url)

    print()
    if static_ok and api_ok:
        print("🎯 All tests passed! Ready for deployment.")
        sys.exit(0)
    else:
        print("⚠️  Some tests failed. Please fix issues before deploying.")
        sys.exit(1)