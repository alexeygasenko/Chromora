document.documentElement.classList.add("js");

document.addEventListener("DOMContentLoaded", () => {
  const root = document.documentElement;
  const themeButtons = [...document.querySelectorAll("[data-theme-choice]")];
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const validThemes = new Set(["glass", "light", "dark"]);
  const themeColors = {
    glass: "#0b284f",
    light: "#f7fbfe",
    dark: "#0b1726",
  };

  const applyTheme = (theme, remember = true) => {
    const nextTheme = validThemes.has(theme) ? theme : "glass";
    root.dataset.theme = nextTheme;

    themeButtons.forEach((button) => {
      const selected = button.dataset.themeChoice === nextTheme;
      button.setAttribute("aria-checked", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });

    if (themeColor) {
      themeColor.content = themeColors[nextTheme];
    }

    if (remember) {
      try {
        localStorage.setItem("chromora-site-theme", nextTheme);
      } catch {
        // Storage can be disabled; the selector still works for this visit.
      }
    }
  };

  let savedTheme = "glass";
  try {
    savedTheme = localStorage.getItem("chromora-site-theme") || "glass";
  } catch {
    savedTheme = "glass";
  }
  applyTheme(savedTheme, false);

  themeButtons.forEach((button, index) => {
    button.addEventListener("click", () => applyTheme(button.dataset.themeChoice));
    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
        return;
      }

      event.preventDefault();
      let nextIndex = index;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = themeButtons.length - 1;
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + themeButtons.length) % themeButtons.length;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % themeButtons.length;

      const nextButton = themeButtons[nextIndex];
      applyTheme(nextButton.dataset.themeChoice);
      nextButton.focus();
    });
  });

  const menuButton = document.querySelector(".menu-toggle");
  const navigation = document.querySelector(".primary-nav");

  const closeMenu = (restoreFocus = false) => {
    const wasOpen = navigation?.classList.contains("is-open") ?? false;
    navigation?.classList.remove("is-open");
    menuButton?.setAttribute("aria-expanded", "false");
    menuButton?.setAttribute("aria-label", "Open navigation");
    if (restoreFocus && wasOpen) menuButton?.focus();
  };

  menuButton?.addEventListener("click", () => {
    const isOpen = navigation?.classList.toggle("is-open") ?? false;
    menuButton.setAttribute("aria-expanded", String(isOpen));
    menuButton.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
    if (isOpen) navigation?.querySelector("a")?.focus();
  });

  navigation?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => closeMenu()));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu(true);
  });
  document.addEventListener("click", (event) => {
    if (!navigation?.classList.contains("is-open")) return;
    if (navigation.contains(event.target) || menuButton?.contains(event.target)) return;
    closeMenu();
  });

  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const tabList = document.querySelector('[role="tablist"]');
  const compactTabs = window.matchMedia("(max-width: 820px)");
  const syncTabOrientation = () => tabList?.setAttribute("aria-orientation", compactTabs.matches ? "horizontal" : "vertical");
  syncTabOrientation();
  compactTabs.addEventListener?.("change", syncTabOrientation);

  const activateTab = (tab, focus = false) => {
    tabs.forEach((candidate) => {
      const selected = candidate === tab;
      candidate.setAttribute("aria-selected", String(selected));
      candidate.tabIndex = selected ? 0 : -1;

      const panel = document.getElementById(candidate.getAttribute("aria-controls"));
      if (panel) {
        panel.hidden = !selected;
        panel.classList.toggle("is-active", selected);
      }
    });

    if (focus) tab.focus();
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateTab(tab));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;

      event.preventDefault();
      let nextIndex = index;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = tabs.length - 1;
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % tabs.length;
      activateTab(tabs[nextIndex], true);
    });
  });

  const selectedTab = tabs.find((tab) => tab.getAttribute("aria-selected") === "true") || tabs[0];
  if (selectedTab) activateTab(selectedTab);

  const revealItems = [...document.querySelectorAll(".reveal")];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reducedMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8%", threshold: 0.08 });

    revealItems.forEach((item) => observer.observe(item));
  }
});
