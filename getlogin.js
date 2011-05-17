(function () {

// Process login response from the authenticator passed through location.hash.

function parseQuery(str) {
	var obj = {};
	str.split('&').forEach(function (pair) {
		var pair2 = pair.split('=');
		var key = pair2[0];
		var value = pair2[1];
		if (key in obj) {
			var prevValue = obj[key];
			if (typeof prevValue == "string") {
				obj[key] = [prevValue, value];
			} else {
				prevValue.push(value);
			}
		} else {
			obj[key] = value;
		}
	});
	return obj;
}

var scripts = document.getElementsByTagName("script");
var ourScript = scripts.length && scripts[scripts.length - 1];
if (!ourScript) {
	throw new Error("Ross authenticator could not find its script.");
}
var src = ourScript.src;
var i = src.indexOf("?") + 1;
var qs = i && parseQuery(src.substr(i));
var cbName = qs && qs["callback"];
if (!cbName) {
	throw new Error("Ross authenticator has no callback.");
}
var cb = window[cbName];
if (!cb) {
	throw new Error("Ross authenticator callback could not be found.");
}

var q = parseQuery(location.hash.substr(1));
var ok = JSON.stringify(q.ok);
if (ok) {
	// login success.
	// save the important tokens.
	cb(q.username, q.token, q.roles);
	//location.replace("manage#loginsuccess");

} else if (ok) {
	// bad login
	cb(false, false, false);
}

}());