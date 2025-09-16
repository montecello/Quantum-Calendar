#!/usr/bin/env python3
"""
Update MongoDB with Enhanced Strong's Data
Replaces the existing strongs collection with comprehensive data from enhanced_strongs.json
"""

import json
import os
import sys
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure

def connect_to_mongodb():
    """Connect to MongoDB Atlas using the same approach as the main app"""
    
    try:
        # Import pymongo from the same environment the app uses
        from pymongo import MongoClient
        
        # Get configuration from the same config file the app uses
        from config import MONGODB_URI, DATABASE_NAME
        
        if not MONGODB_URI:
            print("❌ MONGODB_URI not configured in config.py")
            return None
        
        print(f"🔗 Connecting to MongoDB...")
        client = MongoClient(MONGODB_URI)
        
        # Test the connection
        client.admin.command('ping')
        print("✅ MongoDB connection successful")
        
        return client
        
    except ImportError as e:
        print(f"❌ PyMongo not available: {e}")
        return None
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        return None

def load_enhanced_data(file_path):
    """Load the enhanced Strong's data from JSON file"""
    
    try:
        print(f"📁 Loading enhanced data from {file_path}...")
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"✅ Loaded {len(data)} entries")
        return data
    
    except FileNotFoundError:
        print(f"❌ File not found: {file_path}")
        return None
    except json.JSONDecodeError as e:
        print(f"❌ JSON decode error: {e}")
        return None

def backup_existing_collection(db, collection_name):
    """Create a backup of the existing collection"""
    
    try:
        existing_count = db[collection_name].count_documents({})
        print(f"📋 Current collection has {existing_count} documents")
        
        if existing_count > 0:
            backup_name = f"{collection_name}_backup"
            print(f"💾 Creating backup as '{backup_name}'...")
            
            # Drop existing backup if it exists
            db[backup_name].drop()
            
            # Copy to backup
            pipeline = [{"$out": backup_name}]
            db[collection_name].aggregate(pipeline)
            
            backup_count = db[backup_name].count_documents({})
            print(f"✅ Backup created with {backup_count} documents")
            return True
        else:
            print("⚠️ No existing data to backup")
            return True
            
    except Exception as e:
        print(f"❌ Backup failed: {e}")
        return False

def update_strongs_collection(db, collection_name, enhanced_data):
    """Replace the strongs collection with enhanced data"""
    
    try:
        # Clear the existing collection
        print(f"🗑️ Clearing existing '{collection_name}' collection...")
        db[collection_name].drop()
        
        # Insert enhanced data
        print(f"📥 Inserting {len(enhanced_data)} enhanced entries...")
        
        # Insert in batches for better performance
        batch_size = 500
        for i in range(0, len(enhanced_data), batch_size):
            batch = enhanced_data[i:i + batch_size]
            db[collection_name].insert_many(batch)
            print(f"   Inserted batch {i//batch_size + 1}/{(len(enhanced_data) + batch_size - 1)//batch_size}")
        
        # Verify the insertion
        final_count = db[collection_name].count_documents({})
        print(f"✅ Successfully inserted {final_count} documents")
        
        # Create indexes for better performance
        print("🔍 Creating indexes...")
        db[collection_name].create_index("strongsNumber")
        db[collection_name].create_index("word")
        db[collection_name].create_index("transliteration")
        print("✅ Indexes created")
        
        return True
        
    except Exception as e:
        print(f"❌ Update failed: {e}")
        return False

def verify_enhanced_data(db, collection_name):
    """Verify the enhanced data is properly loaded"""
    
    try:
        print("\n🔍 Verifying enhanced data...")
        
        # Check total count
        total_count = db[collection_name].count_documents({})
        print(f"Total documents: {total_count}")
        
        # Check for etymology data
        etymology_count = db[collection_name].count_documents({"notes.etymology": {"$exists": True}})
        print(f"Documents with etymology: {etymology_count}")
        
        # Check for Greek references
        greek_count = db[collection_name].count_documents({"greekReferences": {"$exists": True, "$ne": []}})
        print(f"Documents with Greek references: {greek_count}")
        
        # Sample a few entries
        print("\n📋 Sample entries:")
        
        # H1 (primitive)
        h1 = db[collection_name].find_one({"strongsNumber": 1})
        if h1:
            print(f"H1: {h1.get('word')} - {h1.get('notes', {}).get('etymology', {}).get('type')}")
        
        # H3 (derived)
        h3 = db[collection_name].find_one({"strongsNumber": 3})
        if h3:
            print(f"H3: {h3.get('word')} - {h3.get('notes', {}).get('etymology', {}).get('type')}")
            refs = h3.get('notes', {}).get('etymology', {}).get('references', [])
            if refs:
                print(f"    References: {refs[0].get('lemma')} ({refs[0].get('transliteration')})")
        
        return True
        
    except Exception as e:
        print(f"❌ Verification failed: {e}")
        return False

def main():
    """Main function to update MongoDB with enhanced Strong's data"""
    
    print("🚀 Starting MongoDB update with enhanced Strong's data...")
    
    # File paths
    enhanced_file = '/Users/m/calendar.heyyou.eth/Quantum-Calendar/backend/data/enhanced_strongs.json'
    
    # Load enhanced data
    enhanced_data = load_enhanced_data(enhanced_file)
    if not enhanced_data:
        return
    
    # Connect to MongoDB
    client = connect_to_mongodb()
    if not client:
        return
    
    try:
        # Select database and collection
        from config import DATABASE_NAME, STRONG_COLLECTION
        db = client[DATABASE_NAME]
        collection_name = STRONG_COLLECTION
        
        print(f"🔗 Connected to database: {db.name}")
        print(f"📊 Target collection: {collection_name}")
        
        # Backup existing collection
        if not backup_existing_collection(db, collection_name):
            print("❌ Backup failed, aborting update")
            return
        
        # Update with enhanced data
        if not update_strongs_collection(db, collection_name, enhanced_data):
            print("❌ Update failed")
            return
        
        # Verify the update
        if not verify_enhanced_data(db, collection_name):
            print("❌ Verification failed")
            return
        
        print("\n🎉 MongoDB update completed successfully!")
        print("✨ Your Strong's collection now includes:")
        print("   - Complete etymology information with references")
        print("   - Greek cross-references")
        print("   - Enhanced explanations with formatting")
        print("   - Full morphological data")
        
    finally:
        client.close()

if __name__ == '__main__':
    main()