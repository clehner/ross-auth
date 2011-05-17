# Ross Authenticator

CouchDB proxy authentication using Ross servers.

## Set up

    git submodule init
    cd node-ldapauth
    ./build.sh

### Edit credentials.js

* Add the list of admins.
* Add the secret which is in couch_httpd_auth.secret in the CouchDB config.

## Usage

To start the auth server:

    node auth.js

To login, post to `http://localhost:8124/login`
And read the location.hash response using `http://localhost:8124/getlogin.js?callback=yourfunction`

This is demonstrated in `example-login.html`.

## Todo
* Add CouchDB code to example page.