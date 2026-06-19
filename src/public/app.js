// Legacy entry point. New code lives in src/public/js/.
(function loadSplitApp() {
  const version = "20260619-analytics-env";
  const scripts = [
    "app-prelude",
    "app-state",
    "app-core",
    "app-admin-crawl",
    "app-map",
    "app-map-popup",
    "app-design",
    "app-marker-utils",
    "markers/apartment/design",
    "markers/apartment/render",
    "markers/region/config",
    "markers/region/design",
    "markers/region/render",
    "app-rankings",
    "app-utils",
    "app-analytics",
    "app-bootstrap"
  ];

  document.write(scripts
    .map((name) => `<script src="/js/${name}.js?v=${version}"><\/script>`)
    .join(""));
}());
