#!/usr/bin/env python3

# Find all useState declarations and JSX variable usage in Dashboard function

with open('src/routes/index.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find Dashboard function
in_dashboard = False
dash_start = None
usestates = []
jsx_vars = []
prop_vars = []
jsx_return_started = False

# Parse the file
for i, line in enumerate(lines):
    stripped = line.strip()
    line_num = i + 1
    
    # Check if this line contains Dashboard function start or return statement
    if 'function Dashboard()' in stripped:
        in_dashboard = True
        dash_start = i
        print(f"Dashboard() function starts at line {line_num}")
        continue
    
    if in_dashboard:
        # Track useState declarations
        if 'useState' in stripped and ('=>' in stripped or ';' in stripped):
            usestates.append((line_num, stripped))
        
        # Track jsx return statement
        if 'return (' in stripped:
            jsx_return_started = True
            print(f"JSX return starts at line {line_num}")
        
        # If we are in the JSX return part, look for variable usage
        if jsx_return_started:
            # Find single braces {} in JSX
            import re
            # Match {...varName} or prop={varName}
            braces = re.findall(r'{(\w+)(?:\.|\?)?\}', stripped)
            for var in braces:
                # Skip common JSX attributes that aren't state vars
                if var not in ['key', 'className', 'href', 'value', 'title', 'htmlFor', 'type', 'disabled', 'checked', 'readOnly', 'placeholder', 'style']:
                    if (line_num, var) not in jsx_vars:
                        jsx_vars.append((line_num, var, stripped))
            
            # Also check for prop={var} patterns using different regex
            prop_pattern = r'(\w+)={(\w+)(?:\.|\?)?}'
            matches = re.findall(prop_pattern, stripped)
            for prop_var, val_var in matches:
                # We care about val_var which is the actual state variable
                if (line_num, val_var) not in jsx_vars:
                    jsx_vars.append((line_num, val_var, stripped))
        
        # Check for prop usage (passed to child components)
        prop_matches = re.findall(r'(\w+)\s*=\s*{\s*(\w+)\s*\}', stripped)
        for prop_name, prop_val in prop_matches:
            prop_vars.append((line_num, prop_name, prop_val, stripped))

print(f"\\n=== useState Declarations Found ===")
for line_num, useline in usestates:
    print(f"  Line {line_num}: {useline}")

print(f"\\n=== Variables Used in JSX Props ===")
for line_num, prop_name, prop_val, varline in prop_vars:
    print(f"  Line {line_num}: {prop_name}={{{prop_val}}} in '{varline}'")

print(f"\\n=== Variables Used in JSX Content ===")
for line_num, varname, varline in jsx_vars:
    print(f"  Line {line_num}: {varname} in '{varline}'")

print(f"\\n=== Analysis ===")
print(f"Total useStates: {len(usestates)}")
print(f"Variables in JSX props: {len(prop_vars)}")
print(f"Variables in JSX content: {len(jsx_vars)}")

# Extract state variable names from useStates
state_vars = []
for _, useline in usestates:
    match = re.search(r'const (\[\w+,\s*\w+\])', useline)
    if match:
        state_vars.extend(match.group(1).strip('[]').split(', '))
    else:
        match = re.search(r'const \[(\w+)\s*,', useline)
        if match:
            state_vars.append(match.group(1))

print(f"\\n=== State Variables Found ===")
for var in state_vars:
    print(f"  {var}")

print(f"\\n=== Missing State Variables (used in JSX but not declared) ===")
used_vars = [v for _, v, _ in jsx_vars] + [p for _, _, p, _ in prop_vars]
missing_vars = []
for var in used_vars:
    if var not in state_vars:
        missing_vars.append(var)

for var in missing_vars:
    print(f"  {var}")

if len(missing_vars) > 0:
    print(f"\\n=== Required useState for missing vars ===")
    for var in missing_vars:
        print(f"  const [{var}, set{var.capitalize()}] = useState<type>('')  (remplace 'type' with actual type)")
