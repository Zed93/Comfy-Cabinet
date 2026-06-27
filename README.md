# 🗄️ Comfy Cabinet

Welcome to the **Comfy Cabinet**, a boutique virtual exhibit of handcrafted ComfyUI custom nodes. No fluff, just a clean, offline-first space where your nodes sit comfortably on velvet shelves, waiting to save your workflow from the depths of chaos.

Current Exhibition: 🎨 **Easy Checkpoint Config Loader** (yeah, I know there's only one for now...more tools will come later)

---

## 🧐 The Problem

We’ve all been there. You switch from an SD1.5 model to an SDXL model, or you fire up a new Flux checkpoint, and *boom*—you forgot to change the steps from 20 to 4. Or you left the CFG scale at 7.0 for a model that fries anything past 1.5. 

Your options used to be:
1. Plaster your canvas with 45 different `Primitive` nodes and switches.
2. Memorize every model's sweet spot (impossible, you haven't slept since Flux dropped).
3. Cry as your GPU renders a beautiful canvas of deep-fried static noise.

---

## 🎨 The Solution: Easy Checkpoint Config

The **Easy Checkpoint Config** is like having a very polite, highly organized butler inside your ComfyUI instance. It intercepts your checkpoint selection and whispers the exact right settings to your workflow.

- **Dynamic Samplers/Schedulers:** It doesn't rely on a dusty, hardcoded list as other custom nodes. It aggressively interrogates your ComfyUI installation at startup to find *exactly* what samplers and schedulers you have installed (yes, even those weird ones from that custom node repo you cloned at 3 AM).
- **Smart Prompt Stitching:** Automatically glues your custom global prefix (e.g., *masterpiece, highly detailed*) and suffix tags to your user prompt using whatever custom separator you want. Want a comma? Cool. Want a line break (`\n`) because you like your prompts structured like a grocery list? Go wild.

---

## 🚀 How to Use It

- Click the shiny new "Easy Config" button injected into your ComfyUI top menu.
- Search for your checkpoint in the dropdown (yes, you can actually type to search, welcome to the future).
- Set your favorite Steps, CFG, Sampler, and default prompt modifiers.
- Hit Save.
- Go back to ComfyUI, drop the "Easy Checkpoint Config Loader" node, and watch your workflow automatically adapt to whatever model you throw at it.

---

## 🛠️ Installation

Simply clone this repository into your ComfyUI custom nodes folder:
```bash
cd ComfyUI/custom_nodes
git clone https://github.com/Zed93/Comfy-Cabinet.git
```

---

## 🧐 Tested with

- ComfyUI 0.26.2
- ltdrdata/ComfyUI-Impact-Pack Facedetailer custom node
