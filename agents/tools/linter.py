import ast
import logging

logger = logging.getLogger("app.tools.linter")

def lint_python_code(code_content: str) -> dict:
    """
    Check Python code content for syntax correctness using AST parsing.
    Returns a dictionary with:
      'valid': bool
      'error': str or None
    """
    if not code_content or code_content.strip() == "":
        return {"valid": False, "error": "Empty code content"}

    try:
        ast.parse(code_content)
        return {"valid": True, "error": None}
    except SyntaxError as e:
        error_msg = f"SyntaxError at line {e.lineno}, offset {e.offset}: {e.msg}\nCode line: {e.text}"
        logger.warning(f"Linter found syntax error: {error_msg}")
        return {"valid": False, "error": error_msg}
    except Exception as e:
        logger.error(f"Linter error: {e}", exc_info=True)
        return {"valid": False, "error": str(e)}
