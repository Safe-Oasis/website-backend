// Copyright © 2022 | LuciferMorningstarDev | All Rights Reserved | ( Email: contact@lucifer-morningstar.dev )

'use strict'; // https://www.w3schools.com/js/js_strict.asp

// append process.env object by some system variables ( ./.env )
require('dotenv').config();

// add global fetch extension
import('node-fetch').then(({ default: fetch }) => {
    global.fetch = fetch;
});
const request = require('request');

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
const { v4 } = require('uuid');
const JWT = require('jsonwebtoken');
const { passwordStrength } = require('check-password-strength');
const validator = require('validator');

const { deepUpdateObject, deepUpdateObjectCopy } = require('./modules/deepUpdateObject');

// load package.json information
const packageJSON = require('./package.json');

// get the webserver port from .env config
const port = process.env.PORT;

// default and public paths
const defaultPath = __dirname.endsWith('/') ? __dirname : __dirname + '/';
const publicPath = defaultPath + 'public/';

// setup sendmail
const sendmail = require('sendmail')({
    logger: {
        debug: console.log,
        info: console.info,
        warn: console.warn,
        error: console.error,
    },
    silent: false,
    devPort: 25,
    devHost: 'localhost',
    smtpPort: 25,
    smtpHost: 'localhost',
});

// create express application and init/append some data
const app = express();
app.data = { package: packageJSON };

// load database handler, initialite it, and append it to express-app
require('./modules/database').setupDatabaseHandler(app);

// app middlewares
app.use(compression()); // compresses all request data
app.use(cookieParser()); // parses cookies and add it to the req variable ( req.cookies )
app.use(express.json()); // parses json bodys and append data to req variable ( req.body )
app.use(express.urlencoded({ extended: false })); // parses urlencoded bodys and append data to req variable ( req.body )

app.set('json spaces', 4); // set default json indention
app.set('view engine', 'ejs'); // apply ejs template loader to express

// sessions setup
const MongoDBStore = mongoSession(session); // makes sessions saved in mongo database
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

// adding jwt authentication for api
app.use(auth.injectCSRF);

// serve favicon on each request
app.use(require('serve-favicon')(publicPath + 'favicon.ico'));

// inject csrf token
app.use((req, res, next) => auth.authJWT(req, res, next, app));

// public served directories
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

// loads the robots.txt ( SEO )
app.get('/robots.txt', async (_, res) => res.sendFile('./public/robots.txt'));

// makes expres able to read uploaded files
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

// homepage route
app.get('/', async (req, res) => {
    if (req.session.user != null) return res.redirect('/app/');
    res.render('index', { path: '/', csrf_token: req.session.csrf, error: {} });
});

// terms route
app.get('/tos', async (_, res) => res.redirect('/terms'));
app.get('/terms', async (_, res) => {
    res.render('terms', { path: '/terms' });
});

// provacy policy route
app.get('/privacy', async (_, res) => {
    res.render('privacy', { path: '/privacy' });
});

// cookie policy route
app.get('/cookies', async (_, res) => {
    res.render('cookies', { path: '/cookies' });
});

// ============================== OAUTH2 ============================== //

/**
 * This method fetches userdata by a given oauth2 user token
 */
var fetchDiscordUserByToken = async (token) => {
    return new Promise(async (resolve, reject) => {
        var response = await fetch(process.env.OAUTH2_DISCORD_APIURL + '/users/@me', {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        }).catch(reject);
        var user = await response.json();
        resolve(user);
    });
};

// route to redirect to the discord oauth2 endpoint ( the user has to confirm that we can read emails/identity/guilds )
app.get('/oauth2/discord/login', async (req, res) => {
    if (req.session.user != null) return res.redirect('/');
    res.redirect(process.env.OAUTH2_DISCORD_ENDPOINT);
});

