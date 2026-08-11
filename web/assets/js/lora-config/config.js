let allLoraItems = [];
let activeTypeFilter = "ALL";
let activeBaseModelFilter = "ALL";
let selectedAuthors = [];
let selectedTags = [];
let activeSearchQuery = "";
let activeSortOrder = "AZ";
let currentDetailItem = null;
let currentDomainMode = "civitai.com";
let civitaiApiKey = "";
let closeModalOnClickOutside = false;

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
    lighting: null,
    prompt_1: null,
    prompt_2: null,
    prompt_3: null,
    prompt_4: null,
    closeOutsideCheckbox: null
};

document.addEventListener("DOMContentLoaded", () => {
    fields.search = document.getElementById("loraSearchInput");
    fields.apiKeyInput = document.getElementById("civitaiApiKeyInput");
    fields.sortSelect = document.getElementById("sortSelectLora") || document.getElementById("sortSelect");
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
    fields.prompt_1 = document.getElementById("block_prompt_1");
    fields.prompt_2 = document.getElementById("block_prompt_2");
    fields.prompt_3 = document.getElementById("block_prompt_3");
    fields.prompt_4 = document.getElementById("block_prompt_4");
    fields.closeOutsideCheckbox = document.getElementById("closeOutsideCheckbox");

    // Add real-time input listeners to update Send to ComfyUI button visibility
    [fields.character, fields.clothing, fields.no_clothing, fields.expression, fields.situation, fields.location, fields.lighting, fields.prompt_1, fields.prompt_2, fields.prompt_3, fields.prompt_4].forEach(el => {
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

        const detailModal = document.getElementById("detailModal");
        if (detailModal) {
            detailModal.addEventListener("click", (e) => {
                if (closeModalOnClickOutside && e.target === detailModal) {
                    closeDetailModal();
                }
            });
        }

        const closeBtn = document.getElementById("closeDetailModal");
        if (closeBtn) closeBtn.addEventListener("click", closeDetailModal);

        const saveBtn = document.getElementById("btnSaveModalConfig");
        if (saveBtn) saveBtn.addEventListener("click", saveCurrentLoraConfig);

        const sendBtn = document.getElementById("btnSendToComfy");
        if (sendBtn) sendBtn.addEventListener("click", sendToComfyUI);

        const resyncSingleBtn = document.getElementById("btnResyncSingle") || document.getElementById("btnResyncSingleLora") || document.getElementById("btnResyncSingleCheckpoint");
        if (resyncSingleBtn) resyncSingleBtn.addEventListener("click", resyncSingleLora);

        // Settings Modal Listeners
        const openSettingsBtn = document.getElementById("openSettingsModal");
        if (openSettingsBtn) openSettingsBtn.addEventListener("click", openSettingsModal);

        const closeSettingsBtn = document.getElementById("closeSettingsModal");
        if (closeSettingsBtn) closeSettingsBtn.addEventListener("click", closeSettingsModal);

        if (fields.closeOutsideCheckbox) {
            fields.closeOutsideCheckbox.addEventListener("change", (e) => {
                closeModalOnClickOutside = e.target.checked;
                saveGlobals();
            });
        }

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

function closeDetailModal() {
    const modal = document.getElementById("detailModal");
    if (modal) modal.style.display = "none";
}

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
        updateAllFilterBarsAndDropdowns();
        renderActiveFilterChips();
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
            if (sfwBtn && nsfwBtn) {
                if (globals.domain_mode === "civitai.red") {
                    nsfwBtn.classList.add("active", "nsfw");
                    sfwBtn.classList.remove("active", "sfw");
                } else {
                    sfwBtn.classList.add("active", "sfw");
                    nsfwBtn.classList.remove("active", "sfw");
                }
            }
            if (typeof updateCivitaiDomainUI === "function") {
                updateCivitaiDomainUI(globals.domain_mode);
            }
        }

        if (globals.civitai_api_key) {
            civitaiApiKey = globals.civitai_api_key;
            if (fields.apiKeyInput) fields.apiKeyInput.value = globals.civitai_api_key;
        }

        const closeOutsideVal = globals.close_modal_on_click_outside !== undefined ? globals.close_modal_on_click_outside : localStorage.getItem("comfy-cabinet-close-outside");
        closeModalOnClickOutside = (closeOutsideVal === "true" || closeOutsideVal === true);
        if (fields.closeOutsideCheckbox) {
            fields.closeOutsideCheckbox.checked = closeModalOnClickOutside;
        }

        populateTypeFilterBar();
        populateBaseModelFilterBar();
        populateAuthorFilterDropdown();
        updateAllFilterBarsAndDropdowns();
        renderActiveFilterChips();
        renderLoraGrid();
    } catch (err) {
        console.error("[EasyLoraConfig] Error loading all loras:", err);
    }
}

const CIVITAI_OFFICIAL_TYPES = [
    "Character", "Style", "Concept", "Clothing", "Base model", "Background",
    "Poses", "Tool", "Assets", "Vehicle", "Buildings", "Objects", "Animal", "Action"
];

function getLoraType(item) {
    if (!item) return "Other";
    
    const itemTags = Array.isArray(item.tags) ? item.tags : [];
    const metaTags = item.civitai_metadata?.tags && Array.isArray(item.civitai_metadata.tags)
        ? item.civitai_metadata.tags.map(t => typeof t === "object" ? (t.name || String(t)) : String(t))
        : [];
    
    const combinedTags = [...itemTags, ...metaTags];

    for (const tag of combinedTags) {
        if (!tag) continue;
        const cleanTag = String(tag).trim().toLowerCase();
        for (const officialType of CIVITAI_OFFICIAL_TYPES) {
            if (cleanTag === officialType.toLowerCase()) {
                return officialType;
            }
        }
    }

    const rawType = item.civitai_metadata?.type || item.civitai_metadata?.model?.type || "";
    if (rawType && rawType !== "LORA" && rawType !== "LoCon") {
        const typeCap = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();
        for (const officialType of CIVITAI_OFFICIAL_TYPES) {
            if (typeCap === officialType || (typeCap === "Pose" && officialType === "Poses")) {
                return officialType;
            }
        }
    }

    const textCorpus = (combinedTags.join(" ") + " " + (item.trigger_words || "") + " " + (item.lora_name || "")).toLowerCase();
    if (textCorpus.includes("character") || textCorpus.includes("1girl") || textCorpus.includes("1boy") || textCorpus.includes("woman") || textCorpus.includes("man")) return "Character";
    if (textCorpus.includes("clothing") || textCorpus.includes("dress") || textCorpus.includes("outfit") || textCorpus.includes("costume") || textCorpus.includes("suit")) return "Clothing";
    if (textCorpus.includes("pose") || textCorpus.includes("posture")) return "Poses";
    if (textCorpus.includes("action") || textCorpus.includes("motion")) return "Action";
    if (textCorpus.includes("background") || textCorpus.includes("landscape") || textCorpus.includes("scenery") || textCorpus.includes("environment")) return "Background";
    if (textCorpus.includes("building") || textCorpus.includes("architecture") || textCorpus.includes("ruins")) return "Buildings";
    if (textCorpus.includes("vehicle") || textCorpus.includes("car")) return "Vehicle";
    if (textCorpus.includes("animal") || textCorpus.includes("dog") || textCorpus.includes("cat")) return "Animal";
    if (textCorpus.includes("style") || textCorpus.includes("painterly") || textCorpus.includes("artstyle")) return "Style";
    if (textCorpus.includes("concept")) return "Concept";
    if (textCorpus.includes("tool")) return "Tool";
    if (textCorpus.includes("asset")) return "Assets";
    if (textCorpus.includes("object") || textCorpus.includes("weapon")) return "Objects";

    return "Other";
}

function getFilteredSubset(excludeCategory = "") {
    return allLoraItems.filter(item => {
        if (excludeCategory !== "SEARCH" && activeSearchQuery) {
            const nameMatch = item.lora_name.toLowerCase().includes(activeSearchQuery);
            const authorMatch = (item.author || "").toLowerCase().includes(activeSearchQuery);
            const baseMatch = (item.base_model || "").toLowerCase().includes(activeSearchQuery);
            const tagMatch = item.tags && item.tags.some(t => t.toLowerCase().includes(activeSearchQuery));
            const triggerMatch = (item.trigger_words || "").toLowerCase().includes(activeSearchQuery);
            if (!nameMatch && !authorMatch && !baseMatch && !tagMatch && !triggerMatch) return false;
        }

        if (excludeCategory !== "TYPE" && activeTypeFilter !== "ALL") {
            if (getLoraType(item) !== activeTypeFilter) return false;
        }

        if (excludeCategory !== "BASE" && activeBaseModelFilter !== "ALL") {
            const bm = (item.base_model && item.base_model.trim()) ? item.base_model.trim() : "Other / Unspecified";
            if (bm !== activeBaseModelFilter) return false;
        }

        if (excludeCategory !== "AUTHORS" && selectedAuthors.length > 0) {
            const author = (item.author && item.author.trim() && item.author.trim() !== "Unknown")
                ? item.author.trim()
                : "Unknown / Unspecified";
            if (!selectedAuthors.includes(author)) return false;
        }

        if (excludeCategory !== "TAGS" && selectedTags.length > 0) {
            if (!item.tags || !Array.isArray(item.tags)) return false;
            if (!item.tags.some(t => selectedTags.includes(t.trim()))) return false;
        }

        return true;
    });
}

function updateAllFilterBarsAndDropdowns() {
    populateTypeFilterBar();
    populateBaseModelFilterBar();
    populateAuthorFilterDropdown();
    populateTagFilterDropdown();
}

function populateTypeFilterBar() {
    const bar = document.getElementById("typeFilterBar");
    if (!bar) return;

    const subset = getFilteredSubset("TYPE");
    const counts = {};
    subset.forEach(item => {
        const type = getLoraType(item);
        counts[type] = (counts[type] || 0) + 1;
    });

    const typesList = [
        { id: "ALL", label: "All Types", icon: "" },
        { id: "Character", label: "Character", icon: "👤 " },
        { id: "Clothing", label: "Clothing", icon: "👗 " },
        { id: "Poses", label: "Poses", icon: "🤸 " },
        { id: "Action", label: "Action", icon: "🎬 " },
        { id: "Background", label: "Background", icon: "🏞️ " },
        { id: "Buildings", label: "Buildings", icon: "🏰 " },
        { id: "Style", label: "Style", icon: "🎨 " },
        { id: "Concept", label: "Concept", icon: "💡 " },
        { id: "Tool", label: "Tool", icon: "🛠️ " },
        { id: "Assets", label: "Assets", icon: "💎 " },
        { id: "Vehicle", label: "Vehicle", icon: "🚗 " },
        { id: "Objects", label: "Objects", icon: "📦 " },
        { id: "Animal", label: "Animal", icon: "🐾 " },
        { id: "Base model", label: "Base Model", icon: "🧬 " }
    ];

    bar.innerHTML = "";
    typesList.forEach(t => {
        const count = t.id === "ALL" ? subset.length : (counts[t.id] || 0);
        const pill = document.createElement("span");
        let className = "tag-filter-pill";
        if (activeTypeFilter === t.id) {
            className += " active";
        } else if (count === 0) {
            className += " disabled";
        }
        pill.className = className;
        pill.setAttribute("data-type", t.id);
        pill.textContent = `${t.icon}${t.label} (${count})`;
        pill.addEventListener("click", () => {
            if (pill.classList.contains("disabled")) return;
            bar.querySelectorAll(".tag-filter-pill").forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            activeTypeFilter = t.id;
            updateAllFilterBarsAndDropdowns();
            renderActiveFilterChips();
            renderLoraGrid();
        });
        bar.appendChild(pill);
    });
}

function populateBaseModelFilterBar() {
    const bar = document.getElementById("baseModelFilterBarLora") || document.getElementById("baseModelFilterBar");
    if (!bar) return;

    const subset = getFilteredSubset("BASE");
    const counts = {};
    subset.forEach(item => {
        const bm = (item.base_model && item.base_model.trim()) ? item.base_model.trim() : "Other / Unspecified";
        counts[bm] = (counts[bm] || 0) + 1;
    });

    const allBaseModels = new Set();
    allLoraItems.forEach(item => {
        const bm = (item.base_model && item.base_model.trim()) ? item.base_model.trim() : "Other / Unspecified";
        allBaseModels.add(bm);
    });

    bar.innerHTML = `<span class="tag-filter-pill ${activeBaseModelFilter === "ALL" ? "active" : ""}" data-base="ALL">All Base Models (${subset.length})</span>`;

    Array.from(allBaseModels).sort().forEach(baseModel => {
        const count = counts[baseModel] || 0;
        const pill = document.createElement("span");
        let className = "tag-filter-pill";
        if (activeBaseModelFilter === baseModel) {
            className += " active";
        } else if (count === 0) {
            className += " disabled";
        }
        pill.className = className;
        pill.setAttribute("data-base", baseModel);
        pill.textContent = `${baseModel} (${count})`;
        pill.addEventListener("click", () => {
            if (pill.classList.contains("disabled")) return;
            bar.querySelectorAll(".tag-filter-pill").forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            activeBaseModelFilter = baseModel;
            updateAllFilterBarsAndDropdowns();
            renderActiveFilterChips();
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
            updateAllFilterBarsAndDropdowns();
            renderActiveFilterChips();
            renderLoraGrid();
        });
    }
}

function populateAuthorFilterDropdown() {
    const trigger = document.getElementById("authorFilterTriggerLora") || document.getElementById("authorFilterTrigger");
    const panel = document.getElementById("authorFilterPanelLora") || document.getElementById("authorFilterPanel");
    const searchInput = document.getElementById("authorFilterSearchLora") || document.getElementById("authorFilterSearch");
    const list = document.getElementById("authorFilterListLora") || document.getElementById("authorFilterList");

    if (!trigger || !panel || !list) return;

    if (!trigger.dataset.bound) {
        trigger.dataset.bound = "true";
        trigger.onclick = (e) => {
            e.stopPropagation();
            const isVisible = panel.style.display === "block";
            panel.style.display = isVisible ? "none" : "block";
            if (!isVisible && searchInput) searchInput.focus();
        };

        document.addEventListener("click", (e) => {
            if (!panel.contains(e.target) && e.target !== trigger) {
                panel.style.display = "none";
            }
        });
    }

    const subset = getFilteredSubset("AUTHORS");
    const counts = {};
    subset.forEach(item => {
        const author = (item.author && item.author.trim() && item.author.trim() !== "Unknown")
            ? item.author.trim()
            : "Unknown / Unspecified";
        counts[author] = (counts[author] || 0) + 1;
    });

    const allAuthors = new Set();
    allLoraItems.forEach(item => {
        const author = (item.author && item.author.trim() && item.author.trim() !== "Unknown")
            ? item.author.trim()
            : "Unknown / Unspecified";
        allAuthors.add(author);
    });

    const renderList = (filterText = "") => {
        list.innerHTML = "";
        const sortedAuthors = Array.from(allAuthors).sort((a, b) => {
            const countA = counts[a] || 0;
            const countB = counts[b] || 0;
            if (countA !== countB) return countB - countA;
            return a.localeCompare(b);
        });

        const filtered = sortedAuthors.filter(a => a.toLowerCase().includes(filterText.toLowerCase()));

        if (filtered.length === 0) {
            list.innerHTML = `<div class="dropdown-item no-results">No authors found</div>`;
            return;
        }

        filtered.forEach(author => {
            const count = counts[author] || 0;
            const isSelected = selectedAuthors.includes(author);
            const itemEl = document.createElement("div");
            let cls = "dropdown-item";
            if (isSelected) cls += " active-item";
            if (count === 0 && !isSelected) cls += " disabled-item";
            itemEl.className = cls;
            itemEl.textContent = `👤 ${author} (${count})`;
            itemEl.onclick = (e) => {
                e.stopPropagation();
                if (count === 0 && !isSelected) return;
                if (isSelected) {
                    selectedAuthors = selectedAuthors.filter(a => a !== author);
                } else {
                    selectedAuthors.push(author);
                }
                updateAllFilterBarsAndDropdowns();
                renderActiveFilterChips();
                renderLoraGrid();
            };
            list.appendChild(itemEl);
        });
    };

    renderList(searchInput ? searchInput.value : "");

    if (searchInput) {
        searchInput.oninput = () => renderList(searchInput.value);
    }
}

function populateTagFilterDropdown() {
    const trigger = document.getElementById("tagFilterTriggerLora") || document.getElementById("tagFilterTrigger");
    const panel = document.getElementById("tagFilterPanelLora") || document.getElementById("tagFilterPanel");
    const searchInput = document.getElementById("tagFilterSearchLora") || document.getElementById("tagFilterSearch");
    const list = document.getElementById("tagFilterListLora") || document.getElementById("tagFilterList");

    if (!trigger || !panel || !list) return;

    if (!trigger.dataset.bound) {
        trigger.dataset.bound = "true";
        trigger.onclick = (e) => {
            e.stopPropagation();
            const isVisible = panel.style.display === "block";
            panel.style.display = isVisible ? "none" : "block";
            if (!isVisible && searchInput) searchInput.focus();
        };

        document.addEventListener("click", (e) => {
            if (!panel.contains(e.target) && e.target !== trigger) {
                panel.style.display = "none";
            }
        });
    }

    const subset = getFilteredSubset("TAGS");
    const tagCounts = {};
    subset.forEach(item => {
        if (item.tags && Array.isArray(item.tags)) {
            item.tags.forEach(t => {
                const cleanTag = t.trim();
                if (cleanTag) {
                    tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
                }
            });
        }
    });

    const allTags = new Set();
    allLoraItems.forEach(item => {
        if (item.tags && Array.isArray(item.tags)) {
            item.tags.forEach(t => {
                const cleanTag = t.trim();
                if (cleanTag) allTags.add(cleanTag);
            });
        }
    });

    const renderList = (filterText = "") => {
        list.innerHTML = "";
        const sortedTags = Array.from(allTags).sort((a, b) => {
            const countA = tagCounts[a] || 0;
            const countB = tagCounts[b] || 0;
            if (countA !== countB) return countB - countA;
            return a.localeCompare(b);
        });

        const filtered = sortedTags.filter(t => t.toLowerCase().includes(filterText.toLowerCase()));

        if (filtered.length === 0) {
            list.innerHTML = `<div class="dropdown-item no-results">No tags found</div>`;
            return;
        }

        filtered.forEach(tag => {
            const count = tagCounts[tag] || 0;
            const isSelected = selectedTags.includes(tag);
            const itemEl = document.createElement("div");
            let cls = "dropdown-item";
            if (isSelected) cls += " active-item";
            if (count === 0 && !isSelected) cls += " disabled-item";
            itemEl.className = cls;
            itemEl.textContent = `🏷️ ${tag} (${count})`;
            itemEl.onclick = (e) => {
                e.stopPropagation();
                if (count === 0 && !isSelected) return;
                if (isSelected) {
                    selectedTags = selectedTags.filter(t => t !== tag);
                } else {
                    selectedTags.push(tag);
                }
                updateAllFilterBarsAndDropdowns();
                renderActiveFilterChips();
                renderLoraGrid();
            };
            list.appendChild(itemEl);
        });
    };

    renderList(searchInput ? searchInput.value : "");

    if (searchInput) {
        searchInput.oninput = () => renderList(searchInput.value);
    }
}

function renderActiveFilterChips() {
    const summaryRow = document.getElementById("activeFiltersSummaryRowLora") || document.getElementById("activeFiltersSummaryRow");
    const container = document.getElementById("activeFilterChipsContainerLora") || document.getElementById("activeFilterChipsContainer");
    if (!container || !summaryRow) return;

    container.innerHTML = `<span style="font-size: 0.8rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted);">Active Filters:</span>`;

    let activeCount = 0;

    if (activeTypeFilter !== "ALL") {
        activeCount++;
        const chip = document.createElement("span");
        chip.className = "active-chip";
        chip.innerHTML = `<span>Type: ${escapeHtml(activeTypeFilter)}</span><span class="chip-remove">✕</span>`;
        chip.querySelector(".chip-remove").onclick = () => {
            activeTypeFilter = "ALL";
            updateAllFilterBarsAndDropdowns();
            renderActiveFilterChips();
            renderLoraGrid();
        };
        container.appendChild(chip);
    }

    if (activeBaseModelFilter !== "ALL") {
        activeCount++;
        const chip = document.createElement("span");
        chip.className = "active-chip";
        chip.innerHTML = `<span>Base: ${escapeHtml(activeBaseModelFilter)}</span><span class="chip-remove">✕</span>`;
        chip.querySelector(".chip-remove").onclick = () => {
            activeBaseModelFilter = "ALL";
            updateAllFilterBarsAndDropdowns();
            renderActiveFilterChips();
            renderLoraGrid();
        };
        container.appendChild(chip);
    }

    selectedAuthors.forEach(author => {
        activeCount++;
        const chip = document.createElement("span");
        chip.className = "active-chip";
        chip.innerHTML = `<span>👤 ${escapeHtml(author)}</span><span class="chip-remove">✕</span>`;
        chip.querySelector(".chip-remove").onclick = () => {
            selectedAuthors = selectedAuthors.filter(a => a !== author);
            updateAllFilterBarsAndDropdowns();
            renderActiveFilterChips();
            renderLoraGrid();
        };
        container.appendChild(chip);
    });

    selectedTags.forEach(tag => {
        activeCount++;
        const chip = document.createElement("span");
        chip.className = "active-chip";
        chip.innerHTML = `<span>🏷️ ${escapeHtml(tag)}</span><span class="chip-remove">✕</span>`;
        chip.querySelector(".chip-remove").onclick = () => {
            selectedTags = selectedTags.filter(t => t !== tag);
            updateAllFilterBarsAndDropdowns();
            renderActiveFilterChips();
            renderLoraGrid();
        };
        container.appendChild(chip);
    });

    if (activeSearchQuery) {
        activeCount++;
        const chip = document.createElement("span");
        chip.className = "active-chip";
        chip.innerHTML = `<span>🔍 "${escapeHtml(activeSearchQuery)}"</span><span class="chip-remove">✕</span>`;
        chip.querySelector(".chip-remove").onclick = () => {
            activeSearchQuery = "";
            const searchInput = document.getElementById("loraSearchInput");
            if (searchInput) searchInput.value = "";
            updateAllFilterBarsAndDropdowns();
            renderActiveFilterChips();
            renderLoraGrid();
        };
        container.appendChild(chip);
    }

    summaryRow.style.display = activeCount > 0 ? "flex" : "none";
    updateActiveFiltersBadge(activeCount);
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
    const toggleHeader = document.getElementById("filtersToggleHeaderLora") || document.getElementById("filtersToggleHeader");
    const toggleBtn = document.getElementById("btnToggleFiltersLora") || document.getElementById("btnToggleFilters");
    const container = document.getElementById("filtersCollapseContainerLora") || document.getElementById("filtersCollapseContainer");
    const toggleText = document.getElementById("toggleFiltersBtnTextLora") || document.getElementById("toggleFiltersBtnText");
    const clearAllBtn = document.getElementById("btnClearAllFiltersLora") || document.getElementById("btnClearAllFilters");

    if (!container) return;

    if (clearAllBtn) {
        clearAllBtn.onclick = () => {
            activeTypeFilter = "ALL";
            activeBaseModelFilter = "ALL";
            selectedAuthors = [];
            selectedTags = [];
            activeSearchQuery = "";
            const searchInput = document.getElementById("loraSearchInput");
            if (searchInput) searchInput.value = "";

            updateAllFilterBarsAndDropdowns();
            renderActiveFilterChips();
            renderLoraGrid();
        };
    }

    let isCollapsed = localStorage.getItem("lora_filters_collapsed") !== "false";

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
        if (e.target.closest("#btnToggleFiltersLora") || e.target.closest("#btnToggleFilters")) return;
        toggle();
    });
    if (toggleBtn) toggleBtn.addEventListener("click", toggle);
}

