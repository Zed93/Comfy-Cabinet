const Toast = {
    container: null,
    init() {
        if (!this.container) {
            this.container = document.createElement("div");
            this.container.id = "toast-container";
            document.body.appendChild(this.container);
        }
    },
    show(message, type = "info", duration = 3500) {
        this.init();
        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;

        const iconMap = {
            success: "✅",
            error: "❌",
            info: "ℹ️"
        };

        const iconSpan = document.createElement("span");
        iconSpan.textContent = iconMap[type] || "ℹ️";

        const textSpan = document.createElement("span");
        textSpan.textContent = message;

        toast.appendChild(iconSpan);
        toast.appendChild(textSpan);
        this.container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add("toast-hide");
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, duration);
    },
    success(message, duration) {
        this.show(message, "success", duration);
    },
    error(message, duration) {
        this.show(message, "error", duration);
    },
    info(message, duration) {
        this.show(message, "info", duration);
    }
};

window.Toast = Toast;
