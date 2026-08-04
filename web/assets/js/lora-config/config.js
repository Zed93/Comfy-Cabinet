let allLoraItems = [];
let activeBaseModelFilter = "ALL";
let activeTagFilter = "ALL";
let activeSearchQuery = "";
let activeSortOrder = "AZ";
let currentDetailItem = null;
let currentDomainMode = "civitai.com";
let civitaiApiKey = "";

const fields = {
    search: null,
    apiKeyInput: null,
    sortSelect: null,
    modalNotes: null,
    weightModel: null,
    weightClip: null,
    character: null,
    clothing: null,
    no_clothing: null,
    expression: null,
    situation: null,
    location: null,
    lighting: null
};

document.addEventListener("DOMContentLoaded", () => {
    fields.search = document.getElementById("loraSearchInput");
    fields.apiKeyInput = document.getElementById("civitaiApiKeyInput");
    fields.sortSelect = document.getElementById("sortSelect");
    fields.modalNotes = document.getElementById("modalNotesInput");
    fields.weightModel = document.getElementById("weightModelInput");
    fields.weightClip = document.getElementById("weightClipInput");
    fields.character = document.getElementById("block_character");
    fields.clothing = document.getElementById("block_clothing");
    fields.no_clothing = document.getElementById("block_no_clothing");
    fields.expression = document.getElementById("block_expression");
    fields.situation = document.getElementById("block_situation");
    fields.location = document.getElementById("block_location");
    fields.lighting = document.getElementById("block_lighting");

    // Add real-time input listeners to update Send to ComfyUI button visibility
    [fields.character, fields.clothing, fields.no_clothing, fields.expression, fields.situation, fields.location, fields.lighting].forEach(el => {
        if (el) {
            el.addEventListener("input", updateSendToComfyVisibility);
        }
    });

    const initLoader = () => {
        setupDomainButtons();
        setupApiKeyToggle();
        setupSearchInput();
        setupSortSelect();
        setupTabs();
        setupPresetsUI();
        setupCollapsibleFilters();

        const syncBtn = document.getElementById("btnSyncAllMetadata");
        if (syncBtn) syncBtn.addEventListener("click", bulkSyncMetadata);

        const closeBtn = document.getElementById("closeDetailModal");
        if (closeBtn) closeBtn.addEventListener("click", closeDetailModal);

        const saveBtn = document.getElementById("btnSaveModalConfig");
        if (saveBtn) saveBtn.addEventListener("click", saveCurrentLoraConfig);

        const sendBtn = document.getElementById("btnSendToComfy");
        if (sendBtn) sendBtn.addEventListener("click", sendToComfyUI);

        const resyncSingleBtn = document.getElementById("btnResyncSingleLora");
        if (resyncSingleBtn) resyncSingleBtn.addEventListener("click", resyncSingleLora);

        // Settings Modal Listeners
        const openSettingsBtn = document.getElementById("openSettingsModal");
        if (openSettingsBtn) openSettingsBtn.addEventListener("click", openSettingsModal);

        const closeSettingsBtn = document.getElementById("closeSettingsModal");
        if (closeSettingsBtn) closeSettingsBtn.addEventListener("click", closeSettingsModal);

        const saveSettingsBtn = document.getElementById("saveSettingsBtn");
        if (saveSettingsBtn) saveSettingsBtn.addEventListener("click", () => {
            saveGlobals();
            closeSettingsModal();
        });

        const testBtn = document.getElementById("btnTestCivitai");
        if (testBtn) testBtn.addEventListener("click", testCivitaiConnection);

        loadAllLoras();
    };

    if (window.i18n && window.i18n.ready) {
        initLoader();
    } else {
        document.addEventListener("i18n-ready", initLoader);
    }
});

function setupDomainButtons() {
    const sfwBtn = document.getElementById("domainSfwBtn");
    const nsfwBtn = document.getElementById("domainNsfwBtn");

    if (!sfwBtn || !nsfwBtn) return;

    sfwBtn.addEventListener("click", () => {
        currentDomainMode = "civitai.com";
        sfwBtn.classList.add("active", "sfw");
        nsfwBtn.classList.remove("active", "nsfw");
        saveGlobals();
    });

    nsfwBtn.addEventListener("click", () => {
        currentDomainMode = "civitai.red";
        nsfwBtn.classList.add("active", "nsfw");
        sfwBtn.classList.remove("active", "sfw");
        saveGlobals();
    });
}

function setupApiKeyToggle() {
    const toggleBtn = document.getElementById("toggleApiKeyBtn");
    if (!toggleBtn || !fields.apiKeyInput) return;

    toggleBtn.addEventListener("click", () => {
        if (fields.apiKeyInput.type === "password") {
            fields.apiKeyInput.type = "text";
            toggleBtn.textContent = "🔒";
        } else {
            fields.apiKeyInput.type = "password";
            toggleBtn.textContent = "👁️";
        }
    });

    fields.apiKeyInput.addEventListener("change", () => {
        civitaiApiKey = fields.apiKeyInput.value.trim();
        saveGlobals();
    });
}

function setupSearchInput() {
    if (!fields.search) return;
    fields.search.addEventListener("input", (e) => {
        activeSearchQuery = e.target.value.toLowerCase().trim();
        renderLoraGrid();
    });
}

function setupSortSelect() {
    if (!fields.sortSelect) return;
    fields.sortSelect.addEventListener("change", (e) => {
        activeSortOrder = e.target.value;
        renderLoraGrid();
    });
}

function setupTabs() {
    const tabs = document.querySelectorAll(".detail-tabs .tab-item");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");

            const tabName = tab.getAttribute("data-tab") || "";
            const contents = document.querySelectorAll(".tab-content");
            contents.forEach(c => c.classList.remove("active"));

            const camelName = tabName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            const target = document.getElementById(`tab${capitalize(camelName)}`) || document.getElementById(`tab${capitalize(tabName)}`);
            if (target) target.classList.add("active");
        });
    });
}

