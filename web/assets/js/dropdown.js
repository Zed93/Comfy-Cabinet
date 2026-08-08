function createDropdownComponent(triggerId, panelId, searchId, listId, dataList, onSelectCallback) {
    const trigger = document.getElementById(triggerId);
    const panel = document.getElementById(panelId);
    const searchInput = document.getElementById(searchId);
    const itemsList = document.getElementById(listId);

    if (!trigger || !panel || !searchInput || !itemsList) return;

    trigger.setAttribute("role", "combobox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", listId);
    trigger.setAttribute("tabindex", "0");
    itemsList.setAttribute("role", "listbox");

    let activeIndex = -1;
    let currentFiltered = [];

    function updateActiveItem(items) {
        items.forEach((itemEl, idx) => {
            if (idx === activeIndex) {
                itemEl.classList.add("active-item");
                itemEl.setAttribute("aria-selected", "true");
                itemEl.scrollIntoView({ block: "nearest" });
            } else {
                itemEl.classList.remove("active-item");
                itemEl.setAttribute("aria-selected", "false");
            }
        });
    }

    function renderItems(filterText = "") {
        itemsList.innerHTML = "";
        activeIndex = -1;
        currentFiltered = dataList.filter(item => item.toLowerCase().includes(filterText.toLowerCase()));
        
        if (currentFiltered.length === 0) {
            const noResultsText = (window.i18n && window.i18n.t) ? window.i18n.t("dropdown.no_results") : "Nessun abbinamento";
            itemsList.innerHTML = `<div class="dropdown-item no-results" role="option">${noResultsText}</div>`;
            return;
        }

        currentFiltered.forEach((item, index) => {
            const div = document.createElement("div");
            div.className = "dropdown-item";
            div.setAttribute("role", "option");
            div.setAttribute("data-index", index);
            div.textContent = item;

            div.addEventListener("click", () => {
                selectItem(item);
            });
            itemsList.appendChild(div);
        });
    }

    function selectItem(item) {
        trigger.textContent = item;
        closePanel();
        onSelectCallback(item);
    }

    function openPanel() {
        document.querySelectorAll('.dropdown-panel').forEach(p => {
            if (p !== panel) p.style.display = 'none';
        });
        panel.style.display = "block";
        trigger.setAttribute("aria-expanded", "true");
        searchInput.value = "";
        renderItems("");
        searchInput.focus();
    }

    function closePanel() {
        panel.style.display = "none";
        trigger.setAttribute("aria-expanded", "false");
    }

    trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        const isVisible = panel.style.display === "block";
        if (isVisible) closePanel();
        else openPanel();
    });

    trigger.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
            e.preventDefault();
            openPanel();
        }
    });

    searchInput.addEventListener("input", () => renderItems(searchInput.value));

    panel.addEventListener("keydown", (e) => {
        const itemEls = itemsList.querySelectorAll(".dropdown-item:not(.no-results)");
        if (!itemEls.length) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            activeIndex = (activeIndex + 1) % itemEls.length;
            updateActiveItem(itemEls);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            activeIndex = (activeIndex - 1 + itemEls.length) % itemEls.length;
            updateActiveItem(itemEls);
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (activeIndex >= 0 && activeIndex < currentFiltered.length) {
                selectItem(currentFiltered[activeIndex]);
            }
        } else if (e.key === "Escape") {
            e.preventDefault();
            closePanel();
            trigger.focus();
        }
    });
}

document.addEventListener("click", () => {
    document.querySelectorAll('.dropdown-panel').forEach(p => {
        p.style.display = 'none';
        const comboboxes = document.querySelectorAll('[role="combobox"]');
        comboboxes.forEach(cb => cb.setAttribute("aria-expanded", "false"));
    });
});