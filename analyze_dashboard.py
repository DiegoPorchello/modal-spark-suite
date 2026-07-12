#!/usr/bin/env python3

# Simple analysis of Dashboard function for missing state variables

with open('src/routes/index.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the Dashboard function - extract everything between function Dashboard() and next function

# Find useState declarations in the file
import re

# Extract all useState declarations
usestates = re.findall(r'const (\[\w+,\s*\w+\]) = useState<[^>]+>', content)

print("=== STATE VARIABLES FROM useState DECLARATIONS ===")
for i, state_vars in enumerate(usestates):
    vars = state_vars.strip('[]').split(', ')
    for var in vars:
        print(f"{i+1}. {var}")

# Find all variable usage in JSX - patterns like {variable} or prop={variable}
jsx_vars = re.findall(r'{(\w+)(?:\.|\?)?}', content)
jsx_props = re.findall(r'(\w+)={(\w+)(?:\.|\?)?}', content)

# Combine both
all_vars = list(set(jsx_vars + [p[1] for p in jsx_props]))

print(f"\n=== ALL VARIABLES USED IN JSX: {len(all_vars)} ===")
for i, var in enumerate(all_vars[:30]):
    print(f"{i+1}. {var}")
if len(all_vars) > 30:
    print(f"... and {len(all_vars)-30} more")

# Extract state variable names
state_var_names = []
for state_vars in usestates:
    state_var_names.extend(state_vars.strip('[]').split(', '))

print(f"\n=== STATE VARIABLES DECLARED: {len(state_var_names)} ===")

print(f"\n=== VARIABLES USED IN JSX BUT NOT DECLARED ===")
missing_vars = []
for var in all_vars:
    if var not in state_var_names:
        missing_vars.append(var)

for var in missing_vars:
    print(f"  {var}")

print(f"\n=== RECOMMENDATION ===")
print(f"Missing {len(missing_vars)} state variables that should have useState declarations:")
print("These variables are used in JSX but don't have corresponding useState hooks:")
for var in missing_vars:
    # Try to infer the likely type based on usage
    if var in ['chartTab']:
        print(f"  - chartTab: const [chartTab, setChartTab] = useState<'grafico' | 'estrutura'>('grafico');")
    elif var in ['modalOpen']:
        print(f"  - modalOpen: const [modalOpen, setModalOpen] = useState<boolean>(false);")
    elif var in ['now']:
        print(f"  - now: const [now, setNow] = useState<Date>(new Date());")
    elif var in ['seconds']:
        print(f"  - seconds: const [seconds, setSeconds] = useState<number>(0);")
    elif var in ['connected', 'userName', 'credentials']:
        print(f"  - {var}: Available from imports, already managed by parent components")
    elif var in ['robotState']:
        print(f"  - robotState: Available from useRobot() hook")
    elif var in ['active']:
        print(f"  - active: Available from useState<NavKey>('fluxo')")
    elif var in ['tf']:
        print(f"  - tf: Available from useState<'M1' | 'M5' | 'M15'>('M1')")
    elif var in ['store']:
        print(f"  - store: Available from useAnalystStore() hook")
    elif var in ['now', 'seconds']:
        print(f"  - {var}: Already handled above")
    elif var in ['modalOpen', 'seconds']:
        print(f"  - {var}: Already handled above")
    elif var in ['chartTab']:
        print(f"  - chartTab: const [chartTab, setChartTab] = useState<'grafico' | 'estrutura'>('grafico');")

print(f"\n=== SUMMARY ===")
print(f"useStates declared: {len(state_var_names)}")
print(f"Variables used in JSX: {len(all_vars)}")
print(f"Missing useStates: {len(missing_vars)}")

if missing_vars:
    print(f"\n⚠️  The Dashboard component is missing useState declarations for: {', '.join(missing_vars)}")
    print("   These variables are used in JSX but don't have state management hooks.")
else:
    print(f"\n✓ All variables used in JSX have corresponding useState declarations.")

# Check for specific variables mentioned in the issue
print(f"\n=== CHECKING SPECIFIED VARIABLES FROM ISSUE ===")
if 'chartTab' in all_vars and 'chartTab' not in state_var_names:
    print(f"\n❌ chartTab is used in JSX but missing useState declaration")
if 'modalOpen' in all_vars and 'modalOpen' not in state_var_names:
    print(f"\n❌ modalOpen is used in JSX but missing useState declaration")
if 'now' in all_vars and 'now' not in state_var_names:
    print(f"\n❌ now is used in JSX but missing useState declaration")
if 'seconds' in all_vars and 'seconds' not in state_var_names:
    print(f"\n❌ seconds is used in JSX but missing useState declaration")

print(f"\n=== END ANALYSIS ===")
