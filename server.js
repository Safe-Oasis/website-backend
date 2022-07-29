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
const { randomBytes } = require('crypto');
const bcrypt = require('bcrypt');

const serveFavicon = require('serve-favicon');

const fs = require('node:fs');

const packageJSON = require('./package.json');

const port = process.env.PORT;

const defaultPath = process.cwd().endsWith('/') ? process.cwd() : process.cwd() + '/';

const publicPath = defaultPath + 'public/';

const MongoDBStore = mongoSession(session);

// create app
const app = express();

// app middlewares
app.use(compression());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.set('json spaces', 4);
app.set('view engine', 'ejs');

// sessions setup
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

// for security reason remove the powered by header
app.use(require('./middleware/removePoweredBy'));
// CORS Policy things
app.use(require('./middleware/cors'));
// Content security headers
app.use(require('./middleware/contentSecurityPolicy'));

// authentication
const authRequired = require('./middleware/auth');

// Basic redirects
app.get('/github', async (req, res) => res.redirect('https://github.com/Safe-Oasis'));
app.get('/discord', async (req, res) => res.redirect('https://discord.gg/fmjVTKH9Gy'));
app.get('/join', async (req, res) => res.redirect('https://discord.gg/fmjVTKH9Gy'));
app.get('/twitter', async (req, res) => res.redirect('https://twitter.com/SafeOasis'));
app.get('/tiktok', async (req, res) => res.redirect('https://tiktok.com/@safeoasis'));
app.get('/instagram', async (req, res) => res.redirect('https://instagram.com/safeoasis.xyz'));
app.get('/tip', async (req, res) => res.redirect('https://www.buymeacoffee.com/safeoasis'));
app.get('/donate', async (req, res) => res.redirect('https://www.buymeacoffee.com/safeoasis'));
app.get('/email', async (req, res) => res.redirect('mailto:contact@safeoasis.xyz'));

app.use('/public', express.static(publicPath));
app.use('/uploads', express.static('uploads'));
// serve favicon on each request
app.use(serveFavicon(publicPath + 'favicon.ico'));

require('./modules/database').setupDatabaseHandler(app);

// inject csrf token
app.use(authRequired.injectCSRF);

app.use(
    fileUpload({
        useTempFiles: true,
        tempFileDir: '/tmp/',
        limits: { fileSize: 50 * 1024 * 1024 },
        limitHandler: (req, res) => {
            return res.status(413).json({ error: true, message: 'TOO BIG (50mb)' });
        },
    })
);

app.get('/', async (_, res) => {
    res.render('index', { path: '/' });
});

// 404 Handling
app.get('*', async (_, res) => {
    res.status(404).send('<h1>404 Error</h1>');
});

app.listen(port, () => {
    console.log('HTTP WEBSERVER Server running on Port ' + port);
});
