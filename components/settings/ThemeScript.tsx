import { PREFERENCES_CHANGED_EVENT, PREFERENCES_STORAGE_KEY } from "@/lib/preferences";

const themeScript = `
(function () {
  var storageKey = ${JSON.stringify(PREFERENCES_STORAGE_KEY)};
  var changedEvent = ${JSON.stringify(PREFERENCES_CHANGED_EVENT)};
  var defaults = { density: "comfortable", motion: "system", theme: "system" };

  function read() {
    try {
      var parsed = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return {
        density: parsed.density === "compact" ? "compact" : "comfortable",
        motion: parsed.motion === "full" || parsed.motion === "reduced" ? parsed.motion : "system",
        theme: parsed.theme === "light" || parsed.theme === "dark" ? parsed.theme : "system"
      };
    } catch (_) {
      return { density: defaults.density, motion: defaults.motion, theme: defaults.theme };
    }
  }

  function apply(value) {
    var dark = value.theme === "dark" ||
      (value.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    var reduced = value.motion === "reduced" ||
      (value.motion === "system" && matchMedia("(prefers-reduced-motion: reduce)").matches);
    var root = document.documentElement;
    root.dataset.theme = dark ? "dark" : "light";
    root.dataset.motion = reduced ? "reduced" : "full";
    root.dataset.density = value.density;
    root.dataset.preferencesReady = "true";
    root.style.colorScheme = dark ? "dark" : "light";
  }

  function persist(value) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch (_) {}
  }

  apply(read());

  document.addEventListener("click", function (event) {
    var target = event.target;
    var control = target && target.closest
      ? target.closest("[data-preference-key], [data-preference-reset]")
      : null;
    if (!control) return;

    var value = control.hasAttribute("data-preference-reset")
      ? { density: defaults.density, motion: defaults.motion, theme: defaults.theme }
      : read();
    var key = control.getAttribute("data-preference-key");
    var next = control.getAttribute("data-preference-value");
    var allowed = {
      density: ["comfortable", "compact"],
      motion: ["system", "full", "reduced"],
      theme: ["system", "light", "dark"]
    };
    if (key && allowed[key] && allowed[key].indexOf(next) !== -1) value[key] = next;
    apply(value);
    persist(value);
    window.dispatchEvent(new CustomEvent(changedEvent, { detail: value }));
  }, true);
})();
`;

const developmentCleanupScript = `
(function () {
  if (!("serviceWorker" in navigator) || !("caches" in window)) return;
  Promise.all([
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      return Promise.all(registrations.map(function (registration) { return registration.unregister(); }));
    }),
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key.indexOf("mathforces-") === 0;
      }).map(function (key) { return caches.delete(key); }));
    })
  ]).then(function () {
    if (navigator.serviceWorker.controller && !sessionStorage.getItem("mathforces:dev-sw-cleaned")) {
      sessionStorage.setItem("mathforces:dev-sw-cleaned", "1");
      location.reload();
    }
  }).catch(function () {});
})();
`;

export function ThemeScript() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} id="mathforces-theme" />
      {process.env.NODE_ENV === "development" && (
        <script
          dangerouslySetInnerHTML={{ __html: developmentCleanupScript }}
          id="mathforces-dev-cache-cleanup"
        />
      )}
    </>
  );
}
