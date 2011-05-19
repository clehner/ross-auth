var cred = require('./credentials').credentials;
var admins = cred.admins;

function makeHost(auth) {
	return cred.host.replace('://', '://' + auth + '@');
}

function getUserRoles(username) {
	// todo: make this more useful
	return [];
}

var CouchDB = require('./node-couch/lib').CouchDB;
var usersDb = CouchDB.db('_users', makeHost(cred.adminAuth));

var sys = require('sys');
var ImapConnection = require('./node-imap/imap').ImapConnection;
	
function IMAPAuth(username, password, callback) {
	sys.debug("Connecting to IMAP");
	new ImapConnection({
		username: username + '@ross.org',
		password: password,
		host: 'imap.gmail.com',
		port: 993,
		secure: true
    }).connect(function (error) {
    	var msg = error || "success";
    	sys.debug("IMAP auth result: " + msg);
    	callback(!error, msg);
    });
}

var ldapauth = require('./node-ldapauth/ldapauth');

function LDAPAuth(username, password, callback) {
	ldapauth.authenticate('AD4.ross.org', 389, "ross\\" + username, password, 
		function (err, result) {
			if (err) {
				sys.debug('LDAP error: ' + err + ', ' + result);
				callback(false, err + "," + result);
			} else {
				if (!password) result = false;
				sys.debug('LDAP success: ' + result); // true or false
				callback(result, result ? "login success" : "bad login");
			}
		}
	);
}


// try these auth services, in this order:
//var auths = [LDAPAuth, IMAPAuth];
var auths = [IMAPAuth];

function tryAuth(username, password, callback, i) {
	//sys.debug("trying auth: "+ username + ", " + password);
	i |= 0;
	var auth = auths[i];
	if (!auth) {
		callback(false, "unable to login");
		return;
	}
	function next(success, msg) {
		if (success) {
			callback(true, msg);
		} else {
			tryAuth(username, password, callback, i + 1);
		}
	}
	try {
		auth(username, password, next);
	} catch(e) {
		next(false, "JS error caught");
	}
}

var crypto = require("crypto");
function hex_sha1(str) {
	var hash = crypto.createHash('sha1');
	hash.update(str);
	return hash.digest('hex');
}

var uuidsCache = [];
function getUUID(cb) {
	if (uuidsCache.length <= 1) {
		CouchDB.generateUUIDs({
			success: function (uuids) {
				uuidsCache.push.apply(uuidsCache, uuids);
				cb(uuidsCache.pop());
			},
			error: function (msg) {
				sys.error("Unable to get uuids.");
				cb(hex_sha1(""+Math.random()));
			}
		});
	} else {
		cb(uuidsCache.pop());
	}
}

var user_prefix = "org.couchdb.user:";
function prepareUserDoc(user_doc, new_password, callback) {
	user_doc._id = user_doc._id || user_prefix + user_doc.name;
	if (new_password) {
		getUUID(function (salt) {
			user_doc.salt = salt;
			user_doc.password_sha = hex_sha1(new_password + salt);
			next();
		});
	} else {
		next();
	}
	function next() {
		user_doc.type = "user";
		if (!user_doc.roles) {
			user_doc.roles = getUserRoles(user_doc.name);
		}
		callback();
	}
}
			
function testCouchLogin(username, password, success, fail) {
	// test the login with the new credentials
	var host = makeHost(username + ':' + password);
	CouchDB.db("", host).interact("get", "/_session", 200, {
		success: function (session) {
			if (session.userCtx.name) {
				success();
			} else {
				fail();
			}
		},
		error: fail
	}, true);
}

var http = require('http');
var parseUrl = require('url').parse;
var qs = require('querystring');

http.createServer(function (request, response) {
	var path = parseUrl(request.url).pathname;

	if (path != "/login") {
		response.writeHead(404, "Not Found",
			{'Content-Type': 'text/plain'});
		response.end("No.");
		return;
	}
	
	if (request.method.toLowerCase() != "post") {
		response.writeHead(405, "Method Not Allowed",
			{'Content-Type': 'text/plain'});
		response.end("No. Use POST.");
		return;
	}
	
	var body = "";
	request.addListener("data", function (chunk) {
		body += chunk;
	});
	request.addListener("end", function () {
		var form = qs.parse(body);
		var username = form.username;
		var password = form.password;
		var redirect = form.redirect;
		//sys.debug(JSON.stringify(form));
		
		// see if the user already exists with this password.
		testCouchLogin(username, password, function () {
			sys.debug("didn't have to create user doc.");
			success();
		}, doAuth);
		
		function finishResponse(msg) {
			if (redirect) {
				response.writeHead(303, "See Other", {"Location": redirectUrl});
			} else {
				response.writeHead(200, "OK", {"Content-Type": "text/plain"});
				response.write(msg);
			}
			response.end('\n');
			sys.debug('end response');
		}
		function success() {
			finishResponse('success');
		}
		function fail(msg) {
			finishResponse(typeof msg == "object" ? JSON.stringify(msg) :
				msg || "");
		}
		
		// try to authenticate using ldap, imap, etc
		function doAuth() {
			tryAuth(username, password, gotAuthResult);
		}
		
		function gotAuthResult(success, msg) {
			if (!success) {
				return fail(msg);
			}
			
			// create or update the user doc.
			usersDb.openDoc(user_prefix + username, {
				success: function (doc) {
					updateUserDoc(doc);
				},
				error: function (err) {
					if (err.error == "not_found") {
						// need to create user doc
						var doc = {name: username};
						updateUserDoc(doc);
					} else {
						fail(err);
					}
				}
			});
		}
		
		function updateUserDoc(doc) {
			prepareUserDoc(doc, password, function () {
				usersDb.saveDoc(doc, {
					success: function () {
						// see if the doc change allows a successful login
						testCouchLogin(username, password, success, fail);					
					},
					error: fail
				});
			});
		}
	});
	
}).listen(cred.localPort);