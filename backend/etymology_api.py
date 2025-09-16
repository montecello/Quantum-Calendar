#!/usr/bin/env python3
"""
Etymology Chain API
Builds complete etymological trees from Strong's numbers back to primitive roots
"""

from flask import request, jsonify
import requests
from typing import List, Dict, Optional, Any

def build_etymology_chain(start_num: int, max_depth: int = 10) -> List[Dict[str, Any]]:
    """
    Build etymological chain starting from a Strong's number
    Returns list of entries from start_num to primitive root
    """
    chain = []
    current_num = start_num
    depth = 0
    
    while current_num and depth < max_depth:
        # Get Strong's data from our existing API
        try:
            response = requests.get(f'http://localhost:5001/api/strongs-data?query=H{current_num}')
            if response.status_code != 200:
                break
                
            data = response.json()
            if not data or len(data) == 0:
                break
                
            entry = data[0]  # API returns a list directly
        except Exception as e:
            print(f"Error fetching H{current_num}: {e}")
            break
            
        etymology = entry.get('notes', {}).get('etymology', {})
        chain_entry = {
            'strongsNumber': entry.get('strongsNumber'),
            'word': entry.get('word'),
            'lemma': entry.get('lemma'),
            'transliteration': entry.get('transliteration'),
            'partOfSpeech': entry.get('partOfSpeech'),
            'morphology': entry.get('morphology'),
            'definitions': entry.get('definitions', []),
            'etymology': {
                'type': etymology.get('type'),
                'description': etymology.get('description'),
                'references': etymology.get('references', [])
            },
            'explanation': entry.get('notes', {}).get('explanation'),
            'greekReferences': entry.get('greekReferences', [])
        }
        
        chain.append(chain_entry)
        
        # Check if this is a primitive root
        if etymology.get('type') == 'primitive':
            break
            
        # Look for src reference to continue the chain
        references = etymology.get('references', [])
        next_num = None
        for ref in references:
            if ref.get('src'):
                try:
                    next_num = int(ref['src'])
                    break
                except (ValueError, TypeError):
                    continue
                    
        if not next_num:
            break
            
        current_num = next_num
        depth += 1
    
    return chain

def etymology_chain_handler():
    """Handle etymology chain API requests"""
    strongs_num = request.args.get('strongs')
    if not strongs_num:
        return jsonify({'error': 'Missing strongs parameter'}), 400
    
    # Remove H prefix if present
    if strongs_num.startswith('H'):
        strongs_num = strongs_num[1:]
    
    try:
        start_num = int(strongs_num)
    except ValueError:
        return jsonify({'error': 'Invalid Strong\'s number format'}), 400
    
    # Get max_depth parameter (optional)
    max_depth = request.args.get('max_depth', 10)
    try:
        max_depth = int(max_depth)
        if max_depth < 1 or max_depth > 20:
            max_depth = 10
    except ValueError:
        max_depth = 10
    
    # Build the chain
    try:
        chain = build_etymology_chain(start_num, max_depth)
        
        if not chain:
            return jsonify({'error': f'No data found for H{start_num}'}), 404
        
        # Add chain metadata
        result = {
            'startingWord': f'H{start_num}',
            'chainLength': len(chain),
            'reachedPrimitive': chain[-1]['etymology']['type'] == 'primitive' if chain else False,
            'chain': chain
        }
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': f'Error building etymology chain: {str(e)}'}), 500