async function loadAllLoras() {
    try {
        const response = await fetch("/easy_lora_config/get_all_loras_full");
        const data = await response.json();

        allLoraItems = data.items || [];
        const globals = data.global_configs || {};

        if (globals.domain_mode) {
            currentDomainMode = globals.domain_mode;
            const sfwBtn = document.getElementById("domainSfwBtn");
            const nsfwBtn = document.getElementById("domainNsfwBtn");
            if (globals.domain_mode === "civitai.red") {
                nsfwBtn.classList.add("active", "nsfw");
                sfwBtn.classList.remove("active", "sfw");
            } else {
                sfwBtn.classList.add("active", "sfw");
                nsfwBtn.classList.remove("active", "sfw");
            }
        }

        if (globals.civitai_api_key) {
            civitaiApiKey = globals.civitai_api_key;
            if (fields.apiKeyInput) fields.apiKeyInput.value = globals.civitai_api_key;
        }

        populateBaseModelFilterBar();
        populateAuthorFilterBar();
        populateTagsFilterBar();
        renderLoraGrid();
    } catch (err) {
        console.error("[EasyLoraConfig] Error loading all loras:", err);
    }
}

let activeAuthorFilter = "ALL";

function populateBaseModelFilterBar() {
    const bar = document.getElementById("baseModelFilterBar");
    if (!bar) return;

    const counts = {};
    allLoraItems.forEach(item => {
        const bm = (item.base_model && item.base_model.trim()) ? item.base_model.trim() : "Other / Unspecified";
        counts[bm] = (counts[bm] || 0) + 1;
    });

    bar.innerHTML = `<span class="tag-filter-pill ${activeBaseModelFilter === "ALL" ? "active" : ""}" data-base="ALL">All Base Models (${allLoraItems.length})</span>`;

    Object.keys(counts).sort().forEach(baseModel => {
        const pill = document.createElement("span");
        pill.className = `tag-filter-pill ${activeBaseModelFilter === baseModel ? "active" : ""}`;
        pill.setAttribute("data-base", baseModel);
        pill.textContent = `${baseModel} (${counts[baseModel]})`;
        pill.addEventListener("click", () => {
            bar.querySelectorAll(".tag-filter-pill").forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            activeBaseModelFilter = baseModel;
            renderLoraGrid();
        });
        bar.appendChild(pill);
    });

    const firstPill = bar.querySelector('[data-base="ALL"]');
    if (firstPill) {
        firstPill.addEventListener("click", () => {
            bar.querySelectorAll(".tag-filter-pill").forEach(p => p.classList.remove("active"));
            firstPill.classList.add("active");
            activeBaseModelFilter = "ALL";
            renderLoraGrid();
        });
    }
}

function populateAuthorFilterBar() {
    const bar = document.getElementById("authorFilterBar");
    if (!bar) return;

    const counts = {};
    allLoraItems.forEach(item => {
        const author = (item.author && item.author.trim() && item.author.trim() !== "Unknown")
            ? item.author.trim()
            : "Unknown / Unspecified";
        counts[author] = (counts[author] || 0) + 1;
    });

    const isIt = (window.i18n && window.i18n.currentLang) === "it";
    const allText = isIt ? `Tutti gli Autori (${allLoraItems.length})` : `All Authors (${allLoraItems.length})`;

    bar.innerHTML = `<span class="tag-filter-pill ${activeAuthorFilter === "ALL" ? "active" : ""}" data-author="ALL">${allText}</span>`;

    Object.keys(counts).sort().forEach(author => {
        const pill = document.createElement("span");
        pill.className = `tag-filter-pill ${activeAuthorFilter === author ? "active" : ""}`;
        pill.setAttribute("data-author", author);
        pill.textContent = `👤 ${author} (${counts[author]})`;
        pill.addEventListener("click", () => {
            bar.querySelectorAll(".tag-filter-pill").forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            activeAuthorFilter = author;
            renderLoraGrid();
        });
        bar.appendChild(pill);
    });

    const firstPill = bar.querySelector('[data-author="ALL"]');
    if (firstPill) {
        firstPill.addEventListener("click", () => {
            bar.querySelectorAll(".tag-filter-pill").forEach(p => p.classList.remove("active"));
            firstPill.classList.add("active");
            activeAuthorFilter = "ALL";
            renderLoraGrid();
        });
    }
}

function populateTagsFilterBar() {
    const bar = document.getElementById("tagsFilterBar");
    if (!bar) return;

    const tagCounts = {};
    allLoraItems.forEach(item => {
        if (item.tags && Array.isArray(item.tags)) {
            item.tags.forEach(t => {
                const cleanTag = t.trim();
                if (cleanTag) {
                    tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
                }
            });
        }
    });

    bar.innerHTML = `<span class="tag-filter-pill ${activeTagFilter === "ALL" ? "active" : ""}" data-tag="ALL">All Tags</span>`;

    Object.keys(tagCounts).sort().forEach(tag => {
        const pill = document.createElement("span");
        pill.className = `tag-filter-pill ${activeTagFilter === tag ? "active" : ""}`;
        pill.setAttribute("data-tag", tag);
        pill.textContent = `${tag} (${tagCounts[tag]})`;
        pill.addEventListener("click", () => {
            bar.querySelectorAll(".tag-filter-pill").forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            activeTagFilter = tag;
            renderLoraGrid();
        });
        bar.appendChild(pill);
    });

    const firstPill = bar.querySelector('[data-tag="ALL"]');
    if (firstPill) {
        firstPill.addEventListener("click", () => {
            bar.querySelectorAll(".tag-filter-pill").forEach(p => p.classList.remove("active"));
            firstPill.classList.add("active");
            activeTagFilter = "ALL";
            renderLoraGrid();
        });
    }
}

function sortLoraItems(items) {
    const sorted = [...items];
    if (activeSortOrder === "ZA") {
        sorted.sort((a, b) => b.lora_name.localeCompare(a.lora_name, undefined, { sensitivity: 'base', numeric: true }));
    } else if (activeSortOrder === "SYNCED") {
        sorted.sort((a, b) => (b.last_synced || "").localeCompare(a.last_synced || ""));
    } else {
        // Default Alphabetical A-Z
        sorted.sort((a, b) => a.lora_name.localeCompare(b.lora_name, undefined, { sensitivity: 'base', numeric: true }));
    }
    return sorted;
}

