import os
import sys

# Add workspace root and backend directories to sys.path to resolve packages
WORKSPACE_ROOT = r"c:\Hackathon"
sys.path.insert(0, WORKSPACE_ROOT)
sys.path.insert(0, os.path.join(WORKSPACE_ROOT, "backend"))

from agents.agents.state import load_project_state, save_project_state, load_agent_configs
from agents.agents.graph import get_agent_graph
from agents.tools import linter, test_runner

print("=========================================")
print("System Refactoring Verification Run")
print("=========================================")

# 1. Test prompts dynamic load
print("\n--- 1. Testing Agent Configurations and Prompts ---")
try:
    configs = load_agent_configs()
    print("Agent configurations loaded successfully!")
    print(f"Loaded {len(configs)} agents:")
    for name, config in configs.items():
        print(f"  - {name} ({config['role']}): Prompt length = {len(config['persona'])} characters")
        print(f"    Persona start: {config['persona'][:80].replace(chr(10), ' ')}...")
except Exception as e:
    print(f"FAIL: Agent configs loading failed: {e}")
    sys.exit(1)

# 2. Test AST Linter
print("\n--- 2. Testing AST Python Linter ---")
valid_code = "def test():\n    return 42\n"
invalid_code = "def test(\n    return 42\n"

valid_res = linter.lint_python_code(valid_code)
print("Valid code lint result:", valid_res)
assert valid_res["valid"] == True, "Linter should mark valid code as True"

invalid_res = linter.lint_python_code(invalid_code)
print("Invalid code lint result:", invalid_res)
assert invalid_res["valid"] == False, "Linter should mark invalid code as False"
print("Linter tests PASSED!")

# 3. Test Graph Compilation
print("\n--- 3. Testing Graph Compilation ---")
try:
    graph = get_agent_graph()
    print("LangGraph workflow compiled successfully!")
except Exception as e:
    print(f"FAIL: Graph compilation failed: {e}")
    sys.exit(1)

# 4. Test run_test_suite on a simulated directory
print("\n--- 4. Testing dynamic test runner tool on dummy test ---")
import tempfile
import shutil

with tempfile.TemporaryDirectory() as tmpdir:
    dummy_app = "def add(a, b):\n    return a + b\n"
    dummy_test = "import pytest\nfrom app import add\ndef test_add():\n    assert add(2, 3) == 5\n"
    
    with open(os.path.join(tmpdir, "app.py"), "w") as f:
        f.write(dummy_app)
    with open(os.path.join(tmpdir, "test_app.py"), "w") as f:
        f.write(dummy_test)
        
    print(f"Running simulated unit tests in {tmpdir}...")
    run_res = test_runner.run_test_suite(tmpdir)
    print("Test Runner Result summary:")
    print(f"  - Passed: {run_res['passed']}")
    print(f"  - Failed: {run_res['failed']}")
    print(f"  - Errors: {run_res['errors']}")
    print(f"  - Exit code: {run_res['exit_code']}")
    print("Test Runner Terminal Output snippet:")
    print("\n".join(run_res["output"].splitlines()[:10]))
    
print("\nVerification script execution complete!")
