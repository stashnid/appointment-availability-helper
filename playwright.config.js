module.exports = {
  testDir: './tests',
  testMatch: '**/*.spec.js',
  use: { browserName: 'chromium', channel: 'chrome' },
  timeout: 60000,
};
