import os
import sqlite3
import json
from aiohttp import web
from server import PromptServer  # type: ignore

DB_PATH = os.path.join(os.path.dirname(__file__), "prompt_blocks.db")

def migrate_db(conn):
    cursor = conn.cursor()
    for table in ["preset_scenes", "active_prompt_config"]:
        cursor.execute(f"PRAGMA table_info({table})")
        cols = [row[1] for row in cursor.fetchall()]
        if "mood" in cols and "expression" not in cols:
            try:
                cursor.execute(f"ALTER TABLE {table} RENAME COLUMN mood TO expression")
            except Exception:
                cursor.execute(f"ALTER TABLE {table} ADD COLUMN expression TEXT DEFAULT ''")
        elif "expression" not in cols and cols:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN expression TEXT DEFAULT ''")
    conn.commit()

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS saved_blocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS preset_scenes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            prefix TEXT DEFAULT '',
            character TEXT DEFAULT '',
            clothing TEXT DEFAULT '',
            expression TEXT DEFAULT '',
            situation TEXT DEFAULT '',
            location TEXT DEFAULT '',
            lighting TEXT DEFAULT '',
            suffix TEXT DEFAULT '',
            separator TEXT DEFAULT ', '
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS active_prompt_config (
            id INTEGER PRIMARY KEY,
            prefix TEXT DEFAULT '',
            character TEXT DEFAULT '',
            clothing TEXT DEFAULT '',
            expression TEXT DEFAULT '',
            situation TEXT DEFAULT '',
            location TEXT DEFAULT '',
            lighting TEXT DEFAULT '',
            suffix TEXT DEFAULT '',
            separator TEXT DEFAULT ', '
        )
    """)
    conn.commit()
    migrate_db(conn)
    cursor.execute("""
        INSERT OR IGNORE INTO active_prompt_config (id, prefix, character, clothing, expression, situation, location, lighting, suffix, separator)
        VALUES (1, '', '', '', '', '', '', '', '', ', ')
    """)
    conn.commit()
    conn.close()

init_db()

def get_all_saved_blocks():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, category, title, content, created_at FROM saved_blocks ORDER BY title ASC")
    rows = cursor.fetchall()
    conn.close()
    return [
        {"id": row[0], "category": row[1], "title": row[2], "content": row[3], "created_at": row[4]}
        for row in rows
    ]

def get_all_scene_presets():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, prefix, character, clothing, expression, situation, location, lighting, suffix, separator FROM preset_scenes ORDER BY name ASC")
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id": row[0], "name": row[1], "prefix": row[2], "character": row[3],
            "clothing": row[4], "expression": row[5], "situation": row[6], "location": row[7],
            "lighting": row[8], "suffix": row[9], "separator": row[10]
        }
        for row in rows
    ]

def get_active_config():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT prefix, character, clothing, expression, situation, location, lighting, suffix, separator FROM active_prompt_config WHERE id = 1")
    row = cursor.fetchone()
    conn.close()
    if row:
        return {
            "prefix": row[0] or "", "character": row[1] or "", "clothing": row[2] or "",
            "expression": row[3] or "", "situation": row[4] or "", "location": row[5] or "",
            "lighting": row[6] or "", "suffix": row[7] or "", "separator": row[8] or ", "
        }
    return {
        "prefix": "", "character": "", "clothing": "", "expression": "",
        "situation": "", "location": "", "lighting": "", "suffix": "", "separator": ", "
    }

# ==================== API ENDPOINTS ====================

@PromptServer.instance.routes.get("/prompt_builder/get_data")
async def api_get_prompt_builder_data(request):
    try:
        blocks = get_all_saved_blocks()
        scene_presets = get_all_scene_presets()
        active = get_active_config()
        return web.json_response({
            "saved_blocks": blocks,
            "scene_presets": scene_presets,
            "active_config": active
        })
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.post("/prompt_builder/save_block")
async def api_save_block(request):
    try:
        data = await request.json()
        category = data.get("category", "").strip()
        if category == "mood":
            category = "expression"
        title = data.get("title", "").strip()
        content = data.get("content", "").strip()
        block_id = data.get("id")

        if not category or not title:
            return web.json_response({"error": "Category and title are required"}, status=400)

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        if block_id:
            cursor.execute(
                "UPDATE saved_blocks SET category = ?, title = ?, content = ? WHERE id = ?",
                (category, title, content, block_id)
            )
        else:
            cursor.execute(
                "INSERT INTO saved_blocks (category, title, content) VALUES (?, ?, ?)",
                (category, title, content)
            )
            block_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return web.json_response({"status": "saved", "id": block_id})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.post("/prompt_builder/delete_block")
async def api_delete_block(request):
    try:
        data = await request.json()
        block_id = data.get("id")
        if not block_id:
            return web.json_response({"error": "ID missing"}, status=400)

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM saved_blocks WHERE id = ?", (block_id,))
        conn.commit()
        conn.close()
        return web.json_response({"status": "deleted"})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.post("/prompt_builder/save_scene_preset")
async def api_save_scene_preset(request):
    try:
        data = await request.json()
        name = data.get("name", "").strip()
        if not name:
            return web.json_response({"error": "Preset name is required"}, status=400)

        prefix = data.get("prefix", "")
        character = data.get("character", "")
        clothing = data.get("clothing", "")
        expression = data.get("expression", data.get("mood", ""))
        situation = data.get("situation", "")
        location = data.get("location", "")
        lighting = data.get("lighting", "")
        suffix = data.get("suffix", "")
        separator = data.get("separator", ", ")

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO preset_scenes (name, prefix, character, clothing, expression, situation, location, lighting, suffix, separator)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                prefix=excluded.prefix, character=excluded.character, clothing=excluded.clothing,
                expression=excluded.expression, situation=excluded.situation, location=excluded.location,
                lighting=excluded.lighting, suffix=excluded.suffix, separator=excluded.separator
        """, (name, prefix, character, clothing, expression, situation, location, lighting, suffix, separator))
        conn.commit()
        conn.close()
        return web.json_response({"status": "scene_saved"})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.post("/prompt_builder/delete_scene_preset")
