import os
import re
import warnings
import logging
import time

# Suppress all future and deprecation warnings from google package
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=DeprecationWarning)

from langgraph.graph import StateGraph, END

# Import local state and agent details
from .state import (
    AgentState,
    load_project_state,
    save_project_state,
    write_deliverable_file,
    load_agent_configs,
    append_agent_trace
)
from .parser import fallback_parser
from .import pm_agent as pm

# Import modularized helpers
from .llm import (
    start_trace_session,
    record_file_written,
    get_trace_session_calls,
    get_trace_session_files,
    agent_think,
    PERSONAS
)
from .generators import (
    generate_project_plan,
    generate_design_specs,
    generate_app_code,
    generate_qa_report,
    generate_unit_tests,
    generate_requirements_doc,
    generate_charter
)

# Logger setup
logger = logging.getLogger("app.agent")
if not logger.handlers and not logging.getLogger("app").handlers:
    logging.basicConfig(level=logging.INFO, format='[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s')

# ─────────────────────────────────────────────────────────────
# Routing / Message parsing helpers
# ─────────────────────────────────────────────────────────────
def extract_project_scope(message: str) -> str:
    """Extract the project name/scope from a customer's requirement message."""
    msg = message.strip()
    msg_lower = msg.lower()

    patterns = [
        r"(?:build|create|develop|make|design|generate|start)\s+(?:an|a)?\s*(.*)",
        r"(?:project\s+for|project\s+about)\s+(.*)"
    ]

    for pattern in patterns:
        match = re.search(pattern, msg_lower)
        if match:
            start, end = match.span(1)
            extracted = msg[start:end].strip()
            extracted = re.sub(r"[.?!]+$", "", extracted).strip()
            if extracted:
                return extracted

    cleaned = re.sub(r"[.?!]+$", "", msg).strip()
    if len(cleaned) > 100:
        cleaned = cleaned[:97] + "..."
    return cleaned


def is_casual_greeting(message: str) -> bool:
    """Detect if a message is a casual greeting/chat (not a project request)."""
    msg = message.strip().lower()
    greetings = [
        "hi", "hello", "hey", "good morning", "good afternoon", "good evening",
        "howdy", "sup", "what's up", "whats up", "how are you", "how's it going",
        "greetings", "yo", "hola", "namaste", "thanks", "thank you", "bye",
        "goodbye", "see you", "nice to meet you"
    ]
    # Check if the message is just a greeting (possibly with punctuation)
    cleaned = re.sub(r"[!.,?]+$", "", msg).strip()
    if cleaned in greetings:
        return True
    # Also match "hi gemini", "hello team", etc.
    for g in greetings:
        if cleaned.startswith(g + " ") or cleaned == g:
            return True
    return False


def is_project_request(message: str) -> bool:
    """Detect if a message is asking to build/create a project."""
    msg = message.lower()
    return any(k in msg for k in [
        "build", "create", "project", "develop", "make", "app",
        "website", "design", "todo", "portal", "dashboard", "platform",
        "system", "tool", "game", "simulation"
    ])


