
## Variables

You can pass compile-time (static) variables to any element, which are defined
within the instance of the element and are also accessible through all its
children. To add a variable to an element, simply write the variable as an
attribute of said element:
```pug
some-element(name="Mary")
	p Hello, @{name}!
```

Which would create the following HTML:
```html
<some-element name="Mary">
	<p>Hello, Mary!</p>
</some-element>
```

A more useful example of this, if you have some text that is re-used multiple
times in a div, you could extrapolate it into a variable:

```pug
div(text="Hey there!")
	p(style="margin-top:5px;color:#ddd") @{text}
	p(style="margin-top:3px;color:#888") @{text}
	p(style="margin-top:1px;color:#000") @{text}
style.
	div > p { margin: 0; position: absolute; font-size: 2em; }
```

Keep in mind that changing the value of the attribute doesn't update the HTML!
That is what **Dynamic Variables** are for!

## ✨Dynamic Variables✨
***NOTE: These are not implemented yet, but they're on the roadmap!***

Dynamic Variables are Spells' version of templates (or interpolation, or JSX
expressions, depending on what framework you're coming from).

To make an element's variables dynamic, simply add the `dynamic` attribute to
said element:
```pug
div(dynamic, name="Jane")#my-element
	p Hello, @{name}!
```

Great! So far, this is pretty similar to before. This compiles to the following:
```html
<div id="my-element" name="Jane">
	<p>Hello, Jane!</p>
</div>
```

Here's where the magic happens: by assigning this element as dynamic, we can
change its properties, and it'll re-render _automatically_!
```ts
const dynamicElement = document.querySelector("#my-element")
dynamicElement.name = "John F. Kennedy"
```

The JavaScript code above modifies the element, which refreshes its contents and
ends up like this:
```html
<div id="my-element" name="John F. Kennedy">
	<p>Hello, John F. Kennedy!</p>
</div>
```

Notice that we're changing the property in JavaScript, and not the element's
attribute itself (See [here](https://stackoverflow.com/a/6004028) for the
distinction). The library inserts a setter on each of the element's properties,
so changing the attribute through `HTMLElement.setAttribute()` won't make the
element re-render!

<sub>Keep in mind that while we offer these JS-framework-like features, any
framework should still be usable in conjunction with Spells. This is just a bit
of (optional) extra sugar to make normal HTML writing a bit nicer! If you don't
include dynamic variables in your Spells code, the associated JS doesn't get
included at all.</sub>