function setupCollapsibleFilters() {
    const toggleHeader = document.getElementById("filtersToggleHeader");
    const toggleBtn = document.getElementById("btnToggleFilters");
    const container = document.getElementById("filtersCollapseContainer");
    const toggleText = document.getElementById("toggleFiltersBtnText");

    if (!container) return;

    let isCollapsed = localStorage.getItem("lora_filters_collapsed") === "true";

    const updateFilterPanelState = () => {
        const isIt = (window.i18n && window.i18n.currentLang) === "it";
        if (isCollapsed) {
            container.style.display = "none";
            if (toggleText) toggleText.textContent = isIt ? "🔽 Mostra Filtri" : "🔽 Show Filters";
        } else {
            container.style.display = "flex";
            if (toggleText) toggleText.textContent = isIt ? "🔼 Nascondi Filtri" : "🔼 Hide Filters";
        }
    };

    updateFilterPanelState();

    const toggle = () => {
        isCollapsed = !isCollapsed;
        localStorage.setItem("lora_filters_collapsed", isCollapsed ? "true" : "false");
        updateFilterPanelState();
    };

    if (toggleHeader) toggleHeader.addEventListener("click", (e) => {
        if (e.target.closest("#btnToggleFilters")) return;
        toggle();
    });
    if (toggleBtn) toggleBtn.addEventListener("click", toggle);
}

function updateActiveFiltersBadge() {
    const badge = document.getElementById("activeFiltersBadge");
    if (!badge) return;

    let count = 0;
    if (activeBaseModelFilter && activeBaseModelFilter !== "ALL") count++;
    if (activeAuthorFilter && activeAuthorFilter !== "ALL") count++;
    if (activeTagFilter && activeTagFilter !== "ALL") count++;
    if (activeSearchQuery) count++;

    if (count > 0) {
        badge.textContent = `${count} ${count === 1 ? 'Active' : 'Active'}`;
        badge.style.display = "inline-block";
    } else {
        badge.style.display = "none";
    }
}

function renderLoraGrid() {
    const grid = document.getElementById("loraGrid");
    if (!grid) return;

    updateActiveFiltersBadge();

    let filtered = allLoraItems;

    // Filter by Base Model Architecture
    if (activeBaseModelFilter !== "ALL") {
        filtered = filtered.filter(item => {
            const bm = (item.base_model && item.base_model.trim()) ? item.base_model.trim() : "Other / Unspecified";
            return bm === activeBaseModelFilter;
        });
    }

    // Filter by Author
    if (activeAuthorFilter !== "ALL") {
        filtered = filtered.filter(item => {
            const author = (item.author && item.author.trim() && item.author.trim() !== "Unknown")
                ? item.author.trim()
                : "Unknown / Unspecified";
            return author === activeAuthorFilter;
        });
    }

    // Filter by Tag
    if (activeTagFilter !== "ALL") {
        filtered = filtered.filter(item => item.tags && item.tags.includes(activeTagFilter));
    }

    // Filter by Search Query
    if (activeSearchQuery) {
        filtered = filtered.filter(item => {
            const nameMatch = item.lora_name.toLowerCase().includes(activeSearchQuery);
            const authorMatch = (item.author || "").toLowerCase().includes(activeSearchQuery);
            const baseMatch = (item.base_model || "").toLowerCase().includes(activeSearchQuery);
            const tagMatch = item.tags && item.tags.some(t => t.toLowerCase().includes(activeSearchQuery));
            const triggerMatch = (item.trigger_words || "").toLowerCase().includes(activeSearchQuery);
            return nameMatch || authorMatch || baseMatch || tagMatch || triggerMatch;
        });
    }

    // Apply Sorting (Alphabetical A-Z by default)
    filtered = sortLoraItems(filtered);

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 50px;">No matching LoRAs found.</div>`;
        return;
    }

    grid.innerHTML = "";
    filtered.forEach(item => {
        const card = document.createElement("div");
        card.className = "lora-card";

        const fileName = item.lora_name.split("/").pop().split("\\").pop().replace(/\.(safetensors|ckpt)$/i, "");
        const displayTitle = item.civitai_metadata?.title || item.civitai_metadata?.name || fileName;
        const rawCoverUrl = item.cover_url || (item.civitai_metadata?.images?.[0]?.url) || "";
        const coverUrl = getCachedImageUrl(rawCoverUrl);
        const baseModel = item.base_model || "SD";
        const author = item.author || item.civitai_metadata?.author || "";

        const firstImgObj = item.civitai_metadata?.images?.[0];
        const isVideo = (firstImgObj && firstImgObj.type === "video") ||
            (rawCoverUrl && (rawCoverUrl.toLowerCase().includes(".mp4") || rawCoverUrl.toLowerCase().includes(".webm")));

        if (coverUrl) {
            if (isVideo) {
                const video = document.createElement("video");
                video.className = "lora-card-img";
                video.src = coverUrl;
                video.muted = true;
                video.loop = true;
                video.playsInline = true;
                video.preload = "metadata";
                card.appendChild(video);

                card.addEventListener("mouseenter", () => {
                    video.play().catch(() => { });
                });
                card.addEventListener("mouseleave", () => {
                    video.pause();
                });
            } else {
                const img = document.createElement("img");
                img.className = "lora-card-img";
                img.src = coverUrl;
                img.loading = "lazy";
                card.appendChild(img);
            }
        } else {
            const placeholder = document.createElement("div");
            placeholder.className = "lora-card-placeholder";
            placeholder.innerHTML = `<span>💊</span><span style="font-size: 0.8rem; margin-top: 6px; color: var(--text-muted);">${escapeHtml(displayTitle)}</span>`;
            card.appendChild(placeholder);
        }

        const overlay = document.createElement("div");
        const baseCivDomain = currentDomainMode === "civitai.red" ? "https://civitai.red" : "https://civitai.com";
        const civIdGrid = item.civitai_id || item.civitai_metadata?.id || item.civitai_metadata?.modelId;
        const verIdGrid = item.model_version_id || item.civitai_metadata?.versionId;
        const directGridUrl = civIdGrid ? `${baseCivDomain}/models/${civIdGrid}${verIdGrid ? '?modelVersionId=' + verIdGrid : ''}` : `${baseCivDomain}/models?query=${encodeURIComponent(displayTitle)}`;

        overlay.className = "lora-card-overlay";
        overlay.innerHTML = `
            <div class="lora-card-top">
                <span class="lora-card-tag">${escapeHtml(baseModel)}</span>
                <div class="lora-card-actions">
                    <button class="icon-btn" title="Select LoRA" onclick="event.stopPropagation(); openDetailModalByName('${escapeHtml(item.lora_name)}');">⚙️</button>
                </div>
            </div>
            <div class="lora-card-bottom">
                <div class="lora-card-title" title="${escapeHtml(displayTitle)}">${escapeHtml(displayTitle)}</div>
                <div class="lora-card-sub">
                    <span>${author ? '👤 ' + escapeHtml(author) : ''}</span>
                    <span class="lora-card-badge">${item.file_size || ''}</span>
                </div>
            </div>
        `;

        card.appendChild(overlay);
        card.addEventListener("click", () => openDetailModal(item));
        grid.appendChild(card);
    });
}

