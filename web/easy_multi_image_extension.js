import { api } from "../../scripts/api.js";
import { app } from "../../scripts/app.js";

const comfyApp = window.comfyAPI?.app?.app || app;
const comfyApi = window.comfyAPI?.api?.api || api;

// Global lightbox instance to avoid duplicates
let lightboxOverlay = null;
let lightboxState = {
    images: [],
    currentIndex: 0,
    subfolder: "",
    onSelectIndex: null
};

function ensureLightbox() {
    if (lightboxOverlay && document.body.contains(lightboxOverlay)) return lightboxOverlay;

    const overlay = document.createElement("div");
    overlay.id = "easy-multi-image-lightbox";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.backgroundColor = "rgba(10, 10, 15, 0.88)";
    overlay.style.backdropFilter = "blur(12px)";
    overlay.style.webkitBackdropFilter = "blur(12px)";
    overlay.style.zIndex = "100000";
    overlay.style.display = "none";
    overlay.style.flexDirection = "column";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "space-between";
    overlay.style.padding = "20px";
    overlay.style.boxSizing = "border-box";
    overlay.style.color = "#f3f4f6";
    overlay.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

    overlay.innerHTML = `
        <!-- Top Bar -->
        <div style="width: 100%; max-width: 1200px; display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: rgba(30, 30, 40, 0.7); border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
            <div style="display: flex; align-items: center; gap: 12px; overflow: hidden;">
                <span id="lb-badge" style="background: linear-gradient(135deg, #6366f1, #a855f7); color: #fff; padding: 4px 10px; border-radius: 20px; font-weight: 600; font-size: 13px;">1 / 1</span>
                <span id="lb-filename" style="font-size: 15px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; max-width: 500px;" title="">filename.png</span>
                <span id="lb-meta" style="font-size: 13px; color: #9ca3af;"></span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <button id="lb-select-btn" style="background: #4f46e5; hover: #4338ca; color: white; border: none; border-radius: 6px; padding: 6px 14px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s;">
                    <span>✓ Select Output</span>
                </button>
                <button id="lb-close-btn" style="background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 6px; padding: 6px 12px; font-size: 16px; cursor: pointer; transition: all 0.2s;" title="Close (Esc)">
                    ✕
                </button>
            </div>
        </div>

        <!-- Center Image Viewer & Nav Arrows -->
        <div style="position: relative; flex: 1; width: 100%; max-width: 1300px; display: flex; align-items: center; justify-content: center; margin: 15px 0; overflow: hidden;">
            <button id="lb-prev-btn" style="position: absolute; left: 10px; background: rgba(20, 20, 30, 0.75); color: white; border: 1px solid rgba(255,255,255,0.15); width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; cursor: pointer; z-index: 10; transition: all 0.2s;" title="Previous (Left Arrow)">
                ❮
            </button>
            
            <img id="lb-img" src="" alt="Preview" style="max-width: 100%; max-height: calc(100vh - 160px); object-fit: contain; border-radius: 8px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); transition: transform 0.2s ease;" />
            
            <button id="lb-next-btn" style="position: absolute; right: 10px; background: rgba(20, 20, 30, 0.75); color: white; border: 1px solid rgba(255,255,255,0.15); width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; cursor: pointer; z-index: 10; transition: all 0.2s;" title="Next (Right Arrow)">
                ❯
            </button>
        </div>

        <!-- Bottom Thumbnail Strip -->
        <div id="lb-thumbs-strip" style="width: 100%; max-width: 1200px; height: 70px; display: flex; gap: 8px; overflow-x: auto; padding: 6px 12px; background: rgba(20, 20, 30, 0.6); border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); align-items: center;">
        </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector("#lb-close-btn");
    const prevBtn = overlay.querySelector("#lb-prev-btn");
    const nextBtn = overlay.querySelector("#lb-next-btn");
    const selectBtn = overlay.querySelector("#lb-select-btn");

    const closeLightbox = () => {
        overlay.style.display = "none";
        document.removeEventListener("keydown", handleKeyDown);
    };

    const updateLightboxView = () => {
        if (!lightboxState.images || lightboxState.images.length === 0) {
            closeLightbox();
            return;
        }

        const total = lightboxState.images.length;
        const idx = Math.max(0, Math.min(lightboxState.currentIndex, total - 1));
        lightboxState.currentIndex = idx;
        const item = lightboxState.images[idx];

        let relPath = typeof item === "string" ? item : (item.relative_path || item.filename);
        let filename = typeof item === "string" ? item.split("/").pop() : item.filename;
        let subfolder = (typeof item === "object" && item.subfolder) ? item.subfolder : lightboxState.subfolder;

        const imgUrl = `/view?filename=${encodeURIComponent(filename)}&type=input&subfolder=${encodeURIComponent(subfolder || "")}`;

        const lbImg = overlay.querySelector("#lb-img");
        lbImg.src = imgUrl;

        overlay.querySelector("#lb-badge").textContent = `${idx + 1} / ${total}`;
        const fnEl = overlay.querySelector("#lb-filename");
        fnEl.textContent = filename;
        fnEl.title = relPath;

        // Strip thumbnails highlight
        const strip = overlay.querySelector("#lb-thumbs-strip");
        strip.querySelectorAll(".lb-strip-thumb").forEach((th, tIdx) => {
            if (tIdx === idx) {
                th.style.border = "2px solid #6366f1";
                th.style.boxShadow = "0 0 10px rgba(99, 102, 241, 0.6)";
                th.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            } else {
                th.style.border = "2px solid transparent";
                th.style.boxShadow = "none";
            }
        });
    };

    const populateStrip = () => {
        const strip = overlay.querySelector("#lb-thumbs-strip");
        strip.innerHTML = "";
        lightboxState.images.forEach((item, idx) => {
            let filename = typeof item === "string" ? item.split("/").pop() : item.filename;
            let subfolder = (typeof item === "object" && item.subfolder) ? item.subfolder : lightboxState.subfolder;
            const imgUrl = `/view?filename=${encodeURIComponent(filename)}&type=input&subfolder=${encodeURIComponent(subfolder || "")}`;

            const thumb = document.createElement("img");
            thumb.className = "lb-strip-thumb";
            thumb.src = imgUrl;
            thumb.style.width = "52px";
            thumb.style.height = "52px";
            thumb.style.objectFit = "cover";
            thumb.style.borderRadius = "6px";
            thumb.style.cursor = "pointer";
            thumb.style.flexShrink = "0";
            thumb.style.transition = "all 0.15s ease";

            thumb.addEventListener("click", () => {
                lightboxState.currentIndex = idx;
                updateLightboxView();
            });

            strip.appendChild(thumb);
        });
    };

    const handleKeyDown = (e) => {
        if (overlay.style.display !== "flex") return;
        if (e.key === "Escape") {
            closeLightbox();
        } else if (e.key === "ArrowLeft") {
            const total = lightboxState.images.length;
            lightboxState.currentIndex = (lightboxState.currentIndex - 1 + total) % total;
            updateLightboxView();
        } else if (e.key === "ArrowRight") {
            const total = lightboxState.images.length;
            lightboxState.currentIndex = (lightboxState.currentIndex + 1) % total;
            updateLightboxView();
        }
    };

    closeBtn.addEventListener("click", closeLightbox);
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeLightbox();
    });

    prevBtn.addEventListener("click", () => {
        const total = lightboxState.images.length;
        lightboxState.currentIndex = (lightboxState.currentIndex - 1 + total) % total;
        updateLightboxView();
    });

    nextBtn.addEventListener("click", () => {
        const total = lightboxState.images.length;
        lightboxState.currentIndex = (lightboxState.currentIndex + 1) % total;
        updateLightboxView();
    });

    selectBtn.addEventListener("click", () => {
        if (lightboxState.onSelectIndex) {
            lightboxState.onSelectIndex(lightboxState.currentIndex + 1);
        }
        closeLightbox();
    });

    overlay._open = (images, index, subfolder, onSelect) => {
        lightboxState.images = images || [];
        lightboxState.currentIndex = Math.max(0, index - 1);
        lightboxState.subfolder = subfolder || "";
        lightboxState.onSelectIndex = onSelect;

        populateStrip();
        updateLightboxView();
        overlay.style.display = "flex";
        document.addEventListener("keydown", handleKeyDown);
    };

    lightboxOverlay = overlay;
    return overlay;
}

function openLightbox(images, index, subfolder, onSelect) {
    const lb = ensureLightbox();
    lb._open(images, index, subfolder, onSelect);
}

// ==================== COMFYUI EXTENSION REGISTRATION ====================

if (comfyApp) {
    comfyApp.registerExtension({
        name: "ComfyCabinet.EasyMultiImageLoader",

        async setup() {
            // Listen for live progress during execution
            if (comfyApi) {
                comfyApi.addEventListener("easy_multi_image_progress", (event) => {
                    const data = event.detail;
                    if (!data) return;

                    const graph = comfyApp.graph;
                    if (!graph) return;

                    const nodes = graph._nodes || graph.nodes || [];
                    for (const node of nodes) {
                        if (!node || node.comfyClass !== "EasyMultiImageLoader") continue;
                        if (data.node_id && String(node.id) !== String(data.node_id)) continue;

                        if (node._updateProgressUI) {
                            node._updateProgressUI(data.current_index, data.total_images, data.progress_percent, data.filename, data.mode);
                        }
                    }
                });
            }

            // Advance cycle on queue prompt serialization (like native seed node in ComfyUI)
            const origGraphToPrompt = comfyApp.graphToPrompt;
            if (origGraphToPrompt) {
                comfyApp.graphToPrompt = async function() {
                    const res = await origGraphToPrompt.apply(this, arguments);
                    try {
                        const graph = comfyApp.graph;
                        if (graph) {
                            const nodes = graph._nodes || graph.nodes || [];
                            for (const node of nodes) {
                                if (node && node.comfyClass === "EasyMultiImageLoader" && node._advanceCycle) {
                                    node._advanceCycle();
                                }
                            }
                        }
                    } catch (e) {
                        console.error("[EasyMultiImageLoader] Error advancing cycle:", e);
                    }
                    return res;
                };
            }

            // Refresh existing gallery nodes when returning to tab or switching workflow views
            document.addEventListener("visibilitychange", () => {
                if (document.visibilityState === "visible") {
                    const graph = comfyApp.graph;
                    if (!graph) return;
                    const nodes = graph._nodes || graph.nodes || [];
                    for (const node of nodes) {
                        if (node && node.comfyClass === "EasyMultiImageLoader" && node._refreshGallery) {
                            node._refreshGallery();
                        }
                    }
                }
            });
        },

        loadedGraphNode(node, app) {
            if (node.comfyClass === "EasyMultiImageLoader") {
                setTimeout(() => {
                    if (node._refreshGallery) {
                        node._refreshGallery();
                    }
                }, 50);
                setTimeout(() => {
                    if (node._refreshGallery) {
                        node._refreshGallery();
                    }
                }, 200);
            }
        },

        nodeCreated(node) {
            if (node.comfyClass !== "EasyMultiImageLoader") return;

            // Set default initial dimensions if node is newly created
            if (!node.size || node.size[0] < 340 || node.size[1] < 380) {
                node.size = [340, 380];
            }

            const origOnResize = node.onResize;
            node.onResize = function(size) {
                if (size[0] < 320) size[0] = 320;
                if (size[1] < 320) size[1] = 320;
                if (origOnResize) origOnResize.apply(this, arguments);
            };

            const origOnConfigure = node.onConfigure;
            node.onConfigure = function(info) {
                if (origOnConfigure) origOnConfigure.apply(this, arguments);
                setTimeout(() => {
                    if (node._refreshGallery) {
                        node._refreshGallery();
                    }
                }, 20);
                setTimeout(() => {
                    if (node._refreshGallery) {
                        node._refreshGallery();
                    }
                }, 200);
            };

            // Find widgets
            const getWidget = (name) => node.widgets?.find(w => w.name === name);

            // Hide the raw JSON images_list string widget from canvas drawing without breaking serialization
            const rawListWidget = getWidget("images_list");
            if (rawListWidget) {
                rawListWidget.computeSize = () => [0, -4];
            }

            // Container Element for DOM Widget
            const container = document.createElement("div");
            container.className = "easy-multi-image-container";
            container.style.display = "flex";
            container.style.flexDirection = "column";
            container.style.gap = "8px";
            container.style.width = "100%";
            container.style.boxSizing = "border-box";
            container.style.fontFamily = "system-ui, -apple-system, sans-serif";
            container.style.color = "#e5e7eb";
            container.style.userSelect = "none";
            container.style.padding = "4px 2px";

            // Hidden file input for uploading images to ComfyUI input folder
            const fileInput = document.createElement("input");
            fileInput.type = "file";
            fileInput.multiple = true;
            fileInput.accept = "image/*";
            fileInput.style.display = "none";
            container.appendChild(fileInput);

            // Helper to get parsed image list with robust deserialization
            const getLoadedImages = () => {
                const listWidget = getWidget("images_list");
                let val = listWidget ? listWidget.value : null;

                // Fallback to node.widgets_values if widget not yet synced during graph configure
                if ((!val || val === "[]") && node.widgets_values && Array.isArray(node.widgets_values)) {
                    const idx = node.widgets ? node.widgets.findIndex(w => w.name === "images_list") : 2;
                    if (idx !== -1 && node.widgets_values[idx]) {
                        val = node.widgets_values[idx];
                    }
                }

                if (!val) return [];
                if (Array.isArray(val)) return val;
                if (typeof val === "object") return [val];
                try {
                    const parsed = JSON.parse(val);
                    return Array.isArray(parsed) ? parsed : [];
                } catch {
                    if (typeof val === "string" && val.trim() && val !== "[]") {
                        const items = [];
                        for (const line of val.replace(/\r/g, "").split("\n")) {
                            for (const chunk of line.split(",")) {
                                const c = chunk.trim().replace(/^["']|["']$/g, "");
                                if (c) items.push(c);
                            }
                        }
                        return items;
                    }
                    return [];
                }
            };

            const setLoadedImages = (arr) => {
                const listWidget = getWidget("images_list");
                if (listWidget) {
                    listWidget.value = JSON.stringify(arr);
                    if (listWidget.callback) listWidget.callback(listWidget.value);
                }
                renderThumbnails();
                updateProgressDisplay();
            };

            // 1. Toolbar Section
            const toolbar = document.createElement("div");
            toolbar.style.display = "flex";
            toolbar.style.alignItems = "center";
            toolbar.style.justifyContent = "space-between";
            toolbar.style.gap = "6px";
            toolbar.style.flexWrap = "wrap";

            // Left actions: Upload & Scan Input
            const leftActions = document.createElement("div");
            leftActions.style.display = "flex";
            leftActions.style.gap = "6px";

            const uploadBtn = document.createElement("button");
            uploadBtn.innerHTML = "<span>📁 Upload</span>";
            uploadBtn.title = "Upload multiple image files to ComfyUI input folder";
            uploadBtn.style.background = "linear-gradient(135deg, #4f46e5, #7c3aed)";
            uploadBtn.style.color = "white";
            uploadBtn.style.border = "none";
            uploadBtn.style.borderRadius = "5px";
            uploadBtn.style.padding = "5px 10px";
            uploadBtn.style.fontSize = "12px";
            uploadBtn.style.fontWeight = "600";
            uploadBtn.style.cursor = "pointer";
            uploadBtn.style.transition = "opacity 0.2s";

            uploadBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                fileInput.click();
            });

            const scanBtn = document.createElement("button");
            scanBtn.innerHTML = "<span>📂 Input Dir</span>";
            scanBtn.title = "Load all images from ComfyUI input directory";
            scanBtn.style.background = "rgba(255, 255, 255, 0.1)";
            scanBtn.style.color = "#e5e7eb";
            scanBtn.style.border = "1px solid rgba(255,255,255,0.15)";
            scanBtn.style.borderRadius = "5px";
            scanBtn.style.padding = "5px 10px";
            scanBtn.style.fontSize = "12px";
            scanBtn.style.cursor = "pointer";

            scanBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                const subfolderWidget = getWidget("subfolder");
                const subfolder = subfolderWidget ? subfolderWidget.value : "";
                try {
                    scanBtn.textContent = "⏳ Scanning...";
                    const res = await fetch(`/easy_multi_image/get_input_files?subfolder=${encodeURIComponent(subfolder || "")}`);
                    const data = await res.json();
                    if (data && data.files) {
                        setLoadedImages(data.files);
                    }
                } catch (err) {
                    console.error("[EasyMultiImageLoader] Scan failed:", err);
                } finally {
                    scanBtn.innerHTML = "<span>📂 Input Dir</span>";
                }
            });

            leftActions.appendChild(uploadBtn);
            leftActions.appendChild(scanBtn);

            // Right actions: Shuffle & Clear
            const rightActions = document.createElement("div");
            rightActions.style.display = "flex";
            rightActions.style.gap = "6px";

            const shuffleBtn = document.createElement("button");
            shuffleBtn.innerHTML = "<span>🔀</span>";
            shuffleBtn.title = "Shuffle loaded images";
            shuffleBtn.style.background = "rgba(255, 255, 255, 0.1)";
            shuffleBtn.style.color = "#e5e7eb";
            shuffleBtn.style.border = "1px solid rgba(255,255,255,0.15)";
            shuffleBtn.style.borderRadius = "5px";
            shuffleBtn.style.padding = "5px 8px";
            shuffleBtn.style.fontSize = "12px";
            shuffleBtn.style.cursor = "pointer";

            shuffleBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const imgs = [...getLoadedImages()];
                for (let i = imgs.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [imgs[i], imgs[j]] = [imgs[j], imgs[i]];
                }
                setLoadedImages(imgs);
            });

            const clearBtn = document.createElement("button");
            clearBtn.innerHTML = "<span>🗑️</span>";
            clearBtn.title = "Clear image list";
            clearBtn.style.background = "rgba(239, 68, 68, 0.2)";
            clearBtn.style.color = "#f87171";
            clearBtn.style.border = "1px solid rgba(239, 68, 68, 0.3)";
            clearBtn.style.borderRadius = "5px";
            clearBtn.style.padding = "5px 8px";
            clearBtn.style.fontSize = "12px";
            clearBtn.style.cursor = "pointer";

            clearBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                setLoadedImages([]);
            });

            rightActions.appendChild(shuffleBtn);
            rightActions.appendChild(clearBtn);

            toolbar.appendChild(leftActions);
            toolbar.appendChild(rightActions);
            container.appendChild(toolbar);

            // 2. Progress & Navigation Header
            const progressContainer = document.createElement("div");
            progressContainer.style.display = "flex";
            progressContainer.style.flexDirection = "column";
            progressContainer.style.gap = "4px";
            progressContainer.style.background = "rgba(20, 20, 28, 0.6)";
            progressContainer.style.padding = "6px 8px";
            progressContainer.style.borderRadius = "8px";
            progressContainer.style.border = "1px solid rgba(255, 255, 255, 0.08)";

            const progressHeader = document.createElement("div");
            progressHeader.style.display = "flex";
            progressHeader.style.alignItems = "center";
            progressHeader.style.justifyContent = "space-between";

            const prevStepBtn = document.createElement("button");
            prevStepBtn.innerHTML = "❮";
            prevStepBtn.style.background = "transparent";
            prevStepBtn.style.border = "none";
            prevStepBtn.style.color = "#9ca3af";
            prevStepBtn.style.cursor = "pointer";
            prevStepBtn.style.fontSize = "12px";
            prevStepBtn.style.padding = "2px 6px";

            const progressText = document.createElement("span");
            progressText.style.fontSize = "12px";
            progressText.style.fontWeight = "600";
            progressText.style.color = "#f3f4f6";
            progressText.textContent = "0 / 0 Images (0%)";

            const nextStepBtn = document.createElement("button");
            nextStepBtn.innerHTML = "❯";
            nextStepBtn.style.background = "transparent";
            nextStepBtn.style.border = "none";
            nextStepBtn.style.color = "#9ca3af";
            nextStepBtn.style.cursor = "pointer";
            nextStepBtn.style.fontSize = "12px";
            nextStepBtn.style.padding = "2px 6px";

            progressHeader.appendChild(prevStepBtn);
            progressHeader.appendChild(progressText);
            progressHeader.appendChild(nextStepBtn);

            const progressBarTrack = document.createElement("div");
            progressBarTrack.style.width = "100%";
            progressBarTrack.style.height = "5px";
            progressBarTrack.style.background = "rgba(255, 255, 255, 0.1)";
            progressBarTrack.style.borderRadius = "3px";
            progressBarTrack.style.overflow = "hidden";

            const progressBarFill = document.createElement("div");
            progressBarFill.style.width = "0%";
            progressBarFill.style.height = "100%";
            progressBarFill.style.background = "linear-gradient(90deg, #6366f1, #a855f7)";
            progressBarFill.style.borderRadius = "3px";
            progressBarFill.style.transition = "width 0.25s ease";

            progressBarTrack.appendChild(progressBarFill);
            progressContainer.appendChild(progressHeader);
            progressContainer.appendChild(progressBarTrack);
            container.appendChild(progressContainer);

            // 3. Thumbnail Grid Container & Drag-Drop Zone
            const gallery = document.createElement("div");
            gallery.className = "easy-multi-image-gallery";
            gallery.style.display = "grid";
            gallery.style.gridTemplateColumns = "repeat(auto-fill, minmax(64px, 1fr))";
            gallery.style.gridAutoRows = "max-content";
            gallery.style.gap = "8px";
            gallery.style.alignContent = "start";
            gallery.style.alignItems = "start";
            gallery.style.boxSizing = "border-box";
            gallery.style.width = "100%";
            gallery.style.maxHeight = "230px";
            gallery.style.minHeight = "100px";
            gallery.style.overflowY = "auto";
            gallery.style.overflowX = "hidden";
            gallery.style.padding = "8px";
            gallery.style.background = "rgba(10, 10, 16, 0.55)";
            gallery.style.borderRadius = "8px";
            gallery.style.border = "1px dashed rgba(255, 255, 255, 0.15)";
            gallery.style.position = "relative";

            container.appendChild(gallery);

            // Drag and drop handling
            gallery.addEventListener("dragover", (e) => {
                e.preventDefault();
                e.stopPropagation();
                gallery.style.border = "1px dashed #6366f1";
                gallery.style.background = "rgba(99, 102, 241, 0.1)";
            });

            gallery.addEventListener("dragleave", (e) => {
                e.preventDefault();
                e.stopPropagation();
                gallery.style.border = "1px dashed rgba(255, 255, 255, 0.15)";
                gallery.style.background = "rgba(10, 10, 16, 0.55)";
            });

            gallery.addEventListener("drop", async (e) => {
                e.preventDefault();
                e.stopPropagation();
                gallery.style.border = "1px dashed rgba(255, 255, 255, 0.15)";
                gallery.style.background = "rgba(10, 10, 16, 0.55)";

                if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    await handleFilesUpload(Array.from(e.dataTransfer.files));
                }
            });

            // Handle file upload
            fileInput.addEventListener("change", async (e) => {
                if (fileInput.files && fileInput.files.length > 0) {
                    await handleFilesUpload(Array.from(fileInput.files));
                    fileInput.value = "";
                }
            });

            async function handleFilesUpload(files) {
                const subfolderWidget = getWidget("subfolder");
                const subfolder = subfolderWidget ? subfolderWidget.value : "";
                const newItems = [];

                for (const file of files) {
                    if (!file.type.startsWith("image/")) continue;
                    try {
                        const formData = new FormData();
                        formData.append("image", file);
                        formData.append("overwrite", "true");
                        if (subfolder) formData.append("subfolder", subfolder);

                        const res = await fetch("/upload/image", {
                            method: "POST",
                            body: formData
                        });
                        const data = await res.json();
                        if (data && data.name) {
                            newItems.push({
                                filename: data.name,
                                subfolder: data.subfolder || subfolder || "",
                                relative_path: data.subfolder ? `${data.subfolder}/${data.name}` : data.name
                            });
                        }
                    } catch (err) {
                        console.error("[EasyMultiImageLoader] Upload error for file:", file.name, err);
                    }
                }

                if (newItems.length > 0) {
                    const current = getLoadedImages();
                    setLoadedImages([...current, ...newItems]);
                }
            }

            // Render thumbnail items
            function renderThumbnails() {
                gallery.innerHTML = "";
                const images = getLoadedImages();
                const indexWidget = getWidget("index");
                const currentIndex = indexWidget ? Number(indexWidget.value || 1) : 1;
                const subfolderWidget = getWidget("subfolder");
                const defaultSubfolder = subfolderWidget ? subfolderWidget.value : "";

                if (images.length === 0) {
                    const emptyNotice = document.createElement("div");
                    emptyNotice.style.gridColumn = "1 / -1";
                    emptyNotice.style.display = "flex";
                    emptyNotice.style.flexDirection = "column";
                    emptyNotice.style.alignItems = "center";
                    emptyNotice.style.justifyContent = "center";
                    emptyNotice.style.padding = "24px 10px";
                    emptyNotice.style.color = "#6b7280";
                    emptyNotice.style.fontSize = "12px";
                    emptyNotice.style.textAlign = "center";
                    emptyNotice.innerHTML = `
                        <div style="font-size: 22px; margin-bottom: 4px;">🖼️</div>
                        <div>Drag & drop images here or click Upload / Input Dir</div>
                    `;
                    gallery.appendChild(emptyNotice);
                    return;
                }

                images.forEach((item, idx) => {
                    const itemIndex = idx + 1;
                    const isSelected = itemIndex === currentIndex;

                    let filename = typeof item === "string" ? item.split("/").pop() : item.filename;
                    let subfolder = (typeof item === "object" && item.subfolder) ? item.subfolder : defaultSubfolder;
                    const imgUrl = `/view?filename=${encodeURIComponent(filename)}&type=input&subfolder=${encodeURIComponent(subfolder || "")}`;

                    const card = document.createElement("div");
                    card.className = "easy-img-thumb-card";
                    card.dataset.index = String(itemIndex);
                    card.style.boxSizing = "border-box";
                    card.style.position = "relative";
                    card.style.width = "100%";
                    card.style.aspectRatio = "1 / 1";
                    card.style.minWidth = "0";
                    card.style.minHeight = "0";
                    card.style.borderRadius = "6px";
                    card.style.overflow = "hidden";
                    card.style.cursor = "pointer";
                    card.style.border = isSelected ? "2px solid #6366f1" : "2px solid rgba(255,255,255,0.08)";
                    card.style.boxShadow = isSelected ? "0 0 10px rgba(99, 102, 241, 0.6)" : "none";
                    card.style.transition = "border-color 0.15s ease, box-shadow 0.15s ease";
                    card.style.background = "#111827";
                    card.style.display = "flex";
                    card.style.alignItems = "center";
                    card.style.justifyContent = "center";

                    const img = document.createElement("img");
                    img.src = imgUrl;
                    img.loading = "lazy";
                    img.alt = filename;
                    img.style.display = "block";
                    img.style.width = "100%";
                    img.style.height = "100%";
                    img.style.objectFit = "cover";
                    img.style.pointerEvents = "none";

                    // Badge showing index
                    const badge = document.createElement("div");
                    badge.className = "easy-img-badge";
                    badge.style.position = "absolute";
                    badge.style.bottom = "3px";
                    badge.style.left = "3px";
                    badge.style.background = isSelected ? "#6366f1" : "rgba(0,0,0,0.75)";
                    badge.style.color = "#ffffff";
                    badge.style.fontSize = "9px";
                    badge.style.fontWeight = "700";
                    badge.style.padding = "1px 5px";
                    badge.style.borderRadius = "3px";
                    badge.style.pointerEvents = "none";
                    badge.style.zIndex = "2";
                    badge.style.lineHeight = "1.2";
                    badge.style.backdropFilter = "blur(4px)";
                    badge.textContent = `#${itemIndex}`;

                    // Delete hover button
                    const delBtn = document.createElement("button");
                    delBtn.innerHTML = "×";
                    delBtn.style.position = "absolute";
                    delBtn.style.top = "3px";
                    delBtn.style.right = "3px";
                    delBtn.style.background = "rgba(0,0,0,0.8)";
                    delBtn.style.color = "#f87171";
                    delBtn.style.border = "none";
                    delBtn.style.borderRadius = "50%";
                    delBtn.style.width = "18px";
                    delBtn.style.height = "18px";
                    delBtn.style.display = "none";
                    delBtn.style.alignItems = "center";
                    delBtn.style.justifyContent = "center";
                    delBtn.style.fontSize = "13px";
                    delBtn.style.cursor = "pointer";
                    delBtn.style.lineHeight = "1";
                    delBtn.style.zIndex = "3";

                    card.addEventListener("mouseenter", () => {
                        delBtn.style.display = "flex";
                    });
                    card.addEventListener("mouseleave", () => {
                        delBtn.style.display = "none";
                    });

                    delBtn.addEventListener("click", (e) => {
                        e.stopPropagation();
                        const current = getLoadedImages();
                        current.splice(idx, 1);
                        setLoadedImages(current);
                    });

                    card.title = `${filename}\n• Click to select as output\n• Double-click to preview in Lightbox`;

                    // Single Click: select image as active output
                    card.addEventListener("click", (e) => {
                        e.stopPropagation();
                        if (indexWidget) {
                            indexWidget.value = itemIndex;
                            if (indexWidget.callback) indexWidget.callback(itemIndex);
                        }
                        updateProgressDisplay();
                        highlightActiveCard(itemIndex);
                        comfyApp.graph?.setDirtyCanvas(true, true);
                    });

                    // Double Click: open full-screen lightbox
                    card.addEventListener("dblclick", (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        openLightbox(getLoadedImages(), itemIndex, defaultSubfolder, (chosenIdx) => {
                            if (indexWidget) {
                                indexWidget.value = chosenIdx;
                                if (indexWidget.callback) indexWidget.callback(chosenIdx);
                            }
                            updateProgressDisplay();
                            highlightActiveCard(chosenIdx);
                            comfyApp.graph?.setDirtyCanvas(true, true);
                        });
                    });

                    card.appendChild(img);
                    card.appendChild(badge);
                    card.appendChild(delBtn);
                    gallery.appendChild(card);
                });
            }

            function highlightActiveCard(itemIndex) {
                const cards = gallery.querySelectorAll(".easy-img-thumb-card");
                cards.forEach(card => {
                    const idx = Number(card.dataset.index);
                    const isSelected = idx === itemIndex;
                    card.style.border = isSelected ? "2px solid #6366f1" : "2px solid rgba(255,255,255,0.08)";
                    card.style.boxShadow = isSelected ? "0 0 10px rgba(99, 102, 241, 0.6)" : "none";
                    const badge = card.querySelector(".easy-img-badge");
                    if (badge) {
                        badge.style.background = isSelected ? "#6366f1" : "rgba(0,0,0,0.75)";
                    }
                    if (isSelected) {
                        card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
                    }
                });
            }

            function updateProgressDisplay() {
                const images = getLoadedImages();
                const total = images.length;
                const indexWidget = getWidget("index");
                let current = indexWidget ? Number(indexWidget.value || 1) : 1;

                if (total === 0) {
                    progressText.textContent = "0 / 0 Images (0%)";
                    progressBarFill.style.width = "0%";
                    return;
                }

                current = Math.max(1, Math.min(current, total));
                const pct = Math.round((current / total) * 100);
                progressText.textContent = `${current} / ${total} Images (${pct}%)`;
                progressBarFill.style.width = `${pct}%`;
            }

            // Step navigation buttons
            prevStepBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const images = getLoadedImages();
                if (images.length === 0) return;
                const indexWidget = getWidget("index");
                let current = indexWidget ? Number(indexWidget.value || 1) : 1;
                // Decrement with wrap-around
                current = current <= 1 ? images.length : current - 1;
                if (indexWidget) {
                    indexWidget.value = current;
                    if (indexWidget.callback) indexWidget.callback(current);
                }
                updateProgressDisplay();
                highlightActiveCard(current);
            });

            nextStepBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const images = getLoadedImages();
                if (images.length === 0) return;
                const indexWidget = getWidget("index");
                let current = indexWidget ? Number(indexWidget.value || 1) : 1;
                // Increment with wrap-around
                current = current >= images.length ? 1 : current + 1;
                if (indexWidget) {
                    indexWidget.value = current;
                    if (indexWidget.callback) indexWidget.callback(current);
                }
                updateProgressDisplay();
                highlightActiveCard(current);
            });

            // Callback when execution event is received
            node._updateProgressUI = (curIdx, total, pct, filename, mode) => {
                const indexWidget = getWidget("index");
                if (indexWidget && curIdx) {
                    indexWidget.value = curIdx;
                }
                updateProgressDisplay();

                // If images exist in UI, highlight card; otherwise if images were auto-scanned on backend, load them into UI
                const currentImages = getLoadedImages();
                if (currentImages.length === 0 && total > 0) {
                    const subfolderWidget = getWidget("subfolder");
                    const subfolder = subfolderWidget ? subfolderWidget.value : "";
                    fetch(`/easy_multi_image/get_input_files?subfolder=${encodeURIComponent(subfolder || "")}`)
                        .then(r => r.json())
                        .then(data => {
                            if (data && data.files && data.files.length > 0) {
                                setLoadedImages(data.files);
                            }
                        })
                        .catch(() => {});
                } else {
                    highlightActiveCard(curIdx);
                }

                comfyApp.graph?.setDirtyCanvas(true, true);
            };

            // Watch index widget changes to reflect in thumbnail gallery
            const indexWidget = getWidget("index");
            if (indexWidget) {
                const originalCallback = indexWidget.callback;
                indexWidget.callback = (val) => {
                    if (originalCallback) originalCallback.call(indexWidget, val);
                    updateProgressDisplay();
                    highlightActiveCard(Number(val));
                };
            }

            // Hook onExecuted to keep UI synchronized and prevent node collapse
            const origOnExecuted = node.onExecuted;
            node.onExecuted = function(message) {
                if (origOnExecuted) origOnExecuted.apply(this, arguments);
                if (message?.index?.[0] !== undefined) {
                    const newIndex = Number(message.index[0]);
                    const indexWidget = getWidget("index");
                    if (indexWidget && newIndex > 0) {
                        indexWidget.value = newIndex;
                    }
                }
                updateProgressDisplay();
                const idxW = getWidget("index");
                if (idxW) {
                    highlightActiveCard(Number(idxW.value || 1));
                }
                comfyApp.graph?.setDirtyCanvas(true, true);
            };

            node._advanceCycle = () => {
                const modeWidget = getWidget("mode");
                const mode = modeWidget ? modeWidget.value : "Fixed / Selected Index";
                if (mode === "Fixed / Selected Index") return;

                const images = getLoadedImages();
                const total = images.length;
                if (total <= 0) return;

                const indexWidget = getWidget("index");
                if (!indexWidget) return;

                let cur = Number(indexWidget.value || 1);
                let nextIdx = cur;

                if (mode === "Cycle (Increment)") {
                    nextIdx = cur >= total ? 1 : cur + 1;
                } else if (mode === "Cycle (Decrement)") {
                    nextIdx = cur <= 1 ? total : cur - 1;
                } else if (mode === "Random") {
                    nextIdx = Math.floor(Math.random() * total) + 1;
                }

                indexWidget.value = nextIdx;
                if (indexWidget.callback) {
                    indexWidget.callback(nextIdx);
                }
                updateProgressDisplay();
                highlightActiveCard(nextIdx);
                comfyApp.graph?.setDirtyCanvas(true, true);
            };

            node._refreshGallery = () => {
                renderThumbnails();
                updateProgressDisplay();
                const idxW = getWidget("index");
                if (idxW) {
                    highlightActiveCard(Number(idxW.value || 1));
                }
            };

            // Add DOM widget to LiteGraph node
            const galleryWidget = node.addDOMWidget("easy_multi_image_gallery_widget", "custom_gallery", container, {
                getValue() {
                    return getWidget("images_list")?.value || "[]";
                },
                setValue(v) {
                    if (v && typeof v === "string" && v !== "[]") {
                        const listWidget = getWidget("images_list");
                        if (listWidget && listWidget.value !== v) {
                            listWidget.value = v;
                        }
                    }
                    if (node._refreshGallery) {
                        node._refreshGallery();
                    }
                },
                getMinHeight() {
                    return 240;
                }
            });

            if (galleryWidget) {
                galleryWidget.serialize = false;
                galleryWidget.computeSize = (width) => [width, 240];
            }

            // Initial render
            setTimeout(() => {
                if (node._refreshGallery) {
                    node._refreshGallery();
                }
            }, 50);
        }
    });
}