function updateActiveFiltersBadge(count = 0) {
    const badge = document.getElementById("activeFiltersBadgeLora") || document.getElementById("activeFiltersBadge");
    if (!badge) return;

    if (count > 0) {
        badge.textContent = `${count} Active`;
        badge.style.display = "inline-block";
    } else {
        badge.style.display = "none";
    }
}

function renderLoraGrid() {
    const grid = document.getElementById("loraGrid");
    if (!grid) return;

    let filtered = allLoraItems;

    // Filter by LoRA Type
    if (activeTypeFilter !== "ALL") {
        filtered = filtered.filter(item => {
            const itemType = getLoraType(item);
            return itemType === activeTypeFilter;
        });
    }

    // Filter by Base Model Architecture
    if (activeBaseModelFilter !== "ALL") {
        filtered = filtered.filter(item => {
            const bm = (item.base_model && item.base_model.trim()) ? item.base_model.trim() : "Other / Unspecified";
            return bm === activeBaseModelFilter;
        });
    }

    // Filter by Selected Authors
    if (selectedAuthors.length > 0) {
        filtered = filtered.filter(item => {
            const author = (item.author && item.author.trim() && item.author.trim() !== "Unknown")
                ? item.author.trim()
                : "Unknown / Unspecified";
            return selectedAuthors.includes(author);
        });
    }

    // Filter by Selected Tags
    if (selectedTags.length > 0) {
        filtered = filtered.filter(item => {
            if (!item.tags || !Array.isArray(item.tags)) return false;
            return item.tags.some(t => selectedTags.includes(t.trim()));
        });
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

window.openDetailModalByName = function (loraName) {
    const item = allLoraItems.find(i => i.lora_name === loraName || i.lora_name.endsWith(loraName));
    if (item) {
        openDetailModal(item);
    }
};

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

    const triggerWordsGroup = document.getElementById("modalTriggerWordsGroup");
    if (triggerWordsGroup) triggerWordsGroup.style.display = "block";

    const ckptControls = document.getElementById("checkpointConfigControls");
    const loraControls = document.getElementById("loraConfigControls");
    if (ckptControls) ckptControls.style.display = "none";
    if (loraControls) loraControls.style.display = "block";

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
    const elVer = document.getElementById("infoVersion");
    if (elVer) elVer.textContent = item.civitai_metadata?.versionName || "v1.0";

    const elFile = document.getElementById("infoFileName");
    if (elFile) elFile.textContent = item.lora_name.split("/").pop().split("\\").pop();

    const elLoc = document.getElementById("infoLocation");
    if (elLoc) elLoc.textContent = item.relative_path || item.lora_name;

    const elBase = document.getElementById("infoBaseModel");
    if (elBase) elBase.textContent = item.base_model || "Unknown";

    const elSize = document.getElementById("infoSize");
    if (elSize) elSize.textContent = item.file_size || "Unknown";

    // Tags rendering
    renderModalTags(item.tags || []);

    // Trigger words badges matching Screenshot 1
    renderModalTriggerWords(item.trigger_words || "", item.civitai_metadata?.trainedWords || []);

    // Notes
    if (fields.modalNotes) fields.modalNotes.value = item.notes || "";

    // Tab 1: Examples
    renderModalExamples(item.civitai_metadata?.images || []);

    // Tab 2: Description
    const sanitizeHTML = (str) => {
        if (!str) return "";
        const temp = document.createElement("div");
        temp.innerHTML = str;
        const disallow = ["script", "iframe", "object", "embed", "link", "style", "form", "input"];
        disallow.forEach(tag => {
            const elms = temp.getElementsByTagName(tag);
            for (let i = elms.length - 1; i >= 0; i--) {
                elms[i].parentNode.removeChild(elms[i]);
            }
        });
        const allElements = temp.getElementsByTagName("*");
        for (let i = 0; i < allElements.length; i++) {
            const attrs = allElements[i].attributes;
            for (let j = attrs.length - 1; j >= 0; j--) {
                const name = attrs[j].name.toLowerCase();
                if (name.startsWith("on") || name.startsWith("javascript:")) {
                    allElements[i].removeAttribute(attrs[j].name);
                }
            }
        }
        return temp.innerHTML;
    };

    const descBox = document.getElementById("modalDescriptionContent");
    if (descBox) {
        if (item.civitai_metadata?.description) {
            descBox.innerHTML = sanitizeHTML(item.civitai_metadata.description);
        } else {
            descBox.textContent = "No Civitai description available. Run 'Sync All Metadata' to fetch.";
        }
    }

    // Tab 3: Versions
    const verName = document.getElementById("verName");
    if (verName) verName.textContent = item.civitai_metadata?.versionName || "v1.0";

    const verBase = document.getElementById("verBase");
    if (verBase) verBase.textContent = item.base_model || "Unknown";

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
            lighting: item.lighting || "",
            prompt_1: item.prompt_1 || "",
            prompt_2: item.prompt_2 || "",
            prompt_3: item.prompt_3 || "",
            prompt_4: item.prompt_4 || ""
        }];
    }

    currentActivePresetId = item.presets[0].id;

    updateConfigFieldsForLora(item);
    renderPresetDropdown(item);
    loadPresetValues(item, currentActivePresetId);

    updateSendToComfyVisibility();

    showModalStatus("");
    modal.style.display = "flex";
}