# ─────────────────────────────────────────────────────────────
# Main Orchestration Node — process_instruction
# ─────────────────────────────────────────────────────────────
def process_instruction_untraced(state: AgentState) -> AgentState:
    user_msg = state.get("message", "")
    agent_name = state.get("agent", "PMAgent")
    active_scope = state.get("scope", "")

    try:
        configs = load_agent_configs()
    except Exception:
        configs = {}

    if agent_name not in configs:
        if agent_name not in PERSONAS:
            agent_name = "PMAgent"
        agent_role = PERSONAS[agent_name]['role']
    else:
        agent_role = configs[agent_name].get('role', PERSONAS.get(agent_name, {}).get('role', 'Agent'))

    # 1. Load project state
    proj_state = load_project_state()

    # Sync scope if user updated it
    if active_scope and active_scope.strip() and active_scope != proj_state.get("scope", ""):
        proj_state["scope"] = active_scope
        save_project_state(proj_state)
    else:
        active_scope = proj_state.get("scope", "")

    msg_lower = user_msg.lower()

    # ─── GREETING / CASUAL CHAT ────────────────────────────────
    # If user just says "hi", "hello", etc. and we're IDLE — let Gemini respond naturally
    if is_casual_greeting(user_msg) and proj_state["state"] == "IDLE":
        llm_result = agent_think(agent_name, user_msg, active_scope or "No project yet", "IDLE")
        if llm_result:
            return {
                "message": state.get("message", ""),
                "action": llm_result.get("action", "NONE"),
                "response_text": llm_result.get("response_text", "Hello! I'm the PM Agent of the KPMG Agentic AI team. How can I help you today?"),
                "target_agent": llm_result.get("target_agent", None),
                "agent": agent_name,
                "scope": active_scope,
                "project_scope": llm_result.get("project_scope", None),
                "project_state": proj_state
            }
        # Fallback for greetings
        return {
            "message": state.get("message", ""),
            "action": "NONE",
            "response_text": f"Hello! I'm the {agent_role} on the KPMG Agentic AI team. I work alongside our Designer, Developer, and DevOps specialists. Tell me about a project you'd like to build, and we'll get the whole team on it!",
            "target_agent": None,
            "agent": agent_name,
            "scope": active_scope,
            "project_scope": None,
            "project_state": proj_state
        }

    # ─── STATE MACHINE TRANSITIONS ─────────────────────────────
    if proj_state["state"] == "IDLE":
        if is_project_request(user_msg):
            # Auto-fill scope from the customer message
            if not active_scope or active_scope.strip() == "":
                active_scope = extract_project_scope(user_msg)

            proj_state["state"] = "PLAN_PENDING"
            proj_state["scope"] = active_scope
            proj_state["step"] = 0
            proj_state["phases"] = {
                "Planning": "In Progress",
                "Design": "Planned",
                "Development": "Planned",
                "Deployment": "Planned"
            }
            save_project_state(proj_state)

            # Generate project plan via Gemini
            plan_content = generate_project_plan(active_scope)
            write_deliverable_file("project_plan.md", plan_content)

            # Let PM Agent announce the plan via LLM
            agent_name = "PMAgent"
            announce_msg = f"I have created the project plan for '{active_scope}'. Please present it to the client and ask for sign-off."
            llm_result = agent_think(agent_name, announce_msg, active_scope, "PLAN_PENDING")
            if llm_result:
                return {
                    "message": state.get("message", ""),
                    "action": llm_result.get("action", "NONE"),
                    "response_text": llm_result.get("response_text", f"I've drafted the project plan for '{active_scope}'. Please review and click 'SIGN OFF PLAN' to approve."),
                    "target_agent": llm_result.get("target_agent", None),
                    "agent": agent_name,
                    "scope": active_scope,
                    "project_scope": llm_result.get("project_scope", active_scope),
                    "project_state": proj_state
                }

    elif proj_state["state"] == "PLAN_PENDING":
        if any(k in msg_lower for k in ["sign off", "sign-off", "approve", "approved", "yes", "go ahead", "lgtm", "looks good"]):
            proj_state["state"] = "DEVELOPMENT"
            proj_state["step"] = 0
            proj_state["phases"] = {
                "Planning": "Completed",
                "Requirements": "In Progress",
                "Design": "Planned",
                "Development": "Planned"
            }
            save_project_state(proj_state)

            # Generate charter
            charter_content = generate_charter(active_scope, proj_state["phases"])
            write_deliverable_file("project_charter.md", charter_content)

            # Update plan with completed status
            plan_content = generate_project_plan(active_scope)
            write_deliverable_file("project_plan.md", plan_content)

            agent_name = "PMAgent"
            kickoff_msg = f"The project plan for '{active_scope}' has been approved! Call the team to the meeting room for a kickoff standup."
            llm_result = agent_think(agent_name, kickoff_msg, active_scope, "DEVELOPMENT")
            if llm_result:
                return {
                    "message": state.get("message", ""),
                    "action": llm_result.get("action", "STANDUP"),
                    "response_text": llm_result.get("response_text", "Plan approved! Team, let's assemble for our kickoff standup."),
                    "target_agent": llm_result.get("target_agent", "ALL"),
                    "agent": agent_name,
                    "scope": active_scope,
                    "project_scope": None,
                    "project_state": proj_state
                }
        else:
            # User is chatting during plan pending — let LLM respond
            llm_result = agent_think(agent_name, user_msg, active_scope, "PLAN_PENDING")
            if llm_result:
                return {
                    "message": state.get("message", ""),
                    "action": llm_result.get("action", "NONE"),
                    "response_text": llm_result.get("response_text", f"The project plan for '{active_scope}' is ready for review. Please click 'SIGN OFF PLAN' to approve."),
                    "target_agent": llm_result.get("target_agent", None),
                    "agent": agent_name,
                    "scope": active_scope,
                    "project_scope": None,
                    "project_state": proj_state
                }

    elif proj_state["state"] == "DEVELOPMENT":
        step = proj_state.get("step", 0)

        if step == 0:
            # ── Consultant produces requirements and process maps ──
            req_content = generate_requirements_doc(active_scope)
            write_deliverable_file("requirements_doc.md", req_content)

            proj_state["step"] = 1
            proj_state["phases"]["Requirements"] = "Completed"
            proj_state["phases"]["Design"] = "In Progress"
            charter_content = generate_charter(active_scope, proj_state["phases"])
            write_deliverable_file("project_charter.md", charter_content)
            save_project_state(proj_state)

            agent_name = "Consultant"
            cons_msg = f"I have completed the BA requirements mapping and process documentation for '{active_scope}' and saved it to 'requirements_doc.md'. Inform the client and hand over to DesignAgent for UI specifications."
            llm_result = agent_think(agent_name, cons_msg, active_scope, "DEVELOPMENT")
            if llm_result:
                return {
                    "message": state.get("message", ""),
                    "action": llm_result.get("action", "WORK"),
                    "response_text": llm_result.get("response_text", "Business requirements document and process maps are ready! Handing off to DesignAgent."),
                    "target_agent": llm_result.get("target_agent", "DesignAgent"),
                    "agent": agent_name,
                    "scope": active_scope,
                    "project_scope": None,
                    "project_state": proj_state
                }

        elif step == 1:
            # ── DesignAgent produces design specs ──
            design_content = generate_design_specs(active_scope)
            write_deliverable_file("design_specs.md", design_content)

            proj_state["step"] = 2
            proj_state["phases"]["Design"] = "Completed"
            proj_state["phases"]["Development"] = "In Progress"
            charter_content = generate_charter(active_scope, proj_state["phases"])
            write_deliverable_file("project_charter.md", charter_content)
            save_project_state(proj_state)

            agent_name = "DesignAgent"
            design_msg = f"I have completed the UI/UX design specifications for '{active_scope}' and saved them to 'design_specs.md'. Inform the client and hand over to DevAgent for implementation."
            llm_result = agent_think(agent_name, design_msg, active_scope, "DEVELOPMENT")
            if llm_result:
                return {
                    "message": state.get("message", ""),
                    "action": llm_result.get("action", "WORK"),
                    "response_text": llm_result.get("response_text", "Design specs ready! Handing off to DevAgent."),
                    "target_agent": llm_result.get("target_agent", "DevAgent"),
                    "agent": agent_name,
                    "scope": active_scope,
                    "project_scope": None,
                    "project_state": proj_state
                }

        elif step == 2:
            # ── DevAgent produces application code ──
            app_content = generate_app_code(active_scope)
            write_deliverable_file("app.py", app_content)

            proj_state["step"] = 3
            proj_state["phases"]["Development"] = "Completed"
            proj_state["phases"]["Testing"] = "In Progress"
            charter_content = generate_charter(active_scope, proj_state["phases"])
            write_deliverable_file("project_charter.md", charter_content)
            save_project_state(proj_state)

            agent_name = "DevAgent"
            dev_msg = f"I have written the FastAPI application code for '{active_scope}' and saved it to 'app.py'. Handing off to QAAgent for comprehensive testing and code quality checks."
            llm_result = agent_think(agent_name, dev_msg, active_scope, "DEVELOPMENT")
            if llm_result:
                return {
                    "message": state.get("message", ""),
                    "action": llm_result.get("action", "WORK"),
                    "response_text": llm_result.get("response_text", "Application code written! Handing off to QAAgent for quality verification and unit tests."),
                    "target_agent": "QAAgent",
                    "agent": agent_name,
                    "scope": active_scope,
                    "project_scope": None,
                    "project_state": proj_state
                }

        elif step == 3:
            # ── QAAgent produces unit tests and QA report ──
            tests_content = generate_unit_tests(active_scope)
            write_deliverable_file("test_app.py", tests_content)

            qa_report = generate_qa_report(active_scope)
            write_deliverable_file("qa_report.md", qa_report)

            proj_state["step"] = 4
            proj_state["phases"]["Testing"] = "Completed"
            proj_state["phases"]["Deployment"] = "In Progress"
            charter_content = generate_charter(active_scope, proj_state["phases"])
            write_deliverable_file("project_charter.md", charter_content)
            save_project_state(proj_state)

            agent_name = "QAAgent"
            qa_msg = f"I have written unit tests to 'test_app.py' and compiled a QA report to 'qa_report.md' for '{active_scope}'. Handing off to PMAgent for final review and wrap-up."
            llm_result = agent_think(agent_name, qa_msg, active_scope, "DEVELOPMENT")
            if llm_result:
                return {
                    "message": state.get("message", ""),
                    "action": llm_result.get("action", "WORK"),
                    "response_text": llm_result.get("response_text", "Unit tests compiled and code quality audit report created successfully! Handing off to PMAgent for final project wrap-up."),
                    "target_agent": "PMAgent",
                    "agent": agent_name,
                    "scope": active_scope,
                    "project_scope": None,
                    "project_state": proj_state
                }

        elif step == 4:
            # ── PMAgent wraps up ──
            final_content = f"""# Project Deliverables Summary: {active_scope}

## Completed Deliverables
- [x] **Project Plan** — `project_plan.md`
- [x] **Project Charter & Gantt** — `project_charter.md`
- [x] **Requirements & Process Map** — `requirements_doc.md`
- [x] **UI/UX Design Specs** — `design_specs.md`
- [x] **Application Source Code** — `app.py`
- [x] **Automated Unit Tests** — `test_app.py`
- [x] **Code Quality & Testing Report** — `qa_report.md`
- [x] **Final Project Report** — `final_report.md`

## Team Contributions
| Agent | Role | Deliverable |
| --- | --- | --- |
| PMAgent | Project Manager | Project Plan, Charter, Final Report |
| Consultant | Senior BA | Requirements Document & Process Map |
| DesignAgent | UI/UX Designer | Design Specifications |
| DevAgent | Lead Developer | Application Source Code |
| QAAgent | QA Engineer | Automated Unit Tests & Code Quality Report |

## Project Status: ✅ COMPLETED
All deliverables are ready for download from the Deliverables Directory.
"""
            write_deliverable_file("final_report.md", final_content)

            proj_state["state"] = "COMPLETED"
            proj_state["step"] = 5
            proj_state["phases"]["Deployment"] = "Completed"
            charter_content = generate_charter(active_scope, proj_state["phases"])
            write_deliverable_file("project_charter.md", charter_content)
            save_project_state(proj_state)

            agent_name = "PMAgent"
            wrap_msg = f"All deliverables (including tests and QA report) for '{active_scope}' are complete! Gather the team for a final wrap-up standup."
            llm_result = agent_think(agent_name, wrap_msg, active_scope, "COMPLETED")
            if llm_result:
                return {
                    "message": state.get("message", ""),
                    "action": llm_result.get("action", "STANDUP"),
                    "response_text": llm_result.get("response_text", f"All deliverables for '{active_scope}' including testing are complete! High quality is assured. Excellent job team! 🎉"),
                    "target_agent": "ALL",
                    "agent": agent_name,
                    "scope": active_scope,
                    "project_scope": None,
                    "project_state": proj_state
                }

    elif proj_state["state"] == "COMPLETED":
        # Project done — let the agent respond naturally to any follow-up
        llm_result = agent_think(agent_name, user_msg, active_scope, "COMPLETED")
        if llm_result:
            return {
                "message": state.get("message", ""),
                "action": llm_result.get("action", "NONE"),
                "response_text": llm_result.get("response_text", f"The project '{active_scope}' is complete! All deliverables are ready for download."),
                "target_agent": llm_result.get("target_agent", None),
                "agent": agent_name,
                "scope": active_scope,
                "project_scope": None,
                "project_state": proj_state
            }

    # ─── FALLBACK: use rule-based parser ───────────────────────
    proj_state = load_project_state()
    try:
        configs = load_agent_configs()
        persona = configs.get(agent_name, PERSONAS.get(agent_name, {}))
    except Exception:
        persona = PERSONAS.get(agent_name, {})
    result = fallback_parser(user_msg, agent_name, proj_state["state"], active_scope, proj_state["step"])
    return {
        "message": state.get("message", ""),
        "action": result["action"],
        "response_text": result["response_text"],
        "target_agent": result.get("target_agent", None),
        "agent": agent_name,
        "scope": active_scope,
        "project_scope": result.get("project_scope", None),
        "project_state": proj_state
    }


