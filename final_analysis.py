#!/usr/bin/env python3

# Simple script to find useState declarations in the Dashboard function

with open('src/routes/index.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the Dashboard function
in_dashboard = False
dash_line = None
for i, line in enumerate(lines):
    if 'function Dashboard()' in line:
        in_dashboard = True
        dash_line = i
        print(f"Dashboard() starts at line {i+1}")
        break

# Extract useState declarations and JavaScript variable usage
usestates = []
jsx_vars = []

if in_dashboard and dash_line is not None:
    # Look for useState declarations in the first ~50 lines after Dashboard
    for i in range(dash_line + 1, min(dash_line + 60, len(lines))):
        line = lines[i].strip()
        if 'useState' in line and ('=>' in line or ';' in line):
            usestates.append((i+1, line))
    
    # Look for variable usage in the rest of the file
    for i in range(dash_line + 1, len(lines)):
        line = lines[i].strip()
        # Look for {variable} patterns
        import re
        vars = re.findall(r'{(\w+)(?:\.|\?)?}', line)
        # Also look for prop={variable} patterns
        props = re.findall(r'(\w+)={(\w+)(?:\.|\?)?}', line)
        
        for var in vars:
            if var not in ['key', 'className', 'value', 'style', 'disabled', 'title', 'htmlFor', 'type', 'readOnly', 'placeholder', 'id', 'for', 'children']:
                jsx_vars.append((i+1, var, line))
        
        for prop_var, prop_val in props:
            jsx_vars.append((i+1, prop_val, line))

# Print analysis
print(f"\n=== useState DECLARATIONS FOUND ===")
for line_num, useline in usestates:
    print(f"  Line {line_num}: {useline}")

print(f"\n=== VARIABLES USED IN JSX ===")
for line_num, varname, varline in jsx_vars:
    print(f"  Line {line_num}: {varname}")

# Extract state variable names
state_vars = []
for _, useline in usestates:
    # Extract from useState lines like "const [variable, setVariable] = useState(...)"
    match = re.search(r'const \[(\w+),\s*\w+\] = useState<[^>]+>', useline)
    if match:
        state_vars.extend(match.group(1).split(', '))

print(f"\n=== STATE VARIABLES DECLARED: {state_vars} ===")

# Get all variables used
used_vars = list(set([v for _, v, _ in jsx_vars]))

print(f"\n=== VARIABLES USED IN JSX: {used_vars} ===")

# Find missing
missing_vars = []
for var in used_vars:
    if var not in state_vars:
        missing_vars.append(var)

print(f"\n=== MISSING useState DECLARATIONS: {missing_vars} ===")
for var in missing_vars:
    print(f"  Need to add: const [{var}, set{var.capitalize()}] = useState(...)")

print(f"\n=== SUMMARY ===")
print(f"useStates declared: {len(state_vars)}")
print(f"Variables used in JSX: {len(used_vars)}")
print(f"Missing useStates: {len(missing_vars)}")

if missing_vars:
    print(f"\n⚠️  The Dashboard component is missing useState declarations for: {', '.join(missing_vars)}")
else:
    print(f"\n✓ All variables used in JSX have corresponding useState declarations.")

# Check for specific variables of interest
print(f"\n=== SPECIFIC CHECK ===")
if 'chartTab' in used_vars and 'chartTab' not in state_vars:
    print(f"❌ chartTab is used in JSX but missing useState")
if 'modalOpen' in used_vars and 'modalOpen' not in state_vars:
    print(f"❌ modalOpen is used in JSX but missing useState")
if 'now' in used_vars and 'now' not in state_vars:
    print(f"❌ now is used in JSX but missing useState")
if 'seconds' in used_vars and 'seconds' not in state_vars:
    print(f"❌ seconds is used in JSX but missing useState")
if 'active' in used_vars and 'active' not in state_vars:
    print(f"❌ active is used in JSX but missing useState")
if 'tf' in used_vars and 'tf' not in state_vars:
    print(f"❌ tf is used in JSX but missing useState")
