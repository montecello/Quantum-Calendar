#!/usr/bin/env python3
"""
Debug script to check contact form submissions in MongoDB
"""

import os
from pymongo import MongoClient

def load_env():
    """Load environment variables from .env file"""
    try:
        with open('.env', 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip().strip('"').strip("'")
                    os.environ[key] = value
    except FileNotFoundError:
        print("⚠️ .env file not found")

def check_contact_data():
    print("🔍 Debugging Contact Form Data in MongoDB")
    print("=" * 50)
    
    # Load environment variables
    load_env()
    
    # Get MongoDB URI from environment
    MONGODB_URI = os.environ.get('MONGODB_URI') or os.environ.get('DATABASE_URL')
    DATABASE_NAME = os.getenv("DATABASE_NAME", "quantum-calendar")
    
    if not MONGODB_URI:
        print("❌ MONGODB_URI not found in environment variables")
        print("Available environment variables with 'MONGO' or 'DATABASE':")
        for key in os.environ:
            if 'MONGO' in key.upper() or 'DATABASE' in key.upper():
                print(f"  {key}")
        return
    
    # Connection info
    print(f"📊 Database: {DATABASE_NAME}")
    print(f"📁 Collection: contact")
    print(f"🔗 MongoDB URI: {MONGODB_URI[:50]}...")
    print()
    
    try:
        # Connect to MongoDB
        print("🔄 Connecting to MongoDB...")
        client = MongoClient(
            MONGODB_URI,
            serverSelectionTimeoutMS=10000,
            connectTimeoutMS=10000,
            socketTimeoutMS=10000
        )
        
        # Test connection
        client.admin.command('ping')
        print("✅ Connected successfully!")
        
        # Get database and collection
        db = client[DATABASE_NAME]
        contact_collection = db['contact']
        
        # Count total documents
        total_count = contact_collection.count_documents({})
        print(f"📈 Total documents in 'contact' collection: {total_count}")
        
        if total_count > 0:
            print("\n📄 Recent contact submissions:")
            print("-" * 40)
            
            # Get recent submissions (last 10)
            recent_docs = contact_collection.find().sort("created_at", -1).limit(10)
            
            for i, doc in enumerate(recent_docs, 1):
                print(f"{i}. ID: {doc['_id']}")
                print(f"   Name: {doc.get('name', 'N/A')}")
                print(f"   Email: {doc.get('email', 'N/A')}")
                print(f"   Created: {doc.get('created_at', 'N/A')}")
                print(f"   Message: {doc.get('message', 'N/A')[:50]}...")
                print()
        else:
            print("❌ No documents found in 'contact' collection")
            
            # Check if collection exists
            collections = db.list_collection_names()
            print(f"🗂️  Available collections in '{DATABASE_NAME}': {collections}")
            
            # Check other databases
            print(f"🗃️  Available databases: {client.list_database_names()}")
        
    except Exception as e:
        print(f"💥 Error: {e}")
        
    finally:
        if 'client' in locals():
            client.close()
            print("🔐 Connection closed")

if __name__ == "__main__":
    check_contact_data()