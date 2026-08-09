import { api } from "../../scripts/api.js";
import { app } from "../../scripts/app.js";

const comfyApp = window.comfyAPI?.app?.app || app;
const comfyApi = window.comfyAPI?.api?.api || api;

function getActiveGraph() {
    const candidates = [
        comfyApp?.graph,
        window.app?.graph,
        app?.graph,
        window.comfyAPI?.app?.app?.graph,
        window.parent?.app?.graph,
        window.opener?.app?.graph,
        window.top?.app?.graph
    ];

    for (const g of candidates) {
        if (g && (Array.isArray(g._nodes) || Array.isArray(g.nodes))) {
            return g;
        }
    }
    return null;
}

function updateCanvasNodes(data) {
    if (!data || !data.checkpoint_name) return;

    const graph = getActiveGraph();
    if (!graph) return;

    const allNodes = graph._nodes || graph.nodes || [];
    for (const node of allNodes) {
        if (!node || !node.widgets) continue;
        for (const widget of node.widgets) {
            const name = String(widget.name || "").toLowerCase();
            if (name === "ckpt_name" || name === "checkpoint" || name === "checkpoint_name") {
                widget.value = checkpointName;
                if (widget.callback) widget.callback(checkpointName);
            }
        }
    }

    if (graph.setDirtyCanvas) {
        graph.setDirtyCanvas(true, true);
    }
}

if (comfyApp) {
    comfyApp.registerExtension({
        name: "ComfyCabinet.EasyCheckpointConfig",
        async setup() {
            if (comfyApi) {
                comfyApi.addEventListener("easy_checkpoint_config_update", (event) => {
                    const data = event.detail;
                    if (data) updateCanvasNodes(data);
                });
            }
        }
    });
}
