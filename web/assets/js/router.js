(function () {
    const routeMap = {
        "": "dashboard",
        "#": "dashboard",
        "#/": "dashboard",
        "#/dashboard": "dashboard",
        "#/checkpoint": "checkpoint",
        "#/lora": "lora",
        "#/prompt": "prompt"
    };

    function handleRoute() {
        const hash = window.location.hash || "#/dashboard";
        const viewName = routeMap[hash] || "dashboard";

        // Toggling view sections
        const sections = document.querySelectorAll(".view-section");
        sections.forEach(section => {
            if (section.id === `view-${viewName}`) {
                section.style.display = "block";
            } else {
                section.style.display = "none";
            }
        });

        // Updating sidebar navigation active state
        const navLinks = document.querySelectorAll(".nav-item");
        navLinks.forEach(link => {
            const linkRoute = link.getAttribute("data-route");
            if (linkRoute === viewName) {
                link.classList.add("active");
            } else {
                link.classList.remove("active");
            }
        });

        // Trigger i18n re-translation if ready
        if (window.i18n && typeof window.i18n.translatePage === "function") {
            window.i18n.translatePage();
        }

        // Dispatch route change event for view controllers
        window.dispatchEvent(new CustomEvent("spa-route-changed", { detail: { view: viewName } }));

        // Scroll workspace to top smoothly
        const mainContent = document.querySelector(".main-content");
        if (mainContent) mainContent.scrollTop = 0;
        window.scrollTo(0, 0);
    }

    window.addEventListener("hashchange", handleRoute);

    document.addEventListener("DOMContentLoaded", () => {
        handleRoute();
    });

    window.navigateToView = function (viewName) {
        window.location.hash = `/#/${viewName}`;
    };
})();
