// Copyright © 2022 | LuciferMorningstarDev | All Rights Reserved | ( Email: contact@lucifer-morningstar.dev )

'use strict'; // https://www.w3schools.com/js/js_strict.asp

// append process.env object by some system variables ( ./.env )
require('dotenv').config();

// add global fetch extension
import('node-fetch').then(({ default: fetch }) => {
    global.fetch = fetch;
});

// imports
const express = require('express');
const session = require('express-session');

const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const fileUpload = require('express-fileupload');
const mongoSession = require('express-mongodb-session');

const fs = require('node:fs');
const path = require('node:path');

const bcrypt = require('bcrypt');

const packageJSON = require('./package.json');

const port = process.env.PORT;

const defaultPath = __dirname.endsWith('/') ? __dirname : __dirname + '/';

const publicPath = defaultPath + 'public/';

// create app
const app = express();
app.data = { package: packageJSON };

require('./modules/database').setupDatabaseHandler(app);

// app middlewares
app.use(compression());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.set('json spaces', 4);
app.set('view engine', 'ejs');

// sessions setup
const MongoDBStore = mongoSession(session);
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: new MongoDBStore({
            uri: process.env.DATABASE_CONNECTION,
            collection: 'sessions',
        }),
    })
);

// authentication
const auth = require('./middleware/auth');
// for security reason remove the powered by header
app.use(require('./middleware/removePoweredBy'));
// CORS Policy things
app.use(require('./middleware/cors'));
// Content security headers
app.use(require('./middleware/contentSecurityPolicy'));

// serve favicon on each request
app.use(require('serve-favicon')(publicPath + 'favicon.ico'));

// inject csrf token
app.use(auth.injectCSRF);

app.use('/public/', express.static(publicPath));
app.use('/uploads/', express.static(defaultPath + 'uploads/'));
app.use('/app/', express.static(defaultPath + 'app/build/'));
app.use('/api/', require('./api')(app));

// Basic redirects
app.get('/github', async (_, res) => res.redirect('https://github.com/Safe-Oasis'));
app.get('/discord', async (_, res) => res.redirect('https://discord.gg/fmjVTKH9Gy'));
app.get('/join', async (_, res) => res.redirect('https://discord.gg/fmjVTKH9Gy'));
app.get('/twitter', async (_, res) => res.redirect('https://twitter.com/SafeOasis'));
app.get('/tiktok', async (_, res) => res.redirect('https://tiktok.com/@safeoasis'));
app.get('/instagram', async (_, res) => res.redirect('https://instagram.com/safeoasis.xyz'));
app.get('/tip', async (_, res) => res.redirect('https://www.buymeacoffee.com/safeoasis'));
app.get('/donate', async (_, res) => res.redirect('https://www.buymeacoffee.com/safeoasis'));
app.get('/email', async (_, res) => res.redirect('mailto:contact@safeoasis.xyz'));

app.get('/robots.txt', async (_, res) => res.sendFile('./public/robots.txt'));

app.use(
    fileUpload({
        useTempFiles: true,
        tempFileDir: '/tmp/',
        limits: { fileSize: 50 * 1024 * 1024 },
        limitHandler: (req, res) => {
            return res.status(413).json({ error: true, message: 'FILE TOO BIG (max 50mb)' });
        },
    })
);

app.get('/', async (_, res) => {
    res.render('index', { path: '/' });
});

app.get('/tos', async (_, res) => res.redirect('/terms'));
app.get('/terms', async (_, res) => {
    res.render('terms', { path: '/terms' });
});

app.get('/privacy', async (_, res) => {
    res.render('privacy', { path: '/privacy' });
});

app.get('/cookies', async (_, res) => {
    res.render('cookies', { path: '/cookies' });
});

// 404 Handling
app.get('*', async (_, res) => {
    res.status(404).send('<h1>404 Error</h1>');
});

app.listen(port, () => {
    console.log('HTTP WEBSERVER Server running on Port ' + port);
});
