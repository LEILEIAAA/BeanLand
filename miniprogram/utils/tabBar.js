function syncTabBar(page, index) {
  if (typeof page.getTabBar !== 'function') return;
  const tabBar = page.getTabBar();
  if (!tabBar) return;
  tabBar.setData({ selected: index });
}

/** Custom tabBar sits above page z-index; hide it while page modals/sheets are open. */
function setTabBarHidden(page, hidden) {
  if (typeof page.getTabBar !== 'function') return;
  const tabBar = page.getTabBar();
  if (!tabBar) return;
  tabBar.setData({ hidden: !!hidden });
}

module.exports = { syncTabBar, setTabBarHidden };
