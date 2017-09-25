/**
 * Created by e84495 on 5/10/2017.
 */
'use strict';
var DB = require('../controller/DB.js');
module.exports = function (app) {

    app.route('/users')
        .get(DB.getAllUser)
        .post(DB.createUser);

    app.route('/user/:id')
        .get(DB.getUser)
        .delete(DB.deleteUser);
    // app.route('/rules/:id')
    //     .post(RULE.updateRule)
    //     .delete(RULE.delete_a_rule);
};