def process_instruction(state: AgentState) -> AgentState:
    import datetime
    user_msg = state.get("message", "")
    agent_name = state.get("agent", "PMAgent")
    
    start_time = time.time()
    start_trace_session()
    
    try:
        configs = load_agent_configs()
    except Exception:
        configs = {}
        
    if agent_name not in configs:
        if agent_name not in PERSONAS:
            agent_name = "PMAgent"
        agent_data = PERSONAS.get(agent_name, {})
        persona_template = agent_data.get("instruction", "")
        model_name = "gemini-3.5-flash"
        temperature = 0.7
    else:
        agent_data = configs[agent_name]
        persona_template = agent_data.get("persona", PERSONAS.get(agent_name, {}).get("instruction", ""))
        model_name = agent_data.get("config", {}).get("model", "gemini-3.5-flash")
        temperature = agent_data.get("config", {}).get("temperature", 0.7)

    logger.info(f"--- Agent Step Start: {agent_name} ---")
    
    fallback_used = False
    result_state = None
    try:
        result_state = process_instruction_untraced(state)
    except Exception as e:
        logger.error(f"Error executing agent step: {str(e)}", exc_info=True)
        raise e
    finally:
        latency_ms = (time.time() - start_time) * 1000
        logger.info(f"--- Agent Step End: {agent_name} in {latency_ms:.2f}ms ---")
        
        calls = get_trace_session_calls()
        files = get_trace_session_files()
        
        # Determine if fallback parser was run: if we have no successful LLM calls, or if LLM config failed
        if not calls or all(c.get("status") in ("error", "timeout") for c in calls):
            fallback_used = True
            
        trace_entry = {
            "timestamp": datetime.datetime.now().isoformat(),
            "active_agent": agent_name,
            "model_name": model_name,
            "temperature": temperature,
            "persona_template": persona_template,
            "user_message": user_msg,
            "latency_ms": latency_ms,
            "action": result_state.get("action", "NONE") if result_state else "NONE",
            "target_agent": result_state.get("target_agent", None) if result_state else None,
            "response_text": result_state.get("response_text", "") if result_state else "",
            "generated_files": files,
            "fallback_used": fallback_used,
            "calls": calls
        }
        
        try:
            append_agent_trace(trace_entry)
        except Exception as te:
            logger.error(f"Failed to save agent trace: {te}")
            
    return result_state


