import os
import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
# Also search parent/workspace root directory for .env
parent_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
if os.path.exists(parent_env):
    load_dotenv(parent_env, override=True)


import time
from app.logger import logger

# Import the Langgraph PM Agent workflow
from app.agent import get_agent_graph

app = FastAPI(title="KPMG Solutions & Analytics - Agentic AI Coordinator")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Observability middleware to log latency and HTTP requests
@app.middleware("http")
async def log_requests(request, call_next):
    start_time = time.time()
    method = request.method
    url = request.url.path
    
    logger.info(f"Incoming request: {method} {url}")
    try:
        response = await call_next(request)
        # Strip Content-Length header for deliverables downloads to prevent ASGI mismatch exceptions
        # when files (like app_server.log) grow dynamically during the request lifecycle.
        if url.startswith("/api/deliverables/download/") and "content-length" in response.headers:
            del response.headers["content-length"]
        process_time = (time.time() - start_time) * 1000
        logger.info(f"Completed request: {method} {url} - Status: {response.status_code} - Latency: {process_time:.2f}ms")
        return response
    except Exception as e:
        process_time = (time.time() - start_time) * 1000
        logger.error(f"Failed request: {method} {url} - Latency: {process_time:.2f}ms - Error: {str(e)}", exc_info=True)
        raise e

# Input data model
class ChatRequest(BaseModel):
    message: str
    agent: str | None = "PMAgent"
    scope: str | None = None

# Output data model
class ChatResponse(BaseModel):
    action: str
    response_text: str
    target_agent: str | None = None
    project_scope: str | None = None
    project_state: dict | None = None

# Compile the agent graph
agent_graph = get_agent_graph()

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    try:
        # Run state through Langgraph
        initial_state = {
            "message": request.message,
            "action": "NONE",
            "response_text": "",
            "target_agent": None,
            "agent": request.agent or "PMAgent",
            "scope": request.scope or "",
            "project_scope": None
        }
        
        result = await asyncio.to_thread(agent_graph.invoke, initial_state)
        
        return ChatResponse(
            action=result.get("action", "NONE"),
            response_text=result.get("response_text", ""),
            target_agent=result.get("target_agent", None),
            project_scope=result.get("project_scope", None),
            project_state=result.get("project_state", None)
        )
    except Exception as e:
        logger.error(f"Error in chat_endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Agent workflow execution failed: {str(e)}")

# Expose Deliverables Directory APIs
DELIVERABLES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "deliverables"))

@app.get("/api/deliverables")
async def get_deliverables():
    if not os.path.exists(DELIVERABLES_DIR):
        os.makedirs(DELIVERABLES_DIR, exist_ok=True)
    files = []
    for f in os.listdir(DELIVERABLES_DIR):
        path = os.path.join(DELIVERABLES_DIR, f)
        if os.path.isfile(path) and f != "project_state.json":
            files.append({
                "name": f,
                "size": f"{os.path.getsize(path) / 1024:.1f} KB",
                "url": f"/api/deliverables/download/{f}"
            })
    return files

@app.get("/api/deliverables/download/{filename}")
async def download_deliverable(filename: str):
    path = os.path.join(DELIVERABLES_DIR, filename)
    if os.path.exists(path) and os.path.isfile(path):
        return FileResponse(path, filename=filename)
    raise HTTPException(status_code=404, detail="File not found")

@app.get("/api/agents")
async def get_agents():
    try:
        from agents.agents.state import load_agent_configs
        return load_agent_configs()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load agent configs: {str(e)}")

@app.post("/api/agents")
async def update_agents(configs: dict):
    try:
        from agents.agents.state import save_agent_configs
        save_agent_configs(configs)
        return {"status": "success", "message": "Agent configurations updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save agent configs: {str(e)}")


@app.post("/api/reset")
async def reset_project():
    import json
    if os.path.exists(DELIVERABLES_DIR):
        for f in os.listdir(DELIVERABLES_DIR):
            path = os.path.join(DELIVERABLES_DIR, f)
            try:
                if os.path.isfile(path):
                    os.remove(path)
            except Exception as e:
                print(f"Failed to remove {path}: {e}")
    state_file = os.path.join(DELIVERABLES_DIR, "project_state.json")
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
    with open(state_file, 'w', encoding='utf-8') as f:
        json.dump(default_state, f, indent=2)
    return {"status": "success", "message": "Project state reset successfully"}

# Serve frontend static files
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend"))
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
    logger.info(f"Mounted frontend static files from: {frontend_dir}")
else:
    logger.warning(f"Frontend directory not found at: {frontend_dir}")

# Trigger reload: 1


