
# Installation instructions

**Important:** This is a Linux/MacOS only library.
The installer will not work on Windows!
_We're working on making the library platform-independent._

First, [make sure you've got Deno installed](https://deno.land/manual@v1.31.1/getting_started/installation):
```
deno --version
```

Then, run the following command to install the library:
```
sudo deno run -A https://raw.githubusercontent.com/abby-1b/Spells/main/install/noClone.ts
```

# If you've already cloned the repository

First, enter the cloned repo:
```
cd Spells
```

Then, run the following to install the library:
```
sudo deno run -A install/fromClone.ts
```

Keep in mind that moving the cloned repo anywhere will break the executable's functioning.

