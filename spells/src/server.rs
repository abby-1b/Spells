
use std::{env, fs, path::{Path, PathBuf}, str::FromStr};

use crate::{cli_error::CliError, compile::{self, options::CompileOptions}, server};

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

  /// The `Content-Type` header
  content_type: (&'static str, &'static str),
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

    println!("{}", path);

    // Get the response
    let response = options.routes.iter()
      .find(|route| (route.capture_fn)(&spells_request))
      .map(|route| (route.routing_fn)(&spells_request))
      .unwrap_or_else(|| default_request_handler(&spells_request));

    // Convert our custom response into a tiny_http response
    let data_length = Some(response.body.len());
    let content_type_string = format!(
      "Content-Type:{}/{}", response.content_type.0, response.content_type.1
    );
    let final_response = tiny_http::Response::new(
      tiny_http::StatusCode(response.status),
      vec![ tiny_http::Header::from_str(&content_type_string).unwrap() ],
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
  let server_path_len = server_path.display().to_string().len() + 2;
  let path = server_path.join(".".to_string() + request.path);

  if path.is_dir() {
    // It's a path!
    handle_path(&path, server_path_len)
  } else if path.exists() {
    // Return the resource directly
    file_response(&path)
  } else {
    Response {
      status: 404,
      body: "404: Resource not found!".to_owned(),
      content_type: ("text", "plain")
    }
  }

}

fn handle_path(path: &PathBuf, server_path_len: usize) -> Response {
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
  let mut a_tags: Vec<String> = vec![];

  let path_len = path.display().to_string().len() - server_path_len;
  if path_len > 1 {
    // Not root, add a link to go back
    a_tags.push("<a href=\"../\">..</a><br>".to_string());
  }

  // Add
  a_tags.extend(
    fs::read_dir(&path).unwrap()
    .map(|path| path.unwrap().path().display().to_string().split_off(server_path_len))
    .map(|path| format!(
      "<a href=\".{}\">{}</a><br>\n",
      path, path
    ))
  );
  
  return Response {
    status: 200,
    body: format!(
      "<style>html{{background-color:white;filter:invert(1)}}*{{font-family:monospace;margin-bottom:0}}a{{color:#0d4500}}</style><h1 style=\"margin-top:20px\">Directory listing of {}</h1><br>\n{}",
      path.as_path().display().to_string().split_off(server_path_len),
      a_tags.join("")
    ),
    content_type: ("text", "html")
  };
}

