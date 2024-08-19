(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
const burgerBtn = document.querySelector(".burger-btn");
const navMobBox = document.querySelector(".nav-mob");
const navBtnClose = document.querySelector(".nav-btn-close");
const body = document.querySelector("body");
burgerBtn == null ? void 0 : burgerBtn.addEventListener("click", toggleNav);
navBtnClose == null ? void 0 : navBtnClose.addEventListener("click", toggleNav);
function toggleNav() {
  navMobBox == null ? void 0 : navMobBox.classList.toggle("is-visible");
  body == null ? void 0 : body.classList.toggle("no-scroll");
}
document.addEventListener("DOMContentLoaded", () => {
  const questionsTitles = document.querySelectorAll(".questions-title");
  questionsTitles.forEach((title) => {
    title.addEventListener("click", function() {
      const content = this.nextElementSibling;
      if (content) {
        if (content.style.display === "block") {
          content.style.display = "none";
        } else {
          content.style.display = "block";
        }
      }
    });
  });
});
document.addEventListener("DOMContentLoaded", () => {
  const baseDir = window.location.pathname.replace(/\/[^\/]*$/, "");
  const currentPath = window.location.pathname;
  const homeItems = document.querySelectorAll(".home");
  const logo = document.querySelector(".logo-link");
  const logoImg = document.querySelector(".logo");
  if (currentPath === `${baseDir}/` || currentPath === `${baseDir}/index.html`) {
    homeItems.forEach((home) => {
      home.style.display = "none";
      logo.style.display = "none";
      logoImg.style.display = "block";
    });
  } else {
    homeItems.forEach((home) => {
      home.style.display = "block";
      logo.style.display = "block";
      logoImg.style.display = "none";
    });
  }
  const navLinks = document.querySelectorAll(".nav-link-mob, .nav-link");
  navLinks.forEach((link) => {
    let linkPath = link.getAttribute("href");
    if (linkPath) {
      linkPath = `${baseDir}${linkPath.replace("./", "/")}`;
    }
    if (linkPath === currentPath) {
      link.classList.add("active");
    }
  });
});
