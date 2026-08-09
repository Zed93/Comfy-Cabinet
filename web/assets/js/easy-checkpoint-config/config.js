(function () {
    let allCheckpointItems = [];
    let rawSamplers = [];
    let rawSchedulers = [];
    let globalConfigs = {};
    let currentDetailItem = null;

    let activeSearchQuery = "";
    let activeBaseModelFilter = "ALL";
    let selectedAuthors = [];
    let selectedTags = [];
    let activeSortOrder = "AZ";
    let currentDomainMode = "civitai.com";
    let civitaiApiKey = "";

    const fields = {};

    document.addEventListener("DOMContentLoaded", () => {
        const initApp = () => {
            cacheDOM();
            bindEvents();
            setupTabs();
            loadAllCheckpoints();
        };

        if (window.i18n && window.i18n.ready) {
            initApp();
        } else {
            document.addEventListener("i18n-ready", initApp);
        }
    });

    function cacheDOM() {
        fields.searchInput = document.getElementById("checkpointSearchInput");
        fields.sortSelect = document.getElementById("sortSelectCheckpoint") || document.getElementById("sortSelect");
        fields.syncAllBtn = document.getElementById("btnSyncAllCheckpoints");

        fields.detailModal = document.getElementById("detailModal");
        fields.closeDetailModal = document.getElementById("closeDetailModal");

        fields.steps = document.getElementById("stepsInput");
        fields.cfg = document.getElementById("cfgInput");
        fields.clipSkip = document.getElementById("clipSkipInput");
        fields.samplerTrigger = document.getElementById("modalSamplerTrigger");
        fields.schedulerTrigger = document.getElementById("modalSchedulerTrigger");
        fields.prefixPrompt = document.getElementById("prefixPromptInput");
        fields.suffixPrompt = document.getElementById("suffixPromptInput");
        fields.notes = document.getElementById("modalNotesInput");
        fields.saveConfigBtn = document.getElementById("btnSaveModalConfig");

        fields.gSteps = document.getElementById("globalSteps");
        fields.gCfg = document.getElementById("globalCfg");
        fields.gClipSkip = document.getElementById("globalClipSkip");
        fields.gSamplerTrigger = document.getElementById("gSamplerTrigger");
        fields.gSchedulerTrigger = document.getElementById("gSchedulerTrigger");
        fields.promptSeparator = document.getElementById("promptSeparator");
        fields.saveGlobalBtn = document.getElementById("saveGlobalBtn");

        fields.openSettingsBtn = document.getElementById("openSettingsModal");
        fields.closeSettingsBtn = document.getElementById("closeSettingsModal");
        fields.settingsModal = document.getElementById("settingsModal");
    }

    function bindEvents() {
        if (fields.searchInput) {
            fields.searchInput.addEventListener("input", (e) => {
                activeSearchQuery = e.target.value.toLowerCase().trim();
                renderActiveFilterChips();
                renderCheckpointGrid();
            });
        }

        if (fields.sortSelect) {
            fields.sortSelect.addEventListener("change", (e) => {
                activeSortOrder = e.target.value;
                renderCheckpointGrid();
            });
        }

        if (fields.syncAllBtn) {
            fields.syncAllBtn.addEventListener("click", syncAllMetadata);
        }

        if (fields.closeDetailModal) {
            fields.closeDetailModal.addEventListener("click", closeDetailModal);
        }

        if (fields.detailModal) {
            fields.detailModal.addEventListener("click", (e) => {
                if (e.target === fields.detailModal) {
                    const isCloseOutside = window.ComfyCabinetSettings ? window.ComfyCabinetSettings.getCloseModalOnClickOutside() : true;
                    if (isCloseOutside) closeDetailModal();
                }
            });
        }

        if (fields.openSettingsBtn && fields.settingsModal) {
            fields.openSettingsBtn.addEventListener("click", () => {
                fields.settingsModal.style.display = "flex";
            });
        }

        if (fields.closeSettingsBtn && fields.settingsModal) {
            fields.closeSettingsBtn.addEventListener("click", () => {
                fields.settingsModal.style.display = "none";
            });
        }

        if (fields.settingsModal) {
            fields.settingsModal.addEventListener("click", (e) => {
                if (e.target === fields.settingsModal) {
                    const isCloseOutside = window.ComfyCabinetSettings ? window.ComfyCabinetSettings.getCloseModalOnClickOutside() : true;
                    if (isCloseOutside) fields.settingsModal.style.display = "none";
                }
            });
        }

        if (fields.saveConfigBtn) {
            fields.saveConfigBtn.addEventListener("click", saveCurrentCheckpointConfig);
        }

        const sendBtn = document.getElementById("btnSendToComfy");
        if (sendBtn) {
            sendBtn.addEventListener("click", () => {
                if (currentDetailItem && currentDetailItem.checkpoint_name) {
                    sendToComfyUI();
                }
            });
        }

        if (fields.saveGlobalBtn) {
            fields.saveGlobalBtn.addEventListener("click", saveGlobalSettings);
        }

        setupCollapsibleFilters();
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

                const targetId = `tab${capitalize(tabName)}`;
                const target = document.getElementById(targetId);
                if (target) target.classList.add("active");
            });
        });
    }

    function capitalize(str) {
        if (!str) return "";
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function getCachedImageUrl(url) {
        if (!url) return "";
        if (url.startsWith("/easy_checkpoint_config/cache_image") || url.startsWith("/easy_lora_config/cache_image")) {
            return url;
        }
        return `/easy_checkpoint_config/cache_image?url=${encodeURIComponent(url)}`;
    }

    function escapeHtml(str) {
        return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    async function loadAllCheckpoints() {
        try {
            const res = await fetch("/easy_checkpoint_config/get_all_checkpoints_full");
            const data = await res.json();

            allCheckpointItems = data.items || [];
            rawSamplers = data.samplers || [];
            rawSchedulers = data.schedulers || [];
            globalConfigs = data.global_configs || {};

            if (globalConfigs.domain_mode) currentDomainMode = globalConfigs.domain_mode;
            if (globalConfigs.civitai_api_key) civitaiApiKey = globalConfigs.civitai_api_key;

            populateGlobalSettingsUI();
            populateBaseModelFilterBar();
            populateAuthorFilterBar();
            populateTagsFilterBar();
            renderCheckpointGrid();
        } catch (err) {
            console.error("[EasyCheckpointConfig] Failed to load checkpoints:", err);
            if (window.Toast) window.Toast.error("Failed to load checkpoints data.");
        }
    }

    function populateGlobalSettingsUI() {
        if (fields.gSteps) fields.gSteps.value = globalConfigs.default_steps || 20;
        if (fields.gCfg) fields.gCfg.value = globalConfigs.default_cfg || 7.0;
        if (fields.gClipSkip) fields.gClipSkip.value = globalConfigs.default_clip_skip || -1;
        if (fields.promptSeparator) fields.promptSeparator.value = globalConfigs.prompt_separator || ", ";

        if (fields.gSamplerTrigger) fields.gSamplerTrigger.textContent = globalConfigs.default_sampler || "euler";
        if (fields.gSchedulerTrigger) fields.gSchedulerTrigger.textContent = globalConfigs.default_scheduler || "normal";

        if (typeof createDropdownComponent === "function") {
            createDropdownComponent("gSamplerTrigger", "gSamplerPanel", "gSamplerSearch", "gSamplerList", rawSamplers, (val) => {
                if (fields.gSamplerTrigger) fields.gSamplerTrigger.textContent = val;
            });

            createDropdownComponent("gSchedulerTrigger", "gSchedulerPanel", "gSchedulerSearch", "gSchedulerList", rawSchedulers, (val) => {
                if (fields.gSchedulerTrigger) fields.gSchedulerTrigger.textContent = val;
            });
        }
    }

    function populateBaseModelFilterBar() {
        const bar = document.getElementById("baseModelFilterBar");
        if (!bar) return;

        const counts = { ALL: allCheckpointItems.length };
        allCheckpointItems.forEach(item => {
            const bm = item.base_model || "Unknown";
            counts[bm] = (counts[bm] || 0) + 1;
        });

        bar.innerHTML = "";
        const allPill = document.createElement("span");
        allPill.className = `tag-filter-pill ${activeBaseModelFilter === "ALL" ? "active" : ""}`;
        allPill.setAttribute("data-base", "ALL");
        allPill.innerHTML = `<span data-i18n="easy_config.all_base_models">All Base Models</span> (<span class="pill-count">${counts.ALL}</span>)`;
        allPill.onclick = () => {
            activeBaseModelFilter = "ALL";
            populateBaseModelFilterBar();
            renderActiveFilterChips();
            renderCheckpointGrid();
        };
        bar.appendChild(allPill);

        Object.keys(counts).forEach(bm => {
            if (bm === "ALL") return;
            const pill = document.createElement("span");
            pill.className = `tag-filter-pill ${activeBaseModelFilter === bm ? "active" : ""}`;
            pill.setAttribute("data-base", bm);
            pill.innerHTML = `<span>${escapeHtml(bm)}</span> (<span class="pill-count">${counts[bm]}</span>)`;
            pill.onclick = () => {
                activeBaseModelFilter = bm;
                populateBaseModelFilterBar();
                renderActiveFilterChips();
                renderCheckpointGrid();
            };
            bar.appendChild(pill);
        });
    }

    function populateAuthorFilterBar() {
        const authorsSet = new Set();
        allCheckpointItems.forEach(item => {
            if (item.author && item.author !== "Unknown") authorsSet.add(item.author);
        });
        const list = Array.from(authorsSet).sort();

        if (typeof createDropdownComponent === "function") {
            createDropdownComponent("authorFilterTrigger", "authorFilterPanel", "authorFilterSearch", "authorFilterList", list, (val) => {
                if (!selectedAuthors.includes(val)) {
                    selectedAuthors.push(val);
                    renderActiveFilterChips();
                    renderCheckpointGrid();
                }
            });
        }
    }

    function populateTagsFilterBar() {
        const tagsSet = new Set();
        allCheckpointItems.forEach(item => {
            if (Array.isArray(item.tags)) {
                item.tags.forEach(t => tagsSet.add(t));
            }
        });
        const list = Array.from(tagsSet).sort();

        if (typeof createDropdownComponent === "function") {
            createDropdownComponent("tagFilterTrigger", "tagFilterPanel", "tagFilterSearch", "tagFilterList", list, (val) => {
                if (!selectedTags.includes(val)) {
                    selectedTags.push(val);
                    renderActiveFilterChips();
                    renderCheckpointGrid();
                }
            });
        }
    }

    function setupCollapsibleFilters() {
        const toggleHeader = document.getElementById("filtersToggleHeaderCkpt") || document.getElementById("filtersToggleHeader");
        const toggleBtn = document.getElementById("btnToggleFiltersCkpt") || document.getElementById("btnToggleFilters");
        const container = document.getElementById("filtersCollapseContainerCkpt") || document.getElementById("filtersCollapseContainer");
        const toggleText = document.getElementById("toggleFiltersBtnTextCkpt") || document.getElementById("toggleFiltersBtnText");
        const clearAllBtn = document.getElementById("btnClearAllFiltersCkpt") || document.getElementById("btnClearAllFilters");

        if (!container) return;

        if (clearAllBtn) {
            clearAllBtn.onclick = () => {
                activeBaseModelFilter = "ALL";
                selectedAuthors = [];
                selectedTags = [];
                activeSearchQuery = "";
                if (fields.searchInput) fields.searchInput.value = "";

                populateBaseModelFilterBar();
                renderActiveFilterChips();
                renderCheckpointGrid();
            };
        }

        let isCollapsed = localStorage.getItem("checkpoint_filters_collapsed") !== "false";

        const updateFilterPanelState = () => {
            const isIt = (window.i18n && window.i18n.lang) === "it";
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
            localStorage.setItem("checkpoint_filters_collapsed", isCollapsed ? "true" : "false");
            updateFilterPanelState();
        };

        if (toggleHeader) {
            toggleHeader.onclick = (e) => {
                if (e.target.closest("#btnToggleFiltersCkpt") || e.target.closest("#btnToggleFilters")) return;
                toggle();
            };
        }
        if (toggleBtn) toggleBtn.onclick = toggle;
    }

    function renderActiveFilterChips() {
        const summaryRow = document.getElementById("activeFiltersSummaryRowCkpt") || document.getElementById("activeFiltersSummaryRow");
        const container = document.getElementById("activeFilterChipsContainerCkpt") || document.getElementById("activeFilterChipsContainer");
        const badge = document.getElementById("activeFiltersBadgeCkpt") || document.getElementById("activeFiltersBadge");
        if (!container || !summaryRow) return;

        container.innerHTML = `<span style="font-size: 0.8rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted);">Active Filters:</span>`;

        let activeCount = 0;

        if (activeBaseModelFilter !== "ALL") {
            activeCount++;
            const chip = document.createElement("span");
            chip.className = "active-chip";
            chip.innerHTML = `<span>Base: ${escapeHtml(activeBaseModelFilter)}</span><span class="chip-remove">✕</span>`;
            chip.querySelector(".chip-remove").onclick = () => {
                activeBaseModelFilter = "ALL";
                populateBaseModelFilterBar();
                renderActiveFilterChips();
                renderCheckpointGrid();
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
                renderActiveFilterChips();
                renderCheckpointGrid();
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
                renderActiveFilterChips();
                renderCheckpointGrid();
            };
            container.appendChild(chip);
        });

        if (activeSearchQuery) {
            activeCount++;
            const chip = document.createElement("span");
            chip.className = "active-chip";
            chip.innerHTML = `<span>Search: ${escapeHtml(activeSearchQuery)}</span><span class="chip-remove">✕</span>`;
            chip.querySelector(".chip-remove").onclick = () => {
                activeSearchQuery = "";
                if (fields.searchInput) fields.searchInput.value = "";
                renderActiveFilterChips();
                renderCheckpointGrid();
            };
            container.appendChild(chip);
        }

        if (badge) {
            if (activeCount > 0) {
                badge.textContent = `${activeCount} Active`;
                badge.style.display = "inline-block";
            } else {
                badge.style.display = "none";
            }
        }

        if (activeCount > 0) {
            summaryRow.style.display = "flex";
        } else {
            summaryRow.style.display = "none";
        }
    }

    function sortCheckpoints(items) {
        const sorted = [...items];
        sorted.sort((a, b) => {
            if (activeSortOrder === "SYNCED") {
                const dateA = a.last_synced ? new Date(a.last_synced).getTime() : 0;
                const dateB = b.last_synced ? new Date(b.last_synced).getTime() : 0;
                return dateB - dateA;
            }

            const nameA = a.checkpoint_name.toLowerCase();
            const nameB = b.checkpoint_name.toLowerCase();
            if (activeSortOrder === "ZA") {
                return nameB.localeCompare(nameA, undefined, { numeric: true, sensitivity: 'base' });
            }
            return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
        });
        return sorted;
    }

    function renderCheckpointGrid() {
        const grid = document.getElementById("checkpointGrid");
        const noMsg = document.getElementById("noCheckpointsMsg");
        if (!grid) return;

        let filtered = allCheckpointItems.filter(item => {
            if (activeBaseModelFilter !== "ALL" && item.base_model !== activeBaseModelFilter) {
                return false;
            }

            if (selectedAuthors.length > 0 && (!item.author || !selectedAuthors.includes(item.author))) {
                return false;
            }

            if (selectedTags.length > 0) {
                const itemTags = item.tags || [];
                const hasAllSelected = selectedTags.every(t => itemTags.includes(t));
                if (!hasAllSelected) return false;
            }

            if (activeSearchQuery) {
                const name = item.checkpoint_name.toLowerCase();
                const author = (item.author || "").toLowerCase();
                const base = (item.base_model || "").toLowerCase();
                const tags = (item.tags || []).join(" ").toLowerCase();
                const combined = `${name} ${author} ${base} ${tags}`;
                if (!combined.includes(activeSearchQuery)) return false;
            }

            return true;
        });

        filtered = sortCheckpoints(filtered);

        if (filtered.length === 0) {
            grid.innerHTML = "";
            if (noMsg) noMsg.style.display = "block";
            return;
        }

        if (noMsg) noMsg.style.display = "none";
        grid.innerHTML = "";

        filtered.forEach(item => {
            const card = document.createElement("div");
            card.className = "tactile-card";

            const fileName = item.checkpoint_name.split("/").pop().split("\\").pop().replace(/\.(safetensors|ckpt)$/i, "");
            const titleText = item.civitai_metadata?.title || item.civitai_metadata?.name || fileName;

            const rawCoverUrl = item.cover_url || (item.civitai_metadata?.images?.[0]?.url) || "";
            const coverUrl = getCachedImageUrl(rawCoverUrl);
            const baseTag = item.base_model || "SD 1.5";
            const authorText = (item.author && item.author !== "Unknown") ? item.author : "";

            const firstImgObj = item.civitai_metadata?.images?.[0];
            const isVideo = (firstImgObj && firstImgObj.type === "video") ||
                (rawCoverUrl && (rawCoverUrl.toLowerCase().includes(".mp4") || rawCoverUrl.toLowerCase().includes(".webm")));

            if (coverUrl) {
                if (isVideo) {
                    const video = document.createElement("video");
                    video.className = "tactile-card-img";
                    video.style.cssText = "width:100%; height:100%; object-fit:cover;";
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
                    img.className = "tactile-card-img";
                    img.style.cssText = "width:100%; height:100%; object-fit:cover;";
                    img.src = coverUrl;
                    img.loading = "lazy";
                    card.appendChild(img);
                }
            } else {
                const placeholder = document.createElement("div");
                placeholder.className = "tactile-card-placeholder";
                placeholder.style.cssText = "background: linear-gradient(135deg, rgba(242,76,61,0.15) 0%, rgba(0,0,0,0.05) 100%); font-size: 3rem; display:flex; align-items:center; justify-content:center; width:100%; height:100%;";
                placeholder.innerHTML = "🎨";
                card.appendChild(placeholder);
            }

            const overlay = document.createElement("div");
            overlay.className = "tactile-card-overlay";
            overlay.innerHTML = `
                <div class="tactile-card-top">
                    <span class="tactile-card-tag">${escapeHtml(baseTag)}</span>
                </div>
                <div class="tactile-card-bottom">
                    <h3 class="tactile-card-title">${escapeHtml(titleText)}</h3>
                    <p class="tactile-card-desc">${authorText ? `👤 ${escapeHtml(authorText)} • ` : ''}${item.file_size || 'Unknown size'}</p>
                </div>
            `;
            card.appendChild(overlay);

            card.onclick = () => openDetailModal(item);
            grid.appendChild(card);
        });
    }

    function openDetailModal(item) {
        currentDetailItem = item;
        if (!fields.detailModal) return;

        const fileName = item.checkpoint_name.split("/").pop().split("\\").pop().replace(/\.(safetensors|ckpt)$/i, "");
        const titleText = item.civitai_metadata?.title || item.civitai_metadata?.name || fileName;
        const authorVal = item.author || "Unknown";

        document.getElementById("modalTitle").textContent = titleText;
        document.getElementById("modalAuthorBadge").textContent = (authorVal && authorVal !== "Unknown") ? `👤 ${authorVal}` : "👤 Unknown Author";

        const triggerWordsGroup = document.getElementById("modalTriggerWordsGroup");
        if (triggerWordsGroup) triggerWordsGroup.style.display = "none";

        const ckptControls = document.getElementById("checkpointConfigControls");
        const loraControls = document.getElementById("loraConfigControls");
        if (ckptControls) ckptControls.style.display = "block";
        if (loraControls) loraControls.style.display = "none";

        const sendBtn = document.getElementById("btnSendToComfy");
        if (sendBtn) sendBtn.style.display = "inline-flex";

        const civBtn = document.getElementById("btnViewCivitai");
        if (civBtn) {
            civBtn.onclick = async (e) => {
                e.preventDefault();
                const baseDomain = currentDomainMode === "civitai.red" ? "https://civitai.red" : "https://civitai.com";
                const civId = item.civitai_id || item.civitai_metadata?.id;
                const verId = item.model_version_id || item.civitai_metadata?.versionId;

                if (civId) {
                    let url = `${baseDomain}/models/${civId}`;
                    if (verId) url += `?modelVersionId=${verId}`;
                    window.open(url, "_blank", "noopener,noreferrer");
                    return;
                }

                const newTab = window.open("about:blank", "_blank");
                try {
                    const res = await fetch("/easy_checkpoint_config/fetch_civitai", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            checkpoint_name: item.checkpoint_name,
                            domain: currentDomainMode,
                            api_key: civitaiApiKey
                        })
                    });
                    const data = await res.json();
                    if (data.status === "success" && data.data) {
                        Object.assign(item, data.data);
                        const fetchedId = item.civitai_id;
                        if (fetchedId) {
                            let url = `${baseDomain}/models/${fetchedId}`;
                            if (item.model_version_id) url += `?modelVersionId=${item.model_version_id}`;
                            if (newTab) newTab.location.href = url;
                            return;
                        }
                    }
                } catch (err) {
                    console.warn("[EasyCheckpointConfig] On-demand Civitai fetch error:", err);
                }

                if (newTab) newTab.location.href = `${baseDomain}/models?query=${encodeURIComponent(fileName)}`;
            };
        }

        const resyncBtn = document.getElementById("btnResyncSingle") || document.getElementById("btnResyncSingleCheckpoint");
        if (resyncBtn) {
            resyncBtn.onclick = async () => {
                showModalStatus("Fetching CivitAI metadata...", "var(--accent)");
                try {
                    const res = await fetch("/easy_checkpoint_config/fetch_civitai", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            checkpoint_name: item.checkpoint_name,
                            domain: currentDomainMode,
                            api_key: civitaiApiKey
                        })
                    });
                    const data = await res.json();
                    if (data.status === "success" && data.data) {
                        Object.assign(item, data.data);
                        openDetailModal(item);
                        populateBaseModelFilterBar();
                        populateAuthorFilterBar();
                        populateTagsFilterBar();
                        renderCheckpointGrid();
                        showModalStatus("CivitAI metadata resynced! ✅", "var(--success)");
                    } else {
                        showModalStatus("No CivitAI data found.", "var(--error)");
                    }
                } catch (err) {
                    showModalStatus("Resync error ❌", "var(--error)");
                }
            };
        }

        document.getElementById("infoVersion").textContent = item.civitai_metadata?.versionName || "v1.0";
        document.getElementById("infoFileName").textContent = item.checkpoint_name.split("/").pop().split("\\").pop();
        document.getElementById("infoBaseModel").textContent = item.base_model || "Unknown";
        document.getElementById("infoSize").textContent = item.file_size || "Unknown";
        document.getElementById("infoLocation").textContent = item.relative_path || item.checkpoint_name;

        renderModalTags(item.tags || []);

        if (fields.notes) fields.notes.value = item.notes || "";

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

        renderModalExamples(item.civitai_metadata?.images || []);

        if (fields.steps) fields.steps.value = item.steps ?? 20;
        if (fields.cfg) fields.cfg.value = item.cfg ?? 7.0;
        if (fields.clipSkip) fields.clipSkip.value = item.clip_skip ?? -1;
        if (fields.prefixPrompt) fields.prefixPrompt.value = item.prefix_prompt || "";
        if (fields.suffixPrompt) fields.suffixPrompt.value = item.suffix_prompt || "";

        if (fields.samplerTrigger) fields.samplerTrigger.textContent = item.sampler_name || "euler";
        if (fields.schedulerTrigger) fields.schedulerTrigger.textContent = item.scheduler || "normal";

        if (typeof createDropdownComponent === "function") {
            createDropdownComponent("modalSamplerTrigger", "modalSamplerPanel", "modalSamplerSearch", "modalSamplerList", rawSamplers, (val) => {
                if (fields.samplerTrigger) fields.samplerTrigger.textContent = val;
                if (currentDetailItem) currentDetailItem.sampler_name = val;
            });

            createDropdownComponent("modalSchedulerTrigger", "modalSchedulerPanel", "modalSchedulerSearch", "modalSchedulerList", rawSchedulers, (val) => {
                if (fields.schedulerTrigger) fields.schedulerTrigger.textContent = val;
                if (currentDetailItem) currentDetailItem.scheduler = val;
            });
        }

        showModalStatus("");
        fields.detailModal.style.display = "flex";
    }

    function closeDetailModal() {
        if (fields.detailModal) fields.detailModal.style.display = "none";
        currentDetailItem = null;
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
        addBtn.onclick = () => {
            const newTag = prompt("Enter new tag:");
            if (newTag && newTag.trim()) {
                const clean = newTag.trim();
                if (!currentDetailItem.tags) currentDetailItem.tags = [];
                if (!currentDetailItem.tags.includes(clean)) {
                    currentDetailItem.tags.push(clean);
                    renderModalTags(currentDetailItem.tags);
                }
            }
        };
        container.appendChild(addBtn);
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

    async function saveCurrentCheckpointConfig() {
        if (!currentDetailItem) return;

        const payload = {
            checkpoint_name: currentDetailItem.checkpoint_name,
            steps: parseInt(fields.steps.value) || 20,
            cfg: parseFloat(fields.cfg.value) || 7.0,
            clip_skip: parseInt(fields.clipSkip.value) || -1,
            sampler_name: fields.samplerTrigger ? fields.samplerTrigger.textContent : "euler",
            scheduler: fields.schedulerTrigger ? fields.schedulerTrigger.textContent : "normal",
            prefix_prompt: fields.prefixPrompt.value,
            suffix_prompt: fields.suffixPrompt.value,
            notes: fields.notes.value,
            tags: currentDetailItem.tags || [],
            base_model: currentDetailItem.base_model || "",
            author: currentDetailItem.author || "",
            cover_url: currentDetailItem.cover_url || "",
            civitai_id: currentDetailItem.civitai_id,
            model_version_id: currentDetailItem.model_version_id,
            civitai_metadata: currentDetailItem.civitai_metadata || {}
        };

        try {
            const res = await fetch("/easy_checkpoint_config/save_settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                if (data.config) {
                    const idx = allCheckpointItems.findIndex(item => item.checkpoint_name === currentDetailItem.checkpoint_name);
                    if (idx !== -1) allCheckpointItems[idx] = data.config;
                }
                showModalStatus("Configuration saved successfully! ✅", "var(--success)");
                if (window.Toast) window.Toast.success("Checkpoint settings saved!");
                renderCheckpointGrid();
            } else {
                showModalStatus("Error saving configuration ❌", "var(--error)");
            }
        } catch (err) {
            showModalStatus("Network error while saving ❌", "var(--error)");
        }
    }

    function updateCanvasCheckpointNodeDirectly(checkpointName) {
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
        for (const c of candidates) {
            if (c && c.graph && (Array.isArray(c.graph._nodes) || Array.isArray(c.graph.nodes))) {
                graph = c.graph;
                break;
            }
        }

        if (!graph) return;

        const allNodes = graph._nodes || graph.nodes || [];
        for (const node of allNodes) {
            if (!node || !node.widgets) continue;
            for (const widget of node.widgets) {
                const name = String(widget.name || "").toLowerCase();
                if (name === "ckpt_name" || name === "checkpoint" || name === "checkpoint_name") {
                    widget.value = checkpointName;
                    if (widget.callback) widget.callback(checkpointName);
                }
            }
        }

        if (graph.setDirtyCanvas) graph.setDirtyCanvas(true, true);
    }

    async function sendToComfyUI() {
        if (!currentDetailItem) return;

        try {
            await saveCurrentCheckpointConfig();
            updateCanvasCheckpointNodeDirectly(currentDetailItem.checkpoint_name);
            if (window.Toast) window.Toast.success(`Checkpoint config for '${currentDetailItem.checkpoint_name}' sent to ComfyUI! 🚀`);
        } catch (err) {
            console.error("[EasyCheckpointConfig] Send error:", err);
            if (window.Toast) window.Toast.error("Error sending configuration to ComfyUI ❌");
        }
    }

    let isCkptSyncActive = false;
    let isCkptSyncCancelled = false;

    async function syncAllMetadata() {
        const syncBtn = document.getElementById("btnSyncAllCheckpoints");
        const spinner = document.getElementById("syncSpinnerCkpt");
        const btnText = document.getElementById("syncBtnTextCkpt");

        if (allCheckpointItems.length === 0) return;

        if (isCkptSyncActive) {
            // User clicked button while sync is running -> Cancel sync!
            isCkptSyncCancelled = true;
            if (btnText) btnText.textContent = "🛑 Stopping...";
            if (window.Toast) window.Toast.info("Stopping metadata sync...");
            return;
        }

        isCkptSyncActive = true;
        isCkptSyncCancelled = false;

        if (syncBtn) syncBtn.classList.add("syncing");
        if (spinner) spinner.style.display = "inline-block";

        const total = allCheckpointItems.length;
        let syncedCount = 0;
        const isIt = (window.i18n && window.i18n.currentLang) === "it";

        if (window.Toast) {
            window.Toast.info(isIt ? `Avviata sincronizzazione in background (${total} modelli)...` : `Started background metadata sync (${total} models)...`);
        }

        try {
            for (let i = 0; i < total; i++) {
                if (isCkptSyncCancelled) {
                    break;
                }

                const currentItem = allCheckpointItems[i];
                const currentNum = i + 1;

                if (btnText) {
                    btnText.textContent = isIt
                        ? `🛑 Stop (${currentNum}/${total})`
                        : `🛑 Stop Sync (${currentNum}/${total})`;
                }

                try {
                    const res = await fetch("/easy_checkpoint_config/fetch_civitai", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            checkpoint_name: currentItem.checkpoint_name,
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
                    console.warn(`[EasyCheckpointConfig] Sync warning for ${currentItem.checkpoint_name}:`, err);
                }
            }

            populateBaseModelFilterBar();
            populateAuthorFilterBar();
            populateTagsFilterBar();
            renderCheckpointGrid();

            if (isCkptSyncCancelled) {
                if (btnText) btnText.textContent = isIt ? "🛑 Sincronizzazione Interrotta" : "🛑 Sync Interrupted";
                if (window.Toast) window.Toast.info(isIt ? `Sincronizzazione interrotta (${syncedCount}/${total} completati)` : `Sync interrupted by user (${syncedCount}/${total} synced)`);
            } else {
                if (btnText) btnText.textContent = isIt ? `✅ Sincronizzazione Completata (${syncedCount}/${total})` : `✅ Sync Completed (${syncedCount}/${total})`;
                if (window.Toast) window.Toast.success(isIt ? `Sincronizzati ${syncedCount}/${total} modelli!` : `Synced ${syncedCount}/${total} models!`);
            }

        } catch (err) {
            console.error("[EasyCheckpointConfig] Bulk sync error:", err);
            if (btnText) btnText.textContent = isIt ? "❌ Sincronizzazione Fallita" : "❌ Sync Failed";
            if (window.Toast) window.Toast.error("Bulk sync error");
        } finally {
            isCkptSyncActive = false;
            setTimeout(() => {
                if (syncBtn) syncBtn.classList.remove("syncing");
                if (spinner) spinner.style.display = "none";
                if (btnText) {
                    btnText.textContent = isIt ? "🔄 Sincronizza Tutti i Metadati (Civitai)" : "🔄 Sync All Metadata (Civitai)";
                }
            }, 3000);
        }
    }

    async function saveGlobalSettings() {
        const closeOutsideCb = document.getElementById("gCloseOutsideCheckbox");
        if (closeOutsideCb && window.ComfyCabinetSettings) {
            window.ComfyCabinetSettings.setCloseModalOnClickOutside(closeOutsideCb.checked);
        }

        const payload = {
            default_steps: fields.gSteps.value,
            default_cfg: fields.gCfg.value,
            default_clip_skip: fields.gClipSkip.value,
            default_sampler: fields.gSamplerTrigger ? fields.gSamplerTrigger.textContent : "euler",
            default_scheduler: fields.gSchedulerTrigger ? fields.gSchedulerTrigger.textContent : "normal",
            prompt_separator: fields.promptSeparator ? fields.promptSeparator.value : ", ",
            close_modal_on_click_outside: closeOutsideCb ? String(closeOutsideCb.checked) : "false"
        };

        try {
            const res = await fetch("/easy_checkpoint_config/save_globals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const el = document.getElementById("globalStatus");
                if (el) {
                    el.textContent = "Global settings updated! ✅";
                    el.style.color = "var(--success)";
                    setTimeout(() => el.textContent = "", 4000);
                }
                if (window.Toast) window.Toast.success("Global preferences saved!");
                const modal = document.getElementById("settingsModal");
                if (modal) setTimeout(() => modal.style.display = "none", 500);
            }
        } catch (err) {
            console.error(err);
        }
    }

    function showModalStatus(msg, color = "var(--text-main)") {
        if (!msg) return;
        let type = "info";
        if (color.includes("success") || color.includes("accent")) type = "success";
        else if (color.includes("error") || color.includes("danger")) type = "error";

        if (window.Toast) {
            window.Toast.show(msg, type);
        }
    }
})();
