import os
import sqlite3
import json
import hashlib
import asyncio
import ipaddress
from urllib.parse import urlparse
import aiohttp
from aiohttp import web
import folder_paths  # type: ignore
import comfy.samplers  # type: ignore
from server import PromptServer  # type: ignore

DB_PATH = os.path.join(os.path.dirname(__file__), "checkpoint_configs.db")
CACHE_DIR = os.path.join(os.path.dirname(__file__), "civitai_cache")
os.makedirs(CACHE_DIR, exist_ok=True)

def is_safe_url(url):
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ('http', 'https'):
            return False
        hostname = parsed.hostname
        if not hostname:
            return False
        if hostname.lower() in ('localhost', '127.0.0.1', '::1', '0.0.0.0'):
            return False
        try:
            ip = ipaddress.ip_address(hostname)
            if ip.is_private or ip.is_loopback or ip.is_link_local:
                return False
        except ValueError:
            pass
        return True
    except Exception:
        return False

def mask_api_key(key_str):
    if not key_str:
        return ""
    if len(key_str) <= 6:
        return "••••"
    return "••••••••" + key_str[-4:]

def _hash_file(filepath):
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        chunk = f.read(1024 * 1024)
        while chunk:
            hasher.update(chunk)
            chunk = f.read(1024 * 1024)
    return hasher.hexdigest()

HASH_CACHE = {}

