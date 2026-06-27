function createDropdownComponent(triggerId, panelId, searchId, listId, dataList, onSelectCallback) {
    const trigger = document.getElementById(triggerId);
    const panel = document.getElementById(panelId);
    const searchInput = document.getElementById(searchId);
    const itemsList = document.getElementById(listId);

    function renderItems(filterText = "") {
        itemsList.innerHTML = "";
        const filtered = dataList.filter(item => item.toLowerCase().includes(filterText.toLowerCase()));
        if (filtered.length === 0) {
            const noResultsText = (window.i18n && window.i18n.t) ? window.i18n.t("dropdown.no_results") : "Nessun abbinamento";
            itemsList.innerHTML = `<div class="dropdown-item no-results">${noResultsText}</div>`;
            return;
        }
        filtered.forEach(item => {
            const div = document.createElement("div"); div.className = "dropdown-item"; div.textContent = item;
            div.addEventListener("click", () => { 
                trigger.textContent = item; 
                panel.style.display = "none"; 
                onSelectCallback(item); 
            });
            itemsList.appendChild(div);
        });
    }
    
    trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll('.dropdown-panel').forEach(p => { if (p !== panel) p.style.display = 'none'; });
        const isVisible = panel.style.display === "block";
        panel.style.display = isVisible ? "none" : "block";
        if (!isVisible) { searchInput.value = ""; renderItems(""); searchInput.focus(); }
    });
    searchInput.addEventListener("input", () => renderItems(searchInput.value));
}

document.addEventListener("click", () => {
    document.querySelectorAll('.dropdown-panel').forEach(p => p.style.display = 'none');
});