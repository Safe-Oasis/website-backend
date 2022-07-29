// Copyright © 2022 | LuciferMorningstarDev | All Rights Reserved | ( Email: contact@lucifer-morningstar.dev )

'use strict'; // https://www.w3schools.com/js/js_strict.asp

const MongoClient = require('./mongo-client');
var client = new MongoClient(process.env.DATABASE_CONNECTION);

module.exports.setupDatabaseHandler = (app) => {
    app.db = {
        client: client,
    };
    app.db.queryAsync = async (collection, searchQuery) => app.db.client.queryAsync(process.env.DATABASE_NAME, collection, searchQuery);
    app.db.insertAsync = async (collection, data) => app.db.client.insertObjectAsync(process.env.DATABASE_NAME, collection, data);
    app.db.updateAsync = async (collection, searchQuery, data) => app.db.client.updateObjectAsync(process.env.DATABASE_NAME, collection, searchQuery, data);
    app.db.deleteAsync = async (collection, searchQuery) => app.db.client.deleteObjectAsync(process.env.DATABASE_NAME, collection, searchQuery);
    app.db.rawQueryAsync = async (database, collection, searchQuery) => app.db.client.queryAsync(database, collection, searchQuery);
    app.db.rawInsertAsync = async (database, collection, data) => app.db.client.insertObjectAsync(database, collection, data);
    app.db.rawUpdateAsync = async (database, collection, searchQuery, data) => app.db.client.updateObjectAsync(database, collection, searchQuery, data);
    app.db.rawDeleteAsync = async (database, collection, searchQuery) => app.db.client.deleteObjectAsync(database, collection, searchQuery);
};
