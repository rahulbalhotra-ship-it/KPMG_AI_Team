import subprocess
import os
import sys
import re
import logging

logger = logging.getLogger("app.tools.test_runner")

def run_test_suite(deliverables_dir: str) -> dict:
    """
    Run test_app.py using pytest in the deliverables directory.
    If pytest is not installed, falls back to a custom Python-based runner
    that executes test_* functions dynamically.
    Returns summary metrics and the full execution output.
    """
    test_file = os.path.join(deliverables_dir, "test_app.py")
    if not os.path.exists(test_file):
        return {
            "passed": 0,
            "failed": 0,
            "errors": 1,
            "exit_code": -3,
            "output": "Error: test_app.py not found in deliverables directory."
        }

    # 1. Try running pytest first
    cmd = [sys.executable, "-m", "pytest", "test_app.py", "-v"]
    logger.info(f"Attempting pytest execution: {' '.join(cmd)} in Cwd: {deliverables_dir}")
    
    try:
        result = subprocess.run(
            cmd,
            cwd=deliverables_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=15
        )
        output = result.stdout
        exit_code = result.returncode
    except subprocess.TimeoutExpired as te:
        output = te.stdout or "Test execution timed out after 15 seconds."
        exit_code = -1
    except Exception as e:
        output = f"Failed to execute tests: {str(e)}"
        exit_code = -2

    # Check if pytest is missing
    is_pytest_missing = (exit_code in (1, 3, 4, 5) and "No module named pytest" in output) or exit_code == -2

    if is_pytest_missing:
        logger.info("pytest is not installed in the active environment. Falling back to custom test runner.")
        return run_test_suite_fallback(deliverables_dir)

    # Parse pytest output
    passed = 0
    failed = 0
    errors = 0

    if "passed" in output or "failed" in output or "error" in output:
        summary_line = ""
        for line in output.splitlines():
            if "in" in line and ("passed" in line or "failed" in line or "error" in line) and line.startswith("==="):
                summary_line = line
                break
        
        if summary_line:
            pass_match = re.search(r"(\d+)\s+passed", summary_line)
            fail_match = re.search(r"(\d+)\s+failed", summary_line)
            err_match = re.search(r"(\d+)\s+error", summary_line)
            
            if pass_match:
                passed = int(pass_match.group(1))
            if fail_match:
                failed = int(fail_match.group(1))
            if err_match:
                errors = int(err_match.group(1))
        else:
            passed = len(re.findall(r"PASSED", output))
            failed = len(re.findall(r"FAILED", output))
    else:
        errors = 1

    return {
        "passed": passed,
        "failed": failed,
        "errors": errors,
        "exit_code": exit_code,
        "output": output
    }

def run_test_suite_fallback(deliverables_dir: str) -> dict:
    """
    Fallback runner that executes test_* functions in test_app.py using standard python import
    without requiring pytest package. Stubs the pytest package in sys.modules first.
    """
    runner_code = """import sys
import os
import traceback

# Stub pytest to prevent ModuleNotFoundError when importing test_app
class MockPytest:
    def fixture(self, *args, **kwargs):
        def decorator(func):
            return func
        return decorator
    
    def __getattr__(self, name):
        # Allow any attribute lookup to succeed silently (e.g. pytest.mark)
        return self
        
    def __call__(self, *args, **kwargs):
        # Allow decorators like @pytest.mark.xxx() to be callable
        return self

sys.modules['pytest'] = MockPytest()

# Add deliverables directory and workspace root to path
sys.path.insert(0, os.path.abspath('.'))

# Try importing test_app
try:
    import test_app
except Exception as e:
    print(f"CRITICAL: Failed to import test_app: {e}")
    traceback.print_exc()
    sys.exit(1)

# Find all test functions
test_funcs = []
for attr_name in dir(test_app):
    if attr_name.startswith("test_"):
        attr = getattr(test_app, attr_name)
        if callable(attr):
            test_funcs.append((attr_name, attr))

print(f"=== Custom Test Runner Starting ===")
print(f"Found {len(test_funcs)} test cases in test_app.py\\n")

passed = 0
failed = 0
errors = 0

for name, func in test_funcs:
    print(f"Running test: {name} ... ", end="")
    try:
        func()
        print("PASSED")
        passed += 1
    except AssertionError as ae:
        print("FAILED")
        traceback.print_exc()
        failed += 1
    except Exception as e:
        print("ERROR")
        traceback.print_exc()
        errors += 1

print(f"\\n=== Custom Test Runner Finished ===")
print(f"Summary: {passed} passed, {failed} failed, {errors} errors")
sys.exit(0 if (failed == 0 and errors == 0) else 1)
"""
    runner_file = os.path.join(deliverables_dir, "run_tests_fallback_temp.py")
    try:
        with open(runner_file, 'w', encoding='utf-8') as f:
            f.write(runner_code)
        
        cmd = [sys.executable, "run_tests_fallback_temp.py"]
        result = subprocess.run(
            cmd,
            cwd=deliverables_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=15
        )
        output = result.stdout
        exit_code = result.returncode
    except Exception as e:
        output = f"Fallback runner execution failed: {e}"
        exit_code = -4
    finally:
        if os.path.exists(runner_file):
            try:
                os.remove(runner_file)
            except Exception:
                pass

    # Parse fallback counts
    passed = 0
    failed = 0
    errors = 0

    pass_matches = re.findall(r"PASSED", output)
    fail_matches = re.findall(r"FAILED", output)
    err_matches = re.findall(r"ERROR", output)

    passed = len(pass_matches)
    failed = len(fail_matches)
    errors = len(err_matches)

    return {
        "passed": passed,
        "failed": failed,
        "errors": errors,
        "exit_code": exit_code,
        "output": output
    }
