# 🗄️ Comfy Cabinet

Welcome to the **Comfy Cabinet**, a boutique virtual exhibit of handcrafted ComfyUI custom nodes. No fluff, just a clean, offline-first space where your nodes sit comfortably on velvet shelves, waiting to save your workflow from the depths of chaos.

Current Exhibition: 🎨 **Easy Checkpoint Config Loader**, 🧩 **Easy Prompt Builder**, & 💊 **Easy LoRA Config Loader**

**ATTENTION**: v0.2.1 is out for testing in the real world as it's a Release Candidate. I've fully reworked the Web UI and introduced many new functionalities. Please read the [Changelog](CHANGELOG.md) for more information.

---

## 🎨 Easy Checkpoint Config

### 🧐 The Problem

We’ve all been there. You switch from an SD1.5 model to an SDXL model, or you fire up a new Flux checkpoint, and *boom*—you forgot to change the steps from 20 to 4. Or you left the CFG scale at 7.0 for a model that fries anything past 1.5. 

Your options used to be:
1. Plaster your canvas with 45 different `Primitive` nodes and switches.
2. Memorize every model's sweet spot (impossible, you haven't slept since Flux dropped).
3. Cry as your GPU renders a beautiful canvas of deep-fried static noise.

---

### 💡 The Solution

The **Easy Checkpoint Config** is like having a very polite, highly organized butler inside your ComfyUI instance. It intercepts your checkpoint selection and whispers the exact right settings to your workflow.

