# Ross Authenticator
CouchDB proxy authentication using Ross servers.

## Set up
    git submodule init
    cd node-ldapauth
    ./build.sh

### Edit credentials.js
* Add the list of admins.
* Add the secret which is in couch_httpd_auth.secret in the CouchDB config.