def get_file_hash_cached(filepath):
    if not filepath or not os.path.exists(filepath):
        return ""
    try:
        mtime = os.path.getmtime(filepath)
        cached = HASH_CACHE.get(filepath)
        if cached and cached.get("mtime") == mtime:
            return cached.get("hash")
        
        sha = _hash_file(filepath)
        HASH_CACHE[filepath] = {"mtime": mtime, "hash": sha}
        return sha
    except Exception:
        return ""

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
            clip_skip INTEGER,
            civitai_id INTEGER,
            model_version_id INTEGER,
            civitai_metadata TEXT DEFAULT '{}',
            tags TEXT DEFAULT '[]',
            base_model TEXT DEFAULT '',
            author TEXT DEFAULT '',
            file_size TEXT DEFAULT '',
            relative_path TEXT DEFAULT '',
            cover_url TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            last_synced TIMESTAMP
        )
    """)

    cursor.execute("PRAGMA table_info(checkpoint_settings)")
    cols = [row[1] for row in cursor.fetchall()]
    migration_cols = [
        ("clip_skip", "INTEGER DEFAULT -1"),
        ("civitai_id", "INTEGER"),
        ("model_version_id", "INTEGER"),
        ("civitai_metadata", "TEXT DEFAULT '{}'"),
        ("tags", "TEXT DEFAULT '[]'"),
        ("base_model", "TEXT DEFAULT ''"),
        ("author", "TEXT DEFAULT ''"),
        ("file_size", "TEXT DEFAULT ''"),
        ("relative_path", "TEXT DEFAULT ''"),
        ("cover_url", "TEXT DEFAULT ''"),
        ("notes", "TEXT DEFAULT ''"),
        ("last_synced", "TIMESTAMP")
    ]
    for col_name, col_def in migration_cols:
        if col_name not in cols:
            try:
                cursor.execute(f"ALTER TABLE checkpoint_settings ADD COLUMN {col_name} {col_def}")
            except Exception:
                pass

    cursor.execute("CREATE TABLE IF NOT EXISTS global_settings (key TEXT PRIMARY KEY, value TEXT)")
    defaults = [
        ("default_steps", "20"),
        ("default_cfg", "7.0"),
        ("default_sampler", "euler"),
        ("default_scheduler", "normal"),
        ("default_clip_skip", "-1"),
        ("prompt_separator", ", "),
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

def get_file_info(checkpoint_name):
    full_path = folder_paths.get_full_path("checkpoints", checkpoint_name)
    size_str = "Unknown"
    rel_path = checkpoint_name
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

def get_settings(checkpoint_name):
    globals_dict = get_global_settings()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT steps, cfg, sampler_name, scheduler, prefix_prompt, suffix_prompt, clip_skip,
               civitai_metadata, civitai_id, model_version_id, tags, base_model, author,
               file_size, relative_path, cover_url, notes, last_synced
        FROM checkpoint_settings WHERE checkpoint_name = ?
    """, (checkpoint_name,))
    row = cursor.fetchone()
    conn.close()

    default_clip_skip = int(globals_dict.get("default_clip_skip", -1))
    calc_size, calc_path = get_file_info(checkpoint_name)

    if row:
        meta = {}
        try: meta = json.loads(row[7]) if row[7] else {}
        except Exception: meta = {}

        tags_list = []
        try: tags_list = json.loads(row[10]) if row[10] else []
        except Exception: tags_list = []

        return {
            "checkpoint_name": checkpoint_name,
            "steps": row[0] if row[0] is not None else int(globals_dict.get("default_steps", 20)),
            "cfg": row[1] if row[1] is not None else float(globals_dict.get("default_cfg", 7.0)),
            "sampler_name": row[2] if row[2] else globals_dict.get("default_sampler", "euler"),
            "scheduler": row[3] if row[3] else globals_dict.get("default_scheduler", "normal"),
            "prefix_prompt": row[4] or "",
            "suffix_prompt": row[5] or "",
            "clip_skip": row[6] if row[6] is not None else default_clip_skip,
            "civitai_metadata": meta,
            "civitai_id": row[8],
            "model_version_id": row[9],
            "tags": tags_list,
            "base_model": row[11] or "",
            "author": row[12] or "",
            "file_size": row[13] or calc_size,
            "relative_path": row[14] or calc_path,
            "cover_url": row[15] or "",
            "notes": row[16] or "",
            "last_synced": row[17] or ""
        }

    return {
        "checkpoint_name": checkpoint_name,
        "steps": int(globals_dict.get("default_steps", 20)),
        "cfg": float(globals_dict.get("default_cfg", 7.0)),
        "sampler_name": globals_dict.get("default_sampler", "euler"),
        "scheduler": globals_dict.get("default_scheduler", "normal"),
        "prefix_prompt": "",
        "suffix_prompt": "",
        "clip_skip": default_clip_skip,
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
    if remote_url.startswith("/easy_checkpoint_config/cache_image"):
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

    return f"/easy_checkpoint_config/cache_image?url={aiohttp.helpers.quote(remote_url)}"

# ==================== API ENDPOINTS ====================

@PromptServer.instance.routes.get("/easy_checkpoint_config/cache_image")
async def api_cache_image(request):
    url = request.query.get("url")
    if not url:
        return web.json_response({"error": "url parameter required"}, status=400)

    if not is_safe_url(url):
        return web.json_response({"error": "Invalid or unsafe URL format"}, status=400)

    url_hash = hashlib.md5(url.encode()).hexdigest()
    ext = get_ext_from_url_or_ct(url)

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

@PromptServer.instance.routes.get("/easy_checkpoint_config/get_resources")
@PromptServer.instance.routes.get("/smart_config/get_resources")
async def api_get_resources(request):
    try:
        checkpoints = folder_paths.get_filename_list("checkpoints")
        samplers = comfy.samplers.KSampler.SAMPLERS
        schedulers = comfy.samplers.KSampler.SCHEDULERS
        global_configs = get_global_settings()
        if "civitai_api_key" in global_configs:
            global_configs["civitai_api_key"] = mask_api_key(global_configs["civitai_api_key"])
        return web.json_response({
            "checkpoints": checkpoints,
            "samplers": samplers,
            "schedulers": schedulers,
            "global_configs": global_configs
        })
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.get("/easy_checkpoint_config/get_all_checkpoints_full")
async def api_get_all_checkpoints_full(request):
    try:
        checkpoints = folder_paths.get_filename_list("checkpoints")
        result = []
        for ckpt in checkpoints:
            result.append(get_settings(ckpt))
        globals_dict = get_global_settings()
        if "civitai_api_key" in globals_dict:
            globals_dict["civitai_api_key"] = mask_api_key(globals_dict["civitai_api_key"])
        return web.json_response({
            "items": result,
            "samplers": comfy.samplers.KSampler.SAMPLERS,
            "schedulers": comfy.samplers.KSampler.SCHEDULERS,
            "global_configs": globals_dict
        })
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.get("/easy_checkpoint_config/get_settings")
@PromptServer.instance.routes.get("/smart_config/get_settings")
async def api_get_settings(request):
    checkpoint = request.query.get("checkpoint")
    if not checkpoint:
        return web.json_response({"error": "Parametro mancante"}, status=400)
    return web.json_response(get_settings(checkpoint))

@PromptServer.instance.routes.post("/easy_checkpoint_config/save_settings")
@PromptServer.instance.routes.post("/smart_config/save_settings")
async def api_save_settings(request):
    try:
        data = await request.json()
        checkpoint_name = data.get("checkpoint_name") or data.get("checkpoint")
        if not checkpoint_name:
            return web.json_response({"error": "checkpoint_name is required"}, status=400)

        steps = int(data.get("steps", 20))
        cfg = float(data.get("cfg", 7.0))
        sampler_name = data.get("sampler_name", "euler")
        scheduler = data.get("scheduler", "normal")
        prefix_prompt = data.get("prefix_prompt", "")
        suffix_prompt = data.get("suffix_prompt", "")
        clip_skip_val = int(data.get("clip_skip", -1))

        civitai_id = data.get("civitai_id")
        model_version_id = data.get("model_version_id")
        civitai_metadata = json.dumps(data.get("civitai_metadata", {}))
        tags = json.dumps(data.get("tags", []))
        base_model = data.get("base_model", "")
        author = data.get("author", "")
        file_size, relative_path = get_file_info(checkpoint_name)
        cover_url = data.get("cover_url", "")
        notes = data.get("notes", "")

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO checkpoint_settings (
                checkpoint_name, steps, cfg, sampler_name, scheduler, prefix_prompt, suffix_prompt, clip_skip,
                civitai_metadata, civitai_id, model_version_id, tags, base_model, author, file_size, relative_path, cover_url, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(checkpoint_name) DO UPDATE SET
                steps=excluded.steps, cfg=excluded.cfg, sampler_name=excluded.sampler_name,
                scheduler=excluded.scheduler, prefix_prompt=excluded.prefix_prompt, suffix_prompt=excluded.suffix_prompt,
                clip_skip=excluded.clip_skip, civitai_metadata=excluded.civitai_metadata,
                civitai_id=excluded.civitai_id, model_version_id=excluded.model_version_id,
                tags=excluded.tags, base_model=excluded.base_model, author=excluded.author,
                file_size=excluded.file_size, relative_path=excluded.relative_path, cover_url=excluded.cover_url, notes=excluded.notes
        """, (
            checkpoint_name, steps, cfg, sampler_name, scheduler, prefix_prompt, suffix_prompt, clip_skip_val,
            civitai_metadata, civitai_id, model_version_id, tags, base_model, author, file_size, relative_path, cover_url, notes
        ))
        conn.commit()
        conn.close()

        updated_config = get_settings(checkpoint_name)
        try:
            PromptServer.instance.send_sync("easy_checkpoint_config_update", {"checkpoint_name": checkpoint_name, "config": updated_config})
        except Exception:
            pass

        return web.json_response({"status": "saved", "config": updated_config})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.post("/easy_checkpoint_config/save_globals")
@PromptServer.instance.routes.post("/smart_config/save_globals")
async def api_save_globals(request):
    try:
        data = await request.json()
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        for key, value in data.items():
            if key == "civitai_api_key" and value.startswith("••••"):
                continue
            cursor.execute("INSERT OR REPLACE INTO global_settings (key, value) VALUES (?, ?)", (key, str(value)))
        conn.commit()
        conn.close()
        return web.json_response({"status": "globals_saved"})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.post("/easy_checkpoint_config/test_civitai")
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
        if api_key and not api_key.startswith("••••"):
            headers["Authorization"] = f"Bearer {api_key}"

        timeout = aiohttp.ClientTimeout(total=8)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            try:
                async with session.get(test_url, headers=headers) as resp:
                    if resp.status == 200:
                        if api_key:
                            return web.json_response({
                                "ok": True,
                                "status": "ok",
                                "status_code": 200,
                                "message": f"Connection successful! Domain '{domain}' is online and API Key is valid & authenticated. ✅"
                            })
                        else:
                            return web.json_response({
                                "ok": True,
                                "status": "ok",
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

@PromptServer.instance.routes.post("/easy_checkpoint_config/compute_hash")
async def api_compute_hash(request):
    try:
        data = await request.json()
        checkpoint_name = data.get("checkpoint_name") or data.get("checkpoint")
        if not checkpoint_name:
            return web.json_response({"error": "checkpoint_name required"}, status=400)

        full_path = folder_paths.get_full_path("checkpoints", checkpoint_name)
        if not full_path or not os.path.exists(full_path):
            return web.json_response({"error": "File not found"}, status=404)

        sha256_hash = await asyncio.to_thread(_hash_file, full_path)
        return web.json_response({"sha256": sha256_hash})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

async def fetch_civitai_for_checkpoint(session, checkpoint_name, domain, api_key):
    full_path = folder_paths.get_full_path("checkpoints", checkpoint_name)
    file_hash = ""
    if full_path and os.path.exists(full_path):
        try:
            file_hash = await asyncio.to_thread(get_file_hash_cached, full_path)
        except Exception:
            pass

    clean_query = checkpoint_name.split("/")[-1].split("\\")[-1]
    clean_query = os.path.splitext(clean_query)[0]
    for ext_strip in [".fp16", ".fp8", ".safetensors", ".ckpt", "-pruned", "-emaonly", "_pruned", "_emaonly"]:
        clean_query = clean_query.replace(ext_strip, "")
    clean_query = clean_query.replace("-", " ").replace("_", " ").strip()

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
        query_endpoints = [
            f"/api/v1/models?query={aiohttp.helpers.quote(clean_query)}&types=Checkpoint&limit=5",
            f"/api/v1/models?query={aiohttp.helpers.quote(clean_query)}&types=CHECKPOINT&limit=5",
            f"/api/v1/models?query={aiohttp.helpers.quote(clean_query)}&limit=5"
        ]
        for q_ep in query_endpoints:
            if model_data: break
            for b_url in base_urls:
                url = f"{b_url}{q_ep}"
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

    cached_images = []
    if images:
        for img in images[:12]:
            orig_u = img.get("url", "")
            if orig_u:
                c_u = await download_to_cache(session, orig_u)
                img_copy = dict(img)
                img_copy["url"] = c_u
                cached_images.append(img_copy)
            else:
                cached_images.append(img)

    combined_metadata = dict(model_data or {})
    if selected_version:
        combined_metadata["selectedVersion"] = selected_version
        combined_metadata["versionId"] = selected_version.get("id")
        combined_metadata["versionName"] = selected_version.get("name")
        combined_metadata["images"] = cached_images or selected_version.get("images", [])

    return {
        "civitai_id": model_data.get("id") if model_data else (selected_version.get("modelId") if selected_version else None),
        "model_version_id": selected_version.get("id") if selected_version else None,
        "civitai_metadata": combined_metadata,
        "author": creator,
        "base_model": base_model or "Unknown",
        "tags": civitai_tags,
        "cover_url": cached_cover_url or raw_cover_url
    }

@PromptServer.instance.routes.post("/easy_checkpoint_config/fetch_civitai")
async def api_fetch_civitai(request):
    try:
        data = await request.json()
        checkpoint_name = data.get("checkpoint_name") or data.get("checkpoint")
        if not checkpoint_name:
            return web.json_response({"error": "checkpoint_name required"}, status=400)

        globals_dict = get_global_settings()
        domain = data.get("domain") or globals_dict.get("domain_mode", "civitai.com")
        api_key = data.get("api_key") or globals_dict.get("civitai_api_key", "")

        async with aiohttp.ClientSession() as session:
            fetched = await fetch_civitai_for_checkpoint(session, checkpoint_name, domain, api_key)

        if not fetched:
            return web.json_response({"status": "not_found", "message": "No matching CivitAI metadata found."})

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        meta_json = json.dumps(fetched["civitai_metadata"])
        tags_json = json.dumps(fetched["tags"])
        file_size, relative_path = get_file_info(checkpoint_name)

        cursor.execute("""
            INSERT INTO checkpoint_settings (
                checkpoint_name, civitai_id, model_version_id, civitai_metadata, tags, base_model, author, file_size, relative_path, cover_url, last_synced
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(checkpoint_name) DO UPDATE SET
                civitai_id=excluded.civitai_id,
                model_version_id=excluded.model_version_id,
                civitai_metadata=excluded.civitai_metadata,
                tags=excluded.tags,
                base_model=excluded.base_model,
                author=excluded.author,
                file_size=excluded.file_size,
                relative_path=excluded.relative_path,
                cover_url=excluded.cover_url,
                last_synced=CURRENT_TIMESTAMP
        """, (
            checkpoint_name, fetched["civitai_id"], fetched["model_version_id"],
            meta_json, tags_json, fetched["base_model"], fetched["author"],
            file_size, relative_path, fetched["cover_url"]
        ))
        conn.commit()
        conn.close()

        updated = get_settings(checkpoint_name)
        return web.json_response({"status": "success", "data": updated})

    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.post("/easy_checkpoint_config/sync_all")
async def api_sync_all(request):
    try:
        checkpoints = folder_paths.get_filename_list("checkpoints")
        globals_dict = get_global_settings()
        domain = globals_dict.get("domain_mode", "civitai.com")
        api_key = globals_dict.get("civitai_api_key", "")

        synced_count = 0
        async with aiohttp.ClientSession() as session:
            for ckpt in checkpoints:
                try:
                    fetched = await fetch_civitai_for_checkpoint(session, ckpt, domain, api_key)
                    if fetched:
                        conn = sqlite3.connect(DB_PATH)
                        cursor = conn.cursor()
                        meta_json = json.dumps(fetched["civitai_metadata"])
                        tags_json = json.dumps(fetched["tags"])
                        file_size, relative_path = get_file_info(ckpt)

                        cursor.execute("""
                            INSERT INTO checkpoint_settings (
                                checkpoint_name, civitai_id, model_version_id, civitai_metadata, tags, base_model, author, file_size, relative_path, cover_url, last_synced
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                            ON CONFLICT(checkpoint_name) DO UPDATE SET
                                civitai_id=excluded.civitai_id,
                                model_version_id=excluded.model_version_id,
                                civitai_metadata=excluded.civitai_metadata,
                                tags=excluded.tags,
                                base_model=excluded.base_model,
                                author=excluded.author,
                                file_size=excluded.file_size,
                                relative_path=excluded.relative_path,
                                cover_url=excluded.cover_url,
                                last_synced=CURRENT_TIMESTAMP
                        """, (
                            ckpt, fetched["civitai_id"], fetched["model_version_id"],
                            meta_json, tags_json, fetched["base_model"], fetched["author"],
                            file_size, relative_path, fetched["cover_url"]
                        ))
                        conn.commit()
                        conn.close()
                        synced_count += 1
                except Exception:
                    pass

        return web.json_response({"status": "success", "synced_count": synced_count, "total": len(checkpoints)})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

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

    RETURN_TYPES = ("MODEL", "CLIP", "VAE", "INT", "FLOAT", "*", "*", "STRING", "STRING", "STRING")
    RETURN_NAMES = ("MODEL", "CLIP", "VAE", "steps", "cfg", "sampler_name", "scheduler", "prefix", "suffix", "final_prompt")
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

        prefix = settings.get("prefix_prompt", "") or ""
        suffix = settings.get("suffix_prompt", "") or ""

        prompt_segments = []
        if prefix: prompt_segments.append(prefix)
        if user_prompt: prompt_segments.append(user_prompt)
        if suffix: prompt_segments.append(suffix)

        full_prompt = separator.join(prompt_segments)
        return (model, clip, vae, settings["steps"], settings["cfg"], settings["sampler_name"], settings["scheduler"], prefix, suffix, full_prompt)

NODE_CLASS_MAPPINGS = {"EasyCheckpointConfigLoader": EasyCheckpointConfigLoader}
NODE_DISPLAY_NAME_MAPPINGS = {"EasyCheckpointConfigLoader": "🎨 Easy Checkpoint Config Loader"}