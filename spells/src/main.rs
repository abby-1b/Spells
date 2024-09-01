use cli_error::throw_cli_error;

mod cli_error;
mod compiler;
mod server;

static HELP_DIALOGUE: &[[&str; 3]] = &[
  [ "help, h", "", "Shows this dialogue" ],
  [ "version, v", "", "Shows the version number" ],
  [
    "server, serve, s", "[port] [--bind] [--silent]",
    concat!(
      "Starts a local development server\n",
      "port (optional): sets the port to serve on (default: 8080)\n",
      "bind (optional): sets the address to serve on (default: localhost)\n",
      "silent (optional): stops logging to the console",
    )
  ],
  [
    "build, b", "buildDir outDir [--final]",
    concat!(
      "Builds the site to HTML and JS",
      "final (optional): minifies files and removes source maps"
    )
  ]
];

fn main() {
  let args: Vec<String> = std::env::args().collect();

  if args.len() < 2 {
    print_version();
    print_help_dialogue();
    return;
  }

  let command = &args[1];
  match command.as_str() {
    "help" | "h" => print_help_dialogue(),
    "version" | "v" => print_version(),
    "server" | "serve" | "s" => {
      let _ = server::start(&args[2..])
        .map_err(|err| throw_cli_error(err));
    },
    "build" | "b" => {
      let _ = compiler::build()
        .map_err(|err| throw_cli_error(err));
    },
    _ => unknown_command(command)
  }

}

fn unknown_command(command: &String) {
  // This tuple stores command, index, and distance
  let mut all_commands: Vec<(&str, usize, usize)> = vec![];

  for (index, full_command) in HELP_DIALOGUE.iter().enumerate() {
    let separate_commands = full_command[0].split(", ");
    for command in separate_commands {
      if command.len() < 2 { continue; }
      all_commands.push((command, index, 0));
    }
  }

  // A very small string distance search!
  let mut rand_idx = 0;
  let mut rand = || {
    rand_idx += 1;
    ((rand_idx as f32 * 5.7).sin() * 93.0 + 100.0) % 1.0
  };

  static ITER_COUNT: usize = 1000;
  let cmd_bytes: Vec<u8> = command.bytes().collect();
  for (potential_command, _, distance) in &mut all_commands {
    let pot_bytes: Vec<u8> = potential_command.bytes().collect();

    for _ in 0..ITER_COUNT {
      let a = (rand() * potential_command.len() as f32) as usize;

      let mut b = a.saturating_add(((rand() * 2.0 - 1.0) * 1.7).round() as usize);
      if b >= command.len() { b = command.len() - 1; }

      if pot_bytes[a] != cmd_bytes[b] {
        *distance += 1;
      }
    }
  }

  let mut min_dist = ITER_COUNT + 1;
  let mut min_idx = 0;
  for (idx, result) in all_commands.iter().enumerate() {
    if result.2 < min_dist {
      min_idx = idx;
      min_dist = result.2;
    }
  }
  
  println!(
    "Command `{}` not found. Did you mean `{}`?",
    command,
    all_commands[min_idx].0,
  );
  print_help_dialogue_part(all_commands[min_idx].1);
}

fn print_help_dialogue() {
  for i in 0..HELP_DIALOGUE.len() {
    print_help_dialogue_part(i);
  }
}
fn print_help_dialogue_part(index: usize) {
  let part = HELP_DIALOGUE[index];
  println!("{}    {}", part[0], part[1]);

  print!("    ");
  for character in part[2].chars() {
    print!("{}", character);
    if character == '\n' {
      print!("    ");
    }
  }
  println!();
}

fn print_version() {
  println!(
    "Spells v{}",
    env!("CARGO_PKG_VERSION")
  );
}
