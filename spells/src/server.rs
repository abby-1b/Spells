
use std::{env, fs, path::{Path, PathBuf}};

use crate::{cli_error::CliError, server};

pub enum ServerError {
  BadArguments { message: String }
}
impl CliError for ServerError {
  fn string(&self) -> String {
    match self {
      Self::BadArguments { message } => {
        format!("BadArguments: {}", message)
      }
    }
  }
}

pub struct Request<'a> {
  /// The entire URL (not including the scheme nor server address)
  url: &'a str,
  
  /// Whether or not the scheme is HTTPS
  secure: bool,

  /// The path that is being requested (https://developer.mozilla.org/en-US/docs/Learn/Common_questions/Web_mechanics/What_is_a_URL#path_to_resource).
  /// The first character of the path is always `/`.
  /// If there is no explicit path after the domain and port, this is `/`.
  path: &'a str,

  /// The URL parameters (https://developer.mozilla.org/en-US/docs/Learn/Common_questions/Web_mechanics/What_is_a_URL#parameters)
  params: Vec<(&'a str, Option<&'a str>)>,
}

pub struct Response {
  /// The HTTP response status code (https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
  status: u16,

  /// The response body
  body: String,
}

pub struct Route {
  capture_fn: fn(&Request) -> bool,
  routing_fn: fn(&Request) -> Response
}

pub struct ServerOptions {
  address: String,
  port: u16,
  silent: bool,
  
  routes: Vec<Route>
}

/// Starts the server
pub fn start(args: &[String]) -> Result<(), ServerError> {
  let options = process_args(args)?;

  let server = {
    let full_address = format!(
      "{}:{}",
      options.address,
      options.port
    );
    if !options.silent { println!("Server running at http://{}/", full_address); }
    tiny_http::Server::http(full_address).unwrap()
  };

  for request in server.incoming_requests() {
    // Get the request parts...
    let url = request.url();
    let secure = request.secure();
    let path = {
      let idx = url.chars()
        .take_while(|&c| !matches!(c, '?' | '&'))
        .count();
      &url[0..idx]
    };
    let params = url.split_once('?')
      .map(|(_, param_str)| param_str)
      .unwrap_or("")
      .split('&')
      .filter(|s| !s.is_empty())
      .map(
        |param| param
          .split_once('=')
          .map_or((param, None), |(param, eq)| (param, Some(eq)))
      )
      .collect();
    
    // Simplify the parts into a struct
    let spells_request = Request {
      url,
      secure,
      path,
      params
    };

    // Get the response
    let response = options.routes.iter()
      .find(|route| (route.capture_fn)(&spells_request))
      .map(|route| (route.routing_fn)(&spells_request))
      .unwrap_or_else(|| default_request_handler(&spells_request));

    // Convert our custom response into a tiny_http response
    let data_length = Some(response.body.len());
    let final_response = tiny_http::Response::new(
      tiny_http::StatusCode(response.status),
      Vec::with_capacity(0),
      std::io::Cursor::new(response.body),
      data_length,
      None
    );

    // Pass the respond to tiny_http
    if let Err(error) = request.respond(final_response) {
      if !options.silent {
        println!("Error when sending response: {}", error.to_string());
      }
    }
  }

  Ok(())
}

fn default_request_handler(request: &Request) -> Response {
  let server_path = env::current_dir().unwrap();
  let server_path_len = server_path.display().to_string().len() + 1;
  let path = server_path.join(".".to_string() + request.path);

  if path.is_dir() {
    return handle_path(&path, server_path_len);
  }

  println!("{}", request.path);
  todo!()
}

fn handle_path(path: &PathBuf, server_path_len: usize) -> Response {
  dbg!(&path);

  // Try to find an index file
  let index_spl = path.join("index.spl");
  if index_spl.exists() {
    return file_response(&index_spl);
  }
  
  let index_html = path.join("index.html");
  if index_html.exists() {
    return file_response(&index_spl);
  }

  // No index file, try returning the directory listing
  if path.exists() {
    let a_tags = fs::read_dir(&path).unwrap()
      .map(|path| path.unwrap().path().display().to_string().split_off(server_path_len))
      .map(|path| format!(
        "<a href=\"./{}\">{}</a><br>\n",
        path, path
      ));
    
    return Response {
      status: 200,
      body: format!(
        "<style>html{{background-color:white;filter:invert(1)}}*{{font-family:monospace;margin-bottom:0}}a{{color:#0d4500}}</style><h1 style=\"margin-top:20px\">Directory listing of {}</h1><br>\n{}",
        path.as_path().display().to_string().split_off(server_path_len),
        a_tags.collect::<Vec<String>>().join("")
      )
    };
  }

  todo!();
}

fn file_response(path: &Path) -> Response {
  Response {
    status: 200,
    body: fs::read_to_string(path).unwrap()
  }
}

/// Processes the server arguments
fn process_args(args: &[String]) -> Result<ServerOptions, ServerError> {
  let mut port: Option<u16> = None;
  let mut address: Option<String> = None;
  let mut silent: Option<bool> = None;

  let mut arg_iter = args.iter().peekable();
  while arg_iter.peek().is_some() {

    match arg_iter.next().unwrap().as_str() {
      "--bind" => match address {
        None => address = arg_iter.next().cloned(),
        Some(_) => return Err(ServerError::BadArguments {
          message: "too many --bind arguments".to_owned()
        })
      }
      "--silent" => match silent {
        None => silent = Some(true),
        Some(_) => return Err(ServerError::BadArguments {
          message: "too many --silent arguments".to_owned()
        })
      }
      other => {
        let new_port = other.parse::<u16>();
        if port.is_none() && new_port.is_ok() {
          port = Some(new_port.unwrap());
        } else {
          return Err(ServerError::BadArguments {
            message: format!("unexpected argument `{}`", other)
          });
        }
      }
    }

  }

  Ok(ServerOptions {
    address: address.unwrap_or("localhost".to_owned()),
    port: port.unwrap_or(8080),
    silent: silent.unwrap_or(false),
    routes: vec![]
  })
}
