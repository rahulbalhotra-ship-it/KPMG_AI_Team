import os
import re
import json
import time
import logging
import threading
import concurrent.futures
import google.generativeai as genai
from dotenv import load_dotenv

# Load env variables
load_dotenv()
parent_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
if os.path.exists(parent_env):
    load_dotenv(parent_env, override=True)

from .state import load_agent_configs, load_prompt_file

# Import agent modules for defaults
from . import pm_agent as pm
from . import dev_agent as dev
from . import design_agent as design
from . import consultant_agent as consultant
from . import partner_agent as partner
from . import director_agent as director
from . import qa_agent as qa

# Logger setup
logger = logging.getLogger("app.agent.llm")

# Thread-local storage for request-specific telemetry tracing
thread_local_telemetry = threading.local()

def start_trace_session():
    thread_local_telemetry.calls = []
    thread_local_telemetry.files_written = []

def record_call_telemetry(call_data):
    if hasattr(thread_local_telemetry, "calls"):
        thread_local_telemetry.calls.append(call_data)

def record_file_written(filename):
    if hasattr(thread_local_telemetry, "files_written"):
        thread_local_telemetry.files_written.append(filename)

def get_trace_session_calls():
    if hasattr(thread_local_telemetry, "calls"):
        return thread_local_telemetry.calls
    return []

def get_trace_session_files():
    if hasattr(thread_local_telemetry, "files_written"):
        return thread_local_telemetry.files_written
    return []

# ─────────────────────────────────────────────────────────────
# Persona registry (with prompt files loaded dynamically)
# ─────────────────────────────────────────────────────────────
PERSONAS = {
    "PMAgent": {
        "role": pm.ROLE,
        "instruction": load_prompt_file("pm_agent.txt", pm.INSTRUCTION_TEMPLATE)
    },
    "DevAgent": {
        "role": dev.ROLE,
        "instruction": load_prompt_file("dev_agent.txt", dev.INSTRUCTION_TEMPLATE)
    },
    "DesignAgent": {
        "role": design.ROLE,
        "instruction": load_prompt_file("design_agent.txt", design.INSTRUCTION_TEMPLATE)
    },
    "Consultant": {
        "role": consultant.ROLE,
        "instruction": load_prompt_file("consultant_agent.txt", consultant.INSTRUCTION_TEMPLATE)
    },
    "Partner": {
        "role": partner.ROLE,
        "instruction": load_prompt_file("partner_agent.txt", partner.INSTRUCTION_TEMPLATE)
    },
    "Director": {
        "role": director.ROLE,
        "instruction": load_prompt_file("director_agent.txt", director.INSTRUCTION_TEMPLATE)
    },
    "QAAgent": {
        "role": qa.ROLE,
        "instruction": load_prompt_file("qa_agent.txt", qa.INSTRUCTION_TEMPLATE)
    }
}

# ─────────────────────────────────────────────────────────────
# Gemini LLM Caller
# ─────────────────────────────────────────────────────────────
_gemini_configured = False

def _ensure_gemini_configured():
    """Configure the Gemini SDK once with the API key from environment."""
    global _gemini_configured
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if api_key and "YOUR_GEMINI_API_KEY" not in api_key and not _gemini_configured:
        genai.configure(api_key=api_key)
        _gemini_configured = True
    return bool(api_key and "YOUR_GEMINI_API_KEY" not in api_key)

