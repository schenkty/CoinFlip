/* @flow */

// eslint-disable-next-line import/no-commonjs, import/no-unassigned-import
require('babel-register');

// eslint-disable-next-line import/no-commonjs
let { app, SERVER_PORT } = require('./src');

app.listen(SERVER_PORT);
console.log(`coinflip server listening on http://127.0.0.1:${ SERVER_PORT }`);
