
# Installation instructions

First, [make sure you've got Deno installed](https://deno.land/manual@v1.31.1/getting_started/installation):
```
deno --version
```

Then, run the following command to install the library:
```
deno install -A -n spl https://raw.githubusercontent.com/abby-1b/Spells/main/src/spells.ts
```

Then, if prompted, add the given repository to your PATH.

# If you've already cloned the repository

If you've already cloned the repository, then run the following command (from
the root of the repo):
```
deno install -A -n spl ./src/spells.ts
```

Then, if prompted, add the given repository to your PATH.

Keep in mind that moving the cloned repo will make the `spl` command stop
working!
