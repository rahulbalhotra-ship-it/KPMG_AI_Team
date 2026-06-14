import os
import sys
import json
from dotenv import load_dotenv

# Prevent script directory from shadowing the package structure,
# then ensure we can import from the agents package in the workspace root
# and resolve the mock 'langgraph' module from the backend directory
script_dir = os.path.dirname(os.path.abspath(__file__))
while script_dir in sys.path:
    sys.path.remove(script_dir)

WORKSPACE_ROOT = os.path.abspath(os.path.join(script_dir, ".."))
BACKEND_DIR = os.path.join(WORKSPACE_ROOT, "backend")
if WORKSPACE_ROOT not in sys.path:
    sys.path.insert(0, WORKSPACE_ROOT)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Load environment variables
load_dotenv(os.path.join(WORKSPACE_ROOT, ".env"))

from agents.agents.graph import get_agent_graph
from agents.agents.state import load_project_state, save_project_state, DELIVERABLES_DIR, STATE_FILE

# ANSI color codes
COLOR_RESET = "\033[0m"
COLOR_BOLD = "\033[1m"
COLOR_CYAN = "\033[36m"
COLOR_GREEN = "\033[32m"
COLOR_YELLOW = "\033[33m"
COLOR_RED = "\033[31m"
COLOR_MAGENTA = "\033[35m"
COLOR_BLUE = "\033[34m"

def print_banner():
    banner = f"""
{COLOR_CYAN}{COLOR_BOLD}==================================================================
  KPMG Solutions & Analytics - Agentic AI CLI Testing Terminal
=================================================================={COLOR_RESET}
Welcome! You can test our team of agents interactively here.

{COLOR_BOLD}Available slash commands:{COLOR_RESET}
  {COLOR_YELLOW}/state{COLOR_RESET}         - View current project phase, step, and generated files
  {COLOR_YELLOW}/reset{COLOR_RESET}         - Reset project state and delete deliverables
  {COLOR_YELLOW}/agent <name>{COLOR_RESET} - Set active agent (PMAgent, DevAgent, DesignAgent, OpsAgent)
  {COLOR_YELLOW}/exit{COLOR_RESET} or {COLOR_YELLOW}/quit{COLOR_RESET} - Exit the terminal testing loop

  Type any message to interact with the active agent.
==================================================================
"""
    print(banner)

def print_state():
    proj_state = load_project_state()
    print(f"\n{COLOR_CYAN}{COLOR_BOLD}--- CURRENT PROJECT STATE ---{COLOR_RESET}")
    print(f"{COLOR_BOLD}Lifecycle State:{COLOR_RESET} {COLOR_MAGENTA}{proj_state.get('state')}{COLOR_RESET}")
    print(f"{COLOR_BOLD}Project Scope:{COLOR_RESET} {proj_state.get('scope', 'None set yet')}")
    print(f"{COLOR_BOLD}Current Step:{COLOR_RESET} {proj_state.get('step', 0)}")
    print(f"{COLOR_BOLD}Phases:{COLOR_RESET}")
    for phase, status in proj_state.get("phases", {}).items():
        color = COLOR_GREEN if status == "Completed" else (COLOR_YELLOW if status == "In Progress" else COLOR_RESET)
        print(f"  - {phase}: {color}{status}{COLOR_RESET}")
    
    print(f"{COLOR_BOLD}Generated Deliverables:{COLOR_RESET}")
    if os.path.exists(DELIVERABLES_DIR):
        files = [f for f in os.listdir(DELIVERABLES_DIR) if f != "project_state.json"]
        if files:
            for f in files:
                path = os.path.join(DELIVERABLES_DIR, f)
                size_kb = os.path.getsize(path) / 1024
                print(f"  - {COLOR_GREEN}{f}{COLOR_RESET} ({size_kb:.2f} KB)")
        else:
            print("  - No deliverables generated yet.")
    else:
        print("  - Deliverables directory does not exist.")
    print(f"{COLOR_CYAN}{COLOR_BOLD}-----------------------------{COLOR_RESET}\n")

def reset_project():
    print(f"{COLOR_YELLOW}Resetting project state and clearing deliverables...{COLOR_RESET}")
    if os.path.exists(DELIVERABLES_DIR):
        for f in os.listdir(DELIVERABLES_DIR):
            path = os.path.join(DELIVERABLES_DIR, f)
            try:
                if os.path.isfile(path):
                    os.remove(path)
            except Exception as e:
                print(f"{COLOR_RED}Failed to remove {f}: {e}{COLOR_RESET}")
    
    default_state = {
        "state": "IDLE",
        "scope": "",
        "step": 0,
        "phases": {
            "Planning": "Planned",
            "Design": "Planned",
            "Development": "Planned",
            "Testing": "Planned",
            "Deployment": "Planned"
        }
    }
    save_project_state(default_state)
    print(f"{COLOR_GREEN}Reset complete!{COLOR_RESET}\n")

