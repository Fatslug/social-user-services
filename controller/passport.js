var FacebookStrategy = require('passport-facebook').Strategy; // Import Passport-Facebook Package
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy; // Import Passport Google Package
var BasicStrategy = require('passport-http').BasicStrategy;
var refresh = require('passport-oauth2-refresh')
var USER = require('../models/user'); // Import User Model
var session = require('express-session'); // Import Express Session Package
var jwt = require('jsonwebtoken'); // Import JWT Package
var secret = 'harrypotter'; // Create custom secret to use with JWT
var FB = require('fb');

var bodyParser = require('body-parser').json();

// load the auth variables
var configAuth = require('../utility/config');
var https = require('https');

var token;

// addPlatformToUser
// Creates an object with data specific to a social platform
// This data is then appended to our user object and updated back to the database
function addPlatformToUser(profile, tokenData, smPlatform) {
	var tokenTimestamp = new Date();
	var tokenExpiry = tokenData.expires_in;
	
	if (smPlatform === "facebook") {
		var platformData = {
			facebook: {
				in_use: true,
				token: tokenData.access_token,
				refreshToken: tokenData.refresh_token,
				tokenTimestamp: tokenTimestamp,
				tokenExpiry: new Date().setSeconds(tokenTimestamp.getSeconds() + tokenExpiry)
			}
		}
	} else if (smPlatform === "google") {
		var platformData = {
			google: {
				in_use: true,
				currentOccupation: profile._json.occupation,
				placesLived: profile._json.placesLived,
				organizations: profile._json.organizations,
				token: tokenData.access_token,
				refreshToken: tokenData.refresh_token,
				tokenTimestamp: tokenTimestamp,
				tokenExpiry: new Date().setSeconds(tokenTimestamp.getSeconds() + tokenExpiry)
			}
		}
	}
	return platformData;
}

// createUser
// Creates an object containing all generic user data, and data specific to the logged in social media platform
// This object is then cast to a USER object, where we have access to our mongoose methods (CRUD)
function createUser(profile, tokenData, smPlatform) {
	if (smPlatform !== 'basic') {
		var tokenTimestamp = new Date();
		var tokenExpiry = tokenData.expires_in;
		var photoUrl = smPlatform == "facebook" ? "https://graph.facebook.com/" + profile.id + "/picture?type=large&w‌​idth=720&height=720" : profile.photos[0].value.slice(0,profile.photos[0].value.length-2)+"500";	
	}
	
	if (smPlatform === "facebook") {
		// FACEBOOK USER
		var newUser = {
			userID: profile.id,
			photo: photoUrl,
			email: profile.emails[0].value,
			name: profile.displayName,

			facebook: {
				in_use: true,
				token: tokenData.access_token,
				refreshToken: tokenData.refresh_token,
				tokenTimestamp: tokenTimestamp,
				tokenExpiry: new Date().setSeconds(tokenTimestamp.getSeconds() + tokenExpiry)
			}
		};
	} else if (smPlatform === "google") {
		console.log("CREATE USER: RefreshToken: ", tokenData.refresh_token);

		// GOOGLE USER
		var newUser = {
			userID: profile.id,
			photo: photoUrl,
			email: profile.emails[0].value,
			name: profile.displayName,
			
			google: {
				in_use: true,
				currentOccupation: profile._json.occupation,
				placesLived: profile._json.placesLived,
				organizations: profile._json.organizations,
				token: tokenData.access_token,
				refreshToken: tokenData.refresh_token,
				tokenTimestamp: tokenTimestamp,
				tokenExpiry: new Date().setSeconds(tokenTimestamp.getSeconds() + tokenExpiry)
			}
		};
	} else if (smPlatform === "basic") {

		// CUSTOM USER
		var newUser = {
			name: profile.name,
			email: profile.emails[0].value,
			password: profile.password
		};
		
	}

	return newUser;
}


