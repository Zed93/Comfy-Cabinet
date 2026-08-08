let rawSamplers = [], rawSchedulers = [];
const currentSelection = { gSampler: "", gScheduler: "" };
let fields;

document.addEventListener("DOMContentLoaded", () => {
    const initSettings = () => {
        fields = {
            gSteps: document.getElementById('globalSteps'), gCfg: document.getElementById('globalCfg'),
            gClipSkip: document.getElementById('globalClipSkip'),
            separator: document.getElementById('promptSeparator')
        };

        const saveGlobalBtn = document.getElementById('saveGlobalBtn');
        if (saveGlobalBtn) saveGlobalBtn.addEventListener('click', saveGlobalSettings);

        const openModalBtn = document.getElementById("openSettingsModal");
        const closeModalBtn = document.getElementById("closeSettingsModal");
        const settingsModal = document.getElementById("settingsModal");

        if (openModalBtn && settingsModal) {
            openModalBtn.addEventListener("click", () => {
                settingsModal.style.display = "flex";
            });
        }

        if (closeModalBtn && settingsModal) {
            closeModalBtn.addEventListener("click", () => {
                settingsModal.style.display = "none";
            });
        }

        loadGlobalResources();
    };

    if (window.i18n && window.i18n.ready) {
        initSettings();
    } else {
        document.addEventListener("i18n-ready", initSettings);
    }
});

async function loadGlobalResources() {
    try {
        const response = await fetch('/smart_config/get_resources');
        const data = await response.json();
        rawSamplers = data.samplers; rawSchedulers = data.schedulers;
        
        createDropdownComponent("gSamplerTrigger", "gSamplerPanel", "gSamplerSearch", "gSamplerList", rawSamplers, (val) => currentSelection.gSampler = val);
        createDropdownComponent("gSchedulerTrigger", "gSchedulerPanel", "gSchedulerSearch", "gSchedulerList", rawSchedulers, (val) => currentSelection.gScheduler = val);

        fields.gSteps.value = data.global_configs.default_steps;
        fields.gCfg.value = data.global_configs.default_cfg;
        fields.gClipSkip.value = data.global_configs.default_clip_skip || -1;
        fields.separator.value = data.global_configs.prompt_separator;
        
        const closeOutsideCb = document.getElementById("gCloseOutsideCheckbox");
        if (closeOutsideCb) {
            const isCloseVal = data.global_configs.close_modal_on_click_outside ?? window.ComfyCabinetSettings.getCloseModalOnClickOutside();
            closeOutsideCb.checked = (isCloseVal === "true" || isCloseVal === true);
        }

        document.getElementById("gSamplerTrigger").textContent = data.global_configs.default_sampler; currentSelection.gSampler = data.global_configs.default_sampler;
        document.getElementById("gSchedulerTrigger").textContent = data.global_configs.default_scheduler; currentSelection.gScheduler = data.global_configs.default_scheduler;
    } catch (err) { console.error(err); }
}

async function saveGlobalSettings() {
    const closeOutsideCb = document.getElementById("gCloseOutsideCheckbox");
    if (closeOutsideCb && window.ComfyCabinetSettings) {
        window.ComfyCabinetSettings.setCloseModalOnClickOutside(closeOutsideCb.checked);
    }
    const payload = {
        default_steps: fields.gSteps.value, default_cfg: fields.gCfg.value, default_clip_skip: fields.gClipSkip.value,
        default_sampler: currentSelection.gSampler, default_scheduler: currentSelection.gScheduler,
        prompt_separator: fields.separator.value,
        close_modal_on_click_outside: closeOutsideCb ? String(closeOutsideCb.checked) : "false"
    };
    try {
        const r = await fetch('/smart_config/save_globals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (r.ok) {
            const msg = (window.i18n && window.i18n.t) ? window.i18n.t("status.global_save_success") : "Impostazioni generali aggiornate! ✅";
            const el = document.getElementById("globalStatus");
            if (el) {
                el.textContent = msg; el.style.color = "var(--success)";
                setTimeout(() => el.textContent = "", 4000);
            }
            if (window.Toast) window.Toast.success(msg);
            const modal = document.getElementById("settingsModal");
            if (modal) {
                setTimeout(() => { modal.style.display = "none"; }, 500);
            }
        } else {
            const msg = (window.i18n && window.i18n.t) ? window.i18n.t("status.global_save_error") : "Errore nel salvataggio ❌";
            const el = document.getElementById("globalStatus");
            if (el) {
                el.textContent = msg; el.style.color = "var(--error)";
                setTimeout(() => el.textContent = "", 4000);
            }
            if (window.Toast) window.Toast.error(msg);
        }
    } catch (err) {
        console.error(err);
        const msg = (window.i18n && window.i18n.t) ? window.i18n.t("status.global_save_error") : "Errore nel salvataggio ❌";
        const el = document.getElementById("globalStatus");
        if (el) {
            el.textContent = msg; el.style.color = "var(--error)";
            setTimeout(() => el.textContent = "", 4000);
        }
        if (window.Toast) window.Toast.error(msg);
    }
}