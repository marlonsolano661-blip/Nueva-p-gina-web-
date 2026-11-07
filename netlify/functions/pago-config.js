'use strict';
exports.handler = require('../../lib/adapters').netlify(require('../../lib/pago-config'));
