# 🗄️ Comfy Cabinet

Welcome to the **Comfy Cabinet**, a boutique virtual exhibit of handcrafted ComfyUI custom nodes. No fluff, just a clean, offline-first space where your nodes sit comfortably on velvet shelves, waiting to save your workflow from the depths of chaos.

Current Exhibition: 🎨 **Easy Checkpoint Config Loader**, 🧩 **Easy Prompt Builder**, & 💊 **Easy LoRA Config Loader**

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

- **Dynamic Samplers/Schedulers:** It doesn't rely on a dusty, hardcoded list as other custom nodes. It aggressively interrogates your ComfyUI installation at startup to find *exactly* what samplers and schedulers you have installed (yes, even those weird ones from that custom node repo you cloned at 3 AM).
- **Smart Prompt Stitching:** Automatically glues your custom global prefix (e.g., *masterpiece, highly detailed*) and suffix tags to your user prompt using whatever custom separator you want. Want a comma? Cool. Want a line break (`\n`) because you like your prompts structured like a grocery list? Go wild.

#### 🚀 How to Use It

- Click the shiny new "Easy Config" button injected into your ComfyUI top menu.
- Search for your checkpoint in the dropdown (yes, you can actually type to search, welcome to the future).
- Set your favorite Steps, CFG, Sampler, and default prompt modifiers.
- Hit Save.
- Go back to ComfyUI, drop the "Easy Checkpoint Config Loader" node, and watch your workflow automatically adapt to whatever model you throw at it.

---

## 🧩 Easy Prompt Builder

### 🧐 The Problem

Writing long, complex prompts often devolves into an unreadable wall of text. Wanting to tweak just a character's expression or lighting means hunting through a 200-word paragraph, and re-using your favorite lighting or outfit tags across different workflows requires constant copy-pasting.

---

### 💡 The Solution

The **Easy Prompt Builder** breaks your prompts into structured, modular building blocks, giving you surgical control over your generations without prompt chaos.

- **8 modular blocks:** Cleanly separate your prompts into `Prefix`, `Character`, `Clothing`, `Expression`, `Situation`, `Location`, `Lighting`, and `Suffix`.
- **Flexible outputs:** Outputs the combined `final_prompt` alongside individual outputs for every single block, letting you route specific parts anywhere in your canvas.
- **Block & Scene presets:** Save individual block fragments (like your signature character or lighting style) or save full **Scene Presets** to swap entire prompt setups instantly.
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

- **Automated Civitai Metadata Sync**: Fetches model titles, cover images/videos, creator usernames, HTML descriptions, tags, and trigger words directly from Civitai (supporting both SFW `civitai.com` and NSFW `civitai.red` domain modes), caching all preview media locally into `civitai_cache/`.
- **Card Gallery with Video Hover Playback**: Displays your local LoRAs in a responsive grid with video hover preview playback and fast filtering by Base Model Architecture (`Illustrious`, `Pony`, `SD 1.5`, `SDXL 1.0`), Author, and Tags.
- **Collapsible Search Filters**: Keep your gallery clean with a collapsible search filter panel featuring real-time active filter badges and state persistence.
- **Multiple Presets per LoRA**: Save multiple weight and prompt presets per LoRA card for instant switching.
- **Direct Civitai Links & Single-Card Resync**: One-click **"🌐 See on CivitAI"** direct model page redirection and single-card metadata resync buttons.
- **Instant Canvas Node Synchronization**: Click **"🚀 Send to ComfyUI"** inside the `Prompt Builder Config` tab to push your selected LoRA model, default weights (`strength_model`, `strength_clip`), and prompt builder blocks (`character`, `clothing`, `no_clothing`, `expression`, `situation`, `location`, `lighting`) directly to the **💊 Easy LoRA Config Loader** node on your active workflow canvas.

#### 🚀 How to Use It

- Drop the **💊 Easy LoRA Config Loader** node (`🗄️ Comfy Cabinet` category) onto your canvas.
- Click the **"Easy Config"** button in your ComfyUI top menu and choose **"Easy LoRA Config"**.
- Browse your gallery, search, or filter by Base Model architecture, Author, or Tag.
- Open a LoRA card to inspect Civitai preview images/videos, description, versions, and trigger words.
- In the **Prompt Builder Config** tab, fine-tune default weights and prompt blocks (or click **"🪄 Auto-fill Trigger Words"**).
- Click **"🚀 Send to ComfyUI"** to instantly update the active node on your canvas.

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
