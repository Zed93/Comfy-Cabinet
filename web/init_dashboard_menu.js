const comfyApp = window.comfyAPI?.app?.app || window.app;

if (comfyApp) {
    comfyApp.registerExtension({
        name: "ComfyCabinet.EasyCheckpointConfig.Menu",
        async setup() {
            const MAX_ATTEMPTS = 120;
            const BUTTON_GROUP_CLASS = "easy-config-top-menu-group";
            
            const attachButton = () => {
                if (document.querySelector(`.${BUTTON_GROUP_CLASS}`)) return true;
                const settingsGroup = comfyApp.menu?.settingsGroup;
                if (!settingsGroup?.element?.parentElement) return false;

                try {
                    const buttonGroup = document.createElement("div");
                    buttonGroup.className = `comfyui-button-group ${BUTTON_GROUP_CLASS}`;
                    buttonGroup.style.display = "inline-flex";
                    buttonGroup.style.marginLeft = "4px";
                    buttonGroup.style.marginRight = "4px";

                    const btn = document.createElement("button");
                    btn.className = "comfyui-button comfyui-menu-mobile-collapse primary";
                    btn.type = "button";
                    btn.title = "🗄️ Apri Comfy Cabinet";
                    btn.style.cursor = "pointer";
                    btn.style.display = "flex";
                    btn.style.alignItems = "center";
                    btn.style.justifyContent = "center";
                    btn.style.backgroundColor = "#4f46e5"; 
                    btn.style.color = "#ffffff";
                    btn.style.border = "none";
                    btn.style.padding = "0 12px";
                    btn.style.height = "100%";
                    btn.style.borderRadius = "4px";
                    btn.style.fontWeight = "bold";

                    btn.innerHTML = `<span style="font-size: 14px;">🗄️ Easy Config</span>`;
                    const getBasePath = () => {
                        try {
                            const url = new URL(import.meta.url);
                            const parts = url.pathname.split('/');
                            parts.pop();
                            return parts.join('/') + '/';
                        } catch (err) {
                            return "/extensions/Comfy-Cabinet/";
                        }
                    };

                    btn.addEventListener("click", () => {
                        const basePath = getBasePath();
                        window.open(`${window.location.origin}${basePath}index.html`, "_blank");
                    });

                    buttonGroup.appendChild(btn);
                    settingsGroup.element.before(buttonGroup);
                    return true;
                } catch (err) { return false; }
            };

            let attempts = 0;
            const tryAttach = () => {
                if (!attachButton() && attempts < MAX_ATTEMPTS) {
                    attempts++;
                    requestAnimationFrame(tryAttach);
                }
            };
            tryAttach();
        }
    });
}