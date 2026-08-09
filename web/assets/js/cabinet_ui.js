(function () {
    const htmlElement = document.documentElement;
    const systemPrefQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // --- Theme Logic ---
    function applyThemePreference(pref) {
        if (pref === 'system') {
            const systemDark = systemPrefQuery.matches;
            htmlElement.setAttribute('data-theme', systemDark ? 'dark' : 'light');
        } else {
            htmlElement.setAttribute('data-theme', pref);
        }
        updateTriSwitchUI(pref);
    }

    function getThemePreference() {
        return localStorage.getItem('comfy-cabinet-theme-pref') || 'system';
    }

    window.setThemePreference = function (pref) {
        localStorage.setItem('comfy-cabinet-theme-pref', pref);
        applyThemePreference(pref);
    };

    function updateTriSwitchUI(pref) {
        document.querySelectorAll('.tri-option').forEach(opt => {
            if (opt.getAttribute('data-value') === pref) {
                opt.classList.add('active');
            } else {
                opt.classList.remove('active');
            }
        });
    }

    systemPrefQuery.addEventListener('change', () => {
        if (getThemePreference() === 'system') {
            applyThemePreference('system');
        }
    });

    // --- Accent Color Logic ---
    function getAccentColor() {
        return localStorage.getItem('comfy-cabinet-color') || 'vermillion';
    }

    window.setAccentColor = function (colorStr) {
        htmlElement.setAttribute('data-color', colorStr);
        localStorage.setItem('comfy-cabinet-color', colorStr);
        updateSwatchUI(colorStr);
    };

    function updateSwatchUI(activeColor) {
        document.querySelectorAll('.color-swatch, .color-swatch-card').forEach(swatch => {
            if (swatch.getAttribute('data-color-val') === activeColor) {
                swatch.classList.add('active');
            } else {
                swatch.classList.remove('active');
            }
        });
    }

    function updateLangSwitchUI(lang) {
        document.querySelectorAll('#langSwitch .tri-option').forEach(opt => {
            if (opt.getAttribute('data-lang-val') === lang) {
                opt.classList.add('active');
            } else {
                opt.classList.remove('active');
            }
        });
    }

    // --- Backdrop Click Close Logic ---
    function getBackdropClosePref() {
        return localStorage.getItem('comfy-cabinet-backdrop-close') === 'true';
    }

    window.toggleBackdropClose = function (checkbox) {
        const enabled = checkbox.checked;
        localStorage.setItem('comfy-cabinet-backdrop-close', enabled ? 'true' : 'false');
        if (window.ComfyCabinetSettings && window.ComfyCabinetSettings.setCloseModalOnClickOutside) {
            window.ComfyCabinetSettings.setCloseModalOnClickOutside(enabled);
        }
    };

    // --- Civitai Settings Logic ---
    let cachedCivitaiApiKey = "";

    function getCivitaiDomainMode() {
        return localStorage.getItem('comfy-cabinet-civitai-domain') || 'civitai.com';
    }

    window.setCivitaiDomainMode = function (domain) {
        localStorage.setItem('comfy-cabinet-civitai-domain', domain);
        updateCivitaiDomainUI(domain);
        
        fetch('/easy_lora_config/save_globals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain_mode: domain })
        }).catch(() => {});
    };

    function updateCivitaiDomainUI(domain) {
        document.querySelectorAll('.civitai-domain-btn').forEach(btn => {
            if (btn.getAttribute('data-domain') === domain) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    window.saveCivitaiApiKey = function (key) {
        if (key.startsWith('••••')) return; // Don't save masked keys back
        cachedCivitaiApiKey = key;
        localStorage.setItem('comfy-cabinet-civitai-api-key', key);
        fetch('/easy_lora_config/save_globals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ civitai_api_key: key })
        }).catch(() => {});
    };

    async function loadGlobalCivitaiSettings() {
        try {
            const resp = await fetch('/easy_lora_config/get_resources');
            if (resp.ok) {
                const data = await resp.json();
                const globals = data.global_configs || {};

                if (globals.domain_mode) {
                    window.setCivitaiDomainMode(globals.domain_mode);
                }

                if (globals.civitai_api_key) {
                    cachedCivitaiApiKey = globals.civitai_api_key;
                    const apiKeyInput = document.getElementById('civitaiApiKeyInput');
                    if (apiKeyInput) {
                        apiKeyInput.value = globals.civitai_api_key;
                    }
                }
            }
        } catch (e) {
            // Fallback to local storage if endpoint unavailable
            const savedKey = localStorage.getItem('comfy-cabinet-civitai-api-key');
            if (savedKey) {
                cachedCivitaiApiKey = savedKey;
                const apiKeyInput = document.getElementById('civitaiApiKeyInput');
                if (apiKeyInput && !apiKeyInput.value) {
                    apiKeyInput.value = savedKey;
                }
            }
        }
    }

    window.testCivitaiConnection = async function () {
        if (window.Toast) window.Toast.info('Testing connection to CivitAI...');

        const domain = getCivitaiDomainMode();
        const apiKeyInput = document.getElementById('civitaiApiKeyInput');
        const apiKey = (apiKeyInput && apiKeyInput.value) ? apiKeyInput.value.trim() : cachedCivitaiApiKey;

        try {
            const resp = await fetch('/easy_lora_config/test_civitai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain: domain, api_key: apiKey })
            });

            if (resp.ok) {
                const data = await resp.json();
                if (data.status === 'ok' || data.success || data.ok) {
                    if (window.Toast) window.Toast.success('Connected successfully to CivitAI!');
                } else {
                    if (window.Toast) window.Toast.error(`Connection issue: ${data.message || 'Unknown error'}`);
                }
            } else {
                if (window.Toast) window.Toast.error(`Test request failed with status ${resp.status}`);
            }
        } catch (err) {
            if (window.Toast) window.Toast.error(`Network Error: ${err.message}`);
        }
    };

    // --- Modal Helpers ---
    window.openCabinetModal = function (id) {
        const dialog = document.getElementById(id);
        if (dialog) {
            if (typeof dialog.showModal === 'function') {
                dialog.showModal();
            } else {
                dialog.style.display = 'flex';
            }
        }
    };

    window.closeCabinetModal = function (id) {
        const dialog = document.getElementById(id);
        if (dialog) {
            if (typeof dialog.close === 'function') {
                dialog.close();
            } else {
                dialog.style.display = 'none';
            }
        }
    };

    // --- DOM Init ---
    document.addEventListener('DOMContentLoaded', () => {
        // Init theme & accent color
        const savedTheme = getThemePreference();
        applyThemePreference(savedTheme);

        const savedColor = getAccentColor();
        htmlElement.setAttribute('data-color', savedColor);
        updateSwatchUI(savedColor);

        // Init language switch active state
        const savedLang = localStorage.getItem('comfy-cabinet-lang') || 'en';
        updateLangSwitchUI(savedLang);

        // Init backdrop toggle
        const backdropCheckbox = document.getElementById('backdrop-toggle');
        if (backdropCheckbox) {
            backdropCheckbox.checked = getBackdropClosePref();
        }

        // Init Civitai settings from backend
        loadGlobalCivitaiSettings();

        const apiKeyInput = document.getElementById('civitaiApiKeyInput');
        if (apiKeyInput) {
            apiKeyInput.addEventListener('change', () => {
                const val = apiKeyInput.value.trim();
                if (val && !val.startsWith('••••')) {
                    window.saveCivitaiApiKey(val);
                }
            });
        }

        // Mobile menu toggle
        const mobileToggleBtn = document.getElementById('mobile-menu-toggle');
        const navMenu = document.getElementById('nav-menu');
        if (mobileToggleBtn && navMenu) {
            mobileToggleBtn.addEventListener('click', () => {
                navMenu.classList.toggle('dropdown-open');
            });
        }

        // Setup backdrop click listeners on dialogs
        const dialogs = document.querySelectorAll('dialog.custom-modal, .detail-modal-overlay');
        dialogs.forEach(dialog => {
            dialog.addEventListener('click', (event) => {
                if (getBackdropClosePref()) {
                    if (dialog.tagName.toLowerCase() === 'dialog') {
                        const rect = dialog.getBoundingClientRect();
                        const isInDialog = (
                            rect.top <= event.clientY &&
                            event.clientY <= rect.bottom &&
                            rect.left <= event.clientX &&
                            event.clientX <= rect.right
                        );
                        if (!isInDialog) {
                            dialog.close();
                        }
                    } else if (event.target === dialog) {
                        dialog.style.display = 'none';
                    }
                }
            });
        });

        // Highlight active nav item
        const currentPath = window.location.pathname;
        const navItems = document.querySelectorAll('.nav-links .nav-item');
        navItems.forEach(item => {
            const pageTarget = item.getAttribute('data-page');
            if (pageTarget) {
                if (
                    (pageTarget === 'home' && (currentPath.endsWith('/index.html') && !currentPath.includes('/tools/'))) ||
                    (pageTarget === 'checkpoint' && currentPath.includes('easy-checkpoint-config')) ||
                    (pageTarget === 'lora' && currentPath.includes('lora-config')) ||
                    (pageTarget === 'prompt' && currentPath.includes('prompt-builder'))
                ) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            }
        });
    });
})();
