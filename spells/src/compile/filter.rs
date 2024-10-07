use std::collections::VecDeque;

struct Filter<'a> {
  iter: Box<dyn Iterator<Item = char> + 'a>,
  queue: VecDeque<char>,
  next_fn: Box<dyn Fn(&mut dyn Iterator<Item = char>, &mut VecDeque<char>)>,
}

impl<'a> Iterator for Filter<'a> {
  type Item = char;
  fn next(&mut self) -> Option<char> {
    if self.queue.is_empty() {
      (self.next_fn)(&mut self.iter, &mut self.queue);
    }
    self.queue.pop_front()
  }
}

fn basic<'a>(s: &'a str) -> Filter<'a> {
  let iter: Box<std::str::Chars<'a>> = Box::new(s.chars());
  let next_fn: Box<dyn Fn(&mut dyn Iterator<Item = char>, &mut VecDeque<char>)> = Box::new(|iter: &mut dyn Iterator<Item = char>, queue: &mut VecDeque<char>| {
    iter.next().map(|c| queue.push_back(c));
  });
  Filter {
    iter,
    queue: VecDeque::new(),
    next_fn
  }
}

// fn convert_vars<'a>()