function openDetailModalByName(loraName) {
    const item = allLoraItems.find(i => i.lora_name === loraName);
    if (item) openDetailModal(item);
}

function openDetailModal(item) {
    currentDetailItem = item;

    const modal = document.getElementById("detailModal");
    const fileName = item.lora_name.split("/").pop().split("\\").pop().replace(/\.(safetensors|ckpt)$/i, "");
    const displayTitle = item.civitai_metadata?.title || item.civitai_metadata?.name || fileName;
    const authorVal = item.author || item.civitai_metadata?.author || "";

    document.getElementById("modalTitle").textContent = displayTitle;
    document.getElementById("modalAuthorBadge").textContent = (authorVal && authorVal !== "Unknown") ? `👤 ${authorVal}` : "👤 Unknown Author";

    const civBtn = document.getElementById("btnViewCivitai");
    if (civBtn) {
        civBtn.style.display = "inline-flex";

        civBtn.onclick = async (e) => {
            e.preventDefault();

            const baseDomain = currentDomainMode === "civitai.red" ? "https://civitai.red" : "https://civitai.com";
            const civId = item.civitai_id || item.civitai_metadata?.id || item.civitai_metadata?.modelId;
            const verId = item.model_version_id || item.civitai_metadata?.versionId;

            if (civId) {
                let directUrl = `${baseDomain}/models/${civId}`;
                if (verId) directUrl += `?modelVersionId=${verId}`;
                window.open(directUrl, "_blank", "noopener,noreferrer");
                return;
            }

            // Unsynced LoRA: Open tab synchronously to avoid browser popup blocks
            const newTab = window.open("about:blank", "_blank");

            try {
                const res = await fetch("/easy_lora_config/fetch_civitai", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        lora_name: item.lora_name,
                        domain: currentDomainMode,
                        api_key: civitaiApiKey
                    })
                });

                const data = await res.json();
                if (data.status === "success" && data.data) {
                    const fetchedId = data.data.id || data.data.versionId;
                    const fetchedVerId = data.data.versionId;

                    Object.assign(item, {
                        civitai_id: data.data.id,
                        model_version_id: data.data.versionId,
                        civitai_metadata: data.data,
                        author: data.data.author || item.author,
                        base_model: data.data.baseModel || item.base_model
                    });

                    openDetailModal(item);
                    populateBaseModelFilterBar();
                    populateAuthorFilterBar();
                    populateTagsFilterBar();
                    renderLoraGrid();

                    if (fetchedId) {
                        let directUrl = `${baseDomain}/models/${fetchedId}`;
                        if (fetchedVerId) directUrl += `?modelVersionId=${fetchedVerId}`;
                        if (newTab) newTab.location.href = directUrl;
                        return;
                    }
                }
            } catch (err) {
                console.warn("[EasyLoraConfig] On-demand Civitai fetch error:", err);
            }

            const cleanTitle = item.lora_name.split("/").pop().split("\\").pop().replace(/\.(safetensors|ckpt)$/i, "");
            if (newTab) newTab.location.href = `${baseDomain}/models?query=${encodeURIComponent(cleanTitle)}`;
        };
    }

    // Info grid matching Screenshot 1
    document.getElementById("infoVersion").textContent = item.civitai_metadata?.versionName || "v1.0";
    document.getElementById("infoFileName").textContent = item.lora_name.split("/").pop().split("\\").pop();
    document.getElementById("infoLocation").textContent = item.relative_path || item.lora_name;
    document.getElementById("infoBaseModel").textContent = item.base_model || "Unknown";
    document.getElementById("infoSize").textContent = item.file_size || "Unknown";

    // Tags rendering
    renderModalTags(item.tags || []);

    // Trigger words badges matching Screenshot 1
    renderModalTriggerWords(item.trigger_words || "", item.civitai_metadata?.trainedWords || []);

    // Notes
    fields.modalNotes.value = item.notes || "";

    // Tab 1: Examples
    renderModalExamples(item.civitai_metadata?.images || []);

    // Tab 2: Description
    const descBox = document.getElementById("modalDescriptionContent");
    if (item.civitai_metadata?.description) {
        descBox.innerHTML = item.civitai_metadata.description;
    } else {
        descBox.textContent = "No Civitai description available. Run 'Sync All Metadata' to fetch.";
    }

    // Tab 3: Versions
    document.getElementById("verName").textContent = item.civitai_metadata?.versionName || "v1.0";
    document.getElementById("verBase").textContent = item.base_model || "Unknown";

    // Tab 4: Prompt Config
    if (!Array.isArray(item.presets) || item.presets.length === 0) {
        item.presets = [{
            id: "default",
            name: "Default Preset",
            weight_model: item.weight_model ?? 1.0,
            weight_clip: item.weight_clip ?? 1.0,
            character: item.character || "",
            clothing: item.clothing || "",
            no_clothing: item.no_clothing || "",
            expression: item.expression || "",
            situation: item.situation || "",
            location: item.location || "",
            lighting: item.lighting || ""
        }];
    }

    currentActivePresetId = item.presets[0].id;

    // Check if default preset is completely empty and trigger words exist -> pre-fill character
    const p0 = item.presets[0];
    const isAllEmpty = !p0.character && !p0.clothing && !p0.no_clothing && !p0.expression && !p0.situation && !p0.location && !p0.lighting;
    const triggers = item.trigger_words || (item.civitai_metadata?.trainedWords ? item.civitai_metadata.trainedWords.join(", ") : "");
    if (isAllEmpty && triggers) {
        p0.character = triggers;
    }

    renderPresetDropdown(item);
    loadPresetValues(item, currentActivePresetId);

    const autoFillBtn = document.getElementById("btnAutoFillTriggers");
    if (autoFillBtn) {
        autoFillBtn.onclick = () => {
            if (triggers) {
                if (!fields.character.value.trim()) {
                    fields.character.value = triggers;
                } else if (!fields.character.value.includes(triggers)) {
                    fields.character.value += `, ${triggers}`;
                }
                updateSendToComfyVisibility();
                showModalStatus("Auto-filled trigger words into Character block! 🪄", "var(--accent)");
            } else {
                showModalStatus("No trigger words found for this LoRA.", "var(--text-muted)");
            }
        };
    }

    updateSendToComfyVisibility();

    showModalStatus("");
    modal.style.display = "flex";
}

