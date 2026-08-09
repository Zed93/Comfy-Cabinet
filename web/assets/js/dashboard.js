(function () {
    const toolsList = [
        {
            id: "easy-checkpoint-config",
            url: "#/checkpoint",
            type: "Tool",
            icon: "🎨",
            bgGradient: "linear-gradient(135deg, rgba(242,76,61,0.15) 0%, rgba(0,0,0,0.05) 100%)",
            titleKey: "home.tool_title",
            defaultTitle: "Easy Checkpoint Config",
            descKey: "home.tool_desc",
            defaultDesc: "Manage presets for your favorite models. Configure steps, CFG, samplers, and fixed prompts.",
            searchTerms: "easy checkpoint config manage presets models steps cfg samplers fixed prompts"
        },
        {
            id: "lora-config",
            url: "#/lora",
            type: "Tool",
            icon: "💊",
            bgGradient: "linear-gradient(135deg, rgba(37,99,235,0.15) 0%, rgba(0,0,0,0.05) 100%)",
            titleKey: "home.tool3_title",
            defaultTitle: "Easy LoRA Config",
            descKey: "home.tool3_desc",
            defaultDesc: "Configure LoRAs with Civitai data, preview media, trigger words, and assign prompt builder blocks.",
            searchTerms: "easy lora config civitai preview media trigger words prompt builder blocks"
        },
        {
            id: "prompt-builder",
            url: "#/prompt",
            type: "Tool",
            icon: "🧩",
            bgGradient: "linear-gradient(135deg, rgba(5,150,105,0.15) 0%, rgba(0,0,0,0.05) 100%)",
            titleKey: "home.tool2_title",
            defaultTitle: "Easy Prompt Builder",
            descKey: "home.tool2_desc",
            defaultDesc: "Build positive prompts with 8 modular blocks: prefix, character, clothing, expression, situation, location, lighting, suffix.",
            searchTerms: "easy prompt builder positive prompts 8 modular blocks prefix character clothing expression situation location lighting suffix"
        }
    ];

    let activeSearchQuery = "";
    let activeTypeFilter = "ALL";
    let activeSortOrder = "AZ";

    function getTranslated(key, fallback) {
        if (window.i18n && typeof window.i18n.t === "function") {
            const val = window.i18n.t(key);
            if (val && val !== key) return val;
        }
        return fallback;
    }

    function sortTools(items) {
        const sorted = [...items];
        sorted.sort((a, b) => {
            const titleA = getTranslated(a.titleKey, a.defaultTitle);
            const titleB = getTranslated(b.titleKey, b.defaultTitle);
            if (activeSortOrder === "ZA") {
                return titleB.localeCompare(titleA, undefined, { sensitivity: 'base', numeric: true });
            }
            return titleA.localeCompare(titleB, undefined, { sensitivity: 'base', numeric: true });
        });
        return sorted;
    }

    function escapeHtml(str) {
        return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function setupCollapsibleFilters() {
        const toggleHeader = document.getElementById("filtersToggleHeader");
        const toggleBtn = document.getElementById("btnToggleFilters");
        const container = document.getElementById("filtersCollapseContainer");
        const toggleText = document.getElementById("toggleFiltersBtnText");
        const clearAllBtn = document.getElementById("btnClearAllFilters");

        if (!container) return;

        if (clearAllBtn) {
            clearAllBtn.onclick = () => {
                activeTypeFilter = "ALL";
                activeSearchQuery = "";
                const searchInput = document.getElementById("dashboardSearchInput");
                if (searchInput) searchInput.value = "";

                renderActiveFilterChips();
                renderDashboardGrid();
            };
        }

        let isCollapsed = localStorage.getItem("dashboard_filters_collapsed") !== "false";

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
            localStorage.setItem("dashboard_filters_collapsed", isCollapsed ? "true" : "false");
            updateFilterPanelState();
        };

        if (toggleHeader) {
            toggleHeader.onclick = (e) => {
                if (e.target.closest("#btnToggleFilters")) return;
                toggle();
            };
        }
        if (toggleBtn) {
            toggleBtn.onclick = toggle;
        }
    }

    function updateActiveFiltersBadge(count = 0) {
        const badge = document.getElementById("activeFiltersBadge");
        if (!badge) return;

        if (count > 0) {
            badge.textContent = `${count} Active`;
            badge.style.display = "inline-block";
        } else {
            badge.style.display = "none";
        }
    }

    function renderActiveFilterChips() {
        const summaryRow = document.getElementById("activeFiltersSummaryRow");
        const container = document.getElementById("activeFilterChipsContainer");
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
                renderActiveFilterChips();
                renderDashboardGrid();
            };
            container.appendChild(chip);
        }

        if (activeSearchQuery) {
            activeCount++;
            const chip = document.createElement("span");
            chip.className = "active-chip";
            chip.innerHTML = `<span>Search: ${escapeHtml(activeSearchQuery)}</span><span class="chip-remove">✕</span>`;
            chip.querySelector(".chip-remove").onclick = () => {
                activeSearchQuery = "";
                const searchInput = document.getElementById("dashboardSearchInput");
                if (searchInput) searchInput.value = "";
                renderActiveFilterChips();
                renderDashboardGrid();
            };
            container.appendChild(chip);
        }

        updateActiveFiltersBadge(activeCount);

        if (activeCount > 0) {
            summaryRow.style.display = "flex";
        } else {
            summaryRow.style.display = "none";
        }
    }

    function renderDashboardGrid() {
        const grid = document.getElementById("toolsGrid") || document.getElementById("dashboardToolGrid");
        const noToolsMsg = document.getElementById("noDashboardToolsMsg");
        if (!grid) return;

        let filtered = toolsList.filter(item => {
            if (activeTypeFilter !== "ALL" && item.type !== activeTypeFilter) {
                return false;
            }

            if (activeSearchQuery) {
                const title = getTranslated(item.titleKey, item.defaultTitle).toLowerCase();
                const desc = getTranslated(item.descKey, item.defaultDesc).toLowerCase();
                const extra = (item.searchTerms || "").toLowerCase();
                const fullText = `${title} ${desc} ${extra}`;
                if (!fullText.includes(activeSearchQuery)) {
                    return false;
                }
            }

            return true;
        });

        filtered = sortTools(filtered);

        if (filtered.length === 0) {
            grid.innerHTML = "";
            if (noToolsMsg) noToolsMsg.style.display = "block";
            updateFilterBarPills();
            renderActiveFilterChips();
            return;
        }

        if (noToolsMsg) noToolsMsg.style.display = "none";
        grid.innerHTML = "";

        const toolTagText = getTranslated("home.tool_tag", "Tool");

        filtered.forEach(item => {
            const title = getTranslated(item.titleKey, item.defaultTitle);
            const desc = getTranslated(item.descKey, item.defaultDesc);

            const card = document.createElement("a");
            card.href = item.url;
            card.className = "tactile-card";
            card.setAttribute("data-tool-type", item.type);

            card.innerHTML = `
                <div class="tactile-card-placeholder" style="background: ${item.bgGradient};">
                    <span>${item.icon}</span>
                </div>
                <div class="tactile-card-overlay">
                    <div class="tactile-card-top">
                        <span class="tactile-card-tag">${escapeHtml(toolTagText)}</span>
                    </div>
                    <div class="tactile-card-bottom">
                        <h3 class="tactile-card-title">${escapeHtml(title)}</h3>
                        <p class="tactile-card-desc">${escapeHtml(desc)}</p>
                    </div>
                </div>
            `;

            grid.appendChild(card);
        });

        updateFilterBarPills();
        renderActiveFilterChips();
    }

    function updateFilterBarPills() {
        const bar = document.getElementById("typeFilterBar");
        if (!bar) return;

        const counts = { ALL: toolsList.length };
        toolsList.forEach(t => {
            counts[t.type] = (counts[t.type] || 0) + 1;
        });

        const pills = bar.querySelectorAll(".tag-filter-pill");
        pills.forEach(pill => {
            const type = pill.getAttribute("data-type") || "ALL";
            if (activeTypeFilter === type) {
                pill.classList.add("active");
            } else {
                pill.classList.remove("active");
            }

            const countEl = pill.querySelector(".pill-count");
            if (countEl) {
                countEl.textContent = counts[type] || 0;
            }
        });
    }

    function initDashboard() {
        const searchInput = document.getElementById("dashboardSearchInput");
        const sortSelect = document.getElementById("sortSelectDashboard") || document.getElementById("sortSelect");
        const filterBar = document.getElementById("dashboardTypeFilterBar") || document.getElementById("typeFilterBar");

        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                activeSearchQuery = e.target.value.toLowerCase().trim();
                renderActiveFilterChips();
                renderDashboardGrid();
            });
        }

        if (sortSelect) {
            sortSelect.addEventListener("change", (e) => {
                activeSortOrder = e.target.value;
                renderDashboardGrid();
            });
        }

        if (filterBar) {
            const pills = filterBar.querySelectorAll(".tag-filter-pill");
            pills.forEach(pill => {
                pill.addEventListener("click", () => {
                    activeTypeFilter = pill.getAttribute("data-type") || "ALL";
                    renderActiveFilterChips();
                    renderDashboardGrid();
                });
            });
        }

        setupCollapsibleFilters();
        renderDashboardGrid();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initDashboard);
    } else {
        initDashboard();
    }
    document.addEventListener("i18n-ready", () => {
        setupCollapsibleFilters();
        renderDashboardGrid();
    });
})();
