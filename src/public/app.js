// Legacy entry point. New code lives in src/public/js/.
(function loadSplitApp() {
  const version = "20260617-marker-rank-controls";
  const scripts = [
    "app-prelude",
    "app-state",
    "app-core",
    "app-admin-crawl",
    "app-map",
    "app-map-popup",
    "app-design",
    "app-apartment-marker-design",
    "app-region-marker-design",
    "app-marker-utils",
    "app-rankings",
    "app-utils",
    "app-bootstrap"
  ];

  document.write(scripts
    .map((name) => `<script src="/js/${name}.js?v=${version}"><\/script>`)
    .join(""));
}());
