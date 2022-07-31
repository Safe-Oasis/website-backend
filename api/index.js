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

    router.get('/users/@me', async (req, res) => {
        if (!req.session.user) return res.json({ error: true, message: 'not logged in' });
        let user = { ...req.session.user };
        delete user._id;
        delete user.profile._id;
        delete user.hashed_password;
        delete user.email_confirmation_code;
        res.json({ error: false, user: user });
    });

    router.get('/users/:user', async (req, res) => {
        if (!req.params.user) return res.json({ error: true, message: 'no given userId or email' });
        let user = await app.db.queryAsync('users', { uuid: req.params.user });
        if (!user[0]) user = await app.db.queryAsync('users', { email: req.params.user });
        if (!user[0]) return res.status(404).json({ error: true, message: 'that user does not exist' });
        user = user[0];

        if (!req.session.user) delete user.email;
        else if (req.session.user.group !== 'ADMINISTRATOR' && req.session.user.group !== 'MODERATOR' && req.session.user.uuid != user.uuid) delete user.email;
        delete user.hashed_password;
        delete user.email_confirmation_code;
        delete user.connected_accounts;
        delete user._id;

        let profile = await app.db.queryAsync('profiles', { uuid: user.profile });
        profile = profile[0];
        delete profile._id;
        user.profile = profile;

        res.json({ error: false, user: user });
    });

    router.get('/profiles/:user', async (req, res) => {
        if (!req.params.user) return res.json({ error: true, message: 'no given userId or email' });
        let profile = await app.db.queryAsync('profiles', { user: req.params.user });
        if (!profile[0]) return res.status(404).json({ error: true, message: 'that user does not exist' });
        profile = profile[0];
        delete profile._id;
        res.json({ error: false, profile: profile });
    });

    return router;
};
