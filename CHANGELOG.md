# Changelog

All notable changes to **Comfy Cabinet** are documented in this file.

## [0.2.3] — 2026-08-27

### Fixed
- **🖼️ Easy Multi-Image Loader Gallery Re-rendering**: Fixed an issue where closing the full-screen lightbox modal caused the node's `images_list` and thumbnail gallery to not render back or remain blank. Added an `onClose` lifecycle callback to force complete gallery refresh and canvas re-synchronization.
- **Subfolder Image Resolution**: Added `parseImageItem` to reliably resolve relative paths and subfolders across both the full lightbox gallery and the canvas thumbnail gallery.
- **Clear Selection Confirmation**: Added a user confirmation prompt (`confirm`) when clicking the clear button (🗑️) to prevent accidental loss of loaded image lists.
- **Thumbnail Gallery Reset on Clear**: Fixed a bug where clearing the image list revived old images from `widgets_values` during re-render, ensuring the thumbnail gallery is cleanly emptied and displays the drop-zone placeholder.

### Added
- **Full Gallery Toolbar Button**: Added a dedicated `🖼️ Gallery` button to the node toolbar to directly open the full-screen interactive gallery modal.

## [0.2.2] — 2026-08-27

### Added
- **🖼️ Easy Multi-Image Loader Custom Node**:
  - Load multiple images into ComfyUI with multi-file upload, drag-and-drop, and automatic input folder / subfolder scanning.
  - **Output Modes**:
    - `Fixed / Selected Index`: Outputs the selected image from the gallery.
    - `Cycle (Increment)`: Advances through images sequentially across generations with seamless wrap-around back to the first image.
    - `Cycle (Decrement)`: Cycles backwards through images with wrap-around back to the last image.
    - `Random`: Selects a random image on each generation execution.
  - **Interactive Canvas Thumbnail Gallery**:
    - Displays crisp thumbnail cards on the ComfyUI workflow canvas with index badges (`#1`, `#2`), active selection glow rings, and deletion buttons.
    - Click thumbnail to select as active output and trigger the Lightbox.
  - **Full-Screen Lightbox Modal**:
    - High-resolution image preview with dark glassmorphism backdrop blur.
    - Keyboard navigation (Left / Right arrow keys, Escape key), position indicator, file metadata, and one-click "Select Output" button.
  - **Live Execution Progress Indicator**:
    - Real-time progress bar showing active position (`Image X / Y (Z%)`) synchronized across queue generations.
  - **Outputs**: `IMAGE` (`IMAGE` tensor), `MASK` (`MASK` tensor), `filename` (`STRING`), `current_index` (`INT`), `total_images` (`INT`), `progress_percent` (`FLOAT`).
  - **Batch Support**: Configure `batch_size` to output multiple consecutive images at once in a single tensor batch.

---

## [0.2.1] — 2026-08-11 *(Full Release Candidate)*

### Added
- **Specialized LoRA Custom Nodes**: Expanded LoRA node suite into 5 specialized loader classes registered under `🗄️ Comfy Cabinet`:
  - `💊 Easy LoRA Character Loader` (Outputs: `MODEL`, `CLIP`, `character`, `clothing`, `no_clothing`, `expression`)
  - `💊 Easy LoRA Clothing Loader` (Outputs: `MODEL`, `CLIP`, `clothing`, `no_clothing`)
  - `💊 Easy LoRA Pose & Action Loader` (Outputs: `MODEL`, `CLIP`, `expression`, `situation`)
  - `💊 Easy LoRA Background Loader` (Outputs: `MODEL`, `CLIP`, `location`, `lighting`, `situation`)
  - `💊 Easy LoRA Basic Loader` (Outputs: `MODEL`, `CLIP`, `prompt_1`, `prompt_2`, `prompt_3`, `prompt_4`)
- **Dynamic Web UI Config Tab**: Config tab fields inside the LoRA detail modal dynamically adapt based on the LoRA's main Civitai category tag (`Character`, `Clothing`, `Poses`, `Action`, `Background`, `Buildings`, or Basic).
- **Category-Filtered LoRA Dropdown Menus**: Canvas custom nodes now filter their `lora_name` dropdown widget to display only LoRA models matching their type.
- **Canvas Real-Time Auto-Population**: Selecting a `lora_name` directly from the dropdown menu of an `EasyLora*` custom node on the workflow canvas automatically populates strength weights (`strength_model`, `strength_clip`) and prompt block fields with saved configuration settings.

### Fixed
- **Strict Canvas Node Targeting**: The "Send to ComfyUI" button in the Web UI dashboard now strictly targets ONLY custom nodes on the canvas matching the LoRA type (`Character` $\rightarrow$ `EasyLoraCharacterConfigLoader`, `Clothing` $\rightarrow$ `EasyLoraClothingConfigLoader`, etc.) without broadcasting updates to unrelated nodes.
- **Unrelated Node Updates**: Prevented canvas updates for unrelated nodes (e.g., checkpoints) when opening LoRA modals in the Web UI.

