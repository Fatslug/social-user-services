// load the auth variables
var mongoose = require('mongoose'),
    USER = mongoose.model('USER');

// DB Routes
exports.getAllUser = function (req, res) {
    // console.log('getting users');
    USER.find({}, function (err, user) {
        if (err) {
            res.json(err);
        } else {
            res.json(user);
        }
    });
};

//ADDITIONAL PARAMS MUST BE A JSON STRING
exports.createUser = function (req, res) {
    // console.log('create user');
    var newUser = new USER(req.body);
    newUser.save(function (err, user) {
        if (err) {
            res.json(err);
        } else {
            res.json(user);
        }
    });
};

exports.deleteUser = function (req, res) {
    // console.log(req.params);
    USER.findByIdAndRemove(req.params.id, function (err, user) {
        // console.log(err);
        // console.log(user);
        if (err) {
            res.send(err);
        } else {
            res.json({message: 'Rule successfully deleted'});
        }
    });
};

exports.getUser = function (req, res) {
    // console.log(req.params);
    USER.findById(req.params.id, function (err, user) {
        // console.log(err);
        // console.log(user);
        if (err) {
            res.send(err);
        } else {
            res.json(user);
        }
    });
};