let currentActivePresetId = "default";

function setupPresetsUI() {
    const presetSelect = document.getElementById("presetSelect");
    const btnNew = document.getElementById("btnNewPreset");
    const btnDelete = document.getElementById("btnDeletePreset");

    if (presetSelect) {
        presetSelect.addEventListener("change", (e) => {
            if (!currentDetailItem) return;
            // Sync current inputs into current active preset first
            syncCurrentInputsToPreset(currentDetailItem, currentActivePresetId);

            currentActivePresetId = e.target.value;
            loadPresetValues(currentDetailItem, currentActivePresetId);
        });
    }

    if (btnNew) {
        btnNew.addEventListener("click", () => {
            if (!currentDetailItem) return;
            const presetName = prompt("Enter a name for this new preset (e.g. Casual Outfit, Battle Armor, NSFW Nude):");
            if (!presetName || !presetName.trim()) return;

            // Sync current fields before creating new
            syncCurrentInputsToPreset(currentDetailItem, currentActivePresetId);

            const newId = "preset_" + Date.now();
            const newPreset = {
                id: newId,
                name: presetName.trim(),
                weight_model: parseFloat(fields.weightModel.value) || 1.0,
                weight_clip: parseFloat(fields.weightClip.value) || 1.0,
                character: fields.character.value,
                clothing: fields.clothing.value,
                no_clothing: fields.no_clothing.value,
                expression: fields.expression.value,
                situation: fields.situation.value,
                location: fields.location.value,
                lighting: fields.lighting.value
            };

            if (!Array.isArray(currentDetailItem.presets)) {
                currentDetailItem.presets = [];
            }
            currentDetailItem.presets.push(newPreset);
            currentActivePresetId = newId;

            renderPresetDropdown(currentDetailItem);
            saveCurrentLoraConfig();
            showModalStatus(`Created preset "${presetName.trim()}"! ➕`, "var(--success)");
        });
    }

    if (btnDelete) {
        btnDelete.addEventListener("click", () => {
            if (!currentDetailItem || !Array.isArray(currentDetailItem.presets)) return;
            if (currentDetailItem.presets.length <= 1) {
                showModalStatus("Cannot delete the last remaining preset.", "var(--error)");
                return;
            }

            const targetIdx = currentDetailItem.presets.findIndex(p => p.id === currentActivePresetId);
            if (targetIdx !== -1) {
                const deletedName = currentDetailItem.presets[targetIdx].name;
                currentDetailItem.presets.splice(targetIdx, 1);
                currentActivePresetId = currentDetailItem.presets[0].id;

                renderPresetDropdown(currentDetailItem);
                loadPresetValues(currentDetailItem, currentActivePresetId);
                saveCurrentLoraConfig();
                showModalStatus(`Deleted preset "${deletedName}"! 🗑️`, "var(--accent)");
            }
        });
    }
}

function syncCurrentInputsToPreset(item, presetId) {
    if (!item || !Array.isArray(item.presets)) return;
    let p = item.presets.find(p => p.id === presetId);
    if (p) {
        p.weight_model = parseFloat(fields.weightModel.value) || 1.0;
        p.weight_clip = parseFloat(fields.weightClip.value) || 1.0;
        p.character = fields.character.value;
        p.clothing = fields.clothing.value;
        p.no_clothing = fields.no_clothing.value;
        p.expression = fields.expression.value;
        p.situation = fields.situation.value;
        p.location = fields.location.value;
        p.lighting = fields.lighting.value;
    }
}

function renderPresetDropdown(item) {
    const presetSelect = document.getElementById("presetSelect");
    if (!presetSelect) return;

    if (!Array.isArray(item.presets) || item.presets.length === 0) {
        item.presets = [{
            id: "default",
            name: "Default Preset",
            weight_model: item.weight_model ?? 1.0,
            weight_clip: item.weight_clip ?? 1.0,
            character: item.character || "",
            clothing: item.clothing || "",
            no_clothing: item.no_clothing || "",
            expression: item.expression || "",
            situation: item.situation || "",
            location: item.location || "",
            lighting: item.lighting || ""
        }];
    }

    presetSelect.innerHTML = "";
    item.presets.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        if (p.id === currentActivePresetId) opt.selected = true;
        presetSelect.appendChild(opt);
    });
}

