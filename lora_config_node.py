import os
import sqlite3
import json
import hashlib
import aiohttp
from aiohttp import web
import folder_paths  # type: ignore
from server import PromptServer  # type: ignore

DB_PATH = os.path.join(os.path.dirname(__file__), "lora_configs.db")
CACHE_DIR = os.path.join(os.path.dirname(__file__), "civitai_cache")
os.makedirs(CACHE_DIR, exist_ok=True)

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS lora_settings (
            lora_name TEXT PRIMARY KEY,
            civitai_id INTEGER,
            model_version_id INTEGER,
            weight_model REAL DEFAULT 1.0,
            weight_clip REAL DEFAULT 1.0,
            character TEXT DEFAULT '',
            clothing TEXT DEFAULT '',
            no_clothing TEXT DEFAULT '',
            expression TEXT DEFAULT '',
            situation TEXT DEFAULT '',
            location TEXT DEFAULT '',
            lighting TEXT DEFAULT '',
            trigger_words TEXT DEFAULT '',
            civitai_metadata TEXT DEFAULT '{}',
            tags TEXT DEFAULT '[]',
            base_model TEXT DEFAULT '',
            author TEXT DEFAULT '',
            file_size TEXT DEFAULT '',
            relative_path TEXT DEFAULT '',
            cover_url TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            presets TEXT DEFAULT '[]',
            last_synced TIMESTAMP
        )
    """)

    cursor.execute("PRAGMA table_info(lora_settings)")
    cols = [row[1] for row in cursor.fetchall()]
    migration_cols = [
        ("no_clothing", "TEXT DEFAULT ''"),
        ("tags", "TEXT DEFAULT '[]'"),
        ("base_model", "TEXT DEFAULT ''"),
        ("author", "TEXT DEFAULT ''"),
        ("file_size", "TEXT DEFAULT ''"),
        ("relative_path", "TEXT DEFAULT ''"),
        ("cover_url", "TEXT DEFAULT ''"),
        ("notes", "TEXT DEFAULT ''"),
        ("presets", "TEXT DEFAULT '[]'"),
        ("last_synced", "TIMESTAMP")
    ]
    for col_name, col_def in migration_cols:
        if col_name not in cols:
            try:
                cursor.execute(f"ALTER TABLE lora_settings ADD COLUMN {col_name} {col_def}")
            except Exception:
                pass

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS global_settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)
    defaults = [
        ("civitai_api_key", ""),
        ("domain_mode", "civitai.com"),
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

def get_file_info(lora_name):
    full_path = folder_paths.get_full_path("loras", lora_name)
    size_str = "Unknown"
    rel_path = lora_name
    if full_path and os.path.exists(full_path):
        size_bytes = os.path.getsize(full_path)
        if size_bytes >= 1024 * 1024 * 1024:
            size_str = f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"
        else:
            size_str = f"{size_bytes / (1024 * 1024):.1f} MB"
        rel_path = full_path.replace("\\", "/")
    return size_str, rel_path

def extract_author(model_data, selected_version):
    if not model_data and not selected_version:
        return "Unknown"

    candidates = [
        model_data.get("creator", {}).get("username") if isinstance(model_data, dict) and isinstance(model_data.get("creator"), dict) else None,
        model_data.get("model", {}).get("creator", {}).get("username") if isinstance(model_data, dict) and isinstance(model_data.get("model"), dict) and isinstance(model_data.get("model").get("creator"), dict) else None,
        selected_version.get("model", {}).get("creator", {}).get("username") if isinstance(selected_version, dict) and isinstance(selected_version.get("model"), dict) and isinstance(selected_version.get("model").get("creator"), dict) else None,
        selected_version.get("creator", {}).get("username") if isinstance(selected_version, dict) and isinstance(selected_version.get("creator"), dict) else None,
        model_data.get("user", {}).get("username") if isinstance(model_data, dict) and isinstance(model_data.get("user"), dict) else None,
    ]
    for c in candidates:
        if c and isinstance(c, str) and c.strip():
            return c.strip()
    return "Unknown"

def get_lora_settings(lora_name):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT weight_model, weight_clip, character, clothing, no_clothing, expression, situation, location, lighting,
               trigger_words, civitai_metadata, civitai_id, model_version_id, tags, base_model, author,
               file_size, relative_path, cover_url, notes, presets, last_synced
        FROM lora_settings WHERE lora_name = ?
    """, (lora_name,))
    row = cursor.fetchone()
    conn.close()

    calc_size, calc_path = get_file_info(lora_name)

    if row:
        meta = {}
        try: meta = json.loads(row[10]) if row[10] else {}
        except Exception: meta = {}

        tags_list = []
        try: tags_list = json.loads(row[13]) if row[13] else []
        except Exception: tags_list = []

        presets_list = []
        try: presets_list = json.loads(row[20]) if row[20] else []
        except Exception: presets_list = []

        # If no presets exist, construct default preset from row values
        if not presets_list:
            presets_list = [{
                "id": "default",
                "name": "Default Preset",
                "weight_model": row[0] if row[0] is not None else 1.0,
                "weight_clip": row[1] if row[1] is not None else 1.0,
                "character": row[2] or "",
                "clothing": row[3] or "",
                "no_clothing": row[4] or "",
                "expression": row[5] or "",
                "situation": row[6] or "",
                "location": row[7] or "",
                "lighting": row[8] or ""
            }]

        return {
            "lora_name": lora_name,
            "weight_model": row[0] if row[0] is not None else 1.0,
            "weight_clip": row[1] if row[1] is not None else 1.0,
            "character": row[2] or "",
            "clothing": row[3] or "",
            "no_clothing": row[4] or "",
            "expression": row[5] or "",
            "situation": row[6] or "",
            "location": row[7] or "",
            "lighting": row[8] or "",
            "trigger_words": row[9] or "",
            "civitai_metadata": meta,
            "civitai_id": row[11],
            "model_version_id": row[12],
            "tags": tags_list,
            "base_model": row[14] or "",
            "author": row[15] or "",
            "file_size": row[16] or calc_size,
            "relative_path": row[17] or calc_path,
            "cover_url": row[18] or "",
            "notes": row[19] or "",
            "presets": presets_list,
            "last_synced": row[21] or ""
        }

    default_presets = [{
        "id": "default",
        "name": "Default Preset",
        "weight_model": 1.0,
        "weight_clip": 1.0,
        "character": "",
        "clothing": "",
        "no_clothing": "",
        "expression": "",
        "situation": "",
        "location": "",
        "lighting": ""
    }]

    return {
        "lora_name": lora_name,
        "weight_model": 1.0,
        "weight_clip": 1.0,
        "character": "",
        "clothing": "",
        "no_clothing": "",
        "expression": "",
        "situation": "",
        "location": "",
        "lighting": "",
        "trigger_words": "",
        "civitai_metadata": {},
        "civitai_id": None,
        "model_version_id": None,
        "tags": [],
        "base_model": "",
        "author": "",
        "file_size": calc_size,
        "relative_path": calc_path,
        "cover_url": "",
        "notes": "",
        "presets": default_presets,
        "last_synced": ""
    }

