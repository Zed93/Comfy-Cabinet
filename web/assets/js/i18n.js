(function () {
    // Check if loaded by ComfyUI's extension loader (which won't set data-lang-path)
    const currentScript = document.currentScript;
    if (!currentScript || !currentScript.hasAttribute('data-lang-path')) {
        return;
    }

    // Add loading class immediately
    document.documentElement.classList.add('i18n-loading');
    const style = document.createElement('style');
    style.innerHTML = `
        html.i18n-loading { opacity: 0; }
        html { transition: opacity 0.15s ease-in-out; }
    `;

    try {
        const head = document.head || document.getElementsByTagName('head')[0];
        if (head) {
            head.appendChild(style);
        } else {
            document.documentElement.appendChild(style);
        }
    } catch (e) {
        console.error("Failed to append styles:", e);
    }

    // Get configuration
    const langPath = currentScript.getAttribute('data-lang-path');

    // Detect language
    let lang = 'en';
    try {
        lang = localStorage.getItem('comfy-cabinet-lang');
        if (!lang) {
            const browserLang = (navigator.language || navigator.userLanguage || 'en').substring(0, 2).toLowerCase();
            lang = browserLang === 'it' ? 'it' : 'en';
        }
    } catch (e) {
        console.warn("Failed to access localStorage, defaulting to 'en':", e);
        lang = 'en';
    }

    let translations = {};

    window.i18n = {
        lang: lang,
        ready: false,
        t: function (key, defaultValue = "") {
            if (!key || typeof key !== 'string') return defaultValue || "";
            const keys = key.split('.');
            let current = translations;
            for (const k of keys) {
                if (current && current[k] !== undefined) {
                    current = current[k];
                } else {
                    return defaultValue || key;
                }
            }
            return current;
        }
    };

    async function init() {
        try {
            const response = await fetch(`${langPath}${lang}.json`);
            if (response.ok) {
                translations = await response.json();
            } else {
                console.error(`Failed to load translation for lang: ${lang}`);
            }
        } catch (e) {
            console.error("Failed to fetch translation:", e);
        } finally {
            // ALWAYS remove loading class first
            try {
                document.documentElement.classList.remove('i18n-loading');
            } catch (e) {
                console.error(e);
            }

            try {
                // Apply translations to DOM
                applyTranslations();
                // Bind language selector elements
                bindLanguageSelector();
            } catch (e) {
                console.error("Error applying translations:", e);
            }

            // Mark ready and dispatch event
            window.i18n.ready = true;
            try {
                document.dispatchEvent(new CustomEvent('i18n-ready'));
            } catch (e) {
                console.error(e);
            }
        }
    }

    function applyTranslations() {
        // Set lang attribute on html tag
        document.documentElement.setAttribute('lang', lang);

        // Translate textContent
        document.querySelectorAll('[data-i18n]').forEach(el => {
            try {
                const key = el.getAttribute('data-i18n');
                const trans = window.i18n.t(key);
                if (trans && trans !== key) {
                    el.textContent = trans;
                }
            } catch (e) {
                console.error("Error translating element:", el, e);
            }
        });

        // Translate placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            try {
                const key = el.getAttribute('data-i18n-placeholder');
                const trans = window.i18n.t(key);
                if (trans && trans !== key) {
                    el.placeholder = trans;
                }
            } catch (e) {
                console.error("Error translating placeholder:", el, e);
            }
        });

        // Translate titles
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            try {
                const key = el.getAttribute('data-i18n-title');
                const trans = window.i18n.t(key);
                if (trans && trans !== key) {
                    el.title = trans;
                }
            } catch (e) {
                console.error("Error translating title:", el, e);
            }
        });
    }

    function bindLanguageSelector() {
        // Sync <select id="langSelect"> if present in settings modal
        const selectEls = document.querySelectorAll('#langSelect, .lang-select-dropdown');
        selectEls.forEach(selectEl => {
            selectEl.value = lang;
            selectEl.addEventListener('change', (e) => {
                setLanguage(e.target.value);
            });
        });

        // Sync container if present
        const container = document.getElementById('lang-selector-container');
        if (container && !container.hasChildNodes()) {
            const select = document.createElement('select');
            select.id = 'langSelect';
            select.className = 'lang-select-dropdown';
            select.innerHTML = `
                <option value="en" ${lang === 'en' ? 'selected' : ''}>🇬🇧 English (EN)</option>
                <option value="it" ${lang === 'it' ? 'selected' : ''}>🇮🇹 Italiano (IT)</option>
            `;
            select.addEventListener('change', (e) => setLanguage(e.target.value));
            container.appendChild(select);
        }
    }

    function setLanguage(newLang) {
        if (newLang === lang) return;
        try {
            localStorage.setItem('comfy-cabinet-lang', newLang);
        } catch (e) {
            console.warn("Failed to save language choice in localStorage:", e);
        }
        window.location.reload();
    }

    window.setLanguage = setLanguage;

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
