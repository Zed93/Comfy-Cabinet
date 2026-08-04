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
    if (!data || !data.lora_name) return;

    const graph = getActiveGraph();
    if (!graph) return;

    const allNodes = graph._nodes || graph.nodes || [];
    const targetNodes = allNodes.filter(node => {
        if (!node) return false;
        const typeStr = String(node.type || "").toLowerCase();
        const titleStr = String(node.title || "").toLowerCase();
        const classStr = String(node.comfyClass || "").toLowerCase();

        if (typeStr.includes("easylora") || titleStr.includes("easy lora") || classStr.includes("easylora") ||
            typeStr.includes("easypromptbuilder") || titleStr.includes("easy prompt builder") || classStr.includes("easypromptbuilder")) {
            return true;
        }

        if (Array.isArray(node.widgets)) {
            const widgetNames = node.widgets.map(w => String(w?.name || "").toLowerCase());
            if (widgetNames.includes("lora_name") && (widgetNames.includes("strength_model") || widgetNames.includes("strength_clip"))) {
                return true;
            }
        }

        return false;
    });

    if (targetNodes.length === 0) return;

    const config = data.config || data;
    const weightModel = data.weight_model !== undefined ? data.weight_model : config.weight_model;
    const weightClip = data.weight_clip !== undefined ? data.weight_clip : config.weight_clip;

    const blockMap = {
        character: config.character !== undefined ? config.character : "",
        character_override: config.character !== undefined ? config.character : "",
        clothing: config.clothing !== undefined ? config.clothing : "",
        clothing_override: config.clothing !== undefined ? config.clothing : "",
        no_clothing: config.no_clothing !== undefined ? config.no_clothing : "",
        no_clothing_override: config.no_clothing !== undefined ? config.no_clothing : "",
        expression: config.expression !== undefined ? config.expression : "",
        expression_override: config.expression !== undefined ? config.expression : "",
        mood: config.expression !== undefined ? config.expression : "",
        situation: config.situation !== undefined ? config.situation : "",
        situation_override: config.situation !== undefined ? config.situation : "",
        location: config.location !== undefined ? config.location : "",
        location_override: config.location !== undefined ? config.location : "",
        lighting: config.lighting !== undefined ? config.lighting : "",
        lighting_override: config.lighting !== undefined ? config.lighting : ""
    };

    for (const node of targetNodes) {
        if (!node.widgets) continue;
        for (const widget of node.widgets) {
            if (widget.name === "lora_name") {
                widget.value = data.lora_name;
                if (widget.callback) widget.callback(data.lora_name);
            } else if (widget.name === "strength_model" && weightModel !== undefined) {
                widget.value = weightModel;
                if (widget.callback) widget.callback(weightModel);
            } else if (widget.name === "strength_clip" && weightClip !== undefined) {
                widget.value = weightClip;
                if (widget.callback) widget.callback(weightClip);
            } else if (blockMap[widget.name] !== undefined) {
                widget.value = blockMap[widget.name];
                if (widget.callback) widget.callback(blockMap[widget.name]);
            }
        }
    }

    if (graph.setDirtyCanvas) {
        graph.setDirtyCanvas(true, true);
    }
}

if (comfyApp) {
    comfyApp.registerExtension({
        name: "ComfyCabinet.EasyLoraConfig",
        async setup() {
            if (comfyApi) {
                comfyApi.addEventListener("easy_lora_config_update", (event) => {
                    const data = event.detail;
                    if (data) updateCanvasNodes(data);
                });
            }
        }
    });
}
