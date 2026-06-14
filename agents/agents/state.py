import os
import json
from typing import TypedDict, Optional

# Define the State of the Langgraph agent
class AgentState(TypedDict):
    message: str
    action: str          # STANDUP, WORK, BREAK, DISPATCH, NONE
    response_text: str
    target_agent: Optional[str]
    agent: Optional[str]
    scope: Optional[str]
    project_scope: Optional[str]
    project_state: Optional[dict]

# Compute absolute path of deliverables directory in the workspace root
DELIVERABLES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "deliverables"))
STATE_FILE = os.path.join(DELIVERABLES_DIR, "project_state.json")

def load_project_state() -> dict:
    if not os.path.exists(DELIVERABLES_DIR):
        os.makedirs(DELIVERABLES_DIR, exist_ok=True)
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "state": "IDLE",
        "scope": "",
        "step": 0,
        "phases": {
            "Planning": "Planned",
            "Design": "Planned",
            "Development": "Planned",
            "Deployment": "Planned"
        }
    }

def save_project_state(state_data: dict) -> None:
    if not os.path.exists(DELIVERABLES_DIR):
        os.makedirs(DELIVERABLES_DIR, exist_ok=True)
    with open(STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(state_data, f, indent=2)

import logging
logger = logging.getLogger("app.state")

def write_deliverable_file(filename: str, content: str) -> None:
    if not os.path.exists(DELIVERABLES_DIR):
        os.makedirs(DELIVERABLES_DIR, exist_ok=True)
    path = os.path.join(DELIVERABLES_DIR, filename)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    logger.info(f"Written deliverable: {path}")
    try:
        from .llm import record_file_written
        record_file_written(filename)
    except Exception:
        pass

CONFIGS_FILE = os.path.join(DELIVERABLES_DIR, "agent_configs.json")
PROMPTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "prompts"))

def load_prompt_file(filename: str, fallback_content: str) -> str:
    """Load a prompt file from prompts/ dir, falling back and saving if not found."""
    if not os.path.exists(PROMPTS_DIR):
        os.makedirs(PROMPTS_DIR, exist_ok=True)
    path = os.path.join(PROMPTS_DIR, filename)
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return f.read().strip()
        except Exception as e:
            logger.error(f"Error reading prompt file {filename}: {e}")
    else:
        try:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(fallback_content)
        except Exception as e:
            logger.error(f"Error writing prompt file {filename}: {e}")
    return fallback_content.strip()

def get_prompt_filename(agent_id: str) -> str:
    """Map agent ID to its prompts file name."""
    if agent_id == "Consultant":
        return "consultant_agent.txt"
    elif agent_id == "Partner":
        return "partner_agent.txt"
    elif agent_id == "Director":
        return "director_agent.txt"
    else:
        import re
        s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', agent_id)
        return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower() + ".txt"

