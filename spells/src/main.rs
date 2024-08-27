
static helpDialogueParts: &[[&str; 2]] = &[
  [ "help, h", "Shows this dialogue" ],
  [ "version, v", "Shows the version number" ],
  [
    "server, serve, s  [port] [--bind] [--silent]",
    concat!(
      "Starts a local development server\n",
      "port (optional): sets the port to serve on (default: 8080)\n",
      "bind (optional): sets the address to serve on (default: localhost)\n",
      "silent (optional): stops logging to the console",
    )
  ],
  [
    "build, b,  buildDir outDir [--final]",
    concat!(
      "Builds the site to HTML and JS",
      "final (optional): minifies files and removes source maps"
    )
  ]
];

fn main() {
  println!("Hello, world!");
  let args: Vec<String> = std::env::args().collect();

  println!("{:?}", args);
}
