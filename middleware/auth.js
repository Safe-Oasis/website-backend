// Copyright © 2022 | LuciferMorningstarDev | All Rights Reserved | ( Email: contact@lucifer-morningstar.dev )

'use strict'; // https://www.w3schools.com/js/js_strict.asp

const { randomBytes } = require('crypto');
const JWT = require('jsonwebtoken');

module.exports = (req, res, next) => {
    if (!req.session.isLoggedIn) return res.redirect('/login');
    next();
};

function extractToken(req) {
    if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
        return req.headers.authorization.split(' ')[1];
    }
    if (req.query && req.query.token) {
        return req.query.token;
    }
    if (req.body.authorization) {
        return req.body.authorization;
    }
    return null;
}

module.exports.authJWT = (req, res, next, app) => {
    let token = extractToken(req);
    if (!token) return next();
    var decoded = JWT.verify(token, process.env.JWT_SECRET);
    if (!decoded.uuid) return next();
    app.db
        .queryAsync('users', { uuid: decoded.uuid })
        .then((users) => {
            let user = users[0];
            req.jwt = {
                authenticated: true,
                token: token,
                user: user,
            };
            return next();
        })
        .catch((err) => next());
};

module.exports.injectCSRF = (req, res, next) => {
    if (!req.session.csrf) {
        req.session.csrf = randomBytes(100).toString('base64');
    }
    next();
};

module.exports.updateCSRF = (req) => {
    req.session.csrf = randomBytes(100).toString('base64');
};
