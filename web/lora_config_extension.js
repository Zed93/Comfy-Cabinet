import { api } from "../../scripts/api.js";
import { app } from "../../scripts/app.js";

const comfyApp = window.comfyAPI?.app?.app || app;
const comfyApi = window.comfyAPI?.api?.api || api;

const EASY_LORA_CLASSES = [
    "EasyLoraCharacterConfigLoader",
    "EasyLoraClothingConfigLoader",
    "EasyLoraPoseActionConfigLoader",
    "EasyLoraBackgroundConfigLoader",
    "EasyLoraBasicConfigLoader"
];

const CIVITAI_OFFICIAL_TYPES = [
    "Character", "Style", "Concept", "Clothing", "Base model", "Background",
    "Poses", "Tool", "Assets", "Vehicle", "Buildings", "Objects", "Animal", "Action"
];

let allLoraConfigsLoaded = false;
const loraConfigMap = {};

function getLoraType(item, fileName = "") {
    if (item) {
        const itemTags = Array.isArray(item.tags) ? item.tags : [];
        const metaTags = item.civitai_metadata?.tags && Array.isArray(item.civitai_metadata.tags)
            ? item.civitai_metadata.tags.map(t => typeof t === "object" ? (t.name || String(t)) : String(t))
            : [];
        
        const combinedTags = [...itemTags, ...metaTags];

        for (const tag of combinedTags) {
            if (!tag) continue;
            const cleanTag = String(tag).trim().toLowerCase();
            for (const officialType of CIVITAI_OFFICIAL_TYPES) {
                if (cleanTag === officialType.toLowerCase()) {
                    return officialType;
                }
            }
        }

        const rawType = item.civitai_metadata?.type || item.civitai_metadata?.model?.type || "";
        if (rawType && rawType !== "LORA" && rawType !== "LoCon") {
            const typeCap = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();
            for (const officialType of CIVITAI_OFFICIAL_TYPES) {
                if (typeCap === officialType || (typeCap === "Pose" && officialType === "Poses")) {
                    return officialType;
                }
            }
        }

        const textCorpus = (combinedTags.join(" ") + " " + (item.trigger_words || "") + " " + (item.lora_name || "")).toLowerCase();
        if (textCorpus.includes("character") || textCorpus.includes("1girl") || textCorpus.includes("1boy") || textCorpus.includes("woman") || textCorpus.includes("man")) return "Character";
        if (textCorpus.includes("clothing") || textCorpus.includes("dress") || textCorpus.includes("outfit") || textCorpus.includes("costume") || textCorpus.includes("suit")) return "Clothing";
        if (textCorpus.includes("pose") || textCorpus.includes("posture")) return "Poses";
        if (textCorpus.includes("action") || textCorpus.includes("motion")) return "Action";
        if (textCorpus.includes("background") || textCorpus.includes("landscape") || textCorpus.includes("scenery") || textCorpus.includes("environment")) return "Background";
        if (textCorpus.includes("building") || textCorpus.includes("architecture") || textCorpus.includes("ruins")) return "Buildings";
        if (textCorpus.includes("vehicle") || textCorpus.includes("car")) return "Vehicle";
        if (textCorpus.includes("animal") || textCorpus.includes("dog") || textCorpus.includes("cat")) return "Animal";
        if (textCorpus.includes("style") || textCorpus.includes("painterly") || textCorpus.includes("artstyle")) return "Style";
        if (textCorpus.includes("concept")) return "Concept";
        if (textCorpus.includes("tool")) return "Tool";
        if (textCorpus.includes("asset")) return "Assets";
        if (textCorpus.includes("object") || textCorpus.includes("weapon")) return "Objects";
    }

    const nameLower = (fileName || "").toLowerCase();
    if (nameLower.includes("character") || nameLower.includes("1girl") || nameLower.includes("1boy") || nameLower.includes("woman") || nameLower.includes("man") || nameLower.includes("waifu")) return "Character";
    if (nameLower.includes("clothing") || nameLower.includes("dress") || nameLower.includes("outfit") || nameLower.includes("costume") || nameLower.includes("suit") || nameLower.includes("shirt") || nameLower.includes("pants")) return "Clothing";
    if (nameLower.includes("pose") || nameLower.includes("posture")) return "Poses";
    if (nameLower.includes("action") || nameLower.includes("motion")) return "Action";
    if (nameLower.includes("background") || nameLower.includes("landscape") || nameLower.includes("scenery") || nameLower.includes("environment")) return "Background";
    if (nameLower.includes("building") || nameLower.includes("architecture") || nameLower.includes("ruins")) return "Buildings";
    if (nameLower.includes("vehicle") || nameLower.includes("car")) return "Vehicle";
    if (nameLower.includes("animal") || nameLower.includes("dog") || nameLower.includes("cat")) return "Animal";
    if (nameLower.includes("style") || nameLower.includes("artstyle")) return "Style";
    if (nameLower.includes("concept")) return "Concept";
    if (nameLower.includes("tool")) return "Tool";
    if (nameLower.includes("asset")) return "Assets";
    if (nameLower.includes("object") || nameLower.includes("weapon")) return "Objects";

    return "Other";
}

