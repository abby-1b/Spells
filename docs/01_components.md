
# Basic Components

Components are an integral part of web development. Editable, customizable, and
most importantly: reusable.

Components in Spells are defined with a `@`. For example:
```pug
component-name(@)
	p This text is inside the component!
```

The first time you declare a component, it doesn't get added to the output HTML.
To actually use the component you've declared, you need to place it where you
want it:
```pug
component-name(@)
```

This will display the component wherever you've placed it. This is what the
generated HTML will look like:
```html
<div @ class="component-name">
	<p>This text is inside the component!</p>
</div>
```

<sub>Note: the @ attribute still stays on the element, though that might be
removed in later versions, but it's not a bother for now.</sub>

They can be defined at any point during the file, but do remember that they need
to be declared _before_ they're used.

The following would be wrong:
```pug
component(@)
component(@)
	p We're declaring the component after it's been used! This won't work.
```

It's wrong because we're using the component (see the top declaration, the one
that doesn't have any content) before declaring it! Don't do that.


# TODO: Variables.
***The following section has not been completed. This won't work yet.***

## Variables

You can pass compile-time variables to components, which are defined within the
instance of the component you've just created. To add a variable to a component,
simply write the variable into a part of the component. For example:
```pug
cool-component(@)
	p Hello, @{name}!
```

Now, when instancing this component, you can pass values to the variable through
attributes:
```pug
cool-component(@, name="Mary")
```

Which would create the following HTML:
```html
<div @ class="cool-component" name="Mary">
	<p>Hello, Mary!</p>
</div>
```

## ✨Dynamic Variables✨

Dynamic Variables are Spells' version of templates (or interpolation, or JSX
expressions, depending on what framework you're coming from).

To make a component's variables dynamic, simply add the `dynamic` attribute to
said component:
```pug
dynamic-component(@, dynamic)#my-component
	p Hello, @{name}!
```

Great! So far, this is pretty similar to before.
```pug
dynamic-component(@, name="Jane")#my-component
```

However, the attributes don't get compiled into the HTML this time...
```html
<div @ class="dynamic-component" id="my-component">
	<p>Hello, Jane!</p>
</div>
```

Here's where the magic happens: by assigning this component as dynamic, we can
change its properties, and it'll re-render _automatically_:

```ts
const dynamicComponent = document.querySelector("#my-component")
dynamicComponent.name = "John F. Kennedy"
```

The JavaScript code above modifies the component, which refreshes its contents
and ends up like this:
```html
<div @ class="dynamic-component" id="my-component">
	<p>Hello, Jane!</p>
</div>
```

<sub>Note: Attributes aren't present in dynamic components to avoid confusion
between element attributes and component properties. Component properties are
the actual properties accessable by JavaScript (`dynComponent.name`), while
element attributes are HTML-side. Although they _could_ be accessed from JS,
they're not as practical.</sub>

<sub>Keep in mind that while we offer these JS-framework-like features, any
framework should still be usable in conjunction with Spells. This is just a bit
of extra sugar to make normal HTML writing a bit nicer!</sub>