// this route gets called when discord redirects to our server
// a code with which we can receive a authentication and refresh token
app.get('/oauth2/discord/callback', async (req, res) => {
    // if a user is already logged in redirect him to homepage
    if (req.session.user != null) return res.redirect('/app/');
    // if a user declines the discord oauth2 page... this url does contain a error querystring of access_denied...
    // so we redirect him back to the startpage
    if (req.query?.error === 'access_denied') return res.redirect('/');

    try {
        let code = req.query.code;
        if (!code) return res.redirect('/oauth2/discord/login'); // if there is no code the user has to accept the discord oauth2 endpoint again

        // request the access and refresh tokens from discord
        request
            .post(
                process.env.OAUTH2_DISCORD_APIURL + '/oauth2/token',
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                },
                (error, _, body) => {
                    if (error) {
                        // if any error in this request occures he user has to accept us again
                        console.error(error);
                        return res.redirect('/oauth2/discord/login');
                    }
                    // load the json data with the tokens
                    let obj = JSON.parse(body);
                    // console.log(obj);
                    let token = obj['access_token'];
                    let refresh_token = obj['refresh_token'];

                    // finally fetch the discord userdata which we need to connect accounts
                    fetchDiscordUserByToken(token)
                        .then(async (user) => {
                            let now = new Date();
                            if (user.message) return res.redirect('/oauth2/discord/login');
                            let websiteUser = await app.db.queryAsync('users', { 'connected_accounts.discord.userId': user.id }).catch(console.error);
                            // console.log(websiteUser);
                            let userProfile;
                            // create a new websiteUser with profile if there is none connected with this discord account
                            // TODO: connect the discord user to a user when there is one with the same mail
                            if (!websiteUser[0]) {
                                websiteUser = require('./objects/defaultUser.json');
                                websiteUser.uuid = v4();
                                websiteUser.email_confirmation_code = v4();
                                userProfile = require('./objects/defaultProfile.json');
                                userProfile.uuid = v4();
                                websiteUser.profile = userProfile.uuid;
                                userProfile.user = websiteUser.uuid;
                                websiteUser.createdAt = now;
                                websiteUser.last_login = now;
                                websiteUser['connected_accounts']['discord']['userId'] = user.id;
                                websiteUser['connected_accounts']['discord']['username'] = user.username;
                                websiteUser['connected_accounts']['discord']['since'] = now;
                                websiteUser['connected_accounts']['discord']['refresh_token'] = refresh_token;
                                websiteUser['connected_accounts']['discord']['access_token'] = token;
                                websiteUser.username = user.username;
                                websiteUser.email = user.email;
                                userProfile.display_name = user.username;
                                sendmail(
                                    {
                                        from: 'no-reply@safeoasis.xyz',
                                        to: websiteUser.email,
                                        subject: 'safeoasis.xyz - confirm your email',
                                        text: fs
                                            .readFileSync('./template/email/registered.txt', 'utf-8')
                                            .replace(/{code}/g, `${websiteUser.uuid}/${websiteUser.email_confirmation_code}`)
                                            .replace(/{host}/g, process.env.OAUTH2_BASE_HOST),
                                    },
                                    (err, reply) => {
                                        // console.log(err && err.stack);
                                        // console.dir(reply);
                                    }
                                );

                                // insert profile and user data to the database
                                await app.db.insertAsync('users', { ...websiteUser }).catch(console.error);
                                await app.db.insertAsync('profiles', { ...userProfile }).catch(console.error);

                                // create a JWT for authentication in api requests
                                let jwt_token = JWT.sign({ username: websiteUser.username, email: websiteUser.email, uuid: websiteUser.uuid }, process.env.JWT_SECRET);
                                req.session.user = websiteUser;
                                req.session.user.profile = userProfile;
                                req.session.isLoggedIn = true;
                                req.session.user.jwt = jwt_token;

                                return res.redirect('/registered');
                            } else {
                                websiteUser = websiteUser[0];
                                app.db.updateAsync('users', { user: websiteUser.uuid }, { last_login: now });
                                websiteUser.last_login = now;
                                userProfile = await app.db.queryAsync('profiles', { user: websiteUser.uuid }).catch(console.error);
                            }
                            // create a JWT for authentication in api requests
                            let jwt_token = JWT.sign({ username: websiteUser.username, email: websiteUser.email, uuid: websiteUser.uuid }, process.env.JWT_SECRET);
                            req.session.user = websiteUser;
                            req.session.user.profile = userProfile;
                            req.session.isLoggedIn = true;
                            req.session.user.jwt = jwt_token;
                            res.redirect('/api/users/@me');
                        })
                        .catch((err) => {
                            console.error(err);
                            res.redirect('/oauth2/discord/login');
                        });
                }
            )
            .form({
                client_id: process.env.OAUTH2_DISCORD_CLIENT,
                client_secret: process.env.OAUTH2_DISCORD_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: process.env.OAUTH2_BASE_HOST + '/oauth2/discord/callback',
                scope: 'identify email guilds',
            });
    } catch (error) {
        console.error(error);
        return res.redirect('/');
    }
});