async function ensureAllLoraConfigsLoaded() {
    if (allLoraConfigsLoaded) return;
    try {
        const response = await fetch("/easy_lora_config/get_all");
        const data = await response.json();
        if (data && Array.isArray(data.items)) {
            data.items.forEach(item => {
                if (item && item.lora_name) {
                    loraConfigMap[item.lora_name] = item;
                }
            });
        }
        allLoraConfigsLoaded = true;
    } catch (err) {
        console.warn("[ComfyCabinet] Failed to load all LoRA configs:", err);
    }
}

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

function getTargetTypesForNodeClass(comfyClass) {
    const clsLower = String(comfyClass || "").toLowerCase();
    if (clsLower.includes("character")) return ["Character"];
    if (clsLower.includes("clothing")) return ["Clothing"];
    if (clsLower.includes("pose") || clsLower.includes("action")) return ["Poses", "Action"];
    if (clsLower.includes("background") || clsLower.includes("building")) return ["Background", "Buildings"];
    return ["Style", "Concept", "Tool", "Assets", "Vehicle", "Objects", "Animal", "Base model", "Other"];
}

function getTargetNodeClassForLora(config, loraName = "") {
    const loraType = getLoraType(config, loraName);
    if (loraType === "Character") {
        return ["easyloracharacterconfigloader", "easyloracharacter", "character loader"];
    } else if (loraType === "Clothing") {
        return ["easyloraclothingconfigloader", "easyloraclothing", "clothing loader"];
    } else if (loraType === "Poses" || loraType === "Action") {
        return ["easyloraposeactionconfigloader", "easyloraposeaction", "pose & action loader", "pose loader", "action loader"];
    } else if (loraType === "Background" || loraType === "Buildings") {
        return ["easylorabackgroundconfigloader", "easylorabackground", "background loader"];
    } else {
        return ["easylorabasicconfigloader", "easylorabasic", "basic loader"];
    }
}

function isEasyLoraNode(node) {
    if (!node) return false;
    const comfyClass = node.comfyClass || node.type || "";
    if (EASY_LORA_CLASSES.includes(comfyClass)) return true;
    const titleStr = String(node.title || "").toLowerCase();
    const typeStr = String(comfyClass).toLowerCase();
    return typeStr.includes("easylora") || titleStr.includes("easy lora");
}

async function filterLoraWidgetForNode(node) {
    if (!node || !node.widgets) return;
    const loraWidget = node.widgets.find(w => w.name === "lora_name");
    if (!loraWidget) return;

    let optionsArray = null;
    if (Array.isArray(loraWidget.options?.values)) {
        optionsArray = loraWidget.options.values;
    } else if (Array.isArray(loraWidget.options)) {
        optionsArray = loraWidget.options;
    }

    if (!optionsArray) return;

    if (!loraWidget._originalValues) {
        loraWidget._originalValues = [...optionsArray];
    }

    const comfyClass = String(node.comfyClass || node.type || node.title || "").toLowerCase();
    const targetTypes = getTargetTypesForNodeClass(comfyClass);

    const fullList = loraWidget._originalValues;
    const filteredList = fullList.filter(fileName => {
        const item = loraConfigMap[fileName];
        const loraType = getLoraType(item, fileName);
        return targetTypes.includes(loraType);
    });

    const finalList = filteredList.length > 0 ? filteredList : fullList;

    if (Array.isArray(loraWidget.options?.values)) {
        loraWidget.options.values = finalList;
    } else if (Array.isArray(loraWidget.options)) {
        loraWidget.options = finalList;
    }

    if (!finalList.includes(loraWidget.value) && finalList.length > 0) {
        loraWidget.value = finalList[0];
        if (loraWidget.callback) {
            loraWidget.callback(loraWidget.value);
        }
    }
}

function bindLoraWidgetAutoPopulate(node) {
    if (!node || !node.widgets) return;
    const loraWidget = node.widgets.find(w => w.name === "lora_name");
    if (!loraWidget || loraWidget._autoPopulateBound) return;

    loraWidget._autoPopulateBound = true;
    const origCallback = loraWidget.callback;

    loraWidget.callback = async function(value) {
        if (origCallback) origCallback.apply(this, arguments);
        if (value) {
            await applyLoraConfigToNode(node, value);
        }
    };
}