# ─────────────────────────────────────────────────────────────
# Langgraph Node Functions — Each agent owns its node
# ─────────────────────────────────────────────────────────────
def pm_agent_node(state: AgentState) -> AgentState:
    state["agent"] = "PMAgent"
    return process_instruction(state)

def dev_agent_node(state: AgentState) -> AgentState:
    state["agent"] = "DevAgent"
    return process_instruction(state)

def design_agent_node(state: AgentState) -> AgentState:
    state["agent"] = "DesignAgent"
    return process_instruction(state)

def consultant_agent_node(state: AgentState) -> AgentState:
    state["agent"] = "Consultant"
    return process_instruction(state)

def partner_agent_node(state: AgentState) -> AgentState:
    state["agent"] = "Partner"
    return process_instruction(state)

def director_agent_node(state: AgentState) -> AgentState:
    state["agent"] = "Director"
    return process_instruction(state)

def qa_agent_node(state: AgentState) -> AgentState:
    state["agent"] = "QAAgent"
    return process_instruction(state)

# ─────────────────────────────────────────────────────────────
# Build the Langgraph workflow
# ─────────────────────────────────────────────────────────────
def get_agent_graph():
    workflow = StateGraph(AgentState)
    
    # 1. Register all agent nodes explicitly in LangGraph
    workflow.add_node("pm", pm_agent_node)
    workflow.add_node("consultant", consultant_agent_node)
    workflow.add_node("design", design_agent_node)
    workflow.add_node("dev", dev_agent_node)
    workflow.add_node("qa", qa_agent_node)
    workflow.add_node("partner", partner_agent_node)
    workflow.add_node("director", director_agent_node)
    
    # 2. Define entry routing based on active agent
    def route_entry(state: AgentState) -> str:
        agent = state.get("agent", "PMAgent")
        if agent == "DevAgent":
            return "dev"
        elif agent == "DesignAgent":
            return "design"
        elif agent == "Consultant":
            return "consultant"
        elif agent == "Partner":
            return "partner"
        elif agent == "Director":
            return "director"
        elif agent == "QAAgent":
            return "qa"
        return "pm"

    # Set conditional entry point to route requests to the active agent node
    workflow.set_conditional_entry_point(
        route_entry,
        {
            "pm": "pm",
            "consultant": "consultant",
            "design": "design",
            "dev": "dev",
            "qa": "qa",
            "partner": "partner",
            "director": "director"
        }
    )
    
    # 3. Define explicit agent-to-agent collaborative edges
    # We route to END at runtime to pause and yield to the client-side simulator
    # animation and chat feed, but register the explicit transitions in the graph structure.
    
    workflow.add_conditional_edges(
        "pm",
        lambda state: END,
        {
            "consultant": "consultant",
            "partner": "partner",
            "director": "director",
            "end": END
        }
    )
    
    workflow.add_conditional_edges(
        "consultant",
        lambda state: END,
        {
            "design": "design",
            "end": END
        }
    )
    
    workflow.add_conditional_edges(
        "design",
        lambda state: END,
        {
            "dev": "dev",
            "end": END
        }
    )
    
    workflow.add_conditional_edges(
        "dev",
        lambda state: END,
        {
            "qa": "qa",
            "end": END
        }
    )
    
    workflow.add_conditional_edges(
        "qa",
        lambda state: END,
        {
            "pm": "pm",
            "end": END
        }
    )
    
    workflow.add_conditional_edges(
        "partner",
        lambda state: END,
        {
            "pm": "pm",
            "end": END
        }
    )
    
    workflow.add_conditional_edges(
        "director",
        lambda state: END,
        {
            "pm": "pm",
            "end": END
        }
    )
    
    return workflow.compile()
