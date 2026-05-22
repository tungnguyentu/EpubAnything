module.exports = {
  apps: [
    {
      name: 'epubanything-backend',
      cwd: '/root/EpubAnything/backend',
      script: '/root/EpubAnything/backend/.venv/bin/uvicorn',
      args: 'main:app --host 127.0.0.1 --port 3801 --env-file .env',
      interpreter: 'none',
      autorestart: true,
    },
    {
      name: 'epubanything-frontend',
      cwd: '/root/EpubAnything/frontend',
      script: '/usr/bin/npm',
      args: 'start -- --hostname 127.0.0.1 --port 3461',
      interpreter: 'none',
      autorestart: true,
    },
  ],
};
