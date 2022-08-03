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

const packageJSON = require('./package.json');

const port = process.env.PORT;

const defaultPath = __dirname.endsWith('/') ? __dirname : __dirname + '/';

const publicPath = defaultPath + 'public/';

const sendmail = require('sendmail')({
    logger: {
        debug: console.log,
        info: console.info,
        warn: console.warn,
        error: console.error,
    },
    silent: false,
    devPort: 25, // Default: False
    devHost: 'localhost', // Default: localhost
    smtpPort: 25, // Default: 25
    smtpHost: 'localhost', // Default: -1 - extra smtp host after resolveMX
});

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

// adding jwt authentication for api
app.use(auth.injectCSRF);

// serve favicon on each request
app.use(require('serve-favicon')(publicPath + 'favicon.ico'));

// inject csrf token
app.use((req, res, next) => auth.authJWT(req, res, next, app));

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

app.get('/', async (req, res) => {
    if (req.session.user != null) return res.redirect('/app/');
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

// ============================== OAUTH2 ============================== //

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

app.get('/oauth2/discord/login', async (req, res) => {
    if (req.session.user != null) return res.redirect('/');
    res.redirect(process.env.OAUTH2_DISCORD_ENDPOINT);
});

app.get('/oauth2/discord/callback', async (req, res) => {
    if (req.session.user != null) return res.redirect('/');
    if (req.query?.error === 'access_denied') return res.redirect('/');

    try {
        let code = req.query.code;
        if (!code) return res.redirect('/oauth2/discord/login');

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
                        console.error(error);
                        return res.redirect('/oauth2/discord/login');
                    }
                    let obj = JSON.parse(body);
                    // console.log(obj);
                    let token = obj['access_token'];
                    let refresh_token = obj['refresh_token'];
                    fetchDiscordUserByToken(token)
                        .then(async (user) => {
                            let now = new Date();
                            if (user.message) return res.redirect('/oauth2/discord/login');
                            let websiteUser = await app.db.queryAsync('users', { 'connected_accounts.discord.userId': user.id }).catch(console.error);
                            // console.log(websiteUser);
                            let userProfile;
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
                                        html: fs
                                            .readFileSync('./template/email/registered.html', 'utf-8')
                                            .replace(/{code}/g, `${websiteUser.uuid}/${websiteUser.email_confirmation_code}`)
                                            .replace(/{host}/g, process.env.OAUTH2_BASE_HOST),
                                    },
                                    function (err, reply) {
                                        // console.log(err && err.stack);
                                        // console.dir(reply);
                                    }
                                );
                                await app.db.insertAsync('users', { ...websiteUser }).catch(console.error);
                                await app.db.insertAsync('profiles', { ...userProfile }).catch(console.error);

                                let jwt_token = JWT.sign({ username: websiteUser.username, email: websiteUser.email, uuid: websiteUser.uuid }, process.env.JWT_SECRET);
                                req.session.user = websiteUser;
                                req.session.user.profile = userProfile;
                                req.session.user.jwt = jwt_token;
                                req.session.isLoggedIn = true;

                                return res.redirect('/registered');
                            } else {
                                websiteUser = websiteUser[0];
                                app.db.updateAsync('users', { user: websiteUser.uuid }, { last_login: now });
                                websiteUser.last_login = now;
                                userProfile = await app.db.queryAsync('profiles', { user: websiteUser.uuid }).catch(console.error);
                            }
                            let jwt_token = JWT.sign({ username: websiteUser.username, email: websiteUser.email, uuid: websiteUser.uuid }, process.env.JWT_SECRET);
                            req.session.user = websiteUser;
                            req.session.user.profile = userProfile;
                            req.session.user.jwt = jwt_token;
                            req.session.isLoggedIn = true;
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
    if (!csrf_token || csrf_token != req.session.csrf) return res.render('register', { path: '/register', csrf_token: req.session.csrf, error: { title: 'Invalid Request', description: 'Invalid or none CSRF token provided.' } });
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

    await app.db.insertAsync('users', { ...websiteUser }).catch(console.error);
    await app.db.insertAsync('profiles', { ...userProfile }).catch(console.error);

    req.session.user = websiteUser;
    req.session.user.profile = userProfile;
    req.session.isLoggedIn = true;

    sendmail(
        {
            from: 'no-reply@safeoasis.xyz',
            to: websiteUser.email,
            subject: 'safeoasis.xyz - confirm your email',
            html: fs
                .readFileSync('./template/email/registered.html', 'utf-8')
                .replace(/{code}/g, `${websiteUser.uuid}/${websiteUser.email_confirmation_code}`)
                .replace(/{host}/g, process.env.OAUTH2_BASE_HOST),
        },
        function (err, reply) {
            // console.log(err && err.stack);
            // console.dir(reply);
        }
    );

    auth.updateCSRF(req); // invalidate old csrf token and create a new one
    return res.redirect(req.query?.next ?? '/registered');
});

app.get('/logout', async (req, res) => {
    req.session.isLoggedIn = false;
    req.session.destroy();
    res.redirect(req.query?.next ?? '/');
});

app.get('/registered', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    return res.render('email_confirm', { path: '/email/confirm', error: { title: 'Thanks for your registration at safeoasis.xyz', description: `A link to confirm your email address was sent to ${req.session.user.email}` } });
});

app.get('/email/confirm/:uuid/:code', async (req, res) => {
    let { code, uuid } = req.params;
    if (!code || !uuid) return res.redirect('/logout?next=/');

    let user = await app.db.queryAsync('users', { uuid });
    if (user.length <= 0) return res.render('email_confirm', { path: '/email/confirm', error: { title: 'Wrong code or uuid provided.', description: 'The userId or confirmaion code does not exist.' } });
    user = user[0];
    if (code != user.email_confirmation_code) return res.render('email_confirm', { path: '/email/confirm', error: { title: 'Confirmation code invalid or expired.', description: 'Your email address could not been confirmed,' } });

    if (req.session.user?.uuid == uuid) {
        req.session.user.email_confirmed = true;
    }

    app.db.updateAsync('users', { uuid }, { email_confirmed: true });

    res.render('email_confirm', { path: '/email/confirm', error: { title: 'Email Confirmation', description: 'Thanks... The confirmation of your email was successful. You can use your full account now.' } });
});

// app.get('/testmail', async (req, res) => {
//     res.send(`
// <form action="" method="post">
//     <p class="txt"></p>
//     <input type="email" name="email" id="email" />
//     <button type="submit">send</button>
// </form>
//     `);
// });

// app.post('/testmail', async (req, res) => {
//     sendmail(
//         {
//             from: 'no-reply@safeoasis.xyz',
//             to: req.body.email,
//             subject: 'Confirm your Email',
//             html: fs
//                 .readFileSync('./template/email/registered.html', 'utf-8')
//                 .replace(/{code}/g, 'just-a-test-email')
//                 .replace(/{host}/g, process.env.OAUTH2_BASE_HOST),
//         },
//         function (err, reply) {
//             console.log(err && err.stack);
//             console.dir(reply);
//         }
//     );
//     res.send(`
// <form action="" method="post">
//     <p class="txt">sent</p>
//     <input type="email" name="email" id="email" />
//     <button type="submit">send</button>
// </form>
//     `);
// });

// ============================== ACCOUNTS ============================== //

// 404 Handling
app.get('*', async (req, res) => {
    res.status(404).render('404', { path: req.url });
});
app.all('*', async (_, res) => {
    res.status(404).json({ error: true, message: 'not found' });
});

app.listen(port, () => {
    console.log('HTTP WEBSERVER Server running on Port ' + port);
});
