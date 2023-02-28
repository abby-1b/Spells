# **Spells**: A half-decent amalgamation of languages that's... pretty fast.

Have you ever wanted to use a combination of JavaScript, TypeScript, MarkDown, and Pug/Jade to mash modules, semi-components, hopes, and dreams into something barely representative of the Web Developer™ you really are, but in a fraction of the time it would take you to do the same thing in a sane matter, y'know, by _not_ mixing languages together?

Well, now you can!

# Amalgamation
_the action, process, or result of combining or uniting_
<br><br>

Yeah, that's what happened here.

As previously stated, this... thing™ mixes JavaScript, TypeScript, MarkDown, and Pug together in a decently cohesive way. Since Pug is already a compiled language, I just took the librety to compile more things while I'm at it!

The compiler is able to convert any MarkDown left in the source into its HTML representation. The MarkDown here is a small subset of the [accepted MarkDown spec](https://spec-md.com/).

The thing™ also compiles Pug into HTML, with a few added features and a few removed features (most notably no variables or pipes, but support for reusable components)! The Pug compiler is also a subset of the [accepted Pug spec](https://pugjs.org/language/attributes.html).

Finally, any TypeScript found in script tags is compiled into plain JavaScript. This is not a subset, as I'd rather die than write [my own TypeScript compiler](./tscompiler.pug).

<br>
<br>

# 
<sub>I'm currently working on a logo. Let's hope it's decent!</sub>