def main():
    # Force ANSI coloring on Windows terminals
    if os.name == 'nt':
        os.system('color')
        
    print_banner()
    agent_graph = get_agent_graph()
    active_agent = "PMAgent"
    
    while True:
        try:
            # Load state scope for display
            state = load_project_state()
            scope = state.get("scope", "")
            
            prompt_str = f"{COLOR_BOLD}{COLOR_BLUE}[{active_agent}]{COLOR_RESET} "
            if scope:
                prompt_str += f"({COLOR_CYAN}{scope[:30]}...{COLOR_RESET}) "
            prompt_str += "> "
            
            user_input = input(prompt_str).strip()
            if not user_input:
                continue
                
            # Handle Slash Commands
            if user_input.startswith("/"):
                parts = user_input.split(maxsplit=1)
                cmd = parts[0].lower()
                
                if cmd in ["/exit", "/quit"]:
                    print(f"{COLOR_YELLOW}Exiting testing terminal. Goodbye!{COLOR_RESET}")
                    break
                elif cmd == "/state":
                    print_state()
                    continue
                elif cmd == "/reset":
                    reset_project()
                    continue
                elif cmd == "/agent":
                    if len(parts) < 2:
                        print(f"{COLOR_RED}Please specify agent name. Example: /agent DevAgent{COLOR_RESET}")
                        print("Valid agents: PMAgent, DevAgent, DesignAgent, Consultant, Partner, Director, QAAgent")
                        continue
                    target = parts[1].strip()
                    valid_agents = ["PMAgent", "DevAgent", "DesignAgent", "Consultant", "Partner", "Director", "QAAgent"]
                    if target in valid_agents:
                        active_agent = target
                        print(f"{COLOR_GREEN}Switched active agent to: {active_agent}{COLOR_RESET}")
                    else:
                        print(f"{COLOR_RED}Invalid agent. Choose from: {', '.join(valid_agents)}{COLOR_RESET}")
                    continue
                else:
                    print(f"{COLOR_RED}Unknown command: {cmd}{COLOR_RESET}")
                    continue
            
            # Run state through Langgraph
            initial_state = {
                "message": user_input,
                "action": "NONE",
                "response_text": "",
                "target_agent": None,
                "agent": active_agent,
                "scope": scope,
                "project_scope": None
            }
            
            print(f"{COLOR_YELLOW}Invoking agent workflow...{COLOR_RESET}")
            result = agent_graph.invoke(initial_state)
            
            # Print response Details
            responding_agent = result.get("agent", active_agent)
            action = result.get("action", "NONE")
            text = result.get("response_text", "")
            target_agent = result.get("target_agent")
            new_scope = result.get("project_scope")
            
            print(f"\n{COLOR_GREEN}{COLOR_BOLD}=== AGENT RESPONSE ==={COLOR_RESET}")
            print(f"{COLOR_BOLD}Responder:{COLOR_RESET} {COLOR_CYAN}{responding_agent}{COLOR_RESET}")
            print(f"{COLOR_BOLD}Action:{COLOR_RESET} {COLOR_MAGENTA}{action}{COLOR_RESET}")
            if target_agent:
                print(f"{COLOR_BOLD}Target/Hand-off Agent:{COLOR_RESET} {COLOR_YELLOW}{target_agent}{COLOR_RESET}")
            if new_scope:
                print(f"{COLOR_BOLD}Updated Scope:{COLOR_RESET} {new_scope}")
            print(f"{COLOR_BOLD}Response Text:{COLOR_RESET}\n{text}")
            print(f"{COLOR_GREEN}{COLOR_BOLD}======================{COLOR_RESET}\n")
            
            # If target_agent is specified and we are simulating standard handoff, let's keep track or suggest switching.
            if target_agent and target_agent in ["PMAgent", "DevAgent", "DesignAgent", "Consultant", "Partner", "Director", "QAAgent"]:
                active_agent = target_agent
                print(f"{COLOR_BLUE}Active agent auto-switched to {active_agent} for handoff workflow.{COLOR_RESET}\n")
                
        except (KeyboardInterrupt, EOFError):
            print(f"\n{COLOR_YELLOW}Exiting testing terminal. Goodbye!{COLOR_RESET}")
            break
        except Exception as e:
            print(f"{COLOR_RED}Error running agent workflow: {e}{COLOR_RESET}\n")

if __name__ == "__main__":
    main()
