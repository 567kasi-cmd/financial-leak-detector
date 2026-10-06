const menuButton = document.querySelector(".nav-toggle");
const navigation = document.getElementById("primary-navigation");

if (!(menuButton instanceof HTMLButtonElement) || !(navigation instanceof HTMLElement)) {
    throw new Error("The primary navigation menu could not be initialized.");
}

function setMenuOpen(isOpen) {
    menuButton.setAttribute("aria-expanded", String(isOpen));
    menuButton.textContent = isOpen ? "Close" : "Menu";
    navigation.classList.toggle("is-open", isOpen);
}

menuButton.addEventListener("click", () => {
    setMenuOpen(menuButton.getAttribute("aria-expanded") !== "true");
});

navigation.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
        setMenuOpen(false);
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
        setMenuOpen(false);
        menuButton.focus();
    }
});