function loadPresetValues(item, presetId) {
    if (!item || !Array.isArray(item.presets)) return;
    let targetPreset = item.presets.find(p => p.id === presetId);
    if (!targetPreset) targetPreset = item.presets[0];

    currentActivePresetId = targetPreset.id;
    fields.weightModel.value = targetPreset.weight_model ?? 1.0;
    fields.weightClip.value = targetPreset.weight_clip ?? 1.0;
    fields.character.value = targetPreset.character || "";
    fields.clothing.value = targetPreset.clothing || "";
    fields.no_clothing.value = targetPreset.no_clothing || "";
    fields.expression.value = targetPreset.expression || "";
    fields.situation.value = targetPreset.situation || "";
    fields.location.value = targetPreset.location || "";
    fields.lighting.value = targetPreset.lighting || "";

    updateSendToComfyVisibility();
}

function updateSendToComfyVisibility() {
    const sendBtn = document.getElementById("btnSendToComfy");
    if (!sendBtn) return;

    const hasAnyConfig = [
        fields.character?.value,
        fields.clothing?.value,
        fields.no_clothing?.value,
        fields.expression?.value,
        fields.situation?.value,
        fields.location?.value,
        fields.lighting?.value
    ].some(val => val && val.trim().length > 0);

    if (hasAnyConfig) {
        sendBtn.style.display = "inline-flex";
    } else {
        sendBtn.style.display = "none";
    }
}

function renderModalTags(tags) {
    const container = document.getElementById("modalTagsContainer");
    if (!container) return;

    container.innerHTML = "";
    tags.forEach(tag => {
        const pill = document.createElement("span");
        pill.className = "tag-pill";
        pill.innerHTML = `<span>${escapeHtml(tag)}</span><span class="remove-tag" title="Remove tag">✕</span>`;
        pill.querySelector(".remove-tag").addEventListener("click", () => {
            currentDetailItem.tags = currentDetailItem.tags.filter(t => t !== tag);
            renderModalTags(currentDetailItem.tags);
        });
        container.appendChild(pill);
    });

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn-add-tag";
    addBtn.textContent = "+ Add Tag";
    addBtn.addEventListener("click", () => {
        const newTag = prompt("Enter new custom tag:");
        if (newTag && newTag.trim()) {
            const clean = newTag.trim();
            if (!currentDetailItem.tags) currentDetailItem.tags = [];
            if (!currentDetailItem.tags.includes(clean)) {
                currentDetailItem.tags.push(clean);
                renderModalTags(currentDetailItem.tags);
            }
        }
    });
    container.appendChild(addBtn);
}

function renderModalTriggerWords(triggerWordsStr, trainedWords) {
    const container = document.getElementById("modalTriggerWordsContainer");
    if (!container) return;

    let words = trainedWords.length > 0 ? trainedWords : triggerWordsStr.split(",").map(s => s.trim()).filter(Boolean);

    container.innerHTML = "";
    if (words.length > 0) {
        words.forEach(word => {
            const badge = document.createElement("span");
            badge.className = "trigger-word-badge";
            badge.innerHTML = `<span>${escapeHtml(word)}</span><span style="font-size:0.8rem;">📋</span>`;
            badge.title = "Click to copy word";
            badge.addEventListener("click", () => {
                navigator.clipboard.writeText(word);
                showModalStatus(`Copied "${word}" to clipboard! 📋`, "var(--accent)");
            });
            container.appendChild(badge);
        });
    } else {
        container.innerHTML = `<span style="color: var(--text-muted); font-size: 0.85rem; font-style: italic;">No trigger words specified</span>`;
    }
}

function renderModalExamples(images) {
    const list = document.getElementById("modalExamplesList");
    if (!list) return;

    list.innerHTML = "";
    if (images && images.length > 0) {
        images.forEach(imgObj => {
            const card = document.createElement("div");
            card.className = "example-card";
            const cachedMediaUrl = getCachedImageUrl(imgObj.url);

            if (imgObj.type === "video" || (imgObj.url && imgObj.url.endsWith(".mp4"))) {
                const video = document.createElement("video");
                video.className = "example-media";
                video.src = cachedMediaUrl;
                video.controls = true;
                video.autoplay = true;
                video.muted = true;
                video.loop = true;
                card.appendChild(video);
            } else {
                const img = document.createElement("img");
                img.className = "example-media";
                img.src = cachedMediaUrl;
                card.appendChild(img);
            }

            const meta = imgObj.meta || {};
            if (meta.prompt || meta.negativePrompt) {
                const info = document.createElement("div");
                info.className = "example-info";

                if (meta.prompt) {
                    info.innerHTML += `
                        <div style="display:flex; justify-space-between; align-items:center;">
                            <strong style="color:#a5b4fc;">PROMPT</strong>
                            <button type="button" class="btn-insert-trigger" onclick="navigator.clipboard.writeText(\`${escapeHtml(meta.prompt)}\`);">📋 Copy</button>
                        </div>
                        <p style="font-family:monospace; font-size:0.85rem; word-break:break-word;">${escapeHtml(meta.prompt)}</p>
                    `;
                }

                if (meta.negativePrompt) {
                    info.innerHTML += `
                        <strong style="color:var(--text-muted); margin-top:6px;">NEGATIVE PROMPT</strong>
                        <p style="font-family:monospace; font-size:0.8rem; word-break:break-word; color:var(--text-muted);">${escapeHtml(meta.negativePrompt)}</p>
                    `;
                }

                card.appendChild(info);
            }

            list.appendChild(card);
        });
    } else {
        list.innerHTML = `<div style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 30px;">No example images or generation prompts available for this model.</div>`;
    }
}

