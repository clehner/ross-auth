# Ross Authenticator

CouchDB proxy authentication using Ross LDAP and/or IMAP servers.

## Set up

    git submodule init
    git submodule update
    cd node-ldapauth
    ./build.sh

### Edit credentials.js

* Add the database url, and a username:password for a database admin user.
* Use `git update-index --assume-unchanged credentials.js` to prevent edits to credentials.js from being tracked by git.

## Usage

To start the auth server that proxies from http to ldap/imap:

    cd server
    node auth.js

### To login, the procedure is as follows.

* Try logging in to CouchDB normally.
* If the login fails, post the login to `http://localhost:8124/login`
* Then try logging in to CouchDB again.

This is demonstrated in `client/login.html`.