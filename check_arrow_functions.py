#!/usr/bin/env python3

# Check the src/routes/index.tsx file for ArrowUp/ArrowDown function declarations

with open('src/routes/index.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Check for ArrowUp and ArrowDown function declarations
import re

# Find all function declarations for ArrowUp and ArrowDown
function_declarations = re.findall(r'^function (ArrowUp|ArrowDown)', content, re.MULTILINE)
print(f'Found function declarations: {function_declarations}')

# Find all function declarations with their line numbers
lines = content.split('\n')
function_lines = []
for i, line in enumerate(lines, 1):
    if 'function ArrowUp' in line or 'function ArrowDown' in line:
        function_lines.append((i, line.strip()))

print('\nFunction declarations:')
for line_num, line in function_lines:
    print(f'  Line {line_num}: {line}')

# If we have more than 2 declaration total (one ArrowUp, one ArrowDown)
if len(function_lines) > 2:
    print(f'\nERROR: {len(function_lines)} duplicate declarations found!')
    print('This should not happen. File should have at most 2 function declarations (ArrowUp and ArrowDown).')
elif len(function_lines) == 2:
    print('\nOK: Exactly 2 function declarations found (ArrowUp and ArrowDown)')
elif len(function_lines) == 0:
    print('\nWARNING: No ArrowUp or ArrowDown function declarations found in file')
    print('But they are imported from lucide-react. If used in JSX, they should use the imported version.')

# Check if ArrowUp or ArrowDown are used in the JSX part
if 'ArrowUp' in content:
    print('ArrowUp is referenced in the file')
if 'ArrowDown' in content:
    print('ArrowDown is referenced in the file')

# Determine if local functions are needed or if we should use the imported ones
# Look for ArrowUp or ArrowDown usage in JSX (like <ArrowUp> or <ArrowDown>)
if re.search(r'<ArrowUp\s*\/', content) or re.search(r'<ArrowDown\s*\/', content):
    print('\nArrowUp/ArrowDown are used in JSX. Local functions are needed.')
else:
    print('\nArrowUp/ArrowDown are NOT used in JSX. Should use the imported versions instead.')
    print('This might mean they were accidentally added as local functions.')