def load_agent_configs() -> dict:
    if not os.path.exists(DELIVERABLES_DIR):
        os.makedirs(DELIVERABLES_DIR, exist_ok=True)
    
    configs = {}
    if os.path.exists(CONFIGS_FILE):
        try:
            with open(CONFIGS_FILE, 'r', encoding='utf-8') as f:
                configs = json.load(f)
        except Exception:
            configs = {}

    # Load defaults first
    from . import pm_agent as pm
    from . import dev_agent as dev
    from . import design_agent as design
    from . import consultant_agent as consultant
    from . import partner_agent as partner
    from . import director_agent as director
    from . import qa_agent as qa
    
    defaults = {
        "PMAgent": {
            "name": "PMAgent",
            "role": pm.ROLE,
            "persona": pm.INSTRUCTION_TEMPLATE,
            "skills": "Coordination, Planning, Communication, Coffee Drinking",
            "level": 5,
            "xp": 350,
            "hp": 100,
            "mana": 80,
            "clothes": "#48BB78",
            "hair": "#319795",
            "config": {
                "model": "gemini-3.5-flash",
                "temperature": 0.7
            }
        },
        "DevAgent": {
            "name": "DevAgent",
            "role": dev.ROLE,
            "persona": dev.INSTRUCTION_TEMPLATE,
            "skills": "Coding, Database Design, Debugging, StackOverflow",
            "level": 5,
            "xp": 420,
            "hp": 95,
            "mana": 120,
            "clothes": "#4299E1",
            "hair": "#ED8936",
            "config": {
                "model": "gemini-3.5-flash",
                "temperature": 0.7
            }
        },
        "DesignAgent": {
            "name": "DesignAgent",
            "role": design.ROLE,
            "persona": design.INSTRUCTION_TEMPLATE,
            "skills": "Pixel Art, Color Harmonies, Layout Wireframing, Font Selection",
            "level": 5,
            "xp": 280,
            "hp": 105,
            "mana": 90,
            "clothes": "#ED64A6",
            "hair": "#ECC94B",
            "config": {
                "model": "gemini-3.5-flash",
                "temperature": 0.7
            }
        },
        "Consultant": {
            "name": "Consultant",
            "role": consultant.ROLE,
            "persona": consultant.INSTRUCTION_TEMPLATE,
            "skills": "Business Analysis, Process Mapping, Technical Writing, Industry Research",
            "level": 5,
            "xp": 300,
            "hp": 100,
            "mana": 85,
            "clothes": "#E2E8F0",
            "hair": "#4A5568",
            "config": {
                "model": "gemini-3.5-flash",
                "temperature": 0.7
            }
        },
        "Partner": {
            "name": "Partner",
            "role": partner.ROLE,
            "persona": partner.INSTRUCTION_TEMPLATE,
            "skills": "Client Management, Scoping, DND, Executive Oversight",
            "level": 9,
            "xp": 900,
            "hp": 100,
            "mana": 50,
            "clothes": "#ECC94B",
            "hair": "#718096",
            "config": {
                "model": "gemini-3.5-flash",
                "temperature": 0.7
            }
        },
        "Director": {
            "name": "Director",
            "role": director.ROLE,
            "persona": director.INSTRUCTION_TEMPLATE,
            "skills": "Project Delivery, Delivery Assurance, Risk Management, DND",
            "level": 8,
            "xp": 750,
            "hp": 100,
            "mana": 60,
            "clothes": "#F6E05E",
            "hair": "#2D3748",
            "config": {
                "model": "gemini-3.5-flash",
                "temperature": 0.7
            }
        },
        "QAAgent": {
            "name": "QAAgent",
            "role": qa.ROLE,
            "persona": qa.INSTRUCTION_TEMPLATE,
            "skills": "Unit Testing, Code Quality Analysis, CI/CD, Bug Hunting",
            "level": 5,
            "xp": 340,
            "hp": 98,
            "mana": 110,
            "clothes": "#9F7AEA",
            "hair": "#4A5568",
            "config": {
                "model": "gemini-3.5-flash",
                "temperature": 0.7
            }
        }
    }

    # Merge configs and force loading persona from prompt files
    for agent_id, default_data in defaults.items():
        if agent_id not in configs:
            configs[agent_id] = default_data
        # Load persona from prompt file, falling back to default
        filename = get_prompt_filename(agent_id)
        configs[agent_id]["persona"] = load_prompt_file(filename, default_data["persona"])

    return configs

def save_agent_configs(configs: dict) -> None:
    if not os.path.exists(DELIVERABLES_DIR):
        os.makedirs(DELIVERABLES_DIR, exist_ok=True)
    with open(CONFIGS_FILE, 'w', encoding='utf-8') as f:
        json.dump(configs, f, indent=2)

TRACE_FILE = os.path.join(DELIVERABLES_DIR, "agent_trace.json")

def append_agent_trace(trace_entry: dict) -> None:
    if not os.path.exists(DELIVERABLES_DIR):
        os.makedirs(DELIVERABLES_DIR, exist_ok=True)
    traces = []
    if os.path.exists(TRACE_FILE):
        try:
            with open(TRACE_FILE, 'r', encoding='utf-8') as f:
                traces = json.load(f)
                if not isinstance(traces, list):
                    traces = []
        except Exception:
            traces = []
    traces.append(trace_entry)
    with open(TRACE_FILE, 'w', encoding='utf-8') as f:
        json.dump(traces, f, indent=2)


