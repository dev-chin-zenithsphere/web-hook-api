const path = require('node:path');
module.exports = { apps: [{
  name: 'checkweigher-gateway',
  script: './src/index.js',
  cwd: __dirname,
  instances: 1,
  exec_mode: 'fork',
  autorestart: true,
  kill_timeout: 7000,
  watch: false,
  max_memory_restart: '300M',
  time: true,
  merge_logs: false,
  out_file: path.join(__dirname, 'logs', 'pm2-out.log'),
  error_file: path.join(__dirname, 'logs', 'pm2-error.log'),
  env: { NODE_ENV: 'development' },
  env_production: { NODE_ENV: 'production' }
}] };
