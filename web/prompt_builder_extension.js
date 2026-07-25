import { api } from "../../scripts/api.js";
import { app } from "../../scripts/app.js";

const comfyApp = window.comfyAPI?.app?.app || app;
const comfyApi = window.comfyAPI?.api?.api || api;

if (comfyApp) {
    comfyApp.registerExtension({
        name: "ComfyCabinet.PromptBuilder",
        async setup() {
            comfyApi.addEventListener("prompt_builder_update", (event) => {
                const config = event.detail;
                if (!config) return;

                const nodes = comfyApp.graph?.findNodesByType("EasyPromptBuilder");
                if (!nodes || nodes.length === 0) return;

                for (const node of nodes) {
                    if (!node.widgets) continue;
                    for (const widget of node.widgets) {
                        if (config[widget.name] !== undefined) {
                            widget.value = config[widget.name];
                            if (widget.callback) {
                                widget.callback(config[widget.name]);
                            }
                        } else if (widget.name === "mood" && config.expression !== undefined) {
                            widget.value = config.expression;
                            if (widget.callback) {
                                widget.callback(config.expression);
                            }
                        }
                    }
                }
                comfyApp.graph?.setDirtyCanvas(true, true);
            });
        }
    });
}
