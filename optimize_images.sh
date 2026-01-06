#!/bin/bash
# Image optimization script for how_it_works page
# Compresses PNGs and creates WebP versions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Image Optimization Script ===${NC}"

# Change to image directory
cd "$(dirname "$0")/frontend/static/img"

# Check if cwebp is installed
if ! command -v cwebp &> /dev/null; then
    echo -e "${RED}Error: cwebp not found. Install with: brew install webp${NC}"
    exit 1
fi

echo -e "${GREEN}Using cwebp for optimization${NC}"

# Function to get file size in human readable format
get_size() {
    ls -lh "$1" | awk '{print $5}'
}

# Create backup directory
BACKUP_DIR="./img_backup_$(date +%Y%m%d_%H%M%S)"
echo -e "${YELLOW}Creating backup in $BACKUP_DIR${NC}"
mkdir -p "$BACKUP_DIR"

# Track total savings
ORIGINAL_TOTAL=0
COMPRESSED_TOTAL=0

# Process PNG files in specific directories
DIRS="intro day month/crescent month/dark month/full special"

for dir in $DIRS; do
    if [ -d "$dir" ]; then
        echo -e "\n${GREEN}Processing $dir...${NC}"
        
        for file in "$dir"/*.png; do
            if [ -f "$file" ]; then
                # Get original size
                ORIG_SIZE=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
                ORIG_SIZE_HR=$(get_size "$file")
                ORIGINAL_TOTAL=$((ORIGINAL_TOTAL + ORIG_SIZE))
                
                # Backup original
                mkdir -p "$BACKUP_DIR/$dir"
                cp "$file" "$BACKUP_DIR/$file"
                
                echo -e "  ${YELLOW}→${NC} $(basename "$file") (${ORIG_SIZE_HR})"
                
                # Note: Skipping pngquant (not installed), creating WebP only
                COMP_SIZE=$ORIG_SIZE
                COMP_SIZE_HR=$ORIG_SIZE_HR
                COMPRESSED_TOTAL=$((COMPRESSED_TOTAL + COMP_SIZE))
                
                # Calculate savings vs original for WebP
                SAVED=$((ORIG_SIZE - COMP_SIZE))
                PERCENT=0
                
                echo -e "    PNG: ${ORIG_SIZE_HR} (unchanged)"
                
                # Create WebP version
                WEBP_FILE="${file%.png}.webp"
                cwebp -q 85 "$file" -o "$WEBP_FILE" -quiet
                
                WEBP_SIZE=$(stat -f%z "$WEBP_FILE" 2>/dev/null || stat -c%s "$WEBP_FILE" 2>/dev/null)
                WEBP_SIZE_HR=$(get_size "$WEBP_FILE")
                WEBP_PERCENT=$((100 - (WEBP_SIZE * 100 / ORIG_SIZE)))
                
                echo -e "    WebP: ${WEBP_SIZE_HR} ${GREEN}(saved ${WEBP_PERCENT}% vs original)${NC}"
            fi
        done
    fi
done

# Also process other standalone images
for file in no.png grid.png spica.png snowglobe.png virgo.png zoom.png; do
    if [ -f "$file" ]; then
        ORIG_SIZE=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
        ORIG_SIZE_HR=$(get_size "$file")
        ORIGINAL_TOTAL=$((ORIGINAL_TOTAL + ORIG_SIZE))
        
        cp "$file" "$BACKUP_DIR/$file"
        
        echo -e "\n${YELLOW}→${NC} $file (${ORIG_SIZE_HR})"
        
        pngquant --quality=75-90 --ext .png --force "$file" 2>/dev/null || echo "  pngquant skipped"
        
        COMP_SIZE=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
        COMP_SIZE_HR=$(get_size "$file")
        COMPRESSED_TOTAL=$((COMPRESSED_TOTAL + COMP_SIZE))
        
        PERCENT=$((100 - (COMP_SIZE * 100 / ORIG_SIZE)))
        echo -e "  PNG: ${ORIG_SIZE_HR} → ${COMP_SIZE_HR} ${GREEN}(saved ${PERCENT}%)${NC}"
        
        WEBP_FILE="${file%.png}.webp"
        cwebp -q 85 "$file" -o "$WEBP_FILE" -quiet
        
        WEBP_SIZE=$(stat -f%z "$WEBP_FILE" 2>/dev/null || stat -c%s "$WEBP_FILE" 2>/dev/null)
        WEBP_SIZE_HR=$(get_size "$WEBP_FILE")
        WEBP_PERCENT=$((100 - (WEBP_SIZE * 100 / ORIG_SIZE)))
        
        echo -e "  WebP: ${WEBP_SIZE_HR} ${GREEN}(saved ${WEBP_PERCENT}% vs original)${NC}"
    fi
done

# Calculate total savings
TOTAL_SAVED=$((ORIGINAL_TOTAL - COMPRESSED_TOTAL))
TOTAL_PERCENT=$((100 - (COMPRESSED_TOTAL * 100 / ORIGINAL_TOTAL)))

# Convert to MB
ORIG_MB=$(echo "scale=2; $ORIGINAL_TOTAL / 1048576" | bc)
COMP_MB=$(echo "scale=2; $COMPRESSED_TOTAL / 1048576" | bc)
SAVED_MB=$(echo "scale=2; $TOTAL_SAVED / 1048576" | bc)

echo -e "\n${GREEN}=== Summary ===${NC}"
echo -e "Original total: ${ORIG_MB}MB"
echo -e "Compressed total: ${COMP_MB}MB"
echo -e "${GREEN}Total saved: ${SAVED_MB}MB (${TOTAL_PERCENT}%)${NC}"
echo -e "\n${YELLOW}Backup saved in: $BACKUP_DIR${NC}"
echo -e "${GREEN}WebP versions created for all images${NC}"
echo -e "\n${YELLOW}Next step: Update HTML to use WebP with PNG fallback${NC}"

exit 0