async def api_delete_scene_preset(request):
    try:
        data = await request.json()
        scene_id = data.get("id")
        name = data.get("name")

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        if scene_id:
            cursor.execute("DELETE FROM preset_scenes WHERE id = ?", (scene_id,))
        elif name:
            cursor.execute("DELETE FROM preset_scenes WHERE name = ?", (name,))
        else:
            conn.close()
            return web.json_response({"error": "ID or name missing"}, status=400)
        conn.commit()
        conn.close()
        return web.json_response({"status": "scene_deleted"})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.post("/prompt_builder/save_active")
async def api_save_active(request):
    try:
        data = await request.json()
        prefix = data.get("prefix", "")
        character = data.get("character", "")
        clothing = data.get("clothing", "")
        expression = data.get("expression", data.get("mood", ""))
        situation = data.get("situation", "")
        location = data.get("location", "")
        lighting = data.get("lighting", "")
        suffix = data.get("suffix", "")
        separator = data.get("separator", ", ")

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO active_prompt_config (id, prefix, character, clothing, expression, situation, location, lighting, suffix, separator)
            VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                prefix=excluded.prefix, character=excluded.character, clothing=excluded.clothing,
                expression=excluded.expression, situation=excluded.situation, location=excluded.location,
                lighting=excluded.lighting, suffix=excluded.suffix, separator=excluded.separator
        """, (prefix, character, clothing, expression, situation, location, lighting, suffix, separator))
        conn.commit()
        conn.close()

        active_config = {
            "prefix": prefix,
            "character": character,
            "clothing": clothing,
            "expression": expression,
            "situation": situation,
            "location": location,
            "lighting": lighting,
            "suffix": suffix,
            "separator": separator
        }
        try:
            PromptServer.instance.send_sync("prompt_builder_update", active_config)
        except Exception as err:
            print(f"[EasyPromptBuilder] Could not send prompt_builder_update sync event: {err}")

        return web.json_response({"status": "active_saved", "config": active_config})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

# ==================== COMFYUI CUSTOM NODE ====================

class EasyPromptBuilder:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        scene_names = ["None / Custom / Active Config"]
        try:
            scenes = get_all_scene_presets()
            scene_names.extend([sc["name"] for sc in scenes])
        except Exception:
            pass

        return {
            "required": {
                "prefix": ("STRING", {"multiline": True, "default": ""}),
                "character": ("STRING", {"multiline": True, "default": ""}),
                "clothing": ("STRING", {"multiline": True, "default": ""}),
                "expression": ("STRING", {"multiline": True, "default": ""}),
                "situation": ("STRING", {"multiline": True, "default": ""}),
                "location": ("STRING", {"multiline": True, "default": ""}),
                "lighting": ("STRING", {"multiline": True, "default": ""}),
                "suffix": ("STRING", {"multiline": True, "default": ""}),
            },
            "optional": {
                "separator": ("STRING", {"default": ", "}),
                "scene_preset": (scene_names, {"default": "None / Custom / Active Config"}),
            }
        }

    RETURN_TYPES = ("STRING", "STRING", "STRING", "STRING", "STRING", "STRING", "STRING", "STRING", "STRING")
    RETURN_NAMES = ("final_prompt", "prefix", "character", "clothing", "expression", "situation", "location", "lighting", "suffix")
    FUNCTION = "process"
    CATEGORY = "🗄️ Comfy Cabinet"

    @classmethod
    def IS_CHANGED(s, **kwargs):
        import time
        return time.time()

    def process(self, prefix, character, clothing, expression="", situation="", location="", lighting="", suffix="", separator=", ", scene_preset="None / Custom / Active Config", mood=None):
        p_expression = expression if expression else (mood or "")
        p_prefix = prefix
        p_character = character
        p_clothing = clothing
        p_situation = situation
        p_location = location
        p_lighting = lighting
        p_suffix = suffix
        p_sep = separator

        # If a preset is selected from dropdown and fields are empty, pull from preset scene or active config
        if scene_preset and scene_preset != "None / Custom / Active Config":
            try:
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT prefix, character, clothing, expression, situation, location, lighting, suffix, separator FROM preset_scenes WHERE name = ?",
                    (scene_preset,)
                )
                row = cursor.fetchone()
                conn.close()
                if row:
                    if not p_prefix: p_prefix = row[0] or ""
                    if not p_character: p_character = row[1] or ""
                    if not p_clothing: p_clothing = row[2] or ""
                    if not p_expression: p_expression = row[3] or ""
                    if not p_situation: p_situation = row[4] or ""
                    if not p_location: p_location = row[5] or ""
                    if not p_lighting: p_lighting = row[6] or ""
                    if not p_suffix: p_suffix = row[7] or ""
                    if not p_sep or p_sep == ", ": p_sep = row[8] or ", "
            except Exception:
                pass
        elif not any([p_prefix, p_character, p_clothing, p_expression, p_situation, p_location, p_lighting, p_suffix]):
            # If all inputs are blank, fallback to active config state saved from web UI
            active = get_active_config()
            p_prefix = active["prefix"]
            p_character = active["character"]
            p_clothing = active["clothing"]
            p_expression = active["expression"]
            p_situation = active["situation"]
            p_location = active["location"]
            p_lighting = active["lighting"]
            p_suffix = active["suffix"]
            p_sep = active["separator"]

        formatted_sep = p_sep.replace("\\n", "\n").replace("\\t", "\t")

        blocks = [p_prefix, p_character, p_clothing, p_expression, p_situation, p_location, p_lighting, p_suffix]
        active_blocks = [b.strip() for b in blocks if b and b.strip()]

        final_prompt = formatted_sep.join(active_blocks)

        return (
            final_prompt,
            p_prefix,
            p_character,
            p_clothing,
            p_expression,
            p_situation,
            p_location,
            p_lighting,
            p_suffix
        )

NODE_CLASS_MAPPINGS = {"EasyPromptBuilder": EasyPromptBuilder}
NODE_DISPLAY_NAME_MAPPINGS = {"EasyPromptBuilder": "🧩 Easy Prompt Builder"}

