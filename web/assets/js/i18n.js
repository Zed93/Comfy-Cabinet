(function () {
    // Add loading class immediately
    document.documentElement.classList.add('i18n-loading');
    const style = document.createElement('style');
    style.innerHTML = `
        html.i18n-loading { opacity: 0; }
        html { transition: opacity 0.15s ease-in-out; }
        
        /* Language Selector Styles */
        .lang-selector {
            position: fixed;
            top: 16px;
            right: 16px;
            display: flex;
            gap: 4px;
            background-color: var(--bg-card, #1e293b);
            border: 1px solid var(--border-color, #334155);
            padding: 4px;
            border-radius: 20px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            z-index: 1000;
        }
        .lang-btn {
            background: none;
            border: none;
            color: var(--text-muted, #94a3b8);
            font-size: 0.75rem;
            font-weight: 700;
            padding: 6px 10px;
            border-radius: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .lang-btn.active {
            background-color: var(--accent, #6366f1);
            color: #ffffff;
        }
        .lang-btn:hover:not(.active) {
            color: var(--text-main, #f8fafc);
            background-color: rgba(255, 255, 255, 0.05);
        }
        
        /* Adjust page header layout if needed */
        @media (max-width: 600px) {
            .lang-selector {
                position: static;
                margin: 0 auto 16px auto;
                width: max-content;
            }
        }
    `;
    document.head.appendChild(style);

    // Get configuration
    const currentScript = document.currentScript;
    const langPath = currentScript ? currentScript.getAttribute('data-lang-path') : 'lang/';

    // Detect language
    let lang = localStorage.getItem('comfy-cabinet-lang');
    if (!lang) {
        const browserLang = (navigator.language || navigator.userLanguage || 'en').substring(0, 2).toLowerCase();
        lang = browserLang === 'it' ? 'it' : 'en';
    }

    let translations = {};

    window.i18n = {
        lang: lang,
        ready: false,
        t: function (key, defaultValue = "") {
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
            console.error(e);
        } finally {
            // Apply translations to DOM
            applyTranslations();
            // Inject language selector
            injectLanguageSelector();
            // Mark ready
            window.i18n.ready = true;
            // Remove loading class
            document.documentElement.classList.remove('i18n-loading');
            // Dispatch event for other scripts
            document.dispatchEvent(new CustomEvent('i18n-ready'));
        }
    }

    function applyTranslations() {
        // Set lang attribute on html tag
        document.documentElement.setAttribute('lang', lang);

        // Translate textContent
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const trans = window.i18n.t(key);
            if (trans && trans !== key) {
                el.textContent = trans;
            }
        });

        // Translate placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const trans = window.i18n.t(key);
            if (trans && trans !== key) {
                el.placeholder = trans;
            }
        });

        // Translate titles
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            const trans = window.i18n.t(key);
            if (trans && trans !== key) {
                el.title = trans;
            }
        });
    }

    function injectLanguageSelector() {
        // Don't inject if selector already exists
        if (document.querySelector('.lang-selector')) return;

        const selector = document.createElement('div');
        selector.className = 'lang-selector';

        const btnEn = document.createElement('button');
        btnEn.className = 'lang-btn' + (lang === 'en' ? ' active' : '');
        btnEn.textContent = 'EN';
        btnEn.addEventListener('click', () => setLanguage('en'));

        const btnIt = document.createElement('button');
        btnIt.className = 'lang-btn' + (lang === 'it' ? ' active' : '');
        btnIt.textContent = 'IT';
        btnIt.addEventListener('click', () => setLanguage('it'));

        selector.appendChild(btnEn);
        selector.appendChild(btnIt);

        // Append to container if it exists, otherwise to body
        const container = document.querySelector('.container') || document.body;
        // Let's append to body directly so fixed position works well relative to viewport
        document.body.appendChild(selector);
    }

    function setLanguage(newLang) {
        if (newLang === lang) return;
        localStorage.setItem('comfy-cabinet-lang', newLang);
        window.location.reload();
    }

    // Initialize when DOM is ready or run immediately if head is parsed
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