async function applyLoraConfigToNode(node, loraName) {
    if (!node || !node.widgets || !loraName) return;

    let config = loraConfigMap[loraName];
    if (!config) {
        try {
            const resp = await fetch(`/easy_lora_config/get_settings?lora=${encodeURIComponent(loraName)}`);
            config = await resp.json();
            if (config && config.lora_name) {
                loraConfigMap[loraName] = config;
            }
        } catch (e) {
            console.warn("[ComfyCabinet] Error fetching config for " + loraName, e);
        }
    }

    if (!config) return;

    const blockMap = {
        strength_model: config.weight_model !== undefined ? config.weight_model : 1.0,
        strength_clip: config.weight_clip !== undefined ? config.weight_clip : 1.0,
        character: config.character || "",
        clothing: config.clothing || "",
        no_clothing: config.no_clothing || "",
        expression: config.expression || "",
        situation: config.situation || "",
        location: config.location || "",
        lighting: config.lighting || "",
        prompt_1: config.prompt_1 || "",
        prompt_2: config.prompt_2 || "",
        prompt_3: config.prompt_3 || "",
        prompt_4: config.prompt_4 || ""
    };

    let updatedAny = false;
    for (const widget of node.widgets) {
        if (widget.name === "lora_name") continue;
        if (blockMap[widget.name] !== undefined) {
            if (widget.value !== blockMap[widget.name]) {
                widget.value = blockMap[widget.name];
                if (widget.callback) widget.callback(blockMap[widget.name]);
                updatedAny = true;
            }
        }
    }

    if (updatedAny) {
        const graph = getActiveGraph();
        if (graph && graph.setDirtyCanvas) {
            graph.setDirtyCanvas(true, true);
        }
    }
}

async function setupEasyLoraNode(node) {
    if (!isEasyLoraNode(node)) return;
    bindLoraWidgetAutoPopulate(node);
    await filterLoraWidgetForNode(node);
}

async function refreshAllNodeFilters() {
    const graph = getActiveGraph();
    if (!graph) return;
    const allNodes = graph._nodes || graph.nodes || [];
    for (const node of allNodes) {
        if (isEasyLoraNode(node)) {
            await filterLoraWidgetForNode(node);
        }
    }
}

function updateCanvasNodes(data) {
    if (!data || !data.lora_name) return;

    const graph = getActiveGraph();
    if (!graph) return;

    const allNodes = graph._nodes || graph.nodes || [];
    const allLoraNodes = allNodes.filter(node => isEasyLoraNode(node));
    if (allLoraNodes.length === 0) return;

    const config = data.config || data;
    const targetClassKeywords = getTargetNodeClassForLora(config, data.lora_name);

    let targetNodes = allLoraNodes.filter(node => {
        const typeStr = String(node.type || "").toLowerCase();
        const titleStr = String(node.title || "").toLowerCase();
        const classStr = String(node.comfyClass || "").toLowerCase();
        return targetClassKeywords.some(kw => typeStr.includes(kw) || titleStr.includes(kw) || classStr.includes(kw));
    });

    if (targetNodes.length === 0) {
        const basicKeywords = ["easylorabasicconfigloader", "easylorabasic", "basic loader"];
        targetNodes = allLoraNodes.filter(node => {
            const typeStr = String(node.type || "").toLowerCase();
            const titleStr = String(node.title || "").toLowerCase();
            const classStr = String(node.comfyClass || "").toLowerCase();
            return basicKeywords.some(kw => typeStr.includes(kw) || titleStr.includes(kw) || classStr.includes(kw));
        });
    }

    if (targetNodes.length === 0) return;

    try {
        const selectedNodesObj = comfyApp?.canvas?.selected_nodes || window.app?.canvas?.selected_nodes || {};
        const selectedList = Object.values(selectedNodesObj);
        const selectedTarget = selectedList.find(n => targetNodes.includes(n));
        if (selectedTarget) {
            targetNodes = [selectedTarget];
        }
    } catch (e) { }

    const weightModel = data.weight_model !== undefined ? data.weight_model : config.weight_model;
    const weightClip = data.weight_clip !== undefined ? data.weight_clip : config.weight_clip;

    const blockMap = {
        character: config.character !== undefined ? config.character : "",
        clothing: config.clothing !== undefined ? config.clothing : "",
        no_clothing: config.no_clothing !== undefined ? config.no_clothing : "",
        expression: config.expression !== undefined ? config.expression : "",
        situation: config.situation !== undefined ? config.situation : "",
        location: config.location !== undefined ? config.location : "",
        lighting: config.lighting !== undefined ? config.lighting : "",
        prompt_1: config.prompt_1 !== undefined ? config.prompt_1 : "",
        prompt_2: config.prompt_2 !== undefined ? config.prompt_2 : "",
        prompt_3: config.prompt_3 !== undefined ? config.prompt_3 : "",
        prompt_4: config.prompt_4 !== undefined ? config.prompt_4 : ""
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
                    if (data) {
                        const config = data.config || data;
                        if (config && config.lora_name) {
                            loraConfigMap[config.lora_name] = config;
                        }
                        updateCanvasNodes(data);
                    }
                });
            }

            await ensureAllLoraConfigsLoaded();
            await refreshAllNodeFilters();
        },
        async nodeCreated(node) {
            if (isEasyLoraNode(node)) {
                setupEasyLoraNode(node);
            }
        }
    });
}
