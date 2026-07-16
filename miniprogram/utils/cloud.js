const ENV_ID = 'cloudbase-d8gzrj9d3f09c5171';

function initCloud() {
  if (!wx.cloud) {
    console.error(
      '[cloud] wx.cloud unavailable. cloud sdk injection may be skipped on gray base libs (e.g. 3.17.0). Set libVersion to 3.5.5 in 详情 → 本地设置 / project.private.config.json, then clear cache and rebuild.',
    );
    return false;
  }

  wx.cloud.init({
    env: ENV_ID,
    traceUser: true,
  });
  console.info('[cloud] init ok', ENV_ID);
  return true;
}

function db() {
  return wx.cloud.database();
}

function callFunction(name, data) {
  return wx.cloud.callFunction({
    name,
    data: data || {},
  });
}

module.exports = {
  ENV_ID,
  initCloud,
  db,
  callFunction,
};