// ============================== OAUTH2 ============================== //

// ============================== ACCOUNTS ============================== //

app.get('/register', async (req, res) => {
    // console.log('CSRF', req.session.csrf);
    res.render('register', { path: '/register', csrf_token: req.session.csrf, error: {} });
});

app.post('/register', async (req, res) => {
    // console.log(req.body);

    const { username, email, password, password_confirm, csrf_token } = req.body;

    // validate request
    if (!csrf_token || csrf_token != req.session.csrf) return res.render('register', { path: '/register', csrf_token: req.session.csrf, error: { title: 'Invalid Request', description: 'Invalid or none CSRF token provided. Please reload the page.' } });
    if (!username) return res.render('register', { path: '/register', csrf_token: req.session.csrf, error: { title: 'Invalid Request', description: 'No username specified.' } });
    if (!email) return res.render('register', { path: '/register', csrf_token: req.session.csrf, error: { title: 'Invalid Request', description: 'No email specified.' } });
    if (!password || !password_confirm) return res.render('register', { path: '/register', csrf_token: req.session.csrf, error: { title: 'Invalid Request', description: 'Password not existing or mismatch.' } });
    if (password != password_confirm) return res.render('register', { path: '/register', csrf_token: req.session.csrf, error: { title: 'Invalid Request', description: 'Password and confirmed password does not match.' } });

    // check password strength on server site ( a check before is made in frontend too )
    // IDs 	0 = Too weak, 1 = Weak & 2 = Medium, 3 = Strong
    // can contain lowercase, uppercase, number, symbol // length: 8
    const pws = passwordStrength(password);
    // console.log(pws);
    if (!pws.contains.includes('uppercase') || !pws.contains.includes('lowercase') || !pws.contains.includes('number') || !pws.contains.includes('symbol')) {
        return res.render('register', { path: '/register', csrf_token: req.session.csrf, error: { title: 'Password Too Weak', description: 'Your Password must at least contain 1 lowercase and 1 uppercase character, 1 number and 1 symbol.' } });
    }
    if (pws.length < 8) return res.render('register', { path: '/register', csrf_token: req.session.csrf, error: { title: 'Password Length Too Short', description: 'Your Password must be least 8 characters long.' } });

    // validate email
    if (!validator.isEmail(email)) return res.render('register', { path: '/register', csrf_token: req.session.csrf, error: { title: 'Invalid Email Input', description: 'The given email address is not an email address.' } });

    // check for exising users
    let userCheck = await app.db.queryAsync('users', { username: username }).catch(console.error);
    let emailCheck = await app.db.queryAsync('users', { email: email }).catch(console.error);

    if (userCheck.length > 0) return res.render('register', { path: '/register', csrf_token: req.session.csrf, error: { title: 'Username does exist.', description: 'There is already a user with that username.' } });
    if (emailCheck.length > 0) return res.render('register', { path: '/register', csrf_token: req.session.csrf, error: { title: 'Email does exist.', description: 'There is already a user with that email.' } });

    let now = new Date();

    let websiteUser = require('./objects/defaultUser.json');
    let userProfile = require('./objects/defaultProfile.json');

    websiteUser.uuid = v4();
    websiteUser.email_confirmation_code = v4();
    userProfile.uuid = v4();
    websiteUser.profile = userProfile.uuid;
    userProfile.user = websiteUser.uuid;
    websiteUser.createdAt = now;
    websiteUser.last_login = now;
    websiteUser.username = username;
    websiteUser.email = email;
    userProfile.display_name = username;
    websiteUser.hashed_password = await bcrypt.hash(password, Number(process.env.SALT_ROUNDS));

    // insert profile and user data to the database
    await app.db.insertAsync('users', { ...websiteUser }).catch(console.error);
    await app.db.insertAsync('profiles', { ...userProfile }).catch(console.error);

    let jwt_token = JWT.sign({ username: websiteUser.username, email: websiteUser.email, uuid: websiteUser.uuid }, process.env.JWT_SECRET);
    req.session.user = websiteUser;
    req.session.user.profile = userProfile;
    req.session.isLoggedIn = true;
    req.session.user.jwt = jwt_token;

    sendmail(
        {
            from: 'no-reply@safeoasis.xyz',
            to: websiteUser.email,
            subject: 'safeoasis.xyz - confirm your email',
            text: fs
                .readFileSync('./template/email/registered.txt', 'utf-8')
                .replace(/{code}/g, `${websiteUser.uuid}/${websiteUser.email_confirmation_code}`)
                .replace(/{host}/g, process.env.OAUTH2_BASE_HOST),
        },
        (err, reply) => {
            // console.log(err && err.stack);
            // console.dir(reply);
        }
    );

    auth.updateCSRF(req); // invalidate old csrf token and create a new one
    return res.redirect(req.query?.next ?? '/registered');
});

