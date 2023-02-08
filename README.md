# mv-mod-loader
A mod loader for RPG Maker MV games. It uses the xdiff library implemented by [Dominic Tarr](https://github.com/dominictarr) to combine complex JSON files (think CommonEvents.json), and some heuristics to handle simpler files (think Items.json).
By making a backup of the game's original files on first launch after install, it then merges the changes made by the different mods on bootup, and overrides the game's files, allowing users to easily change the mods they have installed.
To make game bootup faster, it compresses mods so that they only contain relevant changes in their files. It also stores diffs between files once computed, to further speed things up.

## Install Instructions
For the game developer, adding this plugin to their game is done as they would with any other plugin. The included libraries are required.

For a modder to add support to a game that does not come with this plugin pre-installed, they will have to distribute some extra, game-dependant files, such as `plugins.js`.

A user can install mods by adding them inside the `www/mods` folder, independently of whether those mods were designed with this plugin in mind or not.
For example, if a modder distributes a mod in the form of a folder like `example/www/...`, installing said mod so that it's loaded through the plugin is as simple as drag and dropping the whole thing, so that it looks like `www/mods/example`.

The plugin can handle working on top of an already modified game, but a clean install is always recommended. Once the plugin is installed, there should generally be no need to install mods the usual way, instead of how it's explained here.
The one exception, in the current implementation, are mods that include other plugins. Those need to have the contents of their `www/js` folder installed separately.

## Known Issues
- A heavily modded game can take a few minutes to launch the first time.
- After that, it will only take a few more seconds than normal to launch.
- The plugin can't currently handle loading other plugins. Files inside the `www/js` folder of a mod will be ignored.
- The plugin doesn't know how to solve ID conflicts. Mod authors have to agree the on ID their mods use.
- This is a WIP and bugs are to be expected.