fn file_response(path: &Path) -> Response {
  let extension_string = path.display().to_string().to_lowercase();
  let extension = extension_string.split(".").last().unwrap_or("");

  if extension == "ts" {
    // Compile TypeScript
    todo!()
  } else if extension == "spl" {
    // Compile Spells
    match compile::compiler::build_file(
      CompileOptions { pretty: false },
      path
    ) {
      Ok(out) => Response {
        status: 200,
        body: out,
        content_type: ("text", "html")
      },
      Err(error) => Response {
        status: 404,
        body: error.string(),
        content_type: ("text", "plain")
      }
    }
  } else {
    Response {
      status: 200,
      body: fs::read_to_string(path).unwrap(),
      content_type: get_content_type_from_extension(extension)
    }
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

fn get_content_type_from_extension(extension: &str) -> (&'static str, &'static str) {
  match extension {
    "a2l" => ("application", "A2L"),
    "activemessage" => ("application", "activemessage"),
    "aml" => ("application", "AML"),
    "applefile" => ("application", "applefile"),
    "atf" => ("application", "ATF"),
    "atfx" => ("application", "ATFX"),
    "atomicmail" => ("application", "atomicmail"),
    "atxml" => ("application", "ATXML"),
    "bufr" => ("application", "bufr"),
    "c2pa" => ("application", "c2pa"),
    "cbor" => ("application", "cbor"),
    "cccex" => ("application", "cccex"),
    "cdni" => ("application", "cdni"),
    "cea" => ("application", "CEA"),
    "cfw" => ("application", "cfw"),
    "clr" => ("application", "clr"),
    "cms" => ("application", "cms"),
    "commonground" => ("application", "commonground"),
    "cose" => ("application", "cose"),
    "csrattrs" => ("application", "csrattrs"),
    "cwl" => ("application", "cwl"),
    "cwt" => ("application", "cwt"),
    "cybercash" => ("application", "cybercash"),
    "dashdelta" => ("application", "dashdelta"),
    "dcd" => ("application", "DCD"),
    "dicom" => ("application", "dicom"),
    "dii" => ("application", "DII"),
    "dit" => ("application", "DIT"),
    "dns" => ("application", "dns"),
    "dvcs" => ("application", "dvcs"),
    "edifact" => ("application", "EDIFACT"),
    "efi" => ("application", "efi"),
    "encaprtp" => ("application", "encaprtp"),
    "epub" => ("application", "epub+zip"),
    "eshop" => ("application", "eshop"),
    "example" => ("application", "example"),
    "exi" => ("application", "exi"),
    "express" => ("application", "express"),
    "fastinfoset" => ("application", "fastinfoset"),
    "fastsoap" => ("application", "fastsoap"),
    "fdf" => ("application", "fdf"),
    "fits" => ("application", "fits"),
    "flexfec" => ("application", "flexfec"),
    "grib" => ("application", "grib"),
    "gz" => ("application", "gzip"),
    "gzip" => ("application", "gzip"),
    "h224" => ("application", "H224"),
    "http" => ("application", "http"),
    "hyperstudio" => ("application", "hyperstudio"),
    "iges" => ("application", "iges"),
    "index" => ("application", "index"),
    "iotp" => ("application", "IOTP"),
    "ipfix" => ("application", "ipfix"),
    "ipp" => ("application", "ipp"),
    "isup" => ("application", "ISUP"),
    "jar" => ("application", "java-archive"),
    "jose" => ("application", "jose"),
    "json" => ("application", "json"),
    "jsonpath" => ("application", "jsonpath"),
    "jwt" => ("application", "jwt"),
    "jsonld" => ("application", "ld+json"),
    "linkset" => ("application", "linkset"),
    "lxf" => ("application", "LXF"),
    "macwriteii" => ("application", "macwriteii"),
    "marc" => ("application", "marc"),
    "mathematica" => ("application", "mathematica"),
    "mbox" => ("application", "mbox"),
    "mf4" => ("application", "MF4"),
    "mikey" => ("application", "mikey"),
    "mipc" => ("application", "mipc"),
    "mp21" => ("application", "mp21"),
    "mp4" => ("application", "mp4"),
    "doc" => ("application", "msword"),
    "msword" => ("application", "msword"),
    "mxf" => ("application", "mxf"),
    "nasdata" => ("application", "nasdata"),
    "node" => ("application", "node"),
    "nss" => ("application", "nss"),
    "bin" => ("application", "octet-stream"),
    "oda" => ("application", "ODA"),
    "odx" => ("application", "ODX"),
    "ogg" => ("application", "ogg"),
    "ogx" => ("application", "ogg"),
    "oscore" => ("application", "oscore"),
    "oxps" => ("application", "oxps"),
    "p21" => ("application", "p21"),
    "parityfec" => ("application", "parityfec"),
    "passport" => ("application", "passport"),
    "pdf" => ("application", "pdf"),
    "pdx" => ("application", "PDX"),
    "pkcs10" => ("application", "pkcs10"),
    "pkcs12" => ("application", "pkcs12"),
    "pkcs8" => ("application", "pkcs8"),
    "pkixcmp" => ("application", "pkixcmp"),
    "postscript" => ("application", "postscript"),
    "qsig" => ("application", "QSIG"),
    "raptorfec" => ("application", "raptorfec"),
    "riscos" => ("application", "riscos"),
    "rtf" => ("application", "rtf"),
    "rtploopback" => ("application", "rtploopback"),
    "rtx" => ("application", "rtx"),
    "sbe" => ("application", "sbe"),
    "sdp" => ("application", "sdp"),
    "sgml" => ("application", "SGML"),
    "sieve" => ("application", "sieve"),
    "simplesymbolcontainer" => ("application", "simpleSymbolContainer"),
    "sipc" => ("application", "sipc"),
    "slate" => ("application", "slate"),
    "smpte336m" => ("application", "smpte336m"),
    "sql" => ("application", "sql"),
    "srgs" => ("application", "srgs"),
    "sslkeylogfile" => ("application", "sslkeylogfile"),
    "stratum" => ("application", "stratum"),
    "tetra_isi" => ("application", "TETRA_ISI"),
    "tnauthlist" => ("application", "tnauthlist"),
    "trig" => ("application", "trig"),
    "tzif" => ("application", "tzif"),
    "ulpfec" => ("application", "ulpfec"),
    "vc" => ("application", "vc"),
    "vemmi" => ("application", "vemmi"),
    "azw" => ("application", "vnd.amazon.ebook"),
    "mpkg" => ("application", "vnd.apple.installer+xml"),
    "eot" => ("application", "vnd.ms-fontobject"),
    "ppt" => ("application", "vnd.ms-powerpoint"),
    "odp" => ("application", "vnd.oasis.opendocument.presentation"),
    "ods" => ("application", "vnd.oasis.opendocument.spreadsheet"),
    "odt" => ("application", "vnd.oasis.opendocument.text"),
    "rar" => ("application", "vnd.rar"),
    "vsd" => ("application", "vnd.visio"),
    "vp" => ("application", "vp"),
    "wasm" => ("application", "wasm"),
    "widget" => ("application", "widget"),
    "wita" => ("application", "wita"),
    "7z" => ("application", "x-7z-compressed"),
    "abw" => ("application", "x-abiword"),
    "bz" => ("application", "x-bzip"),
    "bz2" => ("application", "x-bzip2"),
    "cda" => ("application", "x-cdf"),
    "csh" => ("application", "x-csh"),
    "arc" => ("application", "x-freearc"),
    "php" => ("application", "x-httpd-php"),
    "sh" => ("application", "x-sh"),
    "tar" => ("application", "x-tar"),
    "xfdf" => ("application", "xfdf"),
    "xml" => ("application", "xml"),
    "yaml" => ("application", "yaml"),
    "yang" => ("application", "yang"),
    "zip" => ("application", "zip"),
    "zlib" => ("application", "zlib"),
    "zstd" => ("application", "zstd"),
    "32kadpcm" => ("audio", "32kadpcm"),
    "3gpp" => ("audio", "3gpp"),
    "3gpp2" => ("audio", "3gpp2"),
    "aac" => ("audio", "aac"),
    "ac3" => ("audio", "ac3"),
    "amr" => ("audio", "AMR"),
    "aptx" => ("audio", "aptx"),
    "asc" => ("audio", "asc"),
    "atrac3" => ("audio", "ATRAC3"),
    "basic" => ("audio", "basic"),
    "bv16" => ("audio", "BV16"),
    "bv32" => ("audio", "BV32"),
    "clearmode" => ("audio", "clearmode"),
    "cn" => ("audio", "CN"),
    "dat12" => ("audio", "DAT12"),
    "dls" => ("audio", "dls"),
    "dv" => ("audio", "DV"),
    "dvi4" => ("audio", "DVI4"),
    "eac3" => ("audio", "eac3"),
    "evrc" => ("audio", "EVRC"),
    "evrc0" => ("audio", "EVRC0"),
    "evrc1" => ("audio", "EVRC1"),
    "evrcb" => ("audio", "EVRCB"),
    "evrcb0" => ("audio", "EVRCB0"),
    "evrcb1" => ("audio", "EVRCB1"),
    "evrcnw" => ("audio", "EVRCNW"),
    "evrcnw0" => ("audio", "EVRCNW0"),
    "evrcnw1" => ("audio", "EVRCNW1"),
    "evrcwb" => ("audio", "EVRCWB"),
    "evrcwb0" => ("audio", "EVRCWB0"),
    "evrcwb1" => ("audio", "EVRCWB1"),
    "evs" => ("audio", "EVS"),
    "flac" => ("audio", "flac"),
    "fwdred" => ("audio", "fwdred"),
    "g719" => ("audio", "G719"),
    "g722" => ("audio", "G722"),
    "g7221" => ("audio", "G7221"),
    "g723" => ("audio", "G723"),
    "g728" => ("audio", "G728"),
    "g729" => ("audio", "G729"),
    "g7291" => ("audio", "G7291"),
    "g729d" => ("audio", "G729D"),
    "g729e" => ("audio", "G729E"),
    "gsm" => ("audio", "GSM"),
    "ilbc" => ("audio", "iLBC"),
    "l16" => ("audio", "L16"),
    "l20" => ("audio", "L20"),
    "l24" => ("audio", "L24"),
    "l8" => ("audio", "L8"),
    "lpc" => ("audio", "LPC"),
    "matroska" => ("audio", "matroska"),
    "melp" => ("audio", "MELP"),
    "melp1200" => ("audio", "MELP1200"),
    "melp2400" => ("audio", "MELP2400"),
    "melp600" => ("audio", "MELP600"),
    "mhas" => ("audio", "mhas"),
    "midi" => ("audio", "midi"),
    "mid" => ("audio", "midi"),
    "mpa" => ("audio", "MPA"),
    "mp3" => ("audio", "mpeg"),
    "mpeg" => ("audio", "mpeg"),
    "oga" => ("audio", "ogg"),
    "opus" => ("audio", "opus"),
    "pcma" => ("audio", "PCMA"),
    "pcmu" => ("audio", "PCMU"),
    "qcelp" => ("audio", "QCELP"),
    "red" => ("audio", "RED"),
    "scip" => ("audio", "scip"),
    "smv" => ("audio", "SMV"),
    "smv0" => ("audio", "SMV0"),
    "sofa" => ("audio", "sofa"),
    "speex" => ("audio", "speex"),
    "t140c" => ("audio", "t140c"),
    "t38" => ("audio", "t38"),
    "tetra_acelp_bb" => ("audio", "TETRA_ACELP_BB"),
    "tetra_acelp" => ("audio", "TETRA_ACELP"),
    "tone" => ("audio", "tone"),
    "tsvcis" => ("audio", "TSVCIS"),
    "uemclip" => ("audio", "UEMCLIP"),
    "usac" => ("audio", "usac"),
    "vdvi" => ("audio", "VDVI"),
    "vorbis" => ("audio", "vorbis"),
    "wav" => ("audio", "wav"),
    "weba" => ("audio", "webm"),
    "collection" => ("font", "collection"),
    "otf" => ("font", "otf"),
    "sfnt" => ("font", "sfnt"),
    "ttf" => ("font", "ttf"),
    "woff" => ("font", "woff"),
    "woff2" => ("font", "woff2"),
    "hjif" => ("haptics", "hjif"),
    "hmpg" => ("haptics", "hmpg"),
    "ivs" => ("haptics", "ivs"),
    "aces" => ("image", "aces"),
    "apng" => ("image", "apng"),
    "avci" => ("image", "avci"),
    "avcs" => ("image", "avcs"),
    "avif" => ("image", "avif"),
    "bmp" => ("image", "bmp"),
    "cgm" => ("image", "cgm"),
    "dpx" => ("image", "dpx"),
    "emf" => ("image", "emf"),
    "g3fax" => ("image", "g3fax"),
    "gif" => ("image", "gif"),
    "heic" => ("image", "heic"),
    "heif" => ("image", "heif"),
    "hej2k" => ("image", "hej2k"),
    "hsj2" => ("image", "hsj2"),
    "ief" => ("image", "ief"),
    "j2c" => ("image", "j2c"),
    "jls" => ("image", "jls"),
    "jp2" => ("image", "jp2"),
    "jpeg" => ("image", "jpeg"),
    "jpg" => ("image", "jpeg"),
    "jph" => ("image", "jph"),
    "jphc" => ("image", "jphc"),
    "jpm" => ("image", "jpm"),
    "jpx" => ("image", "jpx"),
    "jxl" => ("image", "jxl"),
    "jxr" => ("image", "jxr"),
    "jxra" => ("image", "jxrA"),
    "jxrs" => ("image", "jxrS"),
    "jxs" => ("image", "jxs"),
    "jxsc" => ("image", "jxsc"),
    "jxsi" => ("image", "jxsi"),
    "jxss" => ("image", "jxss"),
    "ktx" => ("image", "ktx"),
    "ktx2" => ("image", "ktx2"),
    "naplps" => ("image", "naplps"),
    "png" => ("image", "png"),
    "svg" => ("image", "svg+xml"),
    "tiff" => ("image", "tiff"),
    "tif" => ("image", "tiff"),
    "ico" => ("image", "vnd.microsoft.icon"),
    "webp" => ("image", "webp"),
    "wmf" => ("image", "wmf"),
    "bhttp" => ("message", "bhttp"),
    "cpim" => ("message", "CPIM"),
    "global" => ("message", "global"),
    "mls" => ("message", "mls"),
    "partial" => ("message", "partial"),
    "rfc822" => ("message", "rfc822"),
    "sip" => ("message", "sip"),
    "sipfrag" => ("message", "sipfrag"),
    "3mf" => ("model", "3mf"),
    "e57" => ("model", "e57"),
    "jt" => ("model", "JT"),
    "mesh" => ("model", "mesh"),
    "mtl" => ("model", "mtl"),
    "obj" => ("model", "obj"),
    "prc" => ("model", "prc"),
    "step" => ("model", "step"),
    "stl" => ("model", "stl"),
    "u3d" => ("model", "u3d"),
    "vrml" => ("model", "vrml"),
    "alternative" => ("multipart", "alternative"),
    "appledouble" => ("multipart", "appledouble"),
    "byteranges" => ("multipart", "byteranges"),
    "digest" => ("multipart", "digest"),
    "encrypted" => ("multipart", "encrypted"),
    "mixed" => ("multipart", "mixed"),
    "multilingual" => ("multipart", "multilingual"),
    "parallel" => ("multipart", "parallel"),
    "related" => ("multipart", "related"),
    "report" => ("multipart", "report"),
    "signed" => ("multipart", "signed"),
    "calendar" => ("text", "calendar"),
    "ics" => ("text", "calendar"),
    "cql" => ("text", "cql"),
    "css" => ("text", "css"),
    "csv" => ("text", "csv"),
    "enriched" => ("text", "enriched"),
    "fhirpath" => ("text", "fhirpath"),
    "gff3" => ("text", "gff3"),
    "hl7v2" => ("text", "hl7v2"),
    "html" => ("text", "html"),
    "htm" => ("text", "html"),
    "javascript" => ("text", "javascript"),
    "js" => ("text", "javascript"),
    "mjs" => ("text", "javascript"),
    "markdown" => ("text", "markdown"),
    "mizar" => ("text", "mizar"),
    "n3" => ("text", "n3"),
    "parameters" => ("text", "parameters"),
    "plain" => ("text", "plain"),
    "txt" => ("text", "plain"),
    "richtext" => ("text", "richtext"),
    "shaclc" => ("text", "shaclc"),
    "shex" => ("text", "shex"),
    "spdx" => ("text", "spdx"),
    "strings" => ("text", "strings"),
    "t140" => ("text", "t140"),
    "troff" => ("text", "troff"),
    "turtle" => ("text", "turtle"),
    "vcard" => ("text", "vcard"),
    "vtt" => ("text", "vtt"),
    "wgsl" => ("text", "wgsl"),
    "av1" => ("video", "AV1"),
    "bmpeg" => ("video", "BMPEG"),
    "bt656" => ("video", "BT656"),
    "celb" => ("video", "CelB"),
    "evc" => ("video", "evc"),
    "ffv1" => ("video", "FFV1"),
    "h261" => ("video", "H261"),
    "h263" => ("video", "H263"),
    "h264" => ("video", "H264"),
    "h265" => ("video", "H265"),
    "h266" => ("video", "H266"),
    "jpeg2000" => ("video", "jpeg2000"),
    "jxsv" => ("video", "jxsv"),
    "mj2" => ("video", "mj2"),
    "mp1s" => ("video", "MP1S"),
    "mp2p" => ("video", "MP2P"),
    "mp2t" => ("video", "MP2T"),
    "ts" => ("video", "mp2t"),
    "mpv" => ("video", "MPV"),
    "nv" => ("video", "nv"),
    "ogv" => ("video", "ogg"),
    "pointer" => ("video", "pointer"),
    "quicktime" => ("video", "quicktime"),
    "raw" => ("video", "raw"),
    "smpte291" => ("video", "smpte291"),
    "smpte292m" => ("video", "SMPTE292M"),
    "vc1" => ("video", "vc1"),
    "vc2" => ("video", "vc2"),
    "vp8" => ("video", "VP8"),
    "vp9" => ("video", "VP9"),
    "webm" => ("video", "webm"),
    "avi" => ("video", "x-msvideo"),

    _ => ("text", "plain")
  }
}
