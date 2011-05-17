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
var auths = [LDAPAuth, IMAPAuth];

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

var cred = require('./credentials').credentials;
var admins = cred.admins;
var secret = cred.secret;

function getUserRoles(username) {
	return admins.indexOf(username) == -1 ? [] : ["_admin"];
}

var crypto = require('crypto');

function hex_hmac_sha1(data, key) {
  var hmac = crypto.createHmac('sha1', key);
  hmac.update(data);
  return hmac.digest('hex');
}

function makeAuthToken(username, roles) {
	return hex_hmac_sha1(username, secret);
	// todo: fix couchdb to add roles to the hash
}

var qs = require('querystring');
function makeLoginRedirectURL(base, username, success, msg) {
	var resp = {ok: success};
	if (success) {
		resp.username = username;
		resp.roles = getUserRoles(username).join(",");
		resp.token = makeAuthToken(username, resp.roles);
	}
	// use hashmark to transmit login token back
	return base.replace(/#.*$/, '') + "#" + qs.stringify(resp);
}

var http = require('http');
var parseUrl = require('url').parse;
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
		var redirect = form.redirect; // url to redirect to
		//sys.debug("Got form: " + JSON.stringify(form));
		tryAuth(username, password, function (success, msg) {
			var redirectBase = request.headers.referer;
			var redirectUrl = makeLoginRedirectURL(redirectBase, username, success, msg);
			response.writeHead(303, "See Other", {"Location": redirectUrl});
			response.end('\n');
		});
	});
}).listen(8124);