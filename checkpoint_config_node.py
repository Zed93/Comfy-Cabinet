import os
import sqlite3
import json
from aiohttp import web
import folder_paths
import comfy.samplers
from server import PromptServer

DB_PATH = os.path.join(os.path.dirname(__file__), "checkpoint_configs.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS checkpoint_settings (
            checkpoint_name TEXT PRIMARY KEY,
            steps INTEGER,
            cfg REAL,
            sampler_name TEXT,
            scheduler TEXT,
            prefix_prompt TEXT,
            suffix_prompt TEXT,
            clip_skip INTEGER
        )
    """)
    try:
        cursor.execute("ALTER TABLE checkpoint_settings ADD COLUMN clip_skip INTEGER")
    except sqlite3.OperationalError:
        pass
    cursor.execute("CREATE TABLE IF NOT EXISTS global_settings (key TEXT PRIMARY KEY, value TEXT)")
    defaults = [
        ("default_steps", "20"),
        ("default_cfg", "7.0"),
        ("default_sampler", "euler"),
        ("default_scheduler", "normal"),
        ("default_clip_skip", "-1"),
        ("prompt_separator", ", ")
    ]
    for key, val in defaults:
        cursor.execute("INSERT OR IGNORE INTO global_settings (key, value) VALUES (?, ?)", (key, val))
    conn.commit()
    conn.close()

init_db()

def get_global_settings():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM global_settings")
    rows = cursor.fetchall()
    conn.close()
    return {row[0]: row[1] for row in rows}

def get_settings(checkpoint_name):
    globals_dict = get_global_settings()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT steps, cfg, sampler_name, scheduler, prefix_prompt, suffix_prompt, clip_skip FROM checkpoint_settings WHERE checkpoint_name = ?", (checkpoint_name,))
        row = cursor.fetchone()
    except sqlite3.OperationalError:
        cursor.execute("SELECT steps, cfg, sampler_name, scheduler, prefix_prompt, suffix_prompt FROM checkpoint_settings WHERE checkpoint_name = ?", (checkpoint_name,))
        row = cursor.fetchone()
        if row: row = tuple(list(row) + [-1])
        
    conn.close()
    
    default_clip_skip = int(globals_dict.get("default_clip_skip", -1))
    
    if row:
        return {
            "steps": row[0] if row[0] is not None else int(globals_dict["default_steps"]),
            "cfg": row[1] if row[1] is not None else float(globals_dict["default_cfg"]),
            "sampler_name": row[2] if row[2] else globals_dict["default_sampler"],
            "scheduler": row[3] if row[3] else globals_dict["default_scheduler"],
            "prefix_prompt": row[4] if row[4] else "",
            "suffix_prompt": row[5] if row[5] else "",
            "clip_skip": row[6] if (len(row) > 6 and row[6] is not None) else default_clip_skip
        }
    return {
        "steps": int(globals_dict["default_steps"]),
        "cfg": float(globals_dict["default_cfg"]),
        "sampler_name": globals_dict["default_sampler"],
        "scheduler": globals_dict["default_scheduler"],
        "prefix_prompt": "",
        "suffix_prompt": "",
        "clip_skip": default_clip_skip
    }

# ==================== API ENDPOINTS ====================

@PromptServer.instance.routes.get("/smart_config/get_resources")
async def api_get_resources(request):
    try:
        checkpoints = folder_paths.get_filename_list("checkpoints")
        samplers = comfy.samplers.KSampler.SAMPLERS
        schedulers = comfy.samplers.KSampler.SCHEDULERS
        global_configs = get_global_settings()
        return web.json_response({"checkpoints": checkpoints, "samplers": samplers, "schedulers": schedulers, "global_configs": global_configs})
    except Exception as e: return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.get("/smart_config/get_settings")
async def api_get_settings(request):
    checkpoint = request.query.get("checkpoint")
    if not checkpoint: return web.json_response({"error": "Parametro mancante"}, status=400)
    return web.json_response(get_settings(checkpoint))

@PromptServer.instance.routes.post("/smart_config/save_settings")
async def api_save_settings(request):
    try:
        data = await request.json()
        checkpoint = data.get("checkpoint")
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        clip_skip_val = int(data.get('clip_skip', -1))
        cursor.execute("""
            INSERT INTO checkpoint_settings (checkpoint_name, steps, cfg, sampler_name, scheduler, prefix_prompt, suffix_prompt, clip_skip)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(checkpoint_name) DO UPDATE SET
                steps=excluded.steps, cfg=excluded.cfg, sampler_name=excluded.sampler_name,
                scheduler=excluded.scheduler, prefix_prompt=excluded.prefix_prompt, suffix_prompt=excluded.suffix_prompt, clip_skip=excluded.clip_skip
        """, (checkpoint, int(data['steps']), float(data['cfg']), data['sampler_name'], data['scheduler'], data['prefix_prompt'], data['suffix_prompt'], clip_skip_val))
        conn.commit()
        conn.close()
        return web.json_response({"status": "saved"})
    except Exception as e: return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.post("/smart_config/save_globals")
async def api_save_globals(request):
    try:
        data = await request.json()
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        for key, value in data.items():
            cursor.execute("INSERT OR REPLACE INTO global_settings (key, value) VALUES (?, ?)", (key, str(value)))
        conn.commit()
        conn.close()
        return web.json_response({"status": "globals_saved"})
    except Exception as e: return web.json_response({"error": str(e)}, status=500)

# ==================== COMFYUI CUSTOM NODE ====================

class EasyCheckpointConfigLoader:
    def __init__(self): pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "checkpoint": (folder_paths.get_filename_list("checkpoints"), ),
                "user_prompt": ("STRING", {"multiline": True, "default": "A beautiful landscape"}),
            }
        }

    RETURN_TYPES = ("MODEL", "CLIP", "VAE", "INT", "FLOAT", "*", "*", "STRING")
    RETURN_NAMES = ("MODEL", "CLIP", "VAE", "steps", "cfg", "sampler_name", "scheduler", "final_prompt")
    FUNCTION = "process"
    CATEGORY = "🗄️ Comfy Cabinet"

    @classmethod
    def IS_CHANGED(s, checkpoint, user_prompt):
        import time
        return time.time()

    def process(self, checkpoint, user_prompt):
        import nodes
        model, clip, vae = nodes.CheckpointLoaderSimple().load_checkpoint(checkpoint)
        settings = get_settings(checkpoint)
        global_configs = get_global_settings()
        
        clip_skip = settings.get("clip_skip", -1)
        if clip_skip < -1:
            clip = clip.clone()
            clip.clip_layer(clip_skip)
            
        separator = global_configs.get("prompt_separator", ", ").replace("\\n", "\n").replace("\\t", "\t")

        prompt_segments = []
        if settings["prefix_prompt"]: prompt_segments.append(settings["prefix_prompt"])
        if user_prompt: prompt_segments.append(user_prompt)
        if settings["suffix_prompt"]: prompt_segments.append(settings["suffix_prompt"])
            
        full_prompt = separator.join(prompt_segments)
        return (model, clip, vae, settings["steps"], settings["cfg"], settings["sampler_name"], settings["scheduler"], full_prompt)

NODE_CLASS_MAPPINGS = {"EasyCheckpointConfigLoader": EasyCheckpointConfigLoader}
NODE_DISPLAY_NAME_MAPPINGS = {"EasyCheckpointConfigLoader": "🎨 Easy Checkpoint Config Loader"}