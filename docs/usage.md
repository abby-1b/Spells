
# CLI Command usage

### help, h, (empty)
 - Shows the help dialogue

### version, v
 - Shows the version number

### server, serve, s [port] [--bind] [--silent]
 - Starts a server, accepting an optional argument for the port.
 - The default port is :8080
 - `bind`: sets the address that we're outputting to.
 - `silent`: stops the server from emitting messages

### build, b buildDir outDir [--final]
 - Builds the site to vanilla HTML and JS.
 - `final`: minifies before exporting, removing source maps and minifying variable names.
