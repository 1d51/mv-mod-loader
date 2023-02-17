# mv-mod-loader
A mod loader for RPG Maker MV games. It uses the xdiff library implemented by [Dominic Tarr](https://github.com/dominictarr) to combine complex JSON files (think CommonEvents.json), and some heuristics to handle simpler files (think Items.json). By making a backup of the game's original files on first launch after install, it then merges the changes made by the different mods on bootup, and overrides the game's files, allowing users to easily change the mods they have installed. To make game bootup faster, it compresses mods so that they only contain relevant changes in their files. It also stores diffs between files once computed, to further speed things up.

## Install Instructions
For the game developer, adding this plugin to their game is done as they would with any other plugin. The included libraries are required.

For a modder to add support to a game that does not come with this plugin pre-installed, they will have to distribute some extra, game-dependant files, such as `plugins.js`. It's also recommended that they package their mods along with the generated `diffs` folder, to reduce first-launch loading times.

A user can install mods by adding them inside the `www/mods` folder, independently of whether those mods were designed with this plugin in mind or not. For example, if a modder distributes a mod in the form of a folder like `example/www/...`, installing said mod so that it's loaded through the plugin is as simple as drag and dropping the whole thing, so that it looks like `www/mods/example`.

The plugin can handle working on top of an already modified game, but a clean install is always recommended. Once the plugin is installed, there should be no need to install mods the usual way, instead of how it's explained here.

## User Instructions
When the plugin is loaded into a game, a new menu option will be added to the start menu, called **mods**. In said menu, it possible to enable and disable mods. It's also possible to reorder mods using **Page Up** and **Page Down** (usually a combination of the **FN** key and arrow keys). When the list of active mods or their order changes, the game will shut down and, on next launch, it'll load with said mods.

## Packaging Instructions
The mod loader does not require any extra work on the side of either the mod makers or the users to function, but it's possible to provide it with some information about the mods to customize their behaviour. A mod folder can include a `metadata.json` file with the following format:
```
{
  "name": "",
  "version": "",
  "dependencies": [{
    "name": "",
    "version": ""
  }],
  "incompatible": [{
    "name": "",
    "version": ""
  }]
}
```
When defining a dependency or incompatibility, it's not necessary to specify a `version`. If it's not specified, the entry will apply to all versions of the mod with the given `name`. If the mod that we want to flag as either thing does not have a `metadata.json` file itself, we can refer to it by the name of its folder.
## Known Issues
- The plugin doesn't know how to solve ID conflicts. Mod authors have to agree on the ID their mods use.
- This is a WIP and bugs are to be expected.
