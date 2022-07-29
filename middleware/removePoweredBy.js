// Copyright © 2022 | LuciferMorningstarDev | All Rights Reserved | ( Email: contact@lucifer-morningstar.dev )

'use strict'; // https://www.w3schools.com/js/js_strict.asp

module.exports = (req, res, next) => {
    res.removeHeader('X-Powered-By');
    next();
};
