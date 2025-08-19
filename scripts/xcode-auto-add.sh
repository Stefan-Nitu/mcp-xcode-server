#!/bin/bash

# Claude Code Hook Script: Auto-add Swift files to Xcode projects
# This script is triggered by PostToolUse hooks when Write or Edit tools are used
# 
# Usage: Configure in Claude Code settings.json:
# {
#   "hooks": {
#     "PostToolUse": {
#       "Write|Edit": "$CLAUDE_PROJECT_DIR/scripts/xcode-auto-add.sh"
#     }
#   }
# }

# Get the file path from Claude Code environment
# The CLAUDE_TOOL_OUTPUT contains the tool's output including the file path
FILE_PATH=$(echo "$CLAUDE_TOOL_OUTPUT" | grep -oE "File (created|updated) successfully at: (.*)" | sed 's/File .* successfully at: //')

# Exit if no file path found
if [ -z "$FILE_PATH" ]; then
    exit 0
fi

# Only process Swift files
if [[ ! "$FILE_PATH" =~ \.swift$ ]]; then
    exit 0
fi

# Find the nearest .xcodeproj file
find_xcodeproj() {
    local dir="$1"
    local max_levels=10
    local level=0
    
    while [ $level -lt $max_levels ]; do
        # Look for .xcodeproj in current directory
        for proj in "$dir"/*.xcodeproj; do
            if [ -d "$proj" ] && [ -f "$proj/project.pbxproj" ]; then
                echo "$proj"
                return 0
            fi
        done
        
        # Move up one directory
        parent_dir=$(dirname "$dir")
        if [ "$parent_dir" = "$dir" ]; then
            break
        fi
        dir="$parent_dir"
        ((level++))
    done
    
    return 1
}

# Get the directory of the Swift file
FILE_DIR=$(dirname "$FILE_PATH")

# Find the nearest Xcode project
XCODE_PROJECT=$(find_xcodeproj "$FILE_DIR")

if [ -z "$XCODE_PROJECT" ]; then
    echo "No Xcode project found for $FILE_PATH"
    exit 0
fi

# Extract target name from project name
TARGET_NAME=$(basename "$XCODE_PROJECT" .xcodeproj)

# Determine group path based on file location
PROJECT_DIR=$(dirname "$XCODE_PROJECT")
RELATIVE_DIR=$(python3 -c "import os.path; print(os.path.relpath('$FILE_DIR', '$PROJECT_DIR'))")

# Build group path
if [[ "$RELATIVE_DIR" == "$TARGET_NAME"* ]]; then
    GROUP_PATH="$TARGET_NAME"
elif [[ "$RELATIVE_DIR" == "." ]]; then
    GROUP_PATH="$TARGET_NAME"
else
    GROUP_PATH="$TARGET_NAME/$RELATIVE_DIR"
fi

echo "Auto-adding $FILE_PATH to Xcode project..."
echo "  Project: $XCODE_PROJECT"
echo "  Target: $TARGET_NAME"
echo "  Group: $GROUP_PATH"

# Use claude to call the modify_project MCP tool
# This assumes claude command is available and the MCP server is running
claude code --no-interactive <<EOF
Use the modify_project tool to add the file '$FILE_PATH' to the Xcode project at '$XCODE_PROJECT' for target '$TARGET_NAME' in group '$GROUP_PATH'.
EOF

echo "Done!"