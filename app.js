var express = require('express'); // ExperssJS Framework
var app = express(); // Invoke express to variable for use in application

app.use(function (req, res, next) {
    
    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, authorization');

    // Pass to next layer of middleware
    return next();
});

var port = process.env.PORT || 8000; // Set default port or assign a port in enviornment
var mongoose = require('mongoose'); // HTTP request logger middleware for Node.js
var bodyParser = require('body-parser'); // Node.js body parsing middleware. Parses incoming request bodies in a middleware before your handlers, available under req.body.
var path = require('path'); // Import path module
var passport = require('passport'); // Express-compatible authentication middleware for Node.js.
var social = require('./controller/passport')(app, passport); // Import passport.js End Points/API
var session = require('express-session'); // Import Express Session Package

app.use(bodyParser.json()); // Body-parser middleware
app.use(bodyParser.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded
app.use(express.static(__dirname + '/public')); // Allow front end to access public folder

mongoose.connect('mongodb://localhost/social-login', {useMongoClient: true},function(err) {
    if (err) {
        console.log('Not connected to the database: ' + err); // Log to console if unable to connect to database
    } else {
        console.log('Successfully connected to MongoDB'); // Log to console if able to connect to database
    }
});

// Start Server
var routes = require('./routes/index.js');
routes(app);
app.listen(port, function() {
    console.log('Running the server on port ' + port); // Listen on configured port
});