def get_ext_from_url_or_ct(url, ct=""):
    u = url.lower()
    c = ct.lower()
    if "video/mp4" in c or ".mp4" in u: return "mp4"
    if "video/webm" in c or ".webm" in u: return "webm"
    if "image/png" in c or ".png" in u: return "png"
    if "image/webp" in c or ".webp" in u: return "webp"
    return "jpg"

async def download_to_cache(session, remote_url):
    if not remote_url:
        return ""
    if remote_url.startswith("/easy_lora_config/cache_image"):
        return remote_url

    url_hash = hashlib.md5(remote_url.encode()).hexdigest()
    ext = get_ext_from_url_or_ct(remote_url)

    cached_filename = f"{url_hash}.{ext}"
    cached_filepath = os.path.join(CACHE_DIR, cached_filename)

    if not os.path.exists(cached_filepath):
        try:
            headers = {"User-Agent": "ComfyUI-ComfyCabinet/1.0"}
            async with session.get(remote_url, headers=headers) as resp:
                if resp.status == 200:
                    ct = resp.headers.get("Content-Type", "")
                    real_ext = get_ext_from_url_or_ct(remote_url, ct)
                    if real_ext != ext:
                        ext = real_ext
                        cached_filename = f"{url_hash}.{ext}"
                        cached_filepath = os.path.join(CACHE_DIR, cached_filename)

                    data = await resp.read()
                    with open(cached_filepath, "wb") as f:
                        f.write(data)
        except Exception:
            pass

    return f"/easy_lora_config/cache_image?url={aiohttp.helpers.quote(remote_url)}"

