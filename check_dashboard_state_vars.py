#!/usr/bin/env python3

# Simple analysis of Dashboard function for missing useStates

with open('src/routes/index.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the Dashboard function
dash_start_line = None
usestates = []
jsx_variables = []
prop_variables = []
in_function_body = False
in_return = False

for i, line in enumerate(lines):
    stripped = line.strip()
    
    # Find Dashboard function start
    if 'function Dashboard()' in stripped:
        in_function_body = True
        print(f"Dashboard() starts at line {i+1}")
        continue
    
    if in_function_body:
        # Track useState declarations
        if 'useState' in stripped and ('=>' in stripped or ';' in stripped):
            usestates.append((i+1, stripped))
            print(f"  useState at line {i+1}: {stripped}")
        
        # Track return statement
        if 'return (' in stripped:
            in_return = True
            print(f"  return starts at line {i+1}")
        
        # If in return, look for variable usage patterns
        if in_return:
            # Look for {variable} patterns
            import re
            # Simple pattern to find variable names between braces
            braces = re.findall(r'{(\w+)(?:\.|\?)?}', stripped)
            for var in braces:
                # Skip common JSX attributes that aren't state variables
                if var not in ['key', 'className', 'value', 'style', 'disabled', 'title', 'htmlFor', 'type', 'readOnly', 'placeholder', 'id', 'for']:
                    if (i+1, var) not in jsx_variables:
                        jsx_variables.append((i+1, var, stripped))
            
            # Look for prop={variable} patterns
            prop_matches = re.findall(r'(\w+)={\s*(\w+)(?:\.|\?)?\s*}', stripped)
            for prop_name, prop_val in prop_matches:
                if (i+1, prop_val) not in prop_variables:
                    prop_variables.append((i+1, prop_name, prop_val, stripped))

# Print analysis
print(f"\n=== ANALYSIS RESULTS ===")
print(f"Total useStates: {len(usestates)}")
print(f"JSX variable usage: {len(jsx_variables)}")
print(f"Prop variable usage: {len(prop_variables)}")

# Extract state variable names from useStates
state_var_names = []
for line_num, useline in usestates:
    # Extract variable names from useState lines
    match = re.search(r'const \[(\w+),\s*\w+\] = useState<[^>]+>', useline)
    if match:
        state_var_names.extend(match.group(1).split(', '))
    else:
        match = re.search(r'const \[(\w+)\s*,', useline)
        if match:
            state_var_names.append(match.group(1))

print(f"\n=== STATE VARIABLE NAMES ===")
for var in state_var_names:
    print(f"  {var}")

# Get all variables used in JSX
jsx_var_names = list(set([v[1] for v in jsx_variables]))
prop_var_names = list(set([p[2] for p in prop_variables]))
all_used_vars = list(set(jsx_var_names + prop_var_names))

print(f"\n=== ALL VARIABLES USED IN JSX ===")
for var in all_used_vars:
    print(f"  {var}")

# Find missing useStates
missing_vars = []
for var in all_used_vars:
    if var not in state_var_names:
        missing_vars.append(var)

print(f"\n=== MISSING useState DECLARATIONS ===")
for var in missing_vars:
    print(f"  {var}")

print(f"\n=== SUMMARY ===")
print(f"useStates declared: {len(state_var_names)}")
print(f"Variables used in JSX: {len(all_used_vars)}")
print(f"Missing useStates: {len(missing_vars)}")
print(f"Recommendation: Add {len(missing_vars)} missing useState declarations")
