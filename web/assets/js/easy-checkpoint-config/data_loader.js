let rawCheckpoints = [], rawSamplers = [], rawSchedulers = [];
const currentSelection = { checkpoint: "", sampler_name: "", scheduler: "" };
let settingsForm, fields;

function autoResizeTextarea(el) { 
    if (!el) return;
    el.style.height = 'auto'; 
    el.style.height = el.scrollHeight + 'px'; 
}

document.addEventListener("DOMContentLoaded", () => {
    const initLoader = () => {
        settingsForm = document.getElementById('settingsForm');
        fields = {
            steps: document.getElementById('steps'), cfg: document.getElementById('cfg'),
            prefix_prompt: document.getElementById('prefixPrompt'), suffix_prompt: document.getElementById('suffixPrompt')
        };

        ['prefixPrompt', 'suffixPrompt'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', function() { autoResizeTextarea(this); });
        });

        const saveBtn = document.getElementById('saveModelBtn');
        if (saveBtn) saveBtn.addEventListener('click', saveModelSettings);

        loadResources();
    };

    if (window.i18n && window.i18n.ready) {
        initLoader();
    } else {
        document.addEventListener("i18n-ready", initLoader);
    }
});

async function loadResources() {
    try {
        const response = await fetch('/smart_config/get_resources');
        const data = await response.json();
        rawCheckpoints = data.checkpoints; rawSamplers = data.samplers; rawSchedulers = data.schedulers;

        createDropdownComponent("checkpointTrigger", "checkpointPanel", "checkpointSearch", "checkpointList", rawCheckpoints, loadCheckpointSettings);
        createDropdownComponent("samplerTrigger", "samplerPanel", "samplerSearch", "samplerList", rawSamplers, (val) => currentSelection.sampler_name = val);
        createDropdownComponent("schedulerTrigger", "schedulerPanel", "schedulerSearch", "schedulerList", rawSchedulers, (val) => currentSelection.scheduler = val);
    } catch (err) { console.error(err); }
}

async function loadCheckpointSettings(checkpointName) {
    currentSelection.checkpoint = checkpointName;
    try {
        const response = await fetch(`/smart_config/get_settings?checkpoint=${encodeURIComponent(checkpointName)}`);
        const config = await response.json();
        
        fields.steps.value = config.steps; fields.cfg.value = config.cfg;
        fields.prefix_prompt.value = config.prefix_prompt; fields.suffix_prompt.value = config.suffix_prompt;
        
        document.getElementById("samplerTrigger").textContent = config.sampler_name; currentSelection.sampler_name = config.sampler_name;
        document.getElementById("schedulerTrigger").textContent = config.scheduler; currentSelection.scheduler = config.scheduler;
        
        autoResizeTextarea(fields.prefix_prompt); autoResizeTextarea(fields.suffix_prompt);
        if (settingsForm) settingsForm.classList.remove('disabled-form');
        const msg = (window.i18n && window.i18n.t) ? window.i18n.t("status.preset_loaded") : "Preset modello caricato!";
        showStatus("modelStatus", msg, "var(--accent)");
    } catch (err) { console.error(err); }
}

async function saveModelSettings() {
    if (!currentSelection.checkpoint) return;
    const payload = {
        checkpoint: currentSelection.checkpoint, steps: fields.steps.value, cfg: fields.cfg.value,
        sampler_name: currentSelection.sampler_name, scheduler: currentSelection.scheduler,
        prefix_prompt: fields.prefix_prompt.value, suffix_prompt: fields.suffix_prompt.value
    };
    try {
        const r = await fetch('/smart_config/save_settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (r.ok) {
            const msg = (window.i18n && window.i18n.t) ? window.i18n.t("status.save_success") : "Impostazioni salvate con successo! ✅";
            showStatus("modelStatus", msg, "var(--success)");
        }
    } catch (err) {
        const msg = (window.i18n && window.i18n.t) ? window.i18n.t("status.save_error") : "Errore nel salvataggio ❌";
        showStatus("modelStatus", msg, "var(--error)");
    }
}

function showStatus(id, msg, color) {
    const el = document.getElementById(id); if (!el) return;
    el.textContent = msg; el.style.color = color;
    setTimeout(() => el.textContent = "", 4000);
}