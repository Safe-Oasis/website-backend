// Copyright © 2022 | LuciferMorningstarDev | All Rights Reserved | ( Email: contact@lucifer-morningstar.dev )

'use strict'; // https://www.w3schools.com/js/js_strict.asp

const { randomBytes } = require('crypto');

module.exports = (req, res, next) => {
    if (!req.session.isLoggedIn) return res.redirect('/login');
    next();
};

module.exports.injectCSRF = (req, res, next) => {
    if (!req.session.csrf) {
        req.session.csrf = randomBytes(100).toString('base64');
    }
    next();
};