# ==================== API ENDPOINTS ====================

@PromptServer.instance.routes.get("/easy_lora_config/cache_image")
async def api_cache_image(request):
    url = request.query.get("url")
    if not url:
        return web.json_response({"error": "url parameter required"}, status=400)

    url_hash = hashlib.md5(url.encode()).hexdigest()
    ext = get_ext_from_url_or_ct(url)
    cached_filename = f"{url_hash}.{ext}"
    cached_filepath = os.path.join(CACHE_DIR, cached_filename)

    for check_ext in ["mp4", "webm", "png", "webp", "jpg"]:
        check_path = os.path.join(CACHE_DIR, f"{url_hash}.{check_ext}")
        if os.path.exists(check_path):
            return web.FileResponse(check_path)

    try:
        headers = {"User-Agent": "ComfyUI-ComfyCabinet/1.0"}
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers) as resp:
                if resp.status == 200:
                    ct = resp.headers.get("Content-Type", "")
                    real_ext = get_ext_from_url_or_ct(url, ct)
                    final_path = os.path.join(CACHE_DIR, f"{url_hash}.{real_ext}")
                    data = await resp.read()
                    with open(final_path, "wb") as f:
                        f.write(data)
                    return web.FileResponse(final_path)
                else:
                    return web.HTTPFound(url)
    except Exception:
        return web.HTTPFound(url)

