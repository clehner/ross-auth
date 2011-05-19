var RossCouchAuth = {};

(function () {

function proxyLogin(proxyAddr, username, password, callback) {
	var form = document.createElement("form");
	form.action = proxyAddr;
	form.method = "post";
	form.target = "ross-couch-auth-hidden-iframe";
	
	var passInput = document.createElement("input");
	passInput.type = "hidden";
	passInput.name = "password";
	passInput.value = password;
	form.appendChild(passInput);
	
	var userInput = document.createElement("input");
	userInput.type = "hidden";
	userInput.name = "username";
	userInput.value = username;
	form.appendChild(userInput);
	
	var iframe = document.createElement("iframe");
	iframe.name = form.target;
	iframe.style.display = "none";
	document.body.appendChild(iframe);
	iframe.onload = function () {
		iframe.onload = null;
		document.body.removeChild(iframe);
		callback();
	};
	
	form.submit();
}

function couchLogin(username, password, success, fail) {
	Couch.login({
		name: username,
		password: password,
		success: success,
		error: fail
	});
}

RossCouchAuth.login = function (proxyAddr, user, pass, callback) {
	function success() {
		callback(true);
	}
	function fail() {
		callback(false);
	}
	couchLogin(user, pass, success, function notyet() {
		proxyLogin(proxyAddr, user, pass, function () {
			couchLogin(user, pass, success, fail);
		})
	});
};

}());