// Find user
// Finds the user if they already exist, refreshes accessToken if it is expired
// If no user, registers the user in MongoDB and provides them with a fresh accessToken
function findUser(profile, tokenData, smPlatform) {
	return new Promise((resolve, reject) => {
		USER.findOne({'email': profile.emails[0].value}).select('email facebook google').exec(function(err, user) {
			if (err) done(err);

			// USER FOUND -- FETCH USER
			if (user && user !== null) {
				console.log("User found - retrieving profile...");

				// Has this user logged in with this social platform before?
				if (smPlatform !== 'basic' && !user[smPlatform].in_use) { // First time logging in with this platform
					console.log("User's first time logging in with: " + smPlatform);
					var updateUser = addPlatformToUser(profile, tokenData, smPlatform);

					console.log("Adding " + smPlatform + " object to userID: ", user._id);
					USER.update({ _id: user._id }, updateUser, function(mongoErr, raw) {
						if (mongoErr) {
							console.log("Error updating user.");
							resolve({err: mongoErr, data: null});
						} else {
							console.log("Existing user updated!");
							resolve({err: null, data: user });
						}
					});
				} else { // Platform has already been linked to this account
					// CHECK ACCESS TOKENS FOR EXPIRATION
					console.log("User has already linked this social platform: " + smPlatform);
					console.log("Updating user data: ", user._id);

					if (tokenData) {
						var tokenTimestamp = new Date();
						var tokenExpiry = tokenData.expires_in;
						var refreshToken = tokenData.refresh_token;
					}

					var userUpdate = {};

					if (smPlatform === 'google') {
						userUpdate = {
							'google.token': tokenData.access_token,
							'google.tokenTimestamp': tokenTimestamp,
							'google.refreshToken': refreshToken,
							'google.tokenExpiry': new Date().setSeconds(tokenTimestamp.getSeconds() + tokenExpiry)
						};
					} else if (smPlatform === 'facebook') {
						userUpdate = {
							'facebook.token': tokenData.access_token,
							'facebook.tokenTimestamp': tokenTimestamp,
							'facebook.refreshToken': refreshToken,
							'facebook.tokenExpiry': new Date().setSeconds(tokenTimestamp.getSeconds() + tokenExpiry)
						};
					} else if (smPlatform === 'basic') {
						switch(profile.requestType) {
							case 'register':
								userUpdate = {
									'password': profile.password
								}
							break;
							case 'login': 
								user.validatePassword(profile.password);
							break;
						}
					}
					USER.update({ _id: user._id }, userUpdate, function(mongoErr, raw) {
						if (mongoErr) {
							console.log("Error updating token info.");
							resolve({err: mongoErr, data: null});
						} else {
							console.log("Existing user info updated!");
							resolve({err: null, data: user });
						}
					});

					resolve({err: null, data: user});
				}
			// NO USER FOUND -- CREATE USER IF SOCIAL MEDIA LOGIN
			} else {
				if (smPlatform !== 'basic') {
					console.log("No existing user found - creating new user...");
					var newUser = new USER(createUser(profile, tokenData, smPlatform));
	
					newUser.save(function (mongoErr) {
						if (mongoErr) {
							console.log("Error saving new user.");
							resolve({err: mongoErr, data: null});
						} else {
							console.log("New user added!");
							resolve({err: null, data: newUser});
						}
					});
				} else {
					resolve({ err: "No user found.", data: null });
				}
			}
		});
	});
}