let currentActivePresetId = "default";

function updateConfigFieldsForLora(item) {
    if (!item) return;
    const loraType = getLoraType(item);
    const allFieldNames = [
        "character", "clothing", "no_clothing", "expression",
        "situation", "location", "lighting",
        "prompt_1", "prompt_2", "prompt_3", "prompt_4"
    ];

    let visibleFieldNames = [];
    let headingLabel = `Prompt Builder Blocks (${loraType})`;

    if (loraType === "Character") {
        visibleFieldNames = ["character", "clothing", "no_clothing", "expression"];
        headingLabel = "Prompt Builder Blocks (Character LoRA)";
    } else if (loraType === "Clothing") {
        visibleFieldNames = ["clothing", "no_clothing"];
        headingLabel = "Prompt Builder Blocks (Clothing LoRA)";
    } else if (loraType === "Poses" || loraType === "Action") {
        visibleFieldNames = ["expression", "situation"];
        headingLabel = `Prompt Builder Blocks (${loraType} LoRA)`;
    } else if (loraType === "Background" || loraType === "Buildings") {
        visibleFieldNames = ["location", "lighting", "situation"];
        headingLabel = `Prompt Builder Blocks (${loraType} LoRA)`;
    } else {
        visibleFieldNames = ["prompt_1", "prompt_2", "prompt_3", "prompt_4"];
        headingLabel = `Prompt Builder Blocks (${loraType} LoRA - Basic Outputs)`;
    }

    const headingEl = document.getElementById("loraBlocksHeading");
    if (headingEl) {
        headingEl.textContent = headingLabel;
    }

    allFieldNames.forEach(fieldName => {
        const groupEl = document.getElementById(`group_block_${fieldName}`);
        if (groupEl) {
            if (visibleFieldNames.includes(fieldName)) {
                groupEl.style.display = "block";
            } else {
                groupEl.style.display = "none";
            }
        }
    });
}

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
                character: fields.character ? fields.character.value : "",
                clothing: fields.clothing ? fields.clothing.value : "",
                no_clothing: fields.no_clothing ? fields.no_clothing.value : "",
                expression: fields.expression ? fields.expression.value : "",
                situation: fields.situation ? fields.situation.value : "",
                location: fields.location ? fields.location.value : "",
                lighting: fields.lighting ? fields.lighting.value : "",
                prompt_1: fields.prompt_1 ? fields.prompt_1.value : "",
                prompt_2: fields.prompt_2 ? fields.prompt_2.value : "",
                prompt_3: fields.prompt_3 ? fields.prompt_3.value : "",
                prompt_4: fields.prompt_4 ? fields.prompt_4.value : ""
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
        p.character = fields.character ? fields.character.value : "";
        p.clothing = fields.clothing ? fields.clothing.value : "";
        p.no_clothing = fields.no_clothing ? fields.no_clothing.value : "";
        p.expression = fields.expression ? fields.expression.value : "";
        p.situation = fields.situation ? fields.situation.value : "";
        p.location = fields.location ? fields.location.value : "";
        p.lighting = fields.lighting ? fields.lighting.value : "";
        p.prompt_1 = fields.prompt_1 ? fields.prompt_1.value : "";
        p.prompt_2 = fields.prompt_2 ? fields.prompt_2.value : "";
        p.prompt_3 = fields.prompt_3 ? fields.prompt_3.value : "";
        p.prompt_4 = fields.prompt_4 ? fields.prompt_4.value : "";
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
            lighting: item.lighting || "",
            prompt_1: item.prompt_1 || "",
            prompt_2: item.prompt_2 || "",
            prompt_3: item.prompt_3 || "",
            prompt_4: item.prompt_4 || ""
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
    if (fields.weightModel) fields.weightModel.value = targetPreset.weight_model ?? 1.0;
    if (fields.weightClip) fields.weightClip.value = targetPreset.weight_clip ?? 1.0;
    if (fields.character) fields.character.value = targetPreset.character || "";
    if (fields.clothing) fields.clothing.value = targetPreset.clothing || "";
    if (fields.no_clothing) fields.no_clothing.value = targetPreset.no_clothing || "";
    if (fields.expression) fields.expression.value = targetPreset.expression || "";
    if (fields.situation) fields.situation.value = targetPreset.situation || "";
    if (fields.location) fields.location.value = targetPreset.location || "";
    if (fields.lighting) fields.lighting.value = targetPreset.lighting || "";
    if (fields.prompt_1) fields.prompt_1.value = targetPreset.prompt_1 || "";
    if (fields.prompt_2) fields.prompt_2.value = targetPreset.prompt_2 || "";
    if (fields.prompt_3) fields.prompt_3.value = targetPreset.prompt_3 || "";
    if (fields.prompt_4) fields.prompt_4.value = targetPreset.prompt_4 || "";

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
        fields.lighting?.value,
        fields.prompt_1?.value,
        fields.prompt_2?.value,
        fields.prompt_3?.value,
        fields.prompt_4?.value
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
            const hasParams = meta.width || meta.height || meta.seed || meta.Model || meta.model || meta.steps || meta.sampler || meta.cfgScale;
            const hasPrompt = meta.prompt;
            const hasNegPrompt = meta.negativePrompt;

            if (hasParams || hasPrompt || hasNegPrompt) {
                const overlay = document.createElement("div");
                overlay.className = "example-overlay";

                // SECTION 1: Params
                if (hasParams) {
                    const paramsLabel = document.createElement("div");
                    paramsLabel.className = "example-section-label";
                    paramsLabel.textContent = "Params:";
                    overlay.appendChild(paramsLabel);

                    const pillsGrid = document.createElement("div");
                    pillsGrid.className = "param-pills-grid";

                    if (meta.width && meta.height) {
                        pillsGrid.innerHTML += `<span class="param-pill">Size: <span>${meta.width}x${meta.height}</span></span>`;
                    }
                    if (meta.seed) {
                        pillsGrid.innerHTML += `<span class="param-pill">Seed: <span>${escapeHtml(String(meta.seed))}</span></span>`;
                    }
                    const modelName = meta.Model || meta.model;
                    if (modelName) {
                        pillsGrid.innerHTML += `<span class="param-pill">Model: <span>${escapeHtml(String(modelName))}</span></span>`;
                    }
                    if (meta.steps) {
                        pillsGrid.innerHTML += `<span class="param-pill">Steps: <span>${meta.steps}</span></span>`;
                    }
                    if (meta.sampler) {
                        pillsGrid.innerHTML += `<span class="param-pill">Sampler: <span>${escapeHtml(String(meta.sampler))}</span></span>`;
                    }
                    if (meta.cfgScale) {
                        pillsGrid.innerHTML += `<span class="param-pill">CFG: <span>${meta.cfgScale}</span></span>`;
                    }

                    overlay.appendChild(pillsGrid);
                }

                // SECTION 2: Prompt
                if (hasPrompt) {
                    const promptHeader = document.createElement("div");
                    promptHeader.className = "example-section-label";

                    const promptTitle = document.createElement("span");
                    promptTitle.textContent = "Prompt:";

                    const copyPromptBtn = document.createElement("button");
                    copyPromptBtn.type = "button";
                    copyPromptBtn.className = "btn-copy-prompt-icon";
                    copyPromptBtn.title = "Copy Positive Prompt";
                    copyPromptBtn.innerHTML = "📋";
                    copyPromptBtn.onclick = (e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(meta.prompt);
                        if (window.Toast) window.Toast.success("Positive prompt copied! 📋");
                    };

                    promptHeader.appendChild(promptTitle);
                    promptHeader.appendChild(copyPromptBtn);
                    overlay.appendChild(promptHeader);

                    const promptBox = document.createElement("div");
                    promptBox.className = "example-prompt-box";
                    promptBox.textContent = meta.prompt;
                    overlay.appendChild(promptBox);
                }

                // SECTION 3: Negative Prompt
                if (hasNegPrompt) {
                    const negHeader = document.createElement("div");
                    negHeader.className = "example-section-label";

                    const negTitle = document.createElement("span");
                    negTitle.textContent = "Negative Prompt:";

                    const copyNegBtn = document.createElement("button");
                    copyNegBtn.type = "button";
                    copyNegBtn.className = "btn-copy-prompt-icon";
                    copyNegBtn.title = "Copy Negative Prompt";
                    copyNegBtn.innerHTML = "📋";
                    copyNegBtn.onclick = (e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(meta.negativePrompt);
                        if (window.Toast) window.Toast.success("Negative prompt copied! 📋");
                    };

                    negHeader.appendChild(negTitle);
                    negHeader.appendChild(copyNegBtn);
                    overlay.appendChild(negHeader);

                    const negBox = document.createElement("div");
                    negBox.className = "example-prompt-box negative";
                    negBox.textContent = meta.negativePrompt;
                    overlay.appendChild(negBox);
                }

                card.appendChild(overlay);
            }

            list.appendChild(card);
        });
    } else {
        list.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 40px;">No example images available for this model.</div>`;
    }
}

window.copyPromptToClipboard = function (text, btnEl) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        if (window.Toast) {
            window.Toast.success("Prompt copied to clipboard!");
        }
        if (btnEl) {
            const originalContent = btnEl.innerHTML;
            btnEl.innerHTML = "✓ Copied!";
            btnEl.classList.add("copied");
            setTimeout(() => {
                btnEl.innerHTML = originalContent;
                btnEl.classList.remove("copied");
            }, 2000);
        }
    }).catch(err => {
        console.error("Failed to copy:", err);
        if (window.Toast) window.Toast.error("Failed to copy prompt");
    });
};

async function resyncSingleLora() {
    if (!currentDetailItem) return;

    const resyncBtn = document.getElementById("btnResyncSingle") || document.getElementById("btnResyncSingleLora") || document.getElementById("btnResyncSingleCheckpoint");
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

            updateAllFilterBarsAndDropdowns();
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

let isLoraSyncActive = false;
let isLoraSyncCancelled = false;

async function bulkSyncMetadata() {
    const syncBtn = document.getElementById("btnSyncAllMetadata");
    const spinner = document.getElementById("syncSpinner");
    const btnText = document.getElementById("syncBtnText");

    if (allLoraItems.length === 0) return;

    if (isLoraSyncActive) {
        // User clicked button while sync is running -> Cancel sync!
        isLoraSyncCancelled = true;
        if (btnText) btnText.textContent = "🛑 Stopping...";
        if (window.Toast) window.Toast.info("Stopping metadata sync...");
        return;
    }

    isLoraSyncActive = true;
    isLoraSyncCancelled = false;

    if (syncBtn) syncBtn.classList.add("syncing");
    if (spinner) spinner.style.display = "inline-block";

    const total = allLoraItems.length;
    let syncedCount = 0;
    const isIt = (window.i18n && window.i18n.currentLang) === "it";

    if (window.Toast) {
        window.Toast.info(isIt ? `Avviata sincronizzazione in background (${total} modelli)...` : `Started background metadata sync (${total} models)...`);
    }

    try {
        for (let i = 0; i < total; i++) {
            if (isLoraSyncCancelled) {
                break;
            }

            const currentItem = allLoraItems[i];
            const currentNum = i + 1;

            if (btnText) {
                btnText.textContent = isIt
                    ? `🛑 Stop (${currentNum}/${total})`
                    : `🛑 Stop Sync (${currentNum}/${total})`;
            }

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

        updateAllFilterBarsAndDropdowns();
        renderLoraGrid();

        if (isLoraSyncCancelled) {
            if (btnText) btnText.textContent = isIt ? "🛑 Sincronizzazione Interrotta" : "🛑 Sync Interrupted";
            if (window.Toast) window.Toast.info(isIt ? `Sincronizzazione interrotta (${syncedCount}/${total} completati)` : `Sync interrupted by user (${syncedCount}/${total} synced)`);
        } else {
            if (btnText) btnText.textContent = isIt ? `✅ Sincronizzazione Completata (${syncedCount}/${total})` : `✅ Sync Completed (${syncedCount}/${total})`;
            if (window.Toast) window.Toast.success(isIt ? `Sincronizzati ${syncedCount}/${total} modelli!` : `Synced ${syncedCount}/${total} models!`);
        }

    } catch (err) {
        console.error("[EasyLoraConfig] Bulk sync error:", err);
        if (btnText) btnText.textContent = isIt ? "❌ Sincronizzazione Fallita" : "❌ Sync Failed";
        if (window.Toast) window.Toast.error("Bulk sync error");
    } finally {
        isLoraSyncActive = false;
        setTimeout(() => {
            if (syncBtn) syncBtn.classList.remove("syncing");
            if (spinner) spinner.style.display = "none";
            if (btnText) {
                btnText.textContent = isIt ? "🔄 Sincronizza Tutti i Metadati (Civitai)" : "🔄 Sync All Metadata (Civitai)";
            }
        }, 3000);
    }
}

async function saveCurrentLoraConfig() {
    if (!currentDetailItem) return;

    syncCurrentInputsToPreset(currentDetailItem, currentActivePresetId);

    const payload = {
        lora_name: currentDetailItem.lora_name,
        weight_model: parseFloat(fields.weightModel.value) || 1.0,
        weight_clip: parseFloat(fields.weightClip.value) || 1.0,
        character: fields.character ? fields.character.value : "",
        clothing: fields.clothing ? fields.clothing.value : "",
        no_clothing: fields.no_clothing ? fields.no_clothing.value : "",
        expression: fields.expression ? fields.expression.value : "",
        situation: fields.situation ? fields.situation.value : "",
        location: fields.location ? fields.location.value : "",
        lighting: fields.lighting ? fields.lighting.value : "",
        prompt_1: fields.prompt_1 ? fields.prompt_1.value : "",
        prompt_2: fields.prompt_2 ? fields.prompt_2.value : "",
        prompt_3: fields.prompt_3 ? fields.prompt_3.value : "",
        prompt_4: fields.prompt_4 ? fields.prompt_4.value : "",
        trigger_words: currentDetailItem.trigger_words || "",
        tags: currentDetailItem.tags || [],
        base_model: currentDetailItem.base_model || "",
        author: currentDetailItem.author || "",
        cover_url: currentDetailItem.cover_url || "",
        notes: fields.modalNotes ? fields.modalNotes.value : "",
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
            updateAllFilterBarsAndDropdowns();
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

function getTargetNodeClassForLora(config) {
    const loraType = getLoraType(config);
    if (loraType === "Character") {
        return ["easyloracharacterconfigloader", "easyloracharacter", "character loader"];
    } else if (loraType === "Clothing") {
        return ["easyloraclothingconfigloader", "easyloraclothing", "clothing loader"];
    } else if (loraType === "Poses" || loraType === "Action") {
        return ["easyloraposeactionconfigloader", "easyloraposeaction", "pose & action loader", "pose loader", "action loader"];
    } else if (loraType === "Background" || loraType === "Buildings") {
        return ["easylorabackgroundconfigloader", "easylorabackground", "background loader"];
    } else {
        return ["easylorabasicconfigloader", "easylorabasic", "basic loader"];
    }
}

function updateCanvasLoraNodeDirectly(loraName, config) {
    const candidates = [
        window.parent?.app,
        window.opener?.app,
        window.top?.app,
        window.app,
        window.parent?.comfyAPI?.app?.app,
        window.opener?.comfyAPI?.app?.app,
        window.top?.comfyAPI?.app?.app,
        window.comfyAPI?.app?.app
    ];

    let graph = null;
    let comfyAppInstance = null;
    for (const c of candidates) {
        if (c && c.graph && (Array.isArray(c.graph._nodes) || Array.isArray(c.graph.nodes))) {
            graph = c.graph;
            comfyAppInstance = c;
            break;
        }
    }

    if (!graph) return;

    const allNodes = graph._nodes || graph.nodes || [];
    
    // 1. Collect all EasyLora candidate nodes on graph
    const allLoraNodes = allNodes.filter(node => {
        if (!node) return false;
        const typeStr = String(node.type || "").toLowerCase();
        const titleStr = String(node.title || "").toLowerCase();
        const classStr = String(node.comfyClass || "").toLowerCase();

        if (typeStr.includes("easylora") || titleStr.includes("easy lora") || classStr.includes("easylora") ||
            typeStr.includes("easypromptbuilder") || titleStr.includes("easy prompt builder") || classStr.includes("easypromptbuilder")) {
            return true;
        }

        if (Array.isArray(node.widgets)) {
            const widgetNames = node.widgets.map(w => String(w?.name || "").toLowerCase());
            if (widgetNames.includes("lora_name") && (widgetNames.includes("strength_model") || widgetNames.includes("strength_clip"))) {
                return true;
            }
        }

        return false;
    });

    if (allLoraNodes.length === 0) return;

    // 2. Filter to specialized nodes matching this LoRA's type
    const targetClassKeywords = getTargetNodeClassForLora(config);
    let targetNodes = allLoraNodes.filter(node => {
        const typeStr = String(node.type || "").toLowerCase();
        const titleStr = String(node.title || "").toLowerCase();
        const classStr = String(node.comfyClass || "").toLowerCase();
        return targetClassKeywords.some(kw => typeStr.includes(kw) || titleStr.includes(kw) || classStr.includes(kw));
    });

    // 3. Fallback: If no node of this specific LoRA type exists on canvas, check for EasyLoraBasicConfigLoader
    if (targetNodes.length === 0) {
        const basicKeywords = ["easylorabasicconfigloader", "easylorabasic", "basic loader"];
        targetNodes = allLoraNodes.filter(node => {
            const typeStr = String(node.type || "").toLowerCase();
            const titleStr = String(node.title || "").toLowerCase();
            const classStr = String(node.comfyClass || "").toLowerCase();
            return basicKeywords.some(kw => typeStr.includes(kw) || titleStr.includes(kw) || classStr.includes(kw));
        });
    }

    // 4. If no matching specialized node or basic node exists, return early without touching unrelated nodes
    if (targetNodes.length === 0) return;

    // 5. If one of the target nodes is currently selected by user on canvas, prioritize only the selected node
    try {
        const selectedNodesObj = comfyAppInstance?.canvas?.selected_nodes || {};
        const selectedList = Object.values(selectedNodesObj);
        const selectedTarget = selectedList.find(n => targetNodes.includes(n));
        if (selectedTarget) {
            targetNodes = [selectedTarget];
        }
    } catch (e) { }

    const weightModel = config.weight_model;
    const weightClip = config.weight_clip;
    const blockMap = {
        character: config.character || "",
        clothing: config.clothing || "",
        no_clothing: config.no_clothing || "",
        expression: config.expression || "",
        situation: config.situation || "",
        location: config.location || "",
        lighting: config.lighting || "",
        prompt_1: config.prompt_1 || "",
        prompt_2: config.prompt_2 || "",
        prompt_3: config.prompt_3 || "",
        prompt_4: config.prompt_4 || ""
    };

    for (const node of targetNodes) {
        if (!node.widgets) continue;
        for (const widget of node.widgets) {
            if (widget.name === "lora_name") {
                widget.value = loraName;
                if (widget.callback) widget.callback(loraName);
            } else if (widget.name === "strength_model" && weightModel !== undefined) {
                widget.value = weightModel;
                if (widget.callback) widget.callback(weightModel);
            } else if (widget.name === "strength_clip" && weightClip !== undefined) {
                widget.value = weightClip;
                if (widget.callback) widget.callback(weightClip);
            } else if (blockMap[widget.name] !== undefined) {
                widget.value = blockMap[widget.name];
                if (widget.callback) widget.callback(blockMap[widget.name]);
            }
        }
    }

    if (graph.setDirtyCanvas) graph.setDirtyCanvas(true, true);
}

async function sendToComfyUI() {
    if (!currentDetailItem) return;

    const isIt = (window.i18n && window.i18n.currentLang) === "it";

    try {
        await saveCurrentLoraConfig();
        updateCanvasLoraNodeDirectly(currentDetailItem.lora_name, currentDetailItem);
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
    if (fields.closeOutsideCheckbox && window.ComfyCabinetSettings) {
        window.ComfyCabinetSettings.setCloseModalOnClickOutside(fields.closeOutsideCheckbox.checked);
        closeModalOnClickOutside = fields.closeOutsideCheckbox.checked;
    }
    try {
        await fetch("/easy_lora_config/save_globals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                domain_mode: currentDomainMode,
                civitai_api_key: civitaiApiKey,
                close_modal_on_click_outside: String(closeModalOnClickOutside)
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
    if (window.Toast) window.Toast.info(`⏳ Testing connection to ${currentDomainMode}...`);

    const testBtn = document.getElementById("btnTestCivitai");
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

        if (data.ok) {
            if (window.Toast) window.Toast.success(data.message || "Connection successful! ✅");
        } else {
            if (window.Toast) window.Toast.error(data.message || "Connection failed ❌");
        }
    } catch (err) {
        if (window.Toast) window.Toast.error(`Connection test failed: ${err.message}`);
    } finally {
        if (testBtn) testBtn.disabled = false;
    }
}

function showModalStatus(message, color) {
    if (!message) return;
    let type = "info";
    if (color && (color.includes("success") || color.includes("accent"))) type = "success";
    else if (color && (color.includes("error") || color.includes("danger"))) type = "error";

    if (window.Toast) {
        window.Toast.show(message, type);
    }
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
