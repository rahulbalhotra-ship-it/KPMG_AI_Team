def fallback_parser(message: str, agent: str, state_str: str, scope: str, step: int) -> dict:
    msg = message.lower()
    
    if state_str == "PLAN_PENDING":
        return {
            "action": "NONE",
            "response_text": f"I have drafted the project plan for '{scope}'. Please click the 'SIGN OFF PLAN' button to approve the plan and start development.",
            "target_agent": None,
            "project_scope": None
        }
    elif state_str == "DEVELOPMENT":
        if step == 0:
            return {
                "action": "STANDUP",
                "response_text": "Great! The project plan is signed off. Team, let's assemble in the meeting room for our standup sync.",
                "target_agent": "ALL",
                "project_scope": None
            }
        elif step == 1:
            return {
                "action": "WORK",
                "response_text": "DesignAgent: I have generated the UI/UX specifications ('design_specs.md') in the deliverables directory. DevAgent, please proceed with the FastAPI backend implementation.",
                "target_agent": "DevAgent",
                "project_scope": None
            }
        elif step == 2:
            return {
                "action": "WORK",
                "response_text": "DevAgent: FastAPI application logic has been written to 'app.py'. QAAgent, please run verification tests and review code quality.",
                "target_agent": "QAAgent",
                "project_scope": None
            }
        elif step == 3:
            return {
                "action": "WORK",
                "response_text": "QAAgent: I have generated the unit test suite ('test_app.py') and completed the code quality analysis ('qa_report.md'). Passing back to PMAgent for final review.",
                "target_agent": "PMAgent",
                "project_scope": None
            }
        elif step == 4:
            return {
                "action": "STANDUP",
                "response_text": "PMAgent: All deliverables are ready! Team, let's sync in the meeting room to wrap up the project.",
                "target_agent": "ALL",
                "project_scope": None
            }
    elif state_str == "COMPLETED":
        return {
            "action": "NONE",
            "response_text": "PMAgent: The project is fully complete! You can download all deliverables (plan, charter, design specs, code, configuration) from the DELIVERABLES DIRECTORY button above.",
            "target_agent": None,
            "project_scope": None
        }

    # Standard responses for general conversation
    if agent == "DevAgent":
        return {
            "action": "WORK",
            "response_text": f"DevAgent here. I'm currently working on our deliverables. I've received your input: '{message}'. Let's build it!",
            "target_agent": None,
            "project_scope": None
        }
    elif agent == "DesignAgent":
        return {
            "action": "WORK",
            "response_text": f"DesignAgent here. I am looking over the user interface mockups. I've noted your input: '{message}'",
            "target_agent": None,
            "project_scope": None
        }
    elif agent == "QAAgent":
        return {
            "action": "WORK",
            "response_text": f"QAAgent here. I'm currently auditing the codebase and writing test cases. I've received your check: '{message}'.",
            "target_agent": None,
            "project_scope": None
        }
        
    # Default PM Agent Fallbacks
    if any(k in msg for k in ["standup", "sync", "meeting", "gather"]):
        return {
            "action": "STANDUP",
            "response_text": "Team, let's assemble in the meeting room for our standup sync immediately!",
            "target_agent": "ALL",
            "project_scope": None
        }
    elif any(k in msg for k in ["work", "desk", "code", "coding"]):
        return {
            "action": "WORK",
            "response_text": "Alright team, let's head back to our desks and focus on our respective deliverables.",
            "target_agent": "ALL",
            "project_scope": None
        }
    elif any(k in msg for k in ["break", "coffee", "lunch", "water", "relax"]):
        return {
            "action": "BREAK",
            "response_text": "Great progress today. Let's take a quick coffee break in the break room!",
            "target_agent": "ALL",
            "project_scope": None
        }
    elif any(k in msg for k in ["dispatch", "assign", "random", "tasks"]):
        return {
            "action": "DISPATCH",
            "response_text": "I'm dispatching some new sprints and engineering tasks to the team now.",
            "target_agent": "ALL",
            "project_scope": None
        }
    
    # Generic chat responses
    if "hello" in msg or "hi" in msg:
        return {
            "action": "NONE",
            "response_text": "Hello! I am the PM Agent. I can coordinate the team: try asking me to call a standup, go back to work, take a break, or assign new tasks.",
            "target_agent": None,
            "project_scope": None
        }
    
    return {
        "action": "NONE",
        "response_text": f"Understood. Let me look into that request: '{message}'",
        "target_agent": None,
        "project_scope": None
    }