app.get('/logout', async (req, res) => {
    req.session.isLoggedIn = false;
    req.session.destroy(); // destroy user session
    res.redirect(req.query?.next ?? '/');
});

app.get('/login', async (req, res) => {
    if (req.session.user != null) return res.redirect('/app/');
    res.render('index', { path: '/login', csrf_token: req.session.csrf, error: {} });
});

app.post('/login', async (req, res) => {
    if (req.session.user) return res.redirect('/');
    const { username, password, csrf_token } = req.body;

    if (!csrf_token || csrf_token != req.session.csrf) return res.render('index', { path: '/', csrf_token: req.session.csrf, error: { title: 'Invalid Request', description: 'Invalid or none CSRF token provided. Please reload the page.' } });

    if (!username) return res.render('index', { path: '/', csrf_token: req.session.csrf, error: { title: 'Invalid Request', description: 'No username specified.' } });
    if (!password) return res.render('index', { path: '/', csrf_token: req.session.csrf, error: { title: 'Invalid Request', description: 'Password not existing or mismatch.' } });

    let websiteUser;
    if (validator.isEmail(username)) {
        websiteUser = await app.db.queryAsync('users', { email: username });
    } else {
        websiteUser = await app.db.queryAsync('users', { username: username });
    }

    if (!websiteUser[0]) return res.render('index', { path: '/', csrf_token: req.session.csrf, error: { title: 'User does not exist.', description: 'There is no user with the given email or username' } });

    websiteUser = websiteUser[0];

    if (!websiteUser.hashed_password) {
        if (websiteUser.connected_accounts.discord.refresh_token) return res.render('index', { path: '/', csrf_token: req.session.csrf, error: { title: 'Password Error.', description: 'You have not set any password. Please try to login via discord' } });
        if (websiteUser.connected_accounts.google.refresh_token) return res.render('index', { path: '/', csrf_token: req.session.csrf, error: { title: 'Password Error.', description: 'You have not set any password. Please try to login via google' } });
        return res.render('index', { path: '/', csrf_token: req.session.csrf, error: { title: 'Password Error.', description: 'You have not set any password. Please try to login via google or discord' } });
    }

    let canAccess = await bcrypt.compare(password, websiteUser.hashed_password);
    if (!canAccess) return res.render('index', { path: '/', csrf_token: req.session.csrf, error: { title: 'Password Error.', description: 'The given password is incorrect.' } });

    let userProfile = await app.db.queryAsync('profiles', { user: websiteUser.uuid });
    userProfile = userProfile[0];

    let jwt_token = JWT.sign({ username: websiteUser.username, email: websiteUser.email, uuid: websiteUser.uuid }, process.env.JWT_SECRET);
    req.session.user = websiteUser;
    req.session.user.profile = userProfile;
    req.session.isLoggedIn = true;
    req.session.user.jwt = jwt_token;

    res.redirect('/api/users/@me');
});