async function resyncSingleLora() {
    if (!currentDetailItem) return;

    const resyncBtn = document.getElementById("btnResyncSingleLora");
    const isIt = (window.i18n && window.i18n.currentLang) === "it";
    const originalText = isIt ? "🔄 Risincronizza Dati Civitai" : "🔄 Resync Civitai Data";

    if (resyncBtn) {
        resyncBtn.disabled = true;
        resyncBtn.textContent = isIt ? "⏳ Risincronizzazione..." : "⏳ Resyncing...";
    }

    try {
        const response = await fetch("/easy_lora_config/fetch_civitai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                lora_name: currentDetailItem.lora_name,
                domain: currentDomainMode,
                api_key: civitaiApiKey
            })
        });

        const data = await response.json();
        if (data.status === "success" && data.data) {
            showModalStatus(isIt ? "Dati Civitai risincronizzati con successo! 🌐" : "Civitai model data resynced successfully! 🌐", "var(--success)");

            const updatedRes = await fetch(`/easy_lora_config/get_settings?lora=${encodeURIComponent(currentDetailItem.lora_name)}`);
            const updatedConfig = await updatedRes.json();

            Object.assign(currentDetailItem, updatedConfig);
            openDetailModal(currentDetailItem);

            populateBaseModelFilterBar();
            populateAuthorFilterBar();
            populateTagsFilterBar();
            renderLoraGrid();
        } else {
            showModalStatus(`Error resyncing: ${data.error || 'Metadata not found'}`, "var(--error)");
        }
    } catch (err) {
        console.error("[EasyLoraConfig] Resync error:", err);
        showModalStatus("Error connecting to Civitai", "var(--error)");
    } finally {
        if (resyncBtn) {
            resyncBtn.disabled = false;
            resyncBtn.textContent = originalText;
        }
    }
}

function closeDetailModal() {
    const modal = document.getElementById("detailModal");
    modal.style.display = "none";
    currentDetailItem = null;
}

async function bulkSyncMetadata() {
    const syncBtn = document.getElementById("btnSyncAllMetadata");
    const spinner = document.getElementById("syncSpinner");
    const btnText = document.getElementById("syncBtnText");

    if (allLoraItems.length === 0) return;

    syncBtn.classList.add("syncing");
    spinner.style.display = "inline-block";

    const total = allLoraItems.length;
    let syncedCount = 0;
    const isIt = (window.i18n && window.i18n.currentLang) === "it";

    try {
        for (let i = 0; i < total; i++) {
            const currentItem = allLoraItems[i];
            const currentNum = i + 1;

            btnText.textContent = isIt
                ? `🔄 Sincronizzazione (${currentNum}/${total})...`
                : `🔄 Syncing (${currentNum}/${total})...`;

            try {
                const res = await fetch("/easy_lora_config/fetch_civitai", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        lora_name: currentItem.lora_name,
                        domain: currentDomainMode,
                        api_key: civitaiApiKey
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.status === "success" && data.data) {
                        syncedCount++;
                        currentItem.civitai_metadata = data.data;
                        currentItem.author = data.data.author || currentItem.author;
                        currentItem.base_model = data.data.baseModel || currentItem.base_model;
                        if (data.data.tags && Array.isArray(data.data.tags)) {
                            currentItem.tags = [...new Set([...(currentItem.tags || []), ...data.data.tags])];
                        }
                    }
                }
            } catch (err) {
                console.warn(`[EasyLoraConfig] Sync warning for ${currentItem.lora_name}:`, err);
            }
        }

        populateBaseModelFilterBar();
        populateAuthorFilterBar();
        populateTagsFilterBar();
        renderLoraGrid();

        btnText.textContent = isIt
            ? `✅ Sincronizzazione Completata (${syncedCount}/${total})`
            : `✅ Sync Completed (${syncedCount}/${total})`;

    } catch (err) {
        console.error("[EasyLoraConfig] Bulk sync error:", err);
        btnText.textContent = isIt ? "❌ Sincronizzazione Fallita" : "❌ Sync Failed";
    } finally {
        setTimeout(() => {
            syncBtn.classList.remove("syncing");
            spinner.style.display = "none";
            btnText.textContent = isIt
                ? "🔄 Sincronizza Tutti i Metadati (Civitai)"
                : "🔄 Sync All Metadata (Civitai)";
        }, 4000);
    }
}

async function saveCurrentLoraConfig() {
    if (!currentDetailItem) return;

    syncCurrentInputsToPreset(currentDetailItem, currentActivePresetId);

    const payload = {
        lora_name: currentDetailItem.lora_name,
        weight_model: parseFloat(fields.weightModel.value) || 1.0,
        weight_clip: parseFloat(fields.weightClip.value) || 1.0,
        character: fields.character.value,
        clothing: fields.clothing.value,
        no_clothing: fields.no_clothing.value,
        expression: fields.expression.value,
        situation: fields.situation.value,
        location: fields.location.value,
        lighting: fields.lighting.value,
        trigger_words: currentDetailItem.trigger_words || "",
        tags: currentDetailItem.tags || [],
        base_model: currentDetailItem.base_model || "",
        author: currentDetailItem.author || "",
        cover_url: currentDetailItem.cover_url || "",
        notes: fields.modalNotes.value,
        presets: currentDetailItem.presets || [],
        civitai_id: currentDetailItem.civitai_id,
        model_version_id: currentDetailItem.model_version_id,
        civitai_metadata: currentDetailItem.civitai_metadata || {}
    };

    try {
        const response = await fetch("/easy_lora_config/save_settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (data.status === "saved") {
            showModalStatus("LoRA configuration saved successfully! ✅", "var(--success)");
            // Update local memory & grid
            Object.assign(currentDetailItem, data.config);
            populateTagsFilterBar();
            renderLoraGrid();
        } else {
            showModalStatus(`Error saving: ${data.error}`, "var(--error)");
        }
    } catch (err) {
        console.error("[EasyLoraConfig] Save error:", err);
        showModalStatus("Error saving configuration ❌", "var(--error)");
    }
}