### Removed
- Legacy all-in-one `EasyLoraConfigLoader` node class in favor of the specialized node suite.

---

## [0.2.0] — 2026-08-09 *(Full Release Candidate)*

> Full Web UI rework. The extension now runs as a fully self-contained Single Page Application embedded inside ComfyUI.

### Added
- **SPA Navigation**: Instant tab switching between Checkpoints, LoRAs, and Prompt Builder with zero page reloads and shared header/sidebar.
- **Unified Settings Modal**: Centralized settings panel accessible from any tab with a sticky header and fully scrollable body.
  - Language switcher with correct active state highlighting.
  - Accent color selection reworked as a named 3-column mini-grid with gradient swatches and fancy color names.
  - Theme mode selector (Dark / Light / System).
  - CivitAI domain mode and API key management.
  - Global defaults (steps, CFG, clip skip).
  - Backdrop close toggle.
- **Toast Notification System**: All user feedback messages now use a unified toast system — no more inline messages next to buttons or inside modals.
- **Background Sync with User Cancellation**: Metadata sync for both LoRAs and Checkpoints now runs entirely in the background, allowing uninterrupted navigation. A red stop button appears during sync to interrupt it at any time.
- **Send to ComfyUI button** in both LoRA and Checkpoint detail modals: saves current config and instantly updates canvas node widgets (lora_name, ckpt_name, strength values, block prompts) with 0ms latency via direct graph access.

### Fixed
- Resync single model CivitAI button now correctly binds in both LoRA and Checkpoint modals.
- CivitAI connection test button now works from any tab (was silently broken due to function shadowing by LoRA-specific code).
- Sync All button pointer-events issue: the button was unclickable during sync; now styled as a red stop button with full interactivity.
- Language selection no longer loses its active state after reload.
- Accent color swatches now correctly reflect saved selection on page load.

---

## [0.1.8] — 2026-08-08

> Major UI improvements to the LoRA Config tool.

### Added
- Toast notification system for non-blocking user feedback.
- Modal manager for consistent dialog handling.
- Collapsible filter sidebar for LoRA grid.
- Dropdown component improvements.
- `easy-checkpoint-config` page merged into the main SPA index.

### Changed
- Significant CSS refactors across `lora_config.css` and `style.css`.
- LoRA config `config.js` expanded with improved filter, sort, and grid rendering logic.
- i18n keys updated for LoRA config UI strings.

### Fixed
- Various bug fixes in `lora_config_node.py`.
- Checkpoint config settings page replaced with integrated index view.

---

## [0.1.7] — 2026-08-04

> Introduced the **Easy LoRA Config Loader** tool.

### Added
- **Easy LoRA Config Loader** node and full web UI.
- LoRA card grid with cover image, author, base model tags, and trigger word support.
- CivitAI metadata sync (individual and bulk) with API key support and civitai.red mirror option.
- LoRA detail modal with tabbed view (Info, Config, Images, Notes).
- `lora_config_extension.js` ComfyUI extension for real-time canvas node updates.
- i18n translations extended for LoRA config strings (EN + IT).
- LoRA config tab added to the main navigation.

---

## [0.1.6] — 2026-07-26

### Added
- Expose configured `prefix` and `suffix` outputs from `EasyCheckpointConfigLoader` node so they can be connected to the Easy Prompt Builder node.

---

## [0.1.5] — 2026-07-26

> Introduced the **Easy Prompt Builder** tool.

### Added
- **Easy Prompt Builder** node and full web UI.
- Scene preset system: save and load prompt presets by name.
- Block-based prompt composition: character, clothing, expression, situation, location, lighting — each independently fillable.
- Prompt preview with live separator and block toggling.
- `prompt_builder_extension.js` ComfyUI extension for real-time prompt injection into canvas nodes.
- i18n translations extended for Prompt Builder (EN + IT).

---

## [0.1.3] — 2026-06-29

### Added
- **CLIP Skip** configuration per checkpoint (stored in the database and applied at node execution time).

---

## [0.1.2] — 2026-06-29

### Fixed
- Language switcher not correctly detecting and applying the saved language on page load.

---

## [0.1.1] — 2026-06-28

### Added
- Internationalization (i18n) support with English and Italian translations.
- Added icon and banner images for the ComfyUI registry listing.
- GitHub Actions workflow to publish the node pack to the official ComfyUI registry.
- Repository URL added to `pyproject.toml`.

### Changed
- Default language changed from Italian to English.

### Fixed
- Force `IS_CHANGED` on the checkpoint config node to always reload outputs on every run (prevents stale caching, will change it later).
- Various bug fixes in `i18n.js` and `init_dashboard_menu.js`.

---

## [0.1.0] — 2026-06-27

> Initial public release of **Comfy Cabinet**.
