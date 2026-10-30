// Draw the base map as soon as its configuration is ready. Period/household
// filters still gate data requests, while admin navigation loads independently.
async function loadStartupResources() {
  const mapFirst = isMapTab();
  state.mapStartupPending = mapFirst;

  const configReady = loadClientConfig();
  const filtersReady = loadFilters();
  const adminReady = loadAdminSession()
    .then(renderAdminNavigation)
    .catch((error) => {
      console.warn("Admin navigation refresh failed:", error?.message || error);
    });
  const mapReady = mapFirst
    ? configReady.then(() => isMapTab() ? initZoomMap() : true)
    : Promise.resolve(true);

  const [, , mapInitialized] = await Promise.all([
    configReady,
    filtersReady,
    mapReady,
    ...(mapFirst ? [] : [adminReady])
  ]);
  // Do not release this gate when filters fail: an idle event must never send
  // a summary request with an uninitialized period or household filter.
  state.mapStartupPending = false;
  return { mapInitialized };
}