@PromptServer.instance.routes.post("/easy_lora_config/test_civitai")
async def api_test_civitai(request):
    try:
        data = await request.json()
        globals_dict = get_global_settings()
        domain = data.get("domain") or globals_dict.get("domain_mode", "civitai.com")
        api_key = data.get("api_key") if data.get("api_key") is not None else globals_dict.get("civitai_api_key", "")
        api_key = api_key.strip()

        base_url = "https://civitai.red" if "civitai.red" in domain else "https://civitai.com"
        test_url = f"{base_url}/api/v1/models?limit=1"

        headers = {"User-Agent": "ComfyUI-ComfyCabinet/1.0"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        timeout = aiohttp.ClientTimeout(total=8)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            try:
                async with session.get(test_url, headers=headers) as resp:
                    if resp.status == 200:
                        if api_key:
                            return web.json_response({
                                "ok": True,
                                "status_code": 200,
                                "message": f"Connection successful! Domain '{domain}' is online and API Key is valid & authenticated. ✅"
                            })
                        else:
                            return web.json_response({
                                "ok": True,
                                "status_code": 200,
                                "message": f"Connection successful! Domain '{domain}' is online (Anonymous Mode - No API Key provided). ℹ️"
                            })
                    elif resp.status in (401, 403):
                        return web.json_response({
                            "ok": False,
                            "error_type": "invalid_api_key",
                            "status_code": resp.status,
                            "message": f"Domain '{domain}' is online, but the provided API Key is invalid or unauthorized (HTTP {resp.status}). ❌"
                        })
                    else:
                        return web.json_response({
                            "ok": False,
                            "error_type": "http_error",
                            "status_code": resp.status,
                            "message": f"Civitai domain '{domain}' returned HTTP {resp.status}. ⚠️"
                        })
            except Exception as conn_err:
                return web.json_response({
                    "ok": False,
                    "error_type": "domain_unreachable",
                    "message": f"Cannot connect to Civitai domain '{domain}'. Network error or server offline: {str(conn_err)} ❌"
                })

    except Exception as e:
        return web.json_response({"ok": False, "error_type": "internal_error", "message": str(e)}, status=500)

@PromptServer.instance.routes.get("/easy_lora_config/get_resources")
async def api_get_resources(request):
    try:
        loras = folder_paths.get_filename_list("loras")
        globals_dict = get_global_settings()
        return web.json_response({
            "loras": loras,
            "global_configs": globals_dict
        })
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.get("/easy_lora_config/get_all_loras_full")
async def api_get_all_loras_full(request):
    try:
        loras = folder_paths.get_filename_list("loras")
        result = []
        for lora in loras:
            result.append(get_lora_settings(lora))
        globals_dict = get_global_settings()
        return web.json_response({
            "items": result,
            "global_configs": globals_dict
        })
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.get("/easy_lora_config/get_settings")
async def api_get_settings(request):
    lora = request.query.get("lora")
    if not lora:
        return web.json_response({"error": "Missing lora parameter"}, status=400)
    return web.json_response(get_lora_settings(lora))

@PromptServer.instance.routes.post("/easy_lora_config/save_settings")
async def api_save_settings(request):
    try:
        data = await request.json()
        lora_name = data.get("lora_name")
        if not lora_name:
            return web.json_response({"error": "lora_name is required"}, status=400)

        weight_model = float(data.get("weight_model", 1.0))
        weight_clip = float(data.get("weight_clip", 1.0))
        character = data.get("character", "")
        clothing = data.get("clothing", "")
        no_clothing = data.get("no_clothing", "")
        expression = data.get("expression", "")
        situation = data.get("situation", "")
        location = data.get("location", "")
        lighting = data.get("lighting", "")
        trigger_words = data.get("trigger_words", "")
        civitai_id = data.get("civitai_id")
        model_version_id = data.get("model_version_id")
        civitai_metadata = json.dumps(data.get("civitai_metadata", {}))
        
        tags = json.dumps(data.get("tags", []))
        base_model = data.get("base_model", "")
        author = data.get("author", "")
        file_size, relative_path = get_file_info(lora_name)
        cover_url = data.get("cover_url", "")
        notes = data.get("notes", "")
        presets = json.dumps(data.get("presets", []))

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO lora_settings (
                lora_name, weight_model, weight_clip, character, clothing, no_clothing, expression,
                situation, location, lighting, trigger_words, civitai_metadata, civitai_id, model_version_id,
                tags, base_model, author, file_size, relative_path, cover_url, notes, presets
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(lora_name) DO UPDATE SET
                weight_model=excluded.weight_model,
                weight_clip=excluded.weight_clip,
                character=excluded.character,
                clothing=excluded.clothing,
                no_clothing=excluded.no_clothing,
                expression=excluded.expression,
                situation=excluded.situation,
                location=excluded.location,
                lighting=excluded.lighting,
                trigger_words=excluded.trigger_words,
                civitai_metadata=excluded.civitai_metadata,
                civitai_id=excluded.civitai_id,
                model_version_id=excluded.model_version_id,
                tags=excluded.tags,
                base_model=excluded.base_model,
                author=excluded.author,
                file_size=excluded.file_size,
                relative_path=excluded.relative_path,
                cover_url=excluded.cover_url,
                notes=excluded.notes,
                presets=excluded.presets
        """, (
            lora_name, weight_model, weight_clip, character, clothing, no_clothing, expression,
            situation, location, lighting, trigger_words, civitai_metadata, civitai_id, model_version_id,
            tags, base_model, author, file_size, relative_path, cover_url, notes, presets
        ))
        conn.commit()
        conn.close()

        updated_config = get_lora_settings(lora_name)
        try:
            PromptServer.instance.send_sync("easy_lora_config_update", {"lora_name": lora_name, "config": updated_config})
        except Exception:
            pass

        return web.json_response({"status": "saved", "config": updated_config})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.post("/easy_lora_config/save_globals")
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
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.post("/easy_lora_config/compute_hash")
async def api_compute_hash(request):
    try:
        data = await request.json()
        lora_name = data.get("lora_name")
        if not lora_name:
            return web.json_response({"error": "lora_name required"}, status=400)
        
        full_path = folder_paths.get_full_path("loras", lora_name)
        if not full_path or not os.path.exists(full_path):
            return web.json_response({"error": "File not found"}, status=404)

        hasher = hashlib.sha256()
        with open(full_path, "rb") as f:
            chunk = f.read(1024 * 1024)
            while chunk:
                hasher.update(chunk)
                chunk = f.read(1024 * 1024)
        
        sha256_hash = hasher.hexdigest()
        return web.json_response({"sha256": sha256_hash})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

async def fetch_civitai_for_lora(session, lora_name, domain, api_key):
    full_path = folder_paths.get_full_path("loras", lora_name)
    file_hash = ""
    if full_path and os.path.exists(full_path):
        try:
            hasher = hashlib.sha256()
            with open(full_path, "rb") as f:
                chunk = f.read(1024 * 1024)
                while chunk:
                    hasher.update(chunk)
                    chunk = f.read(1024 * 1024)
            file_hash = hasher.hexdigest()
        except Exception:
            pass

    clean_query = lora_name.split("/")[-1].split("\\")[-1]
    clean_query = os.path.splitext(clean_query)[0].replace("-", " ").replace("_", " ")

    primary_url = "https://civitai.red" if "civitai.red" in domain else "https://civitai.com"
    secondary_url = "https://civitai.com" if "civitai.red" in domain else "https://civitai.red"
    base_urls = [primary_url, secondary_url]

    headers = {"User-Agent": "ComfyUI-ComfyCabinet/1.0"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    model_data = None
    selected_version = None

    if file_hash:
        for b_url in base_urls:
            url = f"{b_url}/api/v1/model-versions/by-hash/{file_hash}"
            try:
                async with session.get(url, headers=headers) as resp:
                    if resp.status == 200:
                        selected_version = await resp.json()
                        break
            except Exception:
                pass

        if selected_version:
            model_id = selected_version.get("modelId")
            if not model_id and isinstance(selected_version.get("model"), dict):
                model_id = selected_version.get("model").get("id")

            if model_id:
                for b_url in base_urls:
                    url_m = f"{b_url}/api/v1/models/{model_id}"
                    try:
                        async with session.get(url_m, headers=headers) as resp_m:
                            if resp_m.status == 200:
                                model_data = await resp_m.json()
                                break
                    except Exception:
                        pass

            if not model_data and isinstance(selected_version.get("model"), dict):
                model_data = selected_version.get("model")

    if not model_data or not model_data.get("name"):
        for b_url in base_urls:
            url = f"{b_url}/api/v1/models?query={aiohttp.helpers.quote(clean_query)}&types=LORA&limit=5"
            try:
                async with session.get(url, headers=headers) as resp:
                    if resp.status == 200:
                        res_json = await resp.json()
                        items = res_json.get("items", [])
                        if items:
                            found_item = items[0]
                            m_id = found_item.get("id")
                            if m_id:
                                url_m = f"{b_url}/api/v1/models/{m_id}"
                                try:
                                    async with session.get(url_m, headers=headers) as resp_m:
                                        if resp_m.status == 200:
                                            model_data = await resp_m.json()
                                except Exception:
                                    pass
                            if not model_data:
                                model_data = found_item
                            versions = model_data.get("modelVersions", [])
                            if versions and not selected_version:
                                selected_version = versions[0]
                            break
            except Exception:
                pass

    if not model_data and not selected_version:
        return None

    creator = extract_author(model_data, selected_version)
    base_model = selected_version.get("baseModel") if selected_version else (model_data.get("type") if model_data else "Unknown")
    trained_words = selected_version.get("trainedWords", []) if selected_version else []
    images = selected_version.get("images", []) if selected_version else (model_data.get("images", []) if model_data else [])
    
    civitai_tags = model_data.get("tags", []) if model_data else []
    if isinstance(civitai_tags, list):
        civitai_tags = [t.get("name") if isinstance(t, dict) else str(t) for t in civitai_tags if t]
    else:
        civitai_tags = []

    raw_cover_url = ""
    if images and len(images) > 0:
        raw_cover_url = images[0].get("url", "")

    cached_cover_url = await download_to_cache(session, raw_cover_url)

    current_settings = get_lora_settings(lora_name)
    local_tags = current_settings.get("tags", [])
    for tag in civitai_tags:
        if tag not in local_tags:
            local_tags.append(tag)

    title_val = (model_data.get("name") if model_data else None) or clean_query
    desc_val = (model_data.get("description") if model_data else "") or (selected_version.get("description") if selected_version else "")

    meta_dict = {
        "id": model_data.get("id") if model_data else (selected_version.get("modelId") if selected_version else None),
        "versionId": selected_version.get("id") if selected_version else None,
        "title": title_val,
        "name": title_val,
        "author": creator,
        "baseModel": base_model,
        "versionName": selected_version.get("name") if selected_version else "",
        "description": desc_val,
        "trainedWords": trained_words,
        "images": images,
        "tags": civitai_tags
    }

    file_size, relative_path = get_file_info(lora_name)
    trigger_words_str = ", ".join(trained_words) if trained_words else current_settings.get("trigger_words", "")
    civitai_id_val = model_data.get("id") if model_data else (selected_version.get("modelId") if selected_version else None)
    
    char_val = current_settings.get("character", "")
    if not char_val and trigger_words_str:
        char_val = trigger_words_str

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO lora_settings (
            lora_name, weight_model, weight_clip, character, clothing, no_clothing, expression,
            situation, location, lighting, trigger_words, civitai_metadata, civitai_id, model_version_id,
            tags, base_model, author, file_size, relative_path, cover_url, last_synced
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(lora_name) DO UPDATE SET
            character=CASE WHEN character = '' AND excluded.character != '' THEN excluded.character ELSE character END,
            trigger_words=CASE WHEN excluded.trigger_words != '' THEN excluded.trigger_words ELSE trigger_words END,
            civitai_metadata=excluded.civitai_metadata,
            civitai_id=excluded.civitai_id,
            model_version_id=excluded.model_version_id,
            tags=excluded.tags,
            base_model=excluded.base_model,
            author=excluded.author,
            file_size=excluded.file_size,
            relative_path=excluded.relative_path,
            cover_url=excluded.cover_url,
            last_synced=CURRENT_TIMESTAMP
    """, (
        lora_name, current_settings["weight_model"], current_settings["weight_clip"],
        char_val, current_settings["clothing"], current_settings["no_clothing"],
        current_settings["expression"], current_settings["situation"], current_settings["location"],
        current_settings["lighting"], trigger_words_str, json.dumps(meta_dict), civitai_id_val,
        selected_version.get("id") if selected_version else None,
        json.dumps(local_tags), base_model, creator, file_size, relative_path, cached_cover_url
    ))
    conn.commit()
    conn.close()

    return meta_dict

@PromptServer.instance.routes.post("/easy_lora_config/fetch_civitai")
async def api_fetch_civitai(request):
    try:
        data = await request.json()
        lora_name = data.get("lora_name")
        globals_dict = get_global_settings()
        domain = data.get("domain") or globals_dict.get("domain_mode", "civitai.com")
        api_key = data.get("api_key") or globals_dict.get("civitai_api_key", "")

        if not lora_name:
            return web.json_response({"error": "lora_name is required"}, status=400)

        async with aiohttp.ClientSession() as session:
            meta = await fetch_civitai_for_lora(session, lora_name, domain, api_key)
            if meta:
                return web.json_response({"status": "success", "data": meta})
            else:
                return web.json_response({"error": "Model metadata not found on Civitai"}, status=404)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.post("/easy_lora_config/bulk_fetch_civitai")
async def api_bulk_fetch_civitai(request):
    try:
        data = await request.json()
        globals_dict = get_global_settings()
        domain = data.get("domain") or globals_dict.get("domain_mode", "civitai.com")
        api_key = data.get("api_key") or globals_dict.get("civitai_api_key", "")

        loras = folder_paths.get_filename_list("loras")
        synced_count = 0

        async with aiohttp.ClientSession() as session:
            for lora in loras:
                res = await fetch_civitai_for_lora(session, lora, domain, api_key)
                if res:
                    synced_count += 1

        return web.json_response({
            "status": "bulk_completed",
            "total": len(loras),
            "synced": synced_count
        })
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

# ==================== COMFYUI CUSTOM NODE ====================

class EasyLoraConfigLoader:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        loras = folder_paths.get_filename_list("loras")
        return {
            "required": {
                "model": ("MODEL",),
                "clip": ("CLIP",),
                "lora_name": (loras,),
                "strength_model": ("FLOAT", {"default": 1.0, "min": -20.0, "max": 20.0, "step": 0.05}),
                "strength_clip": ("FLOAT", {"default": 1.0, "min": -20.0, "max": 20.0, "step": 0.05}),
            },
            "optional": {
                "character": ("STRING", {"multiline": True, "default": ""}),
                "clothing": ("STRING", {"multiline": True, "default": ""}),
                "no_clothing": ("STRING", {"multiline": True, "default": ""}),
                "expression": ("STRING", {"multiline": True, "default": ""}),
                "situation": ("STRING", {"multiline": True, "default": ""}),
                "location": ("STRING", {"multiline": True, "default": ""}),
                "lighting": ("STRING", {"multiline": True, "default": ""}),
            }
        }

    RETURN_TYPES = ("MODEL", "CLIP", "STRING", "STRING", "STRING", "STRING", "STRING", "STRING", "STRING")
    RETURN_NAMES = ("MODEL", "CLIP", "character", "clothing", "no_clothing", "expression", "situation", "location", "lighting")
    FUNCTION = "process"
    CATEGORY = "🗄️ Comfy Cabinet"

    @classmethod
    def IS_CHANGED(s, model, clip, lora_name, strength_model, strength_clip, **kwargs):
        import time
        return time.time()

    def process(self, model, clip, lora_name, strength_model, strength_clip,
                character="", clothing="", no_clothing="",
                expression="", situation="", location="", lighting=""):
        import nodes
        if strength_model != 0 or strength_clip != 0:
            out_model, out_clip = nodes.LoraLoader().load_lora(model, clip, lora_name, strength_model, strength_clip)
        else:
            out_model, out_clip = model, clip

        saved = get_lora_settings(lora_name)

        p_character = character if character.strip() else saved["character"]
        p_clothing = clothing if clothing.strip() else saved["clothing"]
        p_no_clothing = no_clothing if no_clothing.strip() else saved.get("no_clothing", "")
        p_expression = expression if expression.strip() else saved["expression"]
        p_situation = situation if situation.strip() else saved["situation"]
        p_location = location if location.strip() else saved["location"]
        p_lighting = lighting if lighting.strip() else saved["lighting"]

        return (
            out_model,
            out_clip,
            p_character,
            p_clothing,
            p_no_clothing,
            p_expression,
            p_situation,
            p_location,
            p_lighting
        )

NODE_CLASS_MAPPINGS = {"EasyLoraConfigLoader": EasyLoraConfigLoader}
NODE_DISPLAY_NAME_MAPPINGS = {"EasyLoraConfigLoader": "💊 Easy LoRA Config Loader"}
