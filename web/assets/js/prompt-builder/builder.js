document.addEventListener("DOMContentLoaded", () => {
    const CATEGORIES = ["prefix", "character", "clothing", "expression", "situation", "location", "lighting", "suffix"];
    
    let savedBlocksData = [];
    let scenePresetsData = [];
    let activeConfigData = {};
    let pendingSaveCategory = null;

    // DOM Elements
    const scenePresetSelect = document.getElementById("scenePresetSelect");
    const btnSaveScene = document.getElementById("btnSaveScene");
    const btnDeleteScene = document.getElementById("btnDeleteScene");
    const separatorSelect = document.getElementById("separatorSelect");
    
    const previewText = document.getElementById("previewText");
    const charCountEl = document.getElementById("charCount");
    const wordCountEl = document.getElementById("wordCount");
    const statusMessage = document.getElementById("statusMessage");
    const btnCopyPrompt = document.getElementById("btnCopyPrompt");
    const btnSaveActive = document.getElementById("btnSaveActive");

    // Modal elements
    const saveBlockModal = document.getElementById("saveBlockModal");
    const modalBlockTitleInput = document.getElementById("modalBlockTitleInput");
    const modalBlockCancel = document.getElementById("modalBlockCancel");
    const modalBlockConfirm = document.getElementById("modalBlockConfirm");

    const saveSceneModal = document.getElementById("saveSceneModal");
    const modalSceneNameInput = document.getElementById("modalSceneNameInput");
    const modalSceneCancel = document.getElementById("modalSceneCancel");
    const modalSceneConfirm = document.getElementById("modalSceneConfirm");

    function getTranslation(key, fallback = "") {
        return (window.i18n && window.i18n.t) ? window.i18n.t(key, fallback) : fallback;
    }

    function showStatus(msgKey, defaultMsg, isError = false) {
        const msg = getTranslation(msgKey, defaultMsg);
        if (!msg) return;
        if (window.Toast) {
            window.Toast.show(msg, isError ? "error" : "success");
        }
    }

    // Fetch initial data from server
    async function loadData() {
        try {
            const res = await fetch("/prompt_builder/get_data");
            if (!res.ok) throw new Error("Failed to load prompt builder data");
            const data = await res.json();
            
            savedBlocksData = data.saved_blocks || [];
            scenePresetsData = data.scene_presets || [];
            activeConfigData = data.active_config || {};

            populateActiveConfig();
            populateBlockPresetDropdowns();
            populateScenePresetDropdown();
            updatePreview();
        } catch (err) {
            console.error(err);
            showStatus("status.save_error", "Failed to load data", true);
        }
    }

    function populateActiveConfig() {
        if (activeConfigData.separator) {
            separatorSelect.value = activeConfigData.separator;
        }

        CATEGORIES.forEach(cat => {
            const textarea = document.querySelector(`.block-textarea[data-category="${cat}"]`);
            if (textarea) {
                let val = activeConfigData[cat];
                if (val === undefined && cat === "expression") {
                    val = activeConfigData.mood;
                }
                if (val !== undefined) {
                    textarea.value = val;
                }
            }
        });
    }

    function populateBlockPresetDropdowns() {
        CATEGORIES.forEach(cat => {
            const select = document.querySelector(`.block-select-preset[data-category="${cat}"]`);
            if (!select) return;

            const categoryBlocks = savedBlocksData.filter(b => b.category === cat);
            const currentSelectedVal = select.value;

            const defaultText = getTranslation("prompt_builder.select_block_preset", "Load saved block...");
            select.innerHTML = `<option value="">${defaultText}</option>`;

            categoryBlocks.forEach(block => {
                const opt = document.createElement("option");
                opt.value = block.id;
                opt.textContent = block.title;
                select.appendChild(opt);
            });

            select.value = currentSelectedVal;
        });
    }

    function populateScenePresetDropdown() {
        const defaultText = getTranslation("prompt_builder.select_scene_placeholder", "Choose scene preset...");
        scenePresetSelect.innerHTML = `<option value="">${defaultText}</option>`;

        scenePresetsData.forEach(scene => {
            const opt = document.createElement("option");
            opt.value = scene.id;
            opt.textContent = scene.name;
            scenePresetSelect.appendChild(opt);
        });
    }

    function getSeparatorValue() {
        const raw = separatorSelect.value || ", ";
        return raw.replace("\\n", "\n").replace("\\t", "\t");
    }

    function updatePreview() {
        const sep = getSeparatorValue();
        const activeBlocks = [];

        CATEGORIES.forEach(cat => {
            const textarea = document.querySelector(`.block-textarea[data-category="${cat}"]`);
            if (textarea && textarea.value.trim()) {
                activeBlocks.push(textarea.value.trim());
            }
        });

        const fullPrompt = activeBlocks.join(sep);
        previewText.textContent = fullPrompt;

        charCountEl.textContent = fullPrompt.length;
        const words = fullPrompt.trim() ? fullPrompt.trim().split(/\s+/).length : 0;
        wordCountEl.textContent = words;
    }

    // Auto update live preview on typing
    CATEGORIES.forEach(cat => {
        const textarea = document.querySelector(`.block-textarea[data-category="${cat}"]`);
        if (textarea) {
            textarea.addEventListener("input", updatePreview);
        }
    });

    separatorSelect.addEventListener("change", updatePreview);

    // Load selected block preset
    document.querySelectorAll(".block-select-preset").forEach(select => {
        select.addEventListener("change", (e) => {
            const blockId = parseInt(e.target.value, 10);
            const cat = e.target.getAttribute("data-category");
            if (!blockId) return;

            const foundBlock = savedBlocksData.find(b => b.id === blockId);
            if (foundBlock) {
                const textarea = document.querySelector(`.block-textarea[data-category="${cat}"]`);
                if (textarea) {
                    textarea.value = foundBlock.content;
                    updatePreview();
                }
            }
        });
    });

    // Clear single block
    document.querySelectorAll(".btn-clear-block").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const cat = e.target.getAttribute("data-category");
            const textarea = document.querySelector(`.block-textarea[data-category="${cat}"]`);
            const select = document.querySelector(`.block-select-preset[data-category="${cat}"]`);
            if (textarea) textarea.value = "";
            if (select) select.value = "";
            updatePreview();
        });
    });

    // Open Save Block Modal
    document.querySelectorAll(".btn-save-block").forEach(btn => {
        btn.addEventListener("click", (e) => {
            pendingSaveCategory = e.target.getAttribute("data-category");
            modalBlockTitleInput.value = "";
            saveBlockModal.style.display = "flex";
            saveBlockModal.classList.add("active");
            modalBlockTitleInput.focus();
        });
    });

    modalBlockCancel.addEventListener("click", () => {
        saveBlockModal.style.display = "none";
        saveBlockModal.classList.remove("active");
        pendingSaveCategory = null;
    });

    modalBlockConfirm.addEventListener("click", async () => {
        const title = modalBlockTitleInput.value.trim();
        if (!title || !pendingSaveCategory) return;

        const textarea = document.querySelector(`.block-textarea[data-category="${pendingSaveCategory}"]`);
        const content = textarea ? textarea.value.trim() : "";

        try {
            const res = await fetch("/prompt_builder/save_block", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    category: pendingSaveCategory,
                    title: title,
                    content: content
                })
            });

            if (!res.ok) throw new Error("Failed to save block preset");
            saveBlockModal.style.display = "none";
            saveBlockModal.classList.remove("active");
            showStatus("prompt_builder.status_block_saved", "Block preset saved! ✅");
            await loadData();
        } catch (err) {
            console.error(err);
            showStatus("status.save_error", "Error saving preset", true);
        } finally {
            pendingSaveCategory = null;
        }
    });

    // Delete selected block preset
    document.querySelectorAll(".btn-delete-preset").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const cat = e.target.getAttribute("data-category");
            const select = document.querySelector(`.block-select-preset[data-category="${cat}"]`);
            const blockId = parseInt(select.value, 10);

            if (!blockId) {
                alert("Please select a block preset from the dropdown to delete.");
                return;
            }

            if (!confirm("Are you sure you want to delete this block preset?")) return;

            try {
                const res = await fetch("/prompt_builder/delete_block", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: blockId })
                });

                if (!res.ok) throw new Error("Failed to delete block preset");
                showStatus("prompt_builder.status_block_deleted", "Block preset deleted! 🗑️");
                select.value = "";
                await loadData();
            } catch (err) {
                console.error(err);
                showStatus("status.save_error", "Error deleting preset", true);
            }
        });
    });

    // Load Scene Preset
    scenePresetSelect.addEventListener("change", (e) => {
        const sceneId = parseInt(e.target.value, 10);
        if (!sceneId) return;

        const scene = scenePresetsData.find(s => s.id === sceneId);
        if (!scene) return;

        CATEGORIES.forEach(cat => {
            const textarea = document.querySelector(`.block-textarea[data-category="${cat}"]`);
            if (textarea) {
                let val = scene[cat];
                if (val === undefined && cat === "expression") {
                    val = scene.mood;
                }
                if (val !== undefined) {
                    textarea.value = val;
                }
            }
        });

        if (scene.separator) {
            separatorSelect.value = scene.separator;
        }

        updatePreview();
    });

    // Open Save Scene Modal
    btnSaveScene.addEventListener("click", () => {
        modalSceneNameInput.value = "";
        saveSceneModal.style.display = "flex";
        saveSceneModal.classList.add("active");
        modalSceneNameInput.focus();
    });

    modalSceneCancel.addEventListener("click", () => {
        saveSceneModal.style.display = "none";
        saveSceneModal.classList.remove("active");
    });

    modalSceneConfirm.addEventListener("click", async () => {
        const name = modalSceneNameInput.value.trim();
        if (!name) return;

        const scenePayload = {
            name: name,
            separator: separatorSelect.value
        };

        CATEGORIES.forEach(cat => {
            const textarea = document.querySelector(`.block-textarea[data-category="${cat}"]`);
            scenePayload[cat] = textarea ? textarea.value : "";
        });

        try {
            const res = await fetch("/prompt_builder/save_scene_preset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(scenePayload)
            });

            if (!res.ok) throw new Error("Failed to save scene preset");
            saveSceneModal.style.display = "none";
            saveSceneModal.classList.remove("active");
            showStatus("prompt_builder.status_scene_saved", "Scene preset saved! ✅");
            await loadData();
        } catch (err) {
            console.error(err);
            showStatus("status.save_error", "Error saving scene", true);
        }
    });

    // Delete Scene Preset
    btnDeleteScene.addEventListener("click", async () => {
        const sceneId = parseInt(scenePresetSelect.value, 10);
        if (!sceneId) {
            alert("Please select a full scene preset from the dropdown to delete.");
            return;
        }

        if (!confirm("Are you sure you want to delete this scene preset?")) return;

        try {
            const res = await fetch("/prompt_builder/delete_scene_preset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: sceneId })
            });

            if (!res.ok) throw new Error("Failed to delete scene preset");
            scenePresetSelect.value = "";
            showStatus("prompt_builder.status_scene_deleted", "Scene preset deleted! 🗑️");
            await loadData();
        } catch (err) {
            console.error(err);
            showStatus("status.save_error", "Error deleting scene", true);
        }
    });

    // Save Active Config to Node
    btnSaveActive.addEventListener("click", async () => {
        const activePayload = {
            separator: separatorSelect.value
        };

        CATEGORIES.forEach(cat => {
            const textarea = document.querySelector(`.block-textarea[data-category="${cat}"]`);
            activePayload[cat] = textarea ? textarea.value : "";
        });

        try {
            const res = await fetch("/prompt_builder/save_active", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(activePayload)
            });

            if (!res.ok) throw new Error("Failed to save active config");
            showStatus("prompt_builder.status_active_saved", "Active prompt state saved! ✅");
        } catch (err) {
            console.error(err);
            showStatus("status.save_error", "Error saving active state", true);
        }
    });

    // Copy Prompt to Clipboard
    btnCopyPrompt.addEventListener("click", async () => {
        const text = previewText.textContent || "";
        if (!text) return;

        try {
            await navigator.clipboard.writeText(text);
            showStatus("prompt_builder.status_copied", "Prompt copied to clipboard! 📋");
        } catch (err) {
            console.error(err);
            // Fallback for clipboard
            const textarea = document.createElement("textarea");
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
            showStatus("prompt_builder.status_copied", "Prompt copied to clipboard! 📋");
        }
    });

    // Initial load
    loadData();
});