app.get('/registered', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    return res.render('email_confirm', { path: '/registered', uuid: req.session.user.uuid, error: { title: 'Thanks for your registration at safeoasis.xyz', description: `A link to confirm your email address was sent to ${req.session.user.email}` } });
});

app.get('/email/confirm/:uuid/:code', async (req, res) => {
    let { code, uuid } = req.params;
    if (!code || !uuid) return res.redirect('/logout?next=/');

    let user = await app.db.queryAsync('users', { uuid });
    if (user.length <= 0) return res.render('email_confirm', { path: '/email/confirm', error: { title: 'Wrong code or uuid provided.', description: 'The userId or confirmation code does not exist.' } });
    user = user[0];
    if (code != user.email_confirmation_code) return res.render('email_confirm', { path: '/email/confirm', error: { title: 'Confirmation code invalid or expired.', description: 'Your email address could not been confirmed,' } });

    if (req.session.user?.uuid == uuid) {
        req.session.user.email_confirmed = true;
    }

    app.db.updateAsync('users', { uuid }, { email_confirmed: true });

    res.render('email_confirm', { path: '/email/confirm', error: { title: 'Email Confirmation', description: 'Thanks... The confirmation of your email was successful. You can use your full account now.' } });
});

app.get('/email/resend_confirm/:uuid', async (req, res) => {
    let { uuid } = req.params;
    if (!uuid && !req.session.user?.uuid) return res.redirect('/logout?next=/');
    if (!uuid) uuid = req.session.user?.uuid;

    let user = await app.db.queryAsync('users', { uuid });
    if (user.length <= 0) return res.render('email_confirm', { path: '/email/confirm', error: { title: 'Wrong uuid provided.', description: 'The userId does not exist.' } });
    user = user[0];

    if (user.email_confirmed) return res.render('email_confirm', { path: '/email/confirm', error: { title: 'Email is already confirmed', description: 'Your email was confirmed before.' } });

    user.email_confirmation_code = v4();
    if (req.session.user) {
        req.session.user.email_confirmation_code = user.email_confirmation_code;
    }
    await app.db.updateAsync('users', { uuid }, { email_confirmation_code: user.email_confirmation_code });

    sendmail(
        {
            from: 'no-reply@safeoasis.xyz',
            to: user.email,
            subject: 'safeoasis.xyz - confirm your email',
            text: fs
                .readFileSync('./template/email/registered.txt', 'utf-8')
                .replace(/{code}/g, `${user.uuid}/${user.email_confirmation_code}`)
                .replace(/{host}/g, process.env.OAUTH2_BASE_HOST),
        },
        (err, reply) => {
            // console.log(err && err.stack);
            // console.dir(reply);
        }
    );

    res.render('email_confirm', { path: '/registered', uuid: req.session.user.uuid, error: { title: 'Resend confirmation code', description: `A link to confirm your email address was sent again to ${req.session.user.email}` } });
});

// ============================== ACCOUNTS ============================== //

// 404 Handling
app.get('*', async (req, res) => {
    res.status(404).render('404', { path: req.url });
});
app.all('*', async (_, res) => {
    res.status(404).json({ error: true, message: 'not found' });
});

// finally create server listening to the port specified by .env config
app.listen(port, () => {
    console.log('HTTP WEBSERVER Server running on Port ' + port);
});
