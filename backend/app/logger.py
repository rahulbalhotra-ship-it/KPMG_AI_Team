import os
import logging
from logging.handlers import RotatingFileHandler

def setup_logger():
    # Ensure deliverables directory exists in the workspace
    deliverables_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "deliverables"))
    os.makedirs(deliverables_dir, exist_ok=True)
    
    log_file = os.path.join(deliverables_dir, "app_server.log")
    
    logger = logging.getLogger("app")
    logger.setLevel(logging.INFO)
    
    # Avoid duplicate handlers if setup_logger is called multiple times
    if logger.handlers:
        return logger
        
    formatter = logging.Formatter('[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s')
    
    # Console Handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # File Handler
    try:
        file_handler = RotatingFileHandler(log_file, maxBytes=10*1024*1024, backupCount=5, encoding="utf-8")
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    except Exception as e:
        print(f"Warning: could not set up app_server.log file logging: {e}")
        
    return logger

logger = setup_logger()
