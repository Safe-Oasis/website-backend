const { Router } = require('express');

module.exports = (app) => {
    const router = Router();

    router.get('/', async (_, res) => {
        res.json({
            error: false,
            message: 'OK',
            version: app.data.package.version,
            links: {
                homepage: 'https://safeoasis.xyz/',
                twitter: 'https://safeoasis.xyz/twitter',
                instagram: 'https://safeoasis.xyz/instagram',
                tiktok: 'https://safeoasis.xyz/tiktok',
                github: 'https://safeoasis.xyz/github',
                discord: 'https://safeoasis.xyz/discord',
                donate: 'https://safeoasis.xyz/donate',
                app: 'https://safeoasis.xyz/app/',
            },
        });
    });

    return router;
};