function findLoraConfigNode() {
    let comfyAppInstance = null;

    const candidates = [];
    try { if (window.parent && window.parent.app) candidates.push(window.parent.app); } catch (e) { }
    try { if (window.opener && window.opener.app) candidates.push(window.opener.app); } catch (e) { }
    try { if (window.top && window.top.app) candidates.push(window.top.app); } catch (e) { }
    try { if (window.app) candidates.push(window.app); } catch (e) { }
    try { if (window.parent?.comfyAPI?.app?.app) candidates.push(window.parent.comfyAPI.app.app); } catch (e) { }
    try { if (window.opener?.comfyAPI?.app?.app) candidates.push(window.opener.comfyAPI.app.app); } catch (e) { }
    try { if (window.top?.comfyAPI?.app?.app) candidates.push(window.top.comfyAPI.app.app); } catch (e) { }
    try { if (window.comfyAPI?.app?.app) candidates.push(window.comfyAPI.app.app); } catch (e) { }

    for (const c of candidates) {
        if (c && c.graph && Array.isArray(c.graph.nodes || c.graph._nodes)) {
            comfyAppInstance = c;
            break;
        }
    }

    if (!comfyAppInstance || !comfyAppInstance.graph) {
        return { app: null, node: null };
    }

    const graph = comfyAppInstance.graph;
    const allNodes = graph._nodes || graph.nodes || [];

    const loraNodes = allNodes.filter(n => {
        if (!n) return false;
        const typeStr = String(n.type || "").toLowerCase();
        const titleStr = String(n.title || "").toLowerCase();
        const classStr = String(n.comfyClass || "").toLowerCase();

        if (typeStr.includes("easylora") ||
            titleStr.includes("easy lora") ||
            titleStr.includes("easylora") ||
            classStr.includes("easylora")) {
            return true;
        }

        if (Array.isArray(n.widgets)) {
            const widgetNames = n.widgets.map(w => String(w?.name || "").toLowerCase());
            if (widgetNames.includes("lora_name") && (widgetNames.includes("strength_model") || widgetNames.includes("strength_clip"))) {
                return true;
            }
        }

        return false;
    });

    if (loraNodes.length === 0) {
        return { app: comfyAppInstance, node: null };
    }

    let selectedNode = null;
    try {
        const selected = Object.values(comfyAppInstance.canvas?.selected_nodes || {})[0];
        if (selected && loraNodes.includes(selected)) {
            selectedNode = selected;
        }
    } catch (e) { }

    return { app: comfyAppInstance, node: selectedNode || loraNodes[0] };
}

const loraBroadcastChannel = new BroadcastChannel("comfy_cabinet_easy_lora");

async function sendToComfyUI() {
    if (!currentDetailItem) return;

    const isIt = (window.i18n && window.i18n.currentLang) === "it";

    try {
        await saveCurrentLoraConfig();
        const successMsg = isIt
            ? `Configurazione LoRA '${currentDetailItem.lora_name}' inviata con successo al nodo in ComfyUI! 🚀`
            : `LoRA configuration '${currentDetailItem.lora_name}' successfully sent to ComfyUI node! 🚀`;
        showModalStatus(successMsg, "var(--success)");
    } catch (err) {
        console.error("[EasyLoraConfig] Send error:", err);
        const failMsg = isIt
            ? "Errore durante l'invio della configurazione a ComfyUI ❌"
            : "Error sending configuration to ComfyUI ❌";
        showModalStatus(failMsg, "var(--error)");
    }
}

async function saveGlobals() {
    try {
        await fetch("/easy_lora_config/save_globals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                domain_mode: currentDomainMode,
                civitai_api_key: civitaiApiKey
            })
        });
    } catch (err) {
        console.warn("[EasyLoraConfig] Save globals error:", err);
    }
}
function openSettingsModal() {
    const modal = document.getElementById("settingsModal");
    if (modal) modal.style.display = "flex";
}

function closeSettingsModal() {
    const modal = document.getElementById("settingsModal");
    if (modal) modal.style.display = "none";
}

async function testCivitaiConnection() {
    const statusBox = document.getElementById("diagnosticStatusBox");
    const testBtn = document.getElementById("btnTestCivitai");

    if (statusBox) {
        statusBox.style.color = "var(--text-muted)";
        statusBox.innerHTML = `⏳ Testing connection to <strong>${currentDomainMode}</strong>...`;
    }
    if (testBtn) testBtn.disabled = true;

    try {
        const res = await fetch("/easy_lora_config/test_civitai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                domain: currentDomainMode,
                api_key: civitaiApiKey
            })
        });
        const data = await res.json();

        if (statusBox) {
            if (data.ok) {
                statusBox.style.color = "var(--success)";
                statusBox.innerHTML = `<strong>${data.message}</strong>`;
            } else {
                if (data.error_type === "invalid_api_key") {
                    statusBox.style.color = "var(--error)";
                    statusBox.innerHTML = `<strong>${data.message}</strong><br><span style="font-size:0.8rem; color:var(--text-muted);">Check your API Key in Civitai Account Settings.</span>`;
                } else if (data.error_type === "domain_unreachable") {
                    statusBox.style.color = "#f59e0b";
                    statusBox.innerHTML = `<strong>${data.message}</strong><br><span style="font-size:0.8rem; color:var(--text-muted);">Verify your internet connection or check if domain is blocked by DNS/ISP.</span>`;
                } else {
                    statusBox.style.color = "var(--error)";
                    statusBox.innerHTML = `<strong>${data.message}</strong>`;
                }
            }
        }
    } catch (err) {
        if (statusBox) {
            statusBox.style.color = "var(--error)";
            statusBox.innerHTML = `❌ Connection test failed: ${err.message}`;
        }
    } finally {
        if (testBtn) testBtn.disabled = false;
    }
}

function showModalStatus(message, color) {
    const el = document.getElementById("modalStatusMsg");
    if (!el) return;
    el.textContent = message;
    el.style.color = color || "var(--text-main)";
}

function capitalize(s) {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getCachedImageUrl(url) {
    if (!url) return "";
    if (url.startsWith("/easy_lora_config/cache_image") || url.startsWith("data:")) return url;
    return `/easy_lora_config/cache_image?url=${encodeURIComponent(url)}`;
}
