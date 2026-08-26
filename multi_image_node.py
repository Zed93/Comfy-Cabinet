import os
import glob
import json
import random
import time
from aiohttp import web
from PIL import Image, ImageOps, ImageSequence  # type: ignore
import numpy as np  # type: ignore
import torch  # type: ignore
import folder_paths  # type: ignore
from server import PromptServer  # type: ignore

SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tiff", ".avif", ".tga"}

def get_input_directory():
    if folder_paths and hasattr(folder_paths, "get_input_directory"):
        return folder_paths.get_input_directory()
    return os.path.abspath("input")

def resolve_image_path(filename, subfolder=""):
    input_dir = get_input_directory()
    if subfolder:
        clean_sub = subfolder.strip("/\\")
        candidate = os.path.join(input_dir, clean_sub, filename)
    else:
        candidate = os.path.join(input_dir, filename)

    if os.path.exists(candidate) and os.path.isfile(candidate):
        return candidate

    if folder_paths and hasattr(folder_paths, "get_annotated_filepath"):
        try:
            annotated = folder_paths.get_annotated_filepath(filename)
            if os.path.exists(annotated):
                return annotated
        except Exception:
            pass

    # Direct fallback if filename is absolute or relative
    if os.path.exists(filename) and os.path.isfile(filename):
        return os.path.abspath(filename)

    return None

def scan_input_images(subfolder=""):
    input_dir = get_input_directory()
    target_dir = os.path.join(input_dir, subfolder.strip("/\\")) if subfolder else input_dir

    if not os.path.exists(target_dir) or not os.path.isdir(target_dir):
        return []

    results = []
    try:
        for root, _, files in os.walk(target_dir):
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in SUPPORTED_EXTENSIONS:
                    full_path = os.path.join(root, file)
                    rel_to_input = os.path.relpath(full_path, input_dir).replace("\\", "/")
                    rel_dir = os.path.dirname(rel_to_input).replace("\\", "/")
                    file_size = os.path.getsize(full_path)
                    
                    results.append({
                        "filename": file,
                        "subfolder": rel_dir if rel_dir != "." else "",
                        "relative_path": rel_to_input,
                        "size": file_size,
                        "mtime": os.path.getmtime(full_path)
                    })
    except Exception as e:
        print(f"[EasyMultiImageLoader] Error scanning folder {target_dir}: {e}")

    results.sort(key=lambda x: x["relative_path"].lower())
    return results

def create_placeholder_image(text="No Image Loaded"):
    # Create a 512x512 dark grey tensor
    img_array = np.full((512, 512, 3), 0.15, dtype=np.float32)
    # Add a border
    img_array[0:8, :, :] = 0.3
    img_array[-8:, :, :] = 0.3
    img_array[:, 0:8, :] = 0.3
    img_array[:, -8:, :] = 0.3
    # Add subtle cross lines
    for i in range(512):
        if 0 <= i < 512:
            img_array[i, i, :] = 0.25
            img_array[i, 511 - i, :] = 0.25

    tensor = torch.from_numpy(img_array)[None,]
    mask = torch.zeros((1, 512, 512), dtype=torch.float32)
    return tensor, mask

def load_single_image(filepath):
    try:
        img = Image.open(filepath)
        output_images = []
        output_masks = []
        
        for frame in ImageSequence.Iterator(img):
            frame = ImageOps.exif_transpose(frame)
            if frame.mode == 'I':
                frame = frame.point(lambda i: i * (1 / 255))
            
            # Mask extraction
            if 'A' in frame.getbands():
                mask = np.array(frame.getchannel('A')).astype(np.float32) / 255.0
                mask = 1.0 - torch.from_numpy(mask)
            else:
                mask = torch.zeros((frame.height, frame.width), dtype=torch.float32)

            rgb_frame = frame.convert("RGB")
            np_frame = np.array(rgb_frame).astype(np.float32) / 255.0
            tensor_frame = torch.from_numpy(np_frame)[None,]

            output_images.append(tensor_frame)
            output_masks.append(mask.unsqueeze(0))

        if len(output_images) > 1:
            out_img = torch.cat(output_images, dim=0)
            out_mask = torch.cat(output_masks, dim=0)
        else:
            out_img = output_images[0]
            out_mask = output_masks[0]

        return out_img, out_mask
    except Exception as e:
        print(f"[EasyMultiImageLoader] Error loading image {filepath}: {e}")
        return None, None

# ==================== API ENDPOINTS ====================

