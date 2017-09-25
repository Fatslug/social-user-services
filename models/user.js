// app/models/user.js
// load the things we need
var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');

// define the schema for our user model
var userSchema = mongoose.Schema({
    userID: String,
    photo: String,
    email: String,
    name: String,
    password: String,

    google: {
        in_use: Boolean,
        currentOccupation: String,
        placesLived: { type: Array, default: void 0 },
        organizations: { type: Array, default: void 0 },
        token: String,
        refreshToken: String,
        tokenTimestamp: Date,
        tokenExpiry: Date
    },
    facebook: {
        in_use: Boolean,
        token: String,
        refreshToken: String,
        tokenTimestamp: Date,
        tokenExpiry: Date
    }
});

// methods ======================
// generating a hash
userSchema.methods.generateHash = function(password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

// checking if password is valid
userSchema.methods.validatePassword = function(password) {
    // return bcrypt.compareSync(password, this.password);
    return (password === this.password);
};

// create the model for users and expose it to our app
module.exports = mongoose.model('USER', userSchema);