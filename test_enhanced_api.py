#!/usr/bin/env python3
"""
Test the enhanced Strong's API endpoints
"""

import requests
import json
import time

def test_strongs_api():
    """Test the /api/strongs-data endpoint"""
    
    print("🧪 Testing enhanced Strong's API...")
    
    # Wait for Flask app to start
    time.sleep(2)
    
    try:
        # Test H1 (primitive word)
        print("\n=== Testing H1 (Primitive Word) ===")
        response = requests.get("http://localhost:5001/api/strongs-data?query=H1", timeout=10)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data:
                h1 = data[0]
                print(f"✅ Found H1 data")
                print(f"Word: {h1.get('word')}")
                print(f"Transliteration: {h1.get('transliteration')}")
                print(f"Definitions: {len(h1.get('definitions', []))} items")
                
                # Check for enhanced fields
                notes = h1.get('notes', {})
                if 'etymology' in notes:
                    etym = notes['etymology']
                    print(f"✨ Etymology Type: {etym.get('type')}")
                    print(f"✨ Etymology Description: {etym.get('description')}")
                    refs = etym.get('references', [])
                    if refs:
                        print(f"✨ Etymology References: {len(refs)} found")
                else:
                    print("❌ No etymology data found")
                
                greek_refs = h1.get('greekReferences', [])
                if greek_refs:
                    print(f"✨ Greek References: {len(greek_refs)} found")
                else:
                    print("❌ No Greek references found")
                    
            else:
                print("❌ No data returned")
        else:
            print(f"❌ API Error: {response.status_code}")
            print(f"Response: {response.text}")
        
        # Test H3 (derived word)
        print("\n=== Testing H3 (Derived Word) ===")
        response = requests.get("http://localhost:5001/api/strongs-data?query=H3", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data:
                h3 = data[0]
                print(f"✅ Found H3 data")
                print(f"Word: {h3.get('word')}")
                print(f"Transliteration: {h3.get('transliteration')}")
                
                notes = h3.get('notes', {})
                if 'etymology' in notes:
                    etym = notes['etymology']
                    print(f"✨ Etymology Type: {etym.get('type')}")
                    refs = etym.get('references', [])
                    if refs:
                        ref = refs[0]
                        print(f"✨ References: {ref.get('lemma')} ({ref.get('transliteration')})")
                
        # Test Hebrew search
        print("\n=== Testing Hebrew Search ===")
        response = requests.get("http://localhost:5001/api/hebrew-search?query=אב", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Hebrew search returned {len(data)} results")
        else:
            print(f"❌ Hebrew search failed: {response.status_code}")
        
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed - Flask app may not be running")
    except Exception as e:
        print(f"❌ Test error: {e}")

if __name__ == '__main__':
    test_strongs_api()