#!/usr/bin/env python3
"""
Test script to verify MongoDB Atlas connection and data access
"""
import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("⚠️  python-dotenv not installed, trying without .env file")

from pymongo import MongoClient
from config import MONGODB_URI, DATABASE_NAME, STRONG_COLLECTION, KJV_COLLECTION

def test_mongodb_connection():
    print("🔍 Testing MongoDB Atlas connection...")

    if not MONGODB_URI:
        print("❌ MONGODB_URI not found in environment variables")
        return False

    try:
        # Connect to MongoDB
        client = MongoClient(MONGODB_URI)
        db = client[DATABASE_NAME]

        # List all databases
        databases = client.list_database_names()
        print(f"📋 Available databases: {databases}")

        # Check if our target database exists
        if DATABASE_NAME not in databases:
            print(f"⚠️  Target database '{DATABASE_NAME}' not found!")
            print("� Available databases:", databases)
        else:
            print(f"✅ Target database '{DATABASE_NAME}' found")

        # Test Strong's collection
        strongs_collection = db[STRONG_COLLECTION]
        strongs_count = strongs_collection.count_documents({})
        print(f"✅ Strong's collection '{STRONG_COLLECTION}': {strongs_count} documents")

        # Sample Strong's query
        sample_strongs = strongs_collection.find_one({"strongsNumber": 1})
        if sample_strongs:
            print(f"✅ Sample Strong's entry: H{sample_strongs['strongsNumber']} - {sample_strongs['word']}")
        else:
            print("❌ No Strong's data found")

        # Test KJV collection
        kjv_collection = db[KJV_COLLECTION]
        kjv_count = kjv_collection.count_documents({})
        print(f"✅ KJV collection: {kjv_count} documents")

        # Sample KJV query
        sample_kjv = kjv_collection.find_one({"book": "Genesis", "chapter": 1, "verse": 1})
        if sample_kjv:
            print(f"✅ Sample KJV verse: {sample_kjv['book']} {sample_kjv['chapter']}:{sample_kjv['verse']}")
        else:
            print("❌ No KJV data found")

        client.close()
        print("✅ MongoDB connection test completed successfully!")
        return True

    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")
        return False

if __name__ == "__main__":
    success = test_mongodb_connection()
    sys.exit(0 if success else 1)