def call_gemini(system_instruction: str, user_message: str, json_mode: bool = True, model_name: str = "gemini-3.5-flash", temperature: float = 0.7) -> dict | None:
    """
    Call Gemini with the given system instruction and user message.
    Returns parsed JSON dict on success, or None on failure.
    Has a 30-second timeout to prevent hanging on network issues.
    """
    if not _ensure_gemini_configured():
        logger.warning("Gemini is not configured. Returning None.")
        return None

    start_time = time.time()
    status = "success"
    response_text = ""
    error_msg = ""
    result = None

    try:
        gen_config = {}
        if json_mode:
            gen_config["response_mime_type"] = "application/json"
        if temperature is not None:
            gen_config["temperature"] = temperature

        model = genai.GenerativeModel(
            model_name=model_name,
            generation_config=gen_config,
            system_instruction=system_instruction
        )

        logger.info(f"Initiating Gemini call ({model_name}, temp={temperature}). System instruction len: {len(system_instruction)}, Message len: {len(user_message)}")

        # Use a thread executor with timeout to prevent gRPC hangs
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(model.generate_content, user_message)
            response = future.result(timeout=30)

        response_text = response.text.strip()
        if json_mode:
            text = response_text
            # Strip markdown code fences if present
            if text.startswith("```"):
                text = re.sub(r"^```(?:json)?\s*", "", text)
                text = re.sub(r"\s*```$", "", text)
            result = json.loads(text)
        else:
            result = {"text": response_text}

    except concurrent.futures.TimeoutError:
        status = "timeout"
        error_msg = "Request took longer than 30 seconds"
        logger.error(f"[Gemini API Timeout] {error_msg} — falling back to rule-based parser.")
    except Exception as e:
        status = "error"
        error_msg = str(e)
        logger.error(f"[Gemini API Error] {error_msg}", exc_info=True)
    finally:
        latency_ms = (time.time() - start_time) * 1000
        logger.info(f"Gemini call completed in {latency_ms:.2f}ms with status '{status}'")
        record_call_telemetry({
            "type": "json" if json_mode else "text",
            "model_name": model_name,
            "temperature": temperature,
            "system_prompt": system_instruction,
            "user_message": user_message,
            "response_text": response_text,
            "latency_ms": latency_ms,
            "status": status,
            "error": error_msg
        })

    return result

def call_gemini_text(system_instruction: str, user_message: str, model_name: str = "gemini-3.5-flash", temperature: float = 0.7) -> str | None:
    """
    Call Gemini and return raw text (not JSON).
    Used for generating deliverable file content.
    Has a 30-second timeout to prevent hanging.
    """
    if not _ensure_gemini_configured():
        logger.warning("Gemini is not configured. Returning None.")
        return None

    start_time = time.time()
    status = "success"
    response_text = ""
    error_msg = ""
    result = None

    try:
        gen_config = {}
        if temperature is not None:
            gen_config["temperature"] = temperature

        model = genai.GenerativeModel(
            model_name=model_name,
            generation_config=gen_config,
            system_instruction=system_instruction
        )

        logger.info(f"Initiating Gemini Text call ({model_name}, temp={temperature}). System instruction len: {len(system_instruction)}, Message len: {len(user_message)}")

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(model.generate_content, user_message)
            response = future.result(timeout=30)

        response_text = response.text.strip()
        text = response_text
        # Strip markdown code fences if present
        if text.startswith("```"):
            text = re.sub(r"^```(?:\w+)?\s*\n?", "", text, count=1)
            text = re.sub(r"\n?```\s*$", "", text)
        result = text

    except concurrent.futures.TimeoutError:
        status = "timeout"
        error_msg = "Request took longer than 30 seconds"
        logger.error(f"[Gemini Text API Timeout] {error_msg} — using fallback content.")
    except Exception as e:
        status = "error"
        error_msg = str(e)
        logger.error(f"[Gemini Text API Error] {error_msg}", exc_info=True)
    finally:
        latency_ms = (time.time() - start_time) * 1000
        logger.info(f"Gemini Text call completed in {latency_ms:.2f}ms with status '{status}'")
        record_call_telemetry({
            "type": "text",
            "model_name": model_name,
            "temperature": temperature,
            "system_prompt": system_instruction,
            "user_message": user_message,
            "response_text": response_text,
            "latency_ms": latency_ms,
            "status": status,
            "error": error_msg
        })

    return result

def agent_think(agent_name: str, user_message: str, scope: str, state_str: str) -> dict | None:
    """
    Have a specific agent think about a message using Gemini.
    Returns parsed JSON response or None on failure.
    """
    try:
        configs = load_agent_configs()
    except Exception:
        configs = {}

    if agent_name not in configs:
        if agent_name not in PERSONAS:
            agent_name = "PMAgent"
        instruction_template = PERSONAS[agent_name]["instruction"]
        model_name = "gemini-3.5-flash"
        temperature = 0.7
    else:
        agent_data = configs[agent_name]
        instruction_template = agent_data.get("persona", PERSONAS.get(agent_name, {}).get("instruction", ""))
        model_name = agent_data.get("config", {}).get("model", "gemini-3.5-flash")
        temperature = agent_data.get("config", {}).get("temperature", 0.7)

    system_prompt = instruction_template.format(scope=scope, state=state_str)
    return call_gemini(system_prompt, user_message, model_name=model_name, temperature=temperature)