if PromptServer is not None:
    @PromptServer.instance.routes.get("/easy_multi_image/get_input_files")
    async def api_get_input_files(request):
        try:
            subfolder = request.query.get("subfolder", "")
            files = scan_input_images(subfolder)
            return web.json_response({"files": files, "input_directory": get_input_directory()})
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

    @PromptServer.instance.routes.post("/easy_multi_image/scan_subfolder")
    async def api_scan_subfolder(request):
        try:
            data = await request.json()
            subfolder = data.get("subfolder", "")
            files = scan_input_images(subfolder)
            return web.json_response({"files": files})
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)


# ==================== COMFYUI CUSTOM NODE ====================

def extract_node_id(unique_id):
    if isinstance(unique_id, (list, tuple)):
        return str(unique_id[0]) if len(unique_id) > 0 else "default_node"
    if unique_id is not None:
        return str(unique_id)
    return "default_node"

class EasyMultiImageLoader:
    """
    ComfyUI node to load multiple images from ComfyUI's standard input directory,
    manually choose which image to output, or automatically cycle through images with
    smooth wrap-around and progress reporting.
    """
    
    # Internal in-memory tracking of cycle steps per node instance
    _node_cycle_state = {}

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "mode": (["Fixed / Selected Index", "Cycle (Increment)", "Cycle (Decrement)", "Random"], {"default": "Fixed / Selected Index"}),
                "index": ("INT", {"default": 1, "min": 1, "max": 999999, "step": 1}),
            },
            "optional": {
                "images_list": ("STRING", {"default": "[]", "multiline": True}),
                "subfolder": ("STRING", {"default": "", "multiline": False}),
                "batch_size": ("INT", {"default": 1, "min": 1, "max": 64, "step": 1}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "extra_pnginfo": "EXTRA_PNGINFO",
                "prompt": "PROMPT",
            }
        }

    RETURN_TYPES = ("IMAGE", "MASK", "STRING", "INT", "INT", "FLOAT")
    RETURN_NAMES = ("IMAGE", "MASK", "filename", "current_index", "total_images", "progress_percent")
    FUNCTION = "process_images"
    CATEGORY = "🗄️ Comfy Cabinet"

    @classmethod
    def IS_CHANGED(cls, mode, index, images_list="[]", subfolder="", batch_size=1, unique_id=None, **kwargs):
        # If cycling or random, always return unique timestamp so ComfyUI executes on every run in the queue
        if mode in ("Cycle (Increment)", "Cycle (Decrement)", "Random"):
            return time.time_ns()
        # Otherwise hash the static inputs
        return f"{mode}_{index}_{images_list}_{subfolder}_{batch_size}"

    def process_images(self, mode, index, images_list="[]", subfolder="", batch_size=1, unique_id=None, extra_pnginfo=None, prompt=None):
        # Parse images list
        parsed_items = []
        if images_list and images_list.strip():
            try:
                raw_json = json.loads(images_list)
                if isinstance(raw_json, list):
                    for item in raw_json:
                        if isinstance(item, str) and item.strip():
                            parsed_items.append(item.strip())
                        elif isinstance(item, dict) and "relative_path" in item:
                            parsed_items.append(item["relative_path"])
                        elif isinstance(item, dict) and "filename" in item:
                            sf = item.get("subfolder", "")
                            fn = item["filename"]
                            parsed_items.append(os.path.join(sf, fn).replace("\\", "/") if sf else fn)
            except Exception:
                # Fallback: line-delimited or comma-delimited strings
                for line in images_list.replace("\r", "").split("\n"):
                    for chunk in line.split(","):
                        c = chunk.strip().strip('"').strip("'")
                        if c:
                            parsed_items.append(c)

        # If images_list was empty but a subfolder is specified, auto-scan that subfolder
        if not parsed_items and subfolder:
            scanned = scan_input_images(subfolder)
            parsed_items = [s["relative_path"] for s in scanned]

        total_images = len(parsed_items)

        if total_images == 0:
            print("[EasyMultiImageLoader] Warning: No images found or loaded in the list.")
            placeholder_img, placeholder_mask = create_placeholder_image("No Images Loaded")
            return {
                "ui": {
                    "index": [0],
                    "filename": [""],
                    "progress_percent": [0.0]
                },
                "result": (placeholder_img, placeholder_mask, "", 0, 0, 0.0)
            }

        # Determine effective target index (1-based)
        node_key = extract_node_id(unique_id)
        state = self._node_cycle_state.get(node_key, {})
        prev_idx = state.get("index", None)
        prev_mode = state.get("mode", None)

        if mode == "Fixed / Selected Index":
            target_index = ((index - 1) % total_images) + 1
            self._node_cycle_state[node_key] = {"index": target_index, "mode": mode}
        elif mode == "Cycle (Increment)":
            if prev_idx is None or prev_mode != mode:
                target_index = ((index - 1) % total_images) + 1
            else:
                target_index = (prev_idx % total_images) + 1
            self._node_cycle_state[node_key] = {"index": target_index, "mode": mode}
        elif mode == "Cycle (Decrement)":
            if prev_idx is None or prev_mode != mode:
                target_index = ((index - 1) % total_images) + 1
            else:
                target_index = ((prev_idx - 2) % total_images) + 1
            self._node_cycle_state[node_key] = {"index": target_index, "mode": mode}
        elif mode == "Random":
            target_index = random.randint(1, total_images)
            self._node_cycle_state[node_key] = {"index": target_index, "mode": mode}
        else:
            target_index = max(1, min(index, total_images))
            self._node_cycle_state[node_key] = {"index": target_index, "mode": mode}

        # Calculate progress percentage (100% when at last image)
        progress_percent = round((target_index / total_images) * 100.0, 2)

        # Collect images for batch
        batch_images = []
        batch_masks = []
        filenames_loaded = []

        actual_batch = max(1, min(batch_size, total_images))
        ref_h, ref_w = None, None

        for b in range(actual_batch):
            # Wrap around batch indices if batch_size > 1
            curr_b_idx = ((target_index - 1 + b) % total_images) + 1
            img_rel_path = parsed_items[curr_b_idx - 1]
            full_path = resolve_image_path(img_rel_path, subfolder)

            if not full_path:
                print(f"[EasyMultiImageLoader] Warning: Could not resolve file path for '{img_rel_path}'")
                continue

            img_tensor, mask_tensor = load_single_image(full_path)
            if img_tensor is None:
                continue

            # Ensure mask is a valid 3D tensor [B, H, W]
            if mask_tensor is None:
                mask_tensor = torch.zeros((img_tensor.shape[0], img_tensor.shape[1], img_tensor.shape[2]), dtype=torch.float32)
            elif mask_tensor.ndim == 2:
                mask_tensor = mask_tensor.unsqueeze(0)

            # Ensure all batch items match first image's spatial dimensions (H, W)
            if ref_h is None:
                ref_h, ref_w = img_tensor.shape[1], img_tensor.shape[2]
            else:
                if img_tensor.shape[1] != ref_h or img_tensor.shape[2] != ref_w:
                    # Reshape / interpolate to match reference
                    img_perm = img_tensor.permute(0, 3, 1, 2)  # [B, C, H, W]
                    img_resized = torch.nn.functional.interpolate(img_perm, size=(ref_h, ref_w), mode="bilinear", align_corners=False)
                    img_tensor = img_resized.permute(0, 2, 3, 1)

                    mask_unsqueeze = mask_tensor.unsqueeze(1)  # [B, 1, H, W]
                    mask_resized = torch.nn.functional.interpolate(mask_unsqueeze, size=(ref_h, ref_w), mode="bilinear", align_corners=False)
                    mask_tensor = mask_resized.squeeze(1)

            batch_images.append(img_tensor)
            batch_masks.append(mask_tensor)
            filenames_loaded.append(os.path.basename(img_rel_path))

        if not batch_images:
            placeholder_img, placeholder_mask = create_placeholder_image("Failed to Load Image")
            return {
                "ui": {
                    "index": [target_index],
                    "filename": [""],
                    "progress_percent": [progress_percent]
                },
                "result": (placeholder_img, placeholder_mask, "", target_index, total_images, progress_percent)
            }

        final_image = torch.cat(batch_images, dim=0)
        final_mask = torch.cat(batch_masks, dim=0)
        primary_filename = parsed_items[target_index - 1]

        # Send live progress update event to ComfyUI canvas node
        if PromptServer is not None:
            try:
                PromptServer.instance.send_sync("easy_multi_image_progress", {
                    "node_id": node_key,
                    "current_index": target_index,
                    "total_images": total_images,
                    "progress_percent": progress_percent,
                    "filename": primary_filename,
                    "mode": mode
                })
            except Exception as e:
                pass

        return {
            "ui": {
                "index": [target_index],
                "filename": [primary_filename],
                "progress_percent": [progress_percent]
            },
            "result": (final_image, final_mask, primary_filename, target_index, total_images, progress_percent)
        }


NODE_CLASS_MAPPINGS = {
    "EasyMultiImageLoader": EasyMultiImageLoader
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "EasyMultiImageLoader": "🖼️ Easy Multi-Image Loader"
}
