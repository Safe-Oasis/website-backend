module.exports = {
    apps: [
        {
            name: 'SafeOasis-Backend',
            script: 'server.js',
            instances: 1,
            exec_mode: 'fork',
            watch: true,
            autorestart: true,
            ignore_watch: ['./.git/*', './node_modules/*', './uploads/*'],
        },
    ],
};
