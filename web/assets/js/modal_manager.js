(function () {
    window.ComfyCabinetSettings = {
        getCloseModalOnClickOutside() {
            try {
                return localStorage.getItem('comfy-cabinet-backdrop-close') === 'true';
            } catch (e) {
                return false;
            }
        },
        setCloseModalOnClickOutside(enabled) {
            const valStr = enabled ? 'true' : 'false';
            try {
                localStorage.setItem('comfy-cabinet-backdrop-close', valStr);
            } catch (e) { }

            // Mirror to backend global settings if available
            fetch('/smart_config/save_globals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ close_modal_on_click_outside: valStr })
            }).catch(() => { });

            fetch('/easy_lora_config/save_globals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ close_modal_on_click_outside: valStr })
            }).catch(() => { });

            document.dispatchEvent(new CustomEvent('comfy-cabinet-settings-changed', {
                detail: { closeModalOnClickOutside: enabled }
            }));
        }
    };

    // Universal backdrop click listener for all modals across all tools
    document.addEventListener("click", function (e) {
        if (!window.ComfyCabinetSettings.getCloseModalOnClickOutside()) return;

        const target = e.target;
        if (!target) return;

        if (target.classList && (target.classList.contains("modal-overlay") || target.classList.contains("detail-modal-overlay"))) {
            target.style.display = "none";
        }
    });
})();
