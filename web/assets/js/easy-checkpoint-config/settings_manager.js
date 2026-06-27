let rawSamplers = [], rawSchedulers = [];
const currentSelection = { gSampler: "", gScheduler: "" };
let fields;

document.addEventListener("DOMContentLoaded", () => {
    const initSettings = () => {
        fields = {
            gSteps: document.getElementById('globalSteps'), gCfg: document.getElementById('globalCfg'),
            separator: document.getElementById('promptSeparator')
        };

        const saveGlobalBtn = document.getElementById('saveGlobalBtn');
        if (saveGlobalBtn) saveGlobalBtn.addEventListener('click', saveGlobalSettings);

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
        fields.separator.value = data.global_configs.prompt_separator;
        
        document.getElementById("gSamplerTrigger").textContent = data.global_configs.default_sampler; currentSelection.gSampler = data.global_configs.default_sampler;
        document.getElementById("gSchedulerTrigger").textContent = data.global_configs.default_scheduler; currentSelection.gScheduler = data.global_configs.default_scheduler;
    } catch (err) { console.error(err); }
}

async function saveGlobalSettings() {
    const payload = {
        default_steps: fields.gSteps.value, default_cfg: fields.gCfg.value,
        default_sampler: currentSelection.gSampler, default_scheduler: currentSelection.gScheduler,
        prompt_separator: fields.separator.value
    };
    try {
        const r = await fetch('/smart_config/save_globals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (r.ok) {
            const el = document.getElementById("globalStatus");
            if (el) {
                const msg = (window.i18n && window.i18n.t) ? window.i18n.t("status.global_save_success") : "Impostazioni generali aggiornate! ✅";
                el.textContent = msg; el.style.color = "var(--success)";
                setTimeout(() => el.textContent = "", 4000);
            }
        }
    } catch (err) {
        console.error(err);
        const el = document.getElementById("globalStatus");
        if (el) {
            const msg = (window.i18n && window.i18n.t) ? window.i18n.t("status.global_save_error") : "Errore nel salvataggio ❌";
            el.textContent = msg; el.style.color = "var(--error)";
            setTimeout(() => el.textContent = "", 4000);
        }
    }
}