module.exports = function (app, passport) {

// Start Passport Configuration Settings
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(session({
        secret: 'keyboard cat',
        resave: false,
        saveUninitialized: true,
        cookie: {
            secure: false
        }
    }));
// End Passport Configuration Settings


    // Serialize users once logged in   
    passport.serializeUser(function (user, done) {
        console.log("Serializing user...");
        // Check if user's social media account has an error
        if (user.error) {
            token = 'unconfirmed/error'; // Set url to different error page
        } else {
            token = user.id; // If account active, give user token
        }
        done(null, user); // Return user object
    });

    // Deserialize Users once logged out    
    passport.deserializeUser(function (id, done) {
        USER.findById(id, function (err, user) {
            done(err, user); // Complete deserializeUser and return done
        });
	});






	var basicStrategy = new BasicStrategy(function(userid, password, done) {
		console.log("Running basic strategy...");
		console.log("User ID: " + userid);
		console.log("Password: " + password);
		USER.findOne({ email: userid }, function (err, user) {
			if (err) {
				return done(err); 
			}
			if (!user) { 
				return done(null, false); 
			}
			if (!user.validatePassword(password)) { 
				return done(null, false); 
			}
			return done(null, user);
		});
	});





    // Google Strategy  
    var googleStrategy = new GoogleStrategy({
		clientID: configAuth.googleAuth.clientID,
		clientSecret: configAuth.googleAuth.clientSecret,
		callbackURL: configAuth.googleAuth.callbackURL,
	},
	function (accessToken, refreshToken, profile, done) { // called when we hit the callbackURL
		console.log("Google Strategy callback...");

		console.log("Access Token: ", accessToken);
		console.log("Refresh Token: ", refreshToken);
		
		var options = {
			host: 'www.googleapis.com',
			port: 443,
			path: '/oauth2/v1/tokeninfo?access_token='+accessToken,
		};
		var req = https.get(options, (response) => {
			// console.log("REQUEST: ", req);                
			response.on('data', function (chunk) {
				var body = JSON.parse(chunk);

				var tokenInfo = {
					access_token: accessToken,
					refresh_token: refreshToken,
					expires_in: body.expires_in
				};

				findUser(profile, tokenInfo, "google").then((result) => {
					done(result.err, result.data);
				});
			});
		});
		req.end();

		req.on('error', (e) => {
			console.log(e);
			done(e);
		});
	});






    // Facebook Strategy
    var fbStrategy = new FacebookStrategy({
		clientID: configAuth.facebookAuth.clientID, // Replace with your Facebook Developer App client ID
		clientSecret: configAuth.facebookAuth.clientSecret, // Replace with your Facebook Developer client secret
		callbackURL: configAuth.facebookAuth.callbackURL, // Replace with your Facebook Developer App callback URL
		profileFields: ['id', 'displayName', 'photos', 'email']
	},
	function(accessToken, refreshToken, profile, done) {
		console.log("Facebook Strategy callback...");

		var shortLifeAccessToken = accessToken;
		var longLifeAccessToken;

		FB.api('oauth/access_token', {
			client_id: configAuth.facebookAuth.clientID,
			client_secret: configAuth.facebookAuth.clientSecret,
			grant_type: 'fb_exchange_token',
			fb_exchange_token: shortLifeAccessToken
		}, function(res) {
			if (!res || res.error) {
				console.log(!res ? 'could not extend ' + provider + 'token' : res.error);
				return next(); // TODO change this to a usable response that will show up on the client side aka not sure how we are handling errors in this app yet!
			}
			console.log('LL Access Token: ' + res.access_token);
			findUser(profile, res, "facebook").then((result) => {
				done(result.err, result.data);
			});
		});





	});

	passport.use(googleStrategy);
	passport.use(fbStrategy);
	passport.use(basicStrategy);

    // Google Routes
    app.get('/auth/google', passport.authenticate('google', {scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/calendar'], accessType: 'offline', approvalPrompt: 'force'}));
    app.get('/auth/google/callback', passport.authenticate('google', {failureRedirect: 'http://localhost:4200/login-error'}), function (req, res) {
        console.log("Redirecting back to app...");
        res.redirect('http://localhost:4200/login/' + token); // Redirect user with newly assigned token
    });

    // Facebook Routes
    app.get('/auth/facebook', passport.authenticate('facebook', { scope: 'email, user_likes', accessType: 'offline', approvalPrompt: 'force'}));
    app.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: 'http://localhost:4200/login-error' }), function(req, res) {
        console.log("Redirecting back to app...");
        res.redirect('http://localhost:4200/login/' + token); // Redirect user with newly assigned token
	});
	
	// Local Routes
    app.post('/auth/basic', passport.authenticate('basic', { session: false }), function(req, res) {
		console.log(req.user);
		res.json(req.user);
		// var profile = {
		// 	emails: [{ value: req.username }],
		// 	password: req.password
		// }
		// findUser(profile, null, 'basic').then(result => {
		// 	if (!result.err) {
		// 		console.log("Login success!");
		// 		res.json(result);
		// 	} else {
		// 		console.log("Login failure!");
		// 		console.log(result.err);
		// 		res.json(null);
		// 	}
		// });
	});

	app.post('/register', bodyParser, function(req, res) {
		console.log("REQUEST RECEIVED: ", req.body);
		var profile = {
			name: req.body.firstName + " " + req.body.lastName,
			emails: [{ value: req.body.username }],
			password: req.body.password,
			requestType: 'register'
		}
		findUser(profile, null, 'basic').then(result => {
			console.log(result);
			if (!result.err) {
				res.json(result);
			} else {
				console.log("Creating user...");
				var newUser = new USER(createUser(profile, null, 'basic'));
				newUser.save(function (mongoErr) {
					if (mongoErr) {
						console.log("Error saving new user.");
						res.json(null);
					} else {
						console.log("New user added!");
						res.json(newUser);
					}
				});
			}
		});
	});

    return passport; // Return Passport Object
};