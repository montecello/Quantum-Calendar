#!/usr/bin/env python3
"""
Test script to verify MongoDB Atlas connection and data access
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

try:
    from pymongo import MongoClient
    from config import MONGODB_URI, DATABASE_NAME, STRONG_COLLECTION, KJV_COLLECTION

    def test_mongodb_connection():
        print("🔍 Testing MongoDB Atlas connection...")

        if not MONGODB_URI:
            print("❌ MONGODB_URI not found in environment variables")
            print("   Please update your .env file with the correct MongoDB connection string")
            return False

        try:
            # Connect to MongoDB
            client = MongoClient(MONGODB_URI)
            db = client[DATABASE_NAME]

            print("✅ Connected to MongoDB Atlas successfully!")

            # Test Strong's collection
            strong_collection = db[STRONG_COLLECTION]
            strong_count = strong_collection.count_documents({})
            print(f"📚 Strong's collection: {strong_count} entries")

            if strong_count > 0:
                # Show sample entry
                sample_strong = strong_collection.find_one({}, {'_id': 0})
                print(f"   Sample entry: H{sample_strong.get('strongsNumber', 'N/A')} - {sample_strong.get('word', 'N/A')}")

            # Test KJV collection
            kjv_collection = db[KJV_COLLECTION]
            kjv_count = kjv_collection.count_documents({})
            print(f"📖 KJV collection: {kjv_count} verses")

            if kjv_count > 0:
                # Show sample verse
                sample_verse = kjv_collection.find_one({}, {'_id': 0})
                print(f"   Sample verse: {sample_verse.get('book', 'N/A')} {sample_verse.get('chapter', 'N/A')}:{sample_verse.get('verse', 'N/A')}")

            client.close()
            print("✅ MongoDB connection test completed successfully!")
            return True

        except Exception as e:
            print(f"❌ MongoDB connection failed: {e}")
            print("   Please check your MONGODB_URI in the .env file")
            return False

    if __name__ == "__main__":
        test_mongodb_connection()

except ImportError:
    print("❌ pymongo not installed. Run: pip install pymongo")