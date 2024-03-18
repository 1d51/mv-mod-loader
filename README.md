# MV Mod Loader
A mod loader for RPG Maker MV games. It uses the xdiff library implemented by [Dominic Tarr](https://github.com/dominictarr), optimized and with several fixes, to combine complex JSON files (think CommonEvents.json), and some heuristics to handle simpler files (think Items.json). By making a backup of the game's original files on first launch after install, it then merges the changes made by the different mods on bootup, and overrides the game's files, allowing users to easily change the mods they have installed. It also compresses mods so that they only contain relevant changes in their files.

## Install Instructions

For a modder to add support to a game that does not come with this plugin pre-installed, they will have to distribute some extra, game-dependant files, such as `plugins.js`.

A user can install mods by adding them inside the `www/mods` folder, independently of whether those mods were designed with this plugin in mind or not. For example, if a modder distributes a mod in the form of a folder like `example/www/...`, installing said mod so that it's loaded through the plugin is as simple as drag and dropping the whole thing, so that it looks like `www/mods/example` inside of the game's folder.

The plugin can handle working on top of an already modified game, but a clean install is always recommended. Once the plugin is installed, there should be no need to install mods the usual way, instead of how it's explained here.

## User Instructions
When the plugin is loaded into a game, a new menu option will be added to the start menu, called **mods**. In said menu, it's possible to enable and disable mods. It's also possible to reorder mods using **Page Up** and **Page Down** (usually a combination of the **FN** key and arrow keys). When the list of active mods or their order changes, the game will shut down and, on next launch, it'll load with said mods.

## Packaging Instructions
The mod loader does not require any extra work on the side of either the mod makers or the users to function, but it's possible to provide it with some information about the mods to customize their behavior. A mod folder can include a `metadata.json` file with the following format:
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
  }],
  "overrides": {
    "data/CommonEvents.json": [1]
  },
  "randomize": false,
  "track": false
}
```
When defining a dependency or incompatibility, it's not necessary to specify a `version`. If it's not specified, the entry will apply to all versions of the mod with the given `name`. If the mod that we want to flag as either thing does not have a `metadata.json` file itself, we can refer to it by the name of its folder. There are some rare cases where the xdiff algorithm may fail for a particular file, or part of a file. For these, it's possible to tell the plugin to avoid the fancy algorithm and just do a simple replacement. The `overrides` field takes relative paths as keys, and either a boolean for a full replacement of the file, or an ID, or list of ID, to make a more fine-grained replacement. In the example above, it'd replace the CommonEvent with ID of 1, skipping the attempt at merging it.

Map files can be a challenge to work with, as when one creates a new map event, an ID is automatically assigned to it, independently of its position. It's often the case that two mods may want to add an event to a map, both of which having nothing to do with each other, but as they share the same ID, they are merged. The `randomize` parameter can be set to true to help with this. It will randomize the ID of new map events, while respecting the mod's `dependencies`, avoiding accidental collisions. It's set to false by default.

When reducing mods, order is generally lost for any new plugins, and they will be loaded after the base game's. The `track` parameter can be set to true to avoid this. It's false by default because the algorithm is not very smart. If set to true, make sure you do so before having your mod reduced, or else it's likely your plugins will instead be loaded first.

You can also include a `config.json` file in the mod folder, which allows users to set the value of switches and variables, by editing said file. An easy way of allowing the configuration of a mod.
```
{
  "switches": [{
    "id": 1,
    "value": true,
    "description": "Do you want a feature?"
  }],
  "variables": [{
    "id": 1,
    "value": 42,
    "description": "How many of something?"
  }]
}
```
Only the `id` and `value` fields are actually used.
## Known Issues
- Mod loading is a bit slow. The first launch after changing the mod list can take up to a minute.
- The plugin doesn't know how to solve ID conflicts. Mod authors have to agree on the ID their mods use.
- The plugin relies on empty names to tell if an entry is empty itself or not. To have an entry without a name not be ignored, you have to add some spaces into the otherwise empty name. This is a small quirk that was introduced in favor of more complex, bug-prone solutions to the issue of ignoring empty entries.