- **Smart Prompt Stitching:** Automatically glues your custom global prefix (e.g., *masterpiece, highly detailed*) and suffix tags to your user prompt using whatever custom separator you want. Want a comma? Cool. Want a line break (`\n`) because you like your prompts structured like a grocery list? Go wild.
- **Automated Civitai Metadata Sync**: Fetches model titles, cover images/videos, creator usernames, HTML descriptions, tags, and trigger words directly from Civitai (supporting both `civitai.com` and `civitai.red` domains, BYOK style: you'll have to use your own api key), caching all preview media locally (in the `civitai_cache/` folder, please don't delete it or you'll lose all the previews and will have to resync them).
- **Stylized Checkpoints gallery**: Displays your local Checkpoints in a responsive grid with filtering by Base Model Architecture, Author, and Tags.
- **Collapsible Search Filters**: Keep your gallery clean with a collapsible search filter panel featuring real-time active filter badges and state persistence.
- **Canvas Real-Time Auto-Population**: Selecting a `ckpt_name` directly from the dropdown menu of a canvas node populates its strength weights and prompt fields automatically.
- **Dynamic Config Tab**: Modals in Web UI automatically display only relevant prompt input fields based on the Checkpoint's main Civitai category tag.

#### 🚀 How to Use It

- In the ComfyUI canvas, add the **"🎨 Easy Checkpoint Config Loader"** node (`🗄️ Comfy Cabinet` category).
- Click the **"Easy Config"** button injected into your ComfyUI top menu.
- Select the **"🎨 Easy Checkpoint Config"** tool.
- Select the desired checkpoint (you can type to search its name or use the provided filters).
- Click on the **"Configuration"** tab inside the modal that opens.
- Set your favorite Steps, CFG, Sampler, and default prompt modifiers.
- Hit **"💾 Save config"** and then **"🚀 Send to ComfyUI"** to update the node on the canvas.
- Repeat for all your checkpoints.

---

## 🧩 Easy Prompt Builder

### 🧐 The Problem

Writing long, complex prompts often devolves into an unreadable wall of text. Wanting to tweak just a character's expression or lighting means hunting through a 200-word paragraph, and re-using your favorite lighting or outfit tags across different workflows requires constant copy-pasting.

---

### 💡 The Solution

The **Easy Prompt Builder** breaks your prompts into structured, modular building blocks, giving you surgical control over your generations without prompt chaos. It trades a little bit of flexibility to have a reliable structure.

- **8 modular blocks:** Cleanly separate your prompts into `Prefix`, `Character`, `Clothing`, `Expression`, `Situation`, `Location`, `Lighting`, and `Suffix`.
- **Flexible outputs:** Outputs the combined `final_prompt` alongside individual outputs for every single block, letting you route specific parts anywhere in your canvas.
- **Block & Scene presets:** Save individual block fragments (like your signature character or lighting style) or save full **Scene Presets** to swap entire prompt setups instantly. This allows you to switch between different known good prompts without having to manually change the settings for each one.
- **Simple web interface:** Assemble prompts in a web UI with live previews, clipboard copying, and instant synchronization with the canvas node.
- **Wide variety of separators:** Join your prompt blocks with commas, custom tokens, or line breaks (`\n`).

#### 🚀 How to Use It

- Add the **🧩 Easy Prompt Builder** node (`🗄️ Comfy Cabinet` category) to your canvas and wire `final_prompt` into your text encoder.
- Click the **"Easy Config"** button injected into your ComfyUI top menu.
- Select the **"Easy Prompt Builder"** tool.
- Mix and match saved block presets or fill in any of the 8 modular slots.
- Save your setup as a **Scene Preset** or hit **"Save Active Config to Node"**.
- Enjoy (the data will be set directly to the active node in comfyUI without needing to reload workflow)

---

## 💊 Easy LoRA Manager & Config Loader

### 🧐 The Problem

Managing dozens or hundreds of LoRA models in ComfyUI is chaotic. Finding trigger words, ideal strength weights, Civitai previews, author information, and model versions requires constantly leaving ComfyUI to search Civitai manually. Once found, applying weights and trigger words back to your canvas nodes is tedious.

---

### 💡 The Solution

The **Easy LoRA Manager & Config Loader** is a visual LoRA management dashboard and node system integrated right into ComfyUI.

- **Automated Civitai Metadata Sync**: Fetches model titles, cover images/videos, creator usernames, HTML descriptions, tags, and trigger words directly from Civitai (supporting both `civitai.com` and `civitai.red` domains, BYOK style: you'll have to use your own api key), caching all preview media locally (in the `civitai_cache/` folder, please don't delete it or you'll lose all the previews and will have to resync them).
- **Stylized LoRA gallery**: Displays your local LoRAs in a responsive grid with filtering by Base Model Architecture, Author, and Tags.
- **Collapsible Search Filters**: Keep your gallery clean with a collapsible search filter panel featuring real-time active filter badges and state persistence.
- **Specialized LoRA Nodes**: Tailored output signatures and category-filtered dropdown menus based on LoRA domain:
  - `💊 Easy LoRA Character Loader` (Character LoRAs only; outputs: Character, Clothing, No Clothing, Expression)
  - `💊 Easy LoRA Clothing Loader` (Clothing LoRAs only; outputs: Clothing, No Clothing)
  - `💊 Easy LoRA Pose & Action Loader` (Pose & Action LoRAs only; outputs: Expression, Situation)
  - `💊 Easy LoRA Background Loader` (Background & Building LoRAs only; outputs: Location, Lighting, Situation)
  - `💊 Easy LoRA Basic Loader` (Style, Concept, Tool, Assets, Vehicle, Objects, Animal, Base Model; 4 generic prompt outputs)
- **Canvas Real-Time Auto-Population**: Selecting a `lora_name` directly from the dropdown menu of a canvas node populates its strength weights and prompt fields automatically.
- **Dynamic Config Tab**: Modals in Web UI automatically display only relevant prompt input fields based on the LoRA's main Civitai category tag.
- **Strict Targeted Canvas Synchronization**: Selected LoRA model, default weights, and prompt block outputs strictly to the matching specialized loader node on your active canvas (if any is present).

#### 🚀 How to Use It

- Drop any of the specialized **💊 Easy LoRA Loader** nodes (`🗄️ Comfy Cabinet` category) onto your canvas.
- Click the **"Easy Config"** button in your ComfyUI top menu and choose **"💊 Easy LoRA Config"**.
- Browse your gallery, search, or filter by Type (Civitai main tag), Base Model, Author, or Tag.
- Open a LoRA card to inspect Civitai preview media, descriptions, and trigger words.
- In the **Config** tab, fine-tune weights and prompt blocks.
- Click **"💾 Save config"** and then **"🚀 Send to ComfyUI"** to push to the matching node on your canvas, or simply select a model directly from the node's dropdown menu on the canvas to auto-populate fields.

---

## 🛠️ Installation

Simply clone this repository into your ComfyUI custom nodes folder:
```bash
cd ComfyUI/custom_nodes
git clone https://github.com/Zed93/Comfy-Cabinet.git
```

---

## 🧐 Tested with

- ComfyUI 0.30.1
- ltdrdata/ComfyUI-Impact-Pack Facedetailer custom node
