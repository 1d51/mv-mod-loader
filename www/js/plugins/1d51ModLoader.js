/*:
 * @author 1d51
 * @version 2.7.8
 * @plugindesc A simple mod loader for RPG Maker MV.
 */

var Imported = Imported || {};
Imported.ModLoader = true;

var ModLoader = ModLoader || {};
var Mods = Mods || {};

ModLoader.fs = require("fs");
ModLoader.xdiff = require("./js/libs/xdiff");

ModLoader.Helpers = ModLoader.Helpers || {};
ModLoader.Params = ModLoader.Params || {};
ModLoader.Config = ModLoader.Config || {};
ModLoader.Holders = ModLoader.Holders || {};

(async function ($) {
    $.Config.keyCombine = [];
    $.Config.keyAssign = ["parameters"];
    $.Config.keyMerge = ["inputs", "factors", "pages", "events", "terms"];
    $.Config.keySquash = ["armorTypes", "elements", "equipTypes", "skillTypes", "weaponTypes", "switches", "variables"];
    $.Config.keyXDiff = ["list", "note", "equips", "traits", "learnings", "effects"];

    $.Config.backupSkip = [];
    $.Config.usePlaceholders = true;
    $.Config.mergeIcons = true;
    $.Config.minRandomId = 999999;
    $.Config.maxFolderDepth = 1;

    $.Helpers.strEq = function (left, right) {
        return JSON.stringify(left) === JSON.stringify(right);
    };

    $.Helpers.idPresent = function(obj, id) {
        return obj != null && id in obj;
    }

    $.Helpers.idEq = function (left, right, id) {
        if (left != null && right != null) {
            if (id in left && id in right) {
                return left[id] === right[id];
            }
        }
        return false;
    };

    $.Helpers.idIncl = function (arr, obj, id) {
        if (obj != null && id in obj) {
            if (Array.isArray(arr)) {
                return arr.includes(obj[id]);
            } else return arr === obj[id];
        }
        return false;
    }

    $.Helpers.hashCode = function (str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            let code = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + code;
            hash = hash & hash;
        }
        return hash;
    };

    $.Helpers.randomId = function () {
        return Math.floor(Math.random() * (Number.MAX_SAFE_INTEGER - $.Config.minRandomId + 1)) + $.Config.minRandomId;
    };

    $.Helpers.dedup = function (arr) {
        const a = arr.concat();
        for (let i = 0; i < a.length; ++i) {
            for (let j = i + 1; j < a.length; ++j) {
                if ($.Helpers.strEq(a[i], a[j])) a.splice(j--, 1);
            }
        }
        return a;
    };

    $.Helpers.untag = function (str) {
        const matches = str.match(/<([^>]*)>[\s\S]*?<\/\1>|<([^>]*)>/gm) || [];
        return Array.from(new Set(matches.map(x => x.trim())));
    };

    $.Helpers.move = function (arr, index, delta) {
        const newIndex = index + delta;
        if (newIndex < 0 || newIndex === arr.length) return;
        const indexes = [index, newIndex].sort((a, b) => a - b);
        arr.splice(indexes[0], 2, arr[indexes[1]], arr[indexes[0]]);
    };

    $.Helpers.createPath = function (wrath) {
        const oldVersion = window.location.pathname !== "/index.html";
        oldVersion && (wrath = "/" + wrath);
        wrath += (wrath === "") ? "./" : "/";
        !(Utils.isNwjs() && Utils.isOptionValid("test")) && (wrath = "www/" + wrath);
        let path = window.location.pathname.replace(/(\/www|)\/[^\/]*$/, wrath);
        if (path.match(/^\/([A-Z]:)/)) path = path.slice(1);
        path = decodeURIComponent(path);
        return path;
    };

    $.Helpers.getFilesRecursively = function (path) {
        const files = [];
        const filesInPath = $.fs.readdirSync(path);
        for (const file of filesInPath) {
            const absolute = path + "/" + file;
            if ($.fs.statSync(absolute).isDirectory()) {
                files.push(...$.Helpers.getFilesRecursively(absolute));
            } else files.push(absolute);
        }
        return files;
    };

    $.Helpers.findFolderRecursively = function (path, name, depth = 0) {
        const foldersInPath = $.Helpers.getFolders(path);
        for (const folder of foldersInPath) {
            const absolute = path + "/" + folder;
            if (folder === name) {
                return absolute;
            } else {
                if (depth >= $.Config.maxFolderDepth) return null;
                const result = $.Helpers.findFolderRecursively(absolute, name, depth + 1);
                if (result) return result;
            }
        }
        return null;
    };

    $.Helpers.getFolders = function (path) {
        const folders = [];
        const foldersInPath = $.fs.readdirSync(path);
        for (const folder of foldersInPath) {
            const absolute = path + "/" + folder;
            if ($.fs.statSync(absolute).isDirectory()) {
                folders.push(folder);
            }
        }
        return folders;
    };

    $.Helpers.getFiles = function (path) {
        const files = [];
        const filesInPath = $.fs.readdirSync(path);
        for (const file of filesInPath) {
            const absolute = path + "/" + file;
            if (!$.fs.statSync(absolute).isDirectory()) {
                files.push(file);
            }
        }
        return files;
    };

    $.Helpers.deepWriteSync = function (path, file, options = null) {
        $.Helpers.ensureDirectoryExistence(path);
        $.fs.writeFileSync(path, file, options);
    };

    $.Helpers.ensureDirectoryExistence = function (path) {
        const index = path.lastIndexOf("/");
        if (index === -1) return;

        const directory = path.substring(0, index);
        if ($.fs.existsSync(directory)) return;
        $.Helpers.ensureDirectoryExistence(directory);
        $.fs.mkdirSync(directory);
    };

    $.Helpers.appendix = function (path) {
        const index = path.indexOf("/www");
        return path.substr(index + 5);
    };

    $.Helpers.modName = function (path) {
        const index = path.indexOf("/mods");
        return path.substr(index + 6).split("/")[0];
    };

    $.Helpers.parse = function (file, variable = false) {
        if (!variable) return JSON.parse(file);
        let str = file.toString().match(/=\n*(\[[\s\S]*)/)[1];
        str = str.replace(/;\n*$/, "");
        return JSON.parse(str);
    };

    $.Helpers.append = function (target, input) {
        const text = JSON.stringify(input);
        const ts = target.map((obj) => JSON.stringify(obj));
        if (text && ts.indexOf(text) === -1) ts.push(text);
        return ts.map((str) => JSON.parse(str));
    };

    $.Helpers.squash = function (source, original, target) {
        if (!Array.isArray(target)) return source;

        const result = [...target];
        for (let i = 0; i < source.length; i++) {
            if (i >= target.length) result.push(source[i]);
            else if (source[i] != null && source[i].length > 0) {
                result[i] = source[i];
            }
        }

        return result;
    };

    $.Helpers.assign = function (source, original, target) {
        const result = JSON.parse(JSON.stringify(original));
        Object.keys(target).forEach(function (key) {
            result[key] = target[key];
        });
        Object.keys(source).forEach(function (key) {
            result[key] = source[key];
        });

        return result;
    };

    $.Helpers.isEmptyEntry = function (entry) {
        if (entry == null)
            return true;
        if ("name" in entry)
            return !entry.name;
        return false;
    };

    $.Helpers.overlayImages = async function (paths) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        for (let i = 0; i < paths.length; i++) {
            const file = $.fs.readFileSync(paths[i]);
            const url = `data:image/png;base64,${file.toString('base64')}`;

            const img = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = url;
            });

            if (img != null) {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = Math.max(canvas.width, img.width);
                tempCanvas.height = Math.max(canvas.height, img.height);
                const tempContext = tempCanvas.getContext('2d');
                tempContext.drawImage(canvas, 0, 0);
                tempContext.drawImage(img, 0, 0);
                canvas.width = tempCanvas.width;
                canvas.height = tempCanvas.height;
                context.drawImage(tempCanvas, 0, 0);
            }
        }

        const urlData = canvas.toDataURL("image/png", 1);
        return urlData.replace(/^data:image\/png;base64,/, "");
    }

    $.Helpers.camelize = function (str) {
        return str.replace(/[-_\s]+(.)?/g, function (match, chr) {
            return chr ? chr.toUpperCase() : '';
        }).replace(/^./, function (match) {
            return match.toUpperCase();
        });
    }

    /************************************************************************************/

    $.Params.root = $.Helpers.createPath("");
    $.Params.modsPath = $.Params.root + "mods/";
    $.Params.backupsPath = $.Params.root + "backups/";
    $.Params.iconsPath = $.Params.root + "img/system/IconSet.png";

    $.Params.reboot = false;
    $.Params.badFolder = false;
    $.Params.conflicts = [];

    $.Params.currentMod = null;
    $.Params.currentFile = null;
    $.Params.currentKey = null;
    $.Params.currentId = null;

    $.readMods = async function () {
        $.Helpers.ensureDirectoryExistence($.Params.modsPath);
        $.Helpers.ensureDirectoryExistence($.Params.backupsPath);

        const modFolders = $.Helpers.getFolders($.Params.modsPath);
        const mods = $.sortMods(modFolders).filter(m => $.getModEnabled(m));
        $.setModHash(mods);

        if ($.checkLast(mods)) return;

        const files = $.Helpers.getFilesRecursively($.Params.backupsPath);
        for (let i = 0; i < files.length; i++) {
            const index = files[i].indexOf("/backups");
            const keyPath = files[i].substr(index + 10);
            const originPath = $.Params.root + keyPath;
            const backupFile = $.fs.readFileSync(files[i]);
            $.Helpers.deepWriteSync(originPath, backupFile);
        }

        let additions = $.getAdditions();
        for (let i = 0; i < additions.length; i++) {
            if ($.fs.existsSync(additions[i])) {
                $.fs.unlinkSync(additions[i]);
            }
        }

        const icons = [];
        const filePaths = {};
        additions = new Set();
        for (let i = 0; i < mods.length; i++) {
            let modPath = $.Params.modsPath + mods[i];
            if ($.fs.existsSync(modPath + "/www")) modPath = modPath + "/www";
            else modPath = $.Helpers.findFolderRecursively(modPath, "www");
            if (modPath == null) continue;

            const files = $.Helpers.getFilesRecursively(modPath);
            for (let j = 0; j < files.length; j++) {
                const keyPath = $.Helpers.appendix(files[j]);
                const originPath = $.Params.root + keyPath;
                $.backup(files[j]);

                if (!$.fs.existsSync(originPath)) {
                    additions.add(originPath);
                }

                if ($.Config.mergeIcons && keyPath.match(/IconSet\.png/)) {
                    icons.push(files[j]);
                    continue;
                }

                if (!keyPath.match(/(\.json)|(plugins[^\/]*\.js)/)) {
                    const sourceFile = $.fs.readFileSync(files[j]);
                    $.Helpers.deepWriteSync(originPath, sourceFile);
                    continue;
                }

                if (!filePaths[keyPath]) filePaths[keyPath] = [];
                filePaths[keyPath].push(files[j]);
            }
        }

        if (icons.length > 0) {
            const paths = [$.Params.iconsPath].concat(icons);
            const file = await $.Helpers.overlayImages(paths);
            $.Helpers.deepWriteSync($.Params.iconsPath, file, "base64");
        }

        $.setAdditions([...additions]);
        Object.keys(filePaths).forEach(function (key) {
            const isPlugin = key.match(/plugins[^\/]*\.js/);
            const identifier = isPlugin ? "name" : "id";
            if (isPlugin) $.Params.reboot = true;
            $.Params.currentFile = key;

            const backupPath = $.Params.backupsPath + key;
            const backupFile = $.fs.existsSync(backupPath) ? $.fs.readFileSync(backupPath) : null;
            const backupData = backupFile ? $.Helpers.parse(backupFile, isPlugin) : null;

            let targetData = backupFile ? $.Helpers.parse(backupFile, isPlugin) : null;

            const mappings = {};
            for (let i = 0; i < filePaths[key].length; i++) {
                const mod = $.Helpers.modName(filePaths[key][i]);
                const metadata = $.loadMetadata(mod);
                $.Params.currentMod = mod;

                const sourceFile = $.fs.readFileSync(filePaths[key][i]);
                const sourceData = $.Helpers.parse(sourceFile, isPlugin);

                const reducedData = $.reduceData(sourceData, backupData, identifier, isPlugin);

                if (!$.Helpers.strEq(sourceData, reducedData)) {
                    let reducedStr = JSON.stringify(reducedData);
                    if (isPlugin) reducedStr = "var $plugins =\n" + reducedStr;
                    $.Helpers.deepWriteSync(filePaths[key][i], reducedStr);
                }

                if (reducedData == null) continue;

                const overrides = (metadata["overrides"] || {})[key];
                const randomizedData = $.randomizeData(reducedData, backupData, metadata, mappings, key, identifier);
                targetData = $.mergeData(randomizedData, backupData, targetData, identifier, overrides);

                const patches = $.listPatches(mod);
                for (let j = 0; j < patches.length; j++) {
                    const patchPath = patches[j] + "/www/" + key;
                    if ($.fs.existsSync(patchPath)) {
                        const metadataPath = patches[j] + "/metadata.json";
                        const metadata = $.parseMetadata(mod, metadataPath);

                        const sourceFile = $.fs.readFileSync(patchPath);
                        const sourceData = $.Helpers.parse(sourceFile, isPlugin);

                        const reducedData = $.reduceData(sourceData, backupData, identifier, isPlugin);

                        if (!$.Helpers.strEq(sourceData, reducedData)) {
                            let reducedStr = JSON.stringify(reducedData);
                            if (isPlugin) reducedStr = "var $plugins =\n" + reducedStr;
                            $.Helpers.deepWriteSync(patchPath, reducedStr);
                        }

                        if (reducedData == null) continue;

                        const overrides = (metadata["overrides"] || {})[key];
                        const randomizedData = $.randomizeData(reducedData, backupData, metadata, mappings, key, identifier);
                        targetData = $.mergeData(randomizedData, backupData, targetData, identifier, overrides);
                    }
                }
            }

            if (isPlugin) {
                const sortedData = [];
                for (let i = 0; i < targetData.length; i++) {
                    const plugin = targetData[i];
                    if (plugin["position"] == null) {
                        sortedData.push(plugin);
                    }
                }
                for (let i = 0; i < targetData.length; i++) {
                    const plugin = targetData[i];
                    if (plugin["position"] != null) {
                        const position = Math.min(plugin["position"], sortedData.length - 1);
                        sortedData.splice(position, 0, plugin);
                    }
                }
                targetData = sortedData;
            }

            const path = $.Params.root + key;
            let targetStr = JSON.stringify(targetData);
            if (isPlugin) targetStr = "var $plugins =\n" + targetStr;
            $.Helpers.deepWriteSync(path, targetStr);
        });

        $.setLast(mods);
        $.setConflicts($.Params.conflicts);
    };

    $.backup = function (path) {
        const keyPath = $.Helpers.appendix(path);
        const backupPath = $.Params.backupsPath + keyPath;
        const originPath = $.Params.root + keyPath;

        for (let i = 0; i < $.Config.backupSkip.length; i++) {
            if (keyPath.match($.Config.backupSkip[i])) return;
        }

        if (!$.fs.existsSync(backupPath)) {
            if ($.fs.existsSync(originPath)) {
                const backupFile = $.fs.readFileSync(originPath);
                $.Helpers.deepWriteSync(backupPath, backupFile);
            }
        }
    };

    $.mergeData = function (source, original, target, identifier, overrides) {
        if (typeof overrides == "boolean" && overrides) {
            $.Params.conflicts = $.Params.conflicts.filter(x => {
                return x["file"] !== $.Params.currentFile;
            });
            return source;
        }

        if (target == null) return source;

        let missingIdentifier = false;
        const result = JSON.parse(JSON.stringify(target));
        const primordial = original ? original : target;
        if (Array.isArray(source) && Array.isArray(target)) {
            for (let i = 0; i < source.length; i++) {
                if (source[i] == null) continue;
                $.Params.currentId = source[i][identifier];
                if (!$.Helpers.idPresent(source[i], identifier)) {
                    if (target.length > i) result[i] = $.mergeData(source[i], primordial[i], target[i], identifier, overrides);
                    else result.push(source[i]);
                    missingIdentifier = true;
                    continue;
                }
                const pi = primordial ? primordial.findIndex(x => x && $.Helpers.idEq(x, source[i], identifier)) : -1;
                const ti = target ? target.findIndex(x => x && $.Helpers.idEq(x, source[i], identifier)) : -1;
                if ($.Helpers.idIncl(overrides, source[i], identifier)) {
                    $.Params.conflicts = $.Params.conflicts.filter(x => {
                        return x["file"] !== $.Params.currentFile ||
                            x["id"] !== $.Params.currentId;
                    });
                    if (ti >= 0) result[ti] = source[i];
                    else result.push(source[i]);
                    continue;
                }
                if (ti >= 0) result[ti] = $.mergeData(source[i], primordial[pi], target[ti], identifier, overrides);
                else result.push(source[i]);
            }
            if (missingIdentifier && result.length > source.length) {
                result.splice(source.length, result.length - source.length);
            }
        } else {
            if ($.Helpers.isEmptyEntry(source)) return result;
            $.Params.currentId = source[identifier];
            Object.keys(source).forEach(function (key) {
                $.Params.currentKey = key;
                if (target && key in target) {
                    if (Array.isArray(overrides) && overrides.includes(key) || overrides === key) {
                        $.Params.conflicts = $.Params.conflicts.filter(x => {
                            return x["file"] !== $.Params.currentFile ||
                                x["key"] !== $.Params.currentKey;
                        });
                        result[key] = source[key];
                    } else if ($.Config.keyCombine.includes(key)) {
                        const aux = result[key].concat(source[key]);
                        if (Array.isArray(source[key])) {
                            result[key] = $.Helpers.dedup(aux);
                        } else result[key] = aux;
                    } else if ($.Config.keyAssign.includes(key)) {
                        result[key] = $.Helpers.assign(source[key], primordial[key], target[key]);
                    } else if ($.Config.keyMerge.includes(key)) {
                        result[key] = $.mergeData(source[key], primordial[key], target[key], identifier, overrides);
                    } else if ($.Config.keySquash.includes(key)) {
                        result[key] = $.Helpers.squash(source[key], primordial[key], target[key]);
                    } else if ($.Config.keyXDiff.includes(key)) {
                        if (typeof source[key] === "string" || source[key] instanceof String) {
                            result[key] = $.tagDiff(source[key], primordial[key], target[key]);
                        } else if (Array.isArray(source[key])) {
                            result[key] = $.arrDiff(source[key], primordial[key], target[key]);
                        } else {
                            const diff = $.xdiff.diff3(source[key], primordial[key], target[key])["diff"];
                            result[key] = $.xdiff.patch(primordial[key], diff);
                        }
                    } else if (key === "name") {
                        result[key] = source[key].trim();
                    } else result[key] = source[key];
                } else result[key] = source[key];
            });
        }

        return result;
    };

    $.reduceData = function (source, original, identifier, track) {
        if (original == null) return source;
        const ss = JSON.stringify(source);
        const os = JSON.stringify(original);
        if (source == null || ss === os) {
            if (Array.isArray(source)) return [];
            return null;
        }

        let reduced = false;
        let result = JSON.parse(ss);
        if (Array.isArray(original) && Array.isArray(source)) {
            const positioned = source.some(obj => obj != null && "position" in obj);
            for (let i = 0; i < source.length; i++) {
                if (source[i] == null) continue;
                const ri = result ? result.findIndex(x => x && $.Helpers.idEq(x, source[i], identifier)) : -1;
                const oi = original ? original.findIndex(x => x && $.Helpers.idEq(x, source[i], identifier)) : -1;

                if (ri >= 0 && oi >= 0) {
                    if ($.Helpers.strEq(original[oi], source[i])) {
                        result.splice(ri, 1);
                        reduced = true;
                    }
                } else if (ri >= 0) {
                    const position = result[ri]["position"];
                    if (track && position == null)
                        result[ri]["position"] = i;
                }
            }
            if (!reduced && !positioned) {
                result = result.map(obj => {
                    if (obj == null) return obj;
                    delete obj["position"];
                    return obj;
                });
            }
            result = result.filter(x => x);
        } else {
            Object.keys(source).forEach(function (key) {
                if (original && key in original) {
                    if ($.Config.keyMerge.includes(key)) {
                        result[key] = $.reduceData(source[key], original[key], identifier, track);
                    } else if ($.Helpers.strEq(original[key], source[key])) {
                        delete result[key];
                    }
                }
            });
        }

        return result;
    };

    $.randomizeData = function (source, original, metadata, mappings, key, identifier) {
        if (original == null || identifier !== "id") return source;
        const isMap = key.match(/Map[0-9]*\.json/);
        if (!isMap) return source;

        if (mappings[key] == null) mappings[key] = {};
        if (mappings[key].events == null) mappings[key].events = [];
        const copy = JSON.parse(JSON.stringify(source));

        for (let i = 0; i < copy.events.length; i++) {
            if (copy.events[i] == null) continue;
            const og = original.events.find(x => x != null && x.id === copy.events[i].id);
            if (og != null) continue;

            const mapping = mappings[key].events.find((x) => {
                return x.oldId === copy.events[i].id && metadata.dependencies.find((y) => {
                    return y.name === x.name && y.version === x.version;
                })
            });

            if (mapping == null) {
                const newId = metadata.randomize
                    ? $.Helpers.randomId()
                    : source.events[i].id;
                copy.events[i].id = newId;
                mappings[key].events.push({
                    "name": metadata.name,
                    "version": metadata.version,
                    "oldId": source.events[i].id,
                    "newId": newId
                })
            } else {
                copy.events[i].id = mapping.newId;
            }
        }

        return copy;
    };

    $.tagDiff = function (source, original, target) {
        const sa = $.Helpers.untag(source);
        const oa = $.Helpers.untag(original);
        const ta = $.Helpers.untag(target);

        const ma = $.arrDiff(sa, oa, ta);
        return ma.join("\n");
    };

    $.arrDiff = function (source, original, target) {
        if ($.Helpers.strEq(target, original)) return source;
        if ($.Helpers.strEq(source, original)) return target;

        const ss = source.map((obj) => JSON.stringify(obj));
        const os = original.map((obj) => JSON.stringify(obj));
        const ts = target.map((obj) => JSON.stringify(obj));

        let patch = $.xdiff.diff3(ss, os, ts);
        if (patch["diff"] == null) return original;
        const conflicts = patch["conflicts"].map(obj => JSON.parse(JSON.stringify(obj)));

        if (conflicts.length > 0) {
            $.Params.conflicts.push({
                "mod": $.Params.currentMod,
                "file": $.Params.currentFile,
                "key": $.Params.currentKey,
                "id": $.Params.currentId,
                "items": conflicts.map((obj) => {
                    for (let i = 2; i < obj["source"].length; i++) {
                        obj["source"][i] = JSON.parse(obj["source"][i]);
                    }
                    for (let i = 2; i < obj["target"].length; i++) {
                        obj["target"][i] = JSON.parse(obj["target"][i]);
                    }
                    return obj;
                })
            });
        }

        const rs = $.xdiff.patch(os, patch["diff"]);
        return rs.map((str) => JSON.parse(str));
    };

    $.loadSchema = function () {
        const schemaPath = $.Params.root + "schema.json";
        if ($.fs.existsSync(schemaPath)) {
            const schemaFile = $.fs.readFileSync(schemaPath);
            return JSON.parse(schemaFile);
        } else {
            return {
                "additions": [],
                "enabled": [],
				"order": [],
				"last": [],
            };
        }
    };

    $.writeSchema = function (schema) {
        const schemaPath = $.Params.root + "schema.json";
        $.Helpers.deepWriteSync(schemaPath, JSON.stringify(schema));
    };

    $.getAdditions = function () {
        const schema = $.loadSchema();
        return schema["additions"] || [];
    };

    $.setAdditions = function (additions) {
        const schema = $.loadSchema();
        schema["additions"] = additions || [];
        $.writeSchema(schema);
    };

    $.getEnabled = function () {
        const schema = $.loadSchema();
        return schema["enabled"] || [];
    };

    $.setEnabled = function (enabled) {
        const schema = $.loadSchema();
        schema["enabled"] = enabled || [];
        $.writeSchema(schema);
    };

    $.getOrder = function () {
        const schema = $.loadSchema();
        return schema["order"] || [];
    };

    $.setOrder = function (order) {
        const schema = $.loadSchema();
        schema["order"] = order || [];
        $.writeSchema(schema);
    };

    $.getLast = function () {
        const schema = $.loadSchema();
        return schema["last"] || [];
    };

    $.setLast = function (last) {
        const schema = $.loadSchema();
        schema["last"] = last || [];
        $.writeSchema(schema);
    };

    $.getModEnabled = function (symbol) {
        const schema = $.loadSchema();
        return schema["enabled"].includes(symbol);
    };

    $.setModEnabled = function (symbol, value) {
        const schema = $.loadSchema();

        if (!value) {
            const metadata = $.loadMetadata(symbol);
            for (let i = 0; i < schema["enabled"].length; i++) {
                const aux = $.loadMetadata(schema["enabled"][i]);
                const names = aux["dependencies"].map(d => d["name"]);
                if (names.includes(metadata["name"])) {
                    if (schema["enabled"].includes(schema["enabled"][i])) {
                        const index = schema["enabled"].indexOf(schema["enabled"][i]);
                        schema["enabled"].splice(index, 1);
                    }
                }
            }
        }

        if (value && !schema["enabled"].includes(symbol)) {
            schema["enabled"].push(symbol);
        } else if (!value && schema["enabled"].includes(symbol)) {
            const index = schema["enabled"].indexOf(symbol);
            schema["enabled"].splice(index, 1);
        }

        $.writeSchema(schema);
    };

    $.sortMods = function (mods) {
        let order = $.loadSchema()["order"];
        order = order.filter(m => mods.includes(m));
        for (let i = 0; i < mods.length; i++) {
            if (!order.includes(mods[i])) {
                let inserted = false;
                for (let j = 0; j < order.length; j++) {
                    const mm = $.loadMetadata(mods[i]);
                    const om = $.loadMetadata(order[j]);
                    const names = om["dependencies"].map(d => d["name"]);
                    if (names.includes(mm["name"])) {
                        order.splice(j, 0, mods[i]);
                        inserted = true;
                        break;
                    }
                }
                if (!inserted) {
                    order.push(mods[i]);
                }
            }
        }

        return order;
    };

    $.reorderMod = function (index, move) {
        const modsPath = $.Params.modsPath
        const modFolders = $.Helpers.getFolders(modsPath);
        const mods = $.sortMods(modFolders);

        const position = index + move;
        if (position > 0 && position < mods.length) {
            const im = $.loadMetadata(mods[index]);
            const pm = $.loadMetadata(mods[position]);

            if (move >= 0) {
                const names = pm["dependencies"].map(d => d["name"]);
                if (names.includes(im["name"])) return;
            } else {
                const names = im["dependencies"].map(d => d["name"]);
                if (names.includes(pm["name"])) return;
            }
        }

        $.Helpers.move(mods, index, move);
        const schema = $.loadSchema();
        schema["order"] = mods;
        $.writeSchema(schema);
    };

    $.checkLast = function (mods) {
        const schema = $.loadSchema();
        const titles = mods.map(mod => {
            const metadata = $.loadMetadata(mod);
            return metadata.name + " [" + metadata.version + "]"
        });
        const old = JSON.parse(JSON.stringify(schema["last"]));
        return JSON.stringify(titles) === JSON.stringify(old);
    };

    $.setLast = function (mods) {
        const schema = $.loadSchema();
        schema["last"] = mods.map(mod => {
            const metadata = $.loadMetadata(mod);
            return metadata.name + " [" + metadata.version + "]"
        });
        $.writeSchema(schema);
    };

    $.loadLog = function () {
        const logPath = $.Params.root + "log.json";
        if ($.fs.existsSync(logPath)) {
            const logFile = $.fs.readFileSync(logPath);
            return JSON.parse(logFile);
        } else {
            return {
                "conflicts": [],
            };
        }
    };

    $.writeLog = function (log) {
        const logPath = $.Params.root + "log.json";
        $.Helpers.deepWriteSync(logPath, JSON.stringify(log));
    };

    $.getConflicts = function () {
        const log = $.loadLog();
        return log["conflicts"] || [];
    };

    $.setConflicts = function (conflicts) {
        const log = $.loadLog();
        log["conflicts"] = conflicts || [];
        $.writeLog(log);
    };

    $.listPatches = function (mod) {
        let patchesPath = $.Params.modsPath + mod;
        if ($.fs.existsSync(patchesPath + "/patches")) patchesPath = patchesPath + "/patches";
        else patchesPath = $.Helpers.findFolderRecursively(patchesPath, "patches");
        if (patchesPath == null) return [];

        const result = [];
        const patchFolders = $.Helpers.getFolders(patchesPath);
        for (let i = 0; i < patchFolders.length; i++) {
            const metadataPath = patchesPath + "/" + patchFolders[i] + "/metadata.json";
            const metadata = $.parseMetadata(mod, metadataPath);
            const dependencies = metadata["dependencies"];

            let valid = true;
            for (let j = 0; j < dependencies.length; j++) {
                const version = Mods[dependencies[j]["name"]];
                const present = version && !dependencies[j]["version"];
                const versioned = version && version === dependencies[j]["version"];
                if (!present && !versioned) {
                    valid = false;
                    break;
                }
            }

            if (valid) {
                result.push(patchesPath + "/" + patchFolders[i]);
            }
        }

        return result;
    };

    $.loadMetadata = function (mod) {
        let modPath = $.Params.modsPath + mod;
        if ($.fs.existsSync(modPath + "/www")) modPath = modPath + "/www";
        else modPath = $.Helpers.findFolderRecursively(modPath, "www");

        const metadataPath = modPath != null
            ? modPath.substring(0, modPath.length - 4) + "/metadata.json"
            : $.Params.modsPath + mod + "/metadata.json";

        return $.parseMetadata(mod, metadataPath);
    };

    $.parseMetadata = function (mod, path) {
        if ($.fs.existsSync(path)) {
            const file = $.fs.readFileSync(path);
            let metadata = JSON.parse(file);

            if (metadata.name == null)
                metadata.name = mod;
            if (metadata.version == null)
                metadata.version = "";
            if (metadata.dependencies == null)
                metadata.dependencies = [];
            if (metadata.incompatible == null)
                metadata.incompatible = [];
            if (metadata.overrides == null)
                metadata.overrides = {};
            if (metadata.randomize == null)
                metadata.randomize = false;
            if (metadata.track == null)
                metadata.track = false;
            return metadata;
        } else {
            return {
                "name": mod,
                "version": "",
                "dependencies": [],
                "incompatible": [],
                "overrides": {},
                "randomize": false,
                "track": false
            };
        }
    };

    $.getSelectable = function (mod) {
        const modsPath = $.Params.modsPath
        const modFolders = $.Helpers.getFolders(modsPath);
        const mods = $.sortMods(modFolders).filter(m => $.getModEnabled(m));
        const meta = mods.map(m => $.loadMetadata(m));
        const metadata = $.loadMetadata(mod);
        for (let i = 0; i < meta.length; i++) {
            const incompatible = meta[i]["incompatible"] || [];
            for (let j = 0; j < incompatible.length; j++) {
                if (metadata["name"] === incompatible[j]["name"]) {
                    if (!metadata["version"] || !incompatible[j]["version"]) return false;
                    if (metadata["version"] === incompatible[j]["version"]) return false;
                }
            }
        }
        const incompatible = metadata["incompatible"] || [];
        for (let i = 0; i < incompatible.length; i++) {
            for (let j = 0; j < meta.length; j++) {
                if (incompatible[i]["name"] === meta[j]["name"]) {
                    if (!incompatible[i]["version"] || !meta[j]["version"]) return false;
                    if (incompatible[i]["version"] === meta[j]["version"]) return false;
                }
            }
        }
        const dependencies = metadata["dependencies"] || [];
        for (let i = 0; i < dependencies.length; i++) {
            let found = false;
            for (let j = 0; j < meta.length; j++) {
                if (dependencies[i]["name"] === meta[j]["name"]) {
                    if (!dependencies[i]["version"] || !meta[j]["version"]) found = true;
                    if (dependencies[i]["version"] === meta[j]["version"]) found = true;
                }
            }
            if (!found) return false;
        }

        return true;
    };

    $.loadConfig = function (mod) {
        let modPath = $.Params.modsPath + mod;
        if ($.fs.existsSync(modPath + "/www")) modPath = modPath + "/www";
        else modPath = $.Helpers.findFolderRecursively(modPath, "www");

        const configPath = modPath != null
            ? modPath.substring(0, modPath.length - 4) + "/config.json"
            : $.Params.modsPath + mod + "/config.json";

        if ($.fs.existsSync(configPath)) {
            const configFile = $.fs.readFileSync(configPath);
            let config = JSON.parse(configFile);

            if (config.switches == null)
                config.switches = [];
            if (config.variables == null)
                config.variables = [];
            return config;
        } else {
            return {
                "switches": [],
				"variables": []
            };
        }
    };

    $.configGame = function () {
        const modsPath = ModLoader.Params.modsPath;
        const modFolders = $.Helpers.getFolders(modsPath);
        const mods = ModLoader.sortMods(modFolders).filter(m => ModLoader.getModEnabled(m));
        for (let i = 0; i < mods.length; i++) {
            const config = ModLoader.loadConfig(mods[i]);
            const switches = config["switches"] || [];
            const variables = config["variables"] || [];
            for (let j = 0; j < switches.length; j++) {
                const id = switches[j]["id"];
                const value = switches[j]["value"];
                $gameSwitches.setValue(id, value);
            }
            for (let j = 0; j < variables.length; j++) {
                const id = variables[j]["id"];
                const value = variables[j]["value"];
                $gameVariables.setValue(id, value);
            }
        }
    };

    $.checkMods = function() {
        const modFolders = $.Helpers.getFolders($.Params.modsPath);
        const mods = $.sortMods(modFolders);

        for (let i = 0; i < mods.length; i++) {
            const modPath = $.Params.modsPath + mods[i];
            if ($.Helpers.findFolderRecursively(modPath, "www") == null) {
                $.Params.badFolder = true;
                return;
            }
        }
    }

    $.setModHash = function(mods) {
        for (let i = 0; i < mods.length; i++) {
            const meta = $.loadMetadata(mods[i]);
            const camel = $.Helpers.camelize(meta["name"]);
            Mods[meta["name"]] = meta["version"] || true;
            Mods[camel] = meta["version"] || true;
        }
    }

    /************************************************************************************/

    $.Holders.commandNewGame = Scene_Title.prototype.commandNewGame;
    Scene_Title.prototype.commandNewGame = function () {
        $.Holders.commandNewGame.call(this);
        $.configGame();
    };

    $.Holders.loadGame = DataManager.loadGame;
    DataManager.loadGame = function(savefileId) {
        const result = $.Holders.loadGame.call(this, savefileId);
        if (result) $.configGame();
        return result;
    };

    $.Holders.create = Scene_Title.prototype.create;
    Scene_Title.prototype.create = function() {
        $.Holders.create.call(this);
        if ($.getEnabled().length === 0) return;
        const conflicts = $.getConflicts();

        const itemCount = conflicts.reduce((acc, conflict) => acc + conflict.items.length, 0);
        const fatalCount = conflicts.reduce((acc, conflict) => {
            return acc + conflict.items.filter(item => item.fatal).length;
        }, 0);

        const bitmap = new Bitmap(Graphics.width, Graphics.height)
        bitmap.drawText("MV Mod Loader v2.7.7", 15, Graphics.height - (itemCount > 0 ? 60 : 30), Graphics.width, 6, "left");

        if (itemCount > 0) {
            bitmap.textColor = "#ff0000"
            const text = "Found " + itemCount + " conflicts (" + fatalCount + " fatal)";
            bitmap.drawText(text, 15, Graphics.height - 30, Graphics.width, 6, "left");
        }

        const sprite = new Sprite(bitmap);
        this.addChild(sprite);
    };

    $.Holders.makeCommandList = Window_TitleCommand.prototype.makeCommandList;
    Window_TitleCommand.prototype.makeCommandList = function () {
        $.Holders.makeCommandList.call(this);
        const modsPath = $.Params.modsPath;
        const modFolders = $.Helpers.getFolders(modsPath);
        const enabled = modFolders.length > 0 && !$.Params.badFolder;
        this.addCommand("Mods", "mods", enabled);
    };

    $.Holders.createCommandWindow = Scene_Title.prototype.createCommandWindow;
    Scene_Title.prototype.createCommandWindow = function () {
        $.Holders.createCommandWindow.call(this);
        this._commandWindow.setHandler("mods", this.mods.bind(this));
    };

    Scene_Title.prototype.mods = function () {
        this._commandWindow.close();
        SceneManager.push(Scene_Mods);
    };

    $.Holders.makeSaveContents = DataManager.makeSaveContents;
    DataManager.makeSaveContents = function () {
        let contents = $.Holders.makeSaveContents.call(this);
        contents.saveMods = $.loadSchema()["enabled"];
        return contents;
    };

    if (Imported.YEP_SaveCore) {
        Scene_File.prototype.createModConfirmWindow = function (lines) {
            this._modConfirmWindow = new Window_ModConfirm(lines);
            this._modConfirmWindow.setHandler("confirm", this.onModConfirmOk.bind(this));
            this._modConfirmWindow.setHandler("cancel", this.onModConfirmCancel.bind(this));
            this.addWindow(this._modConfirmWindow);
        };

        Scene_File.prototype.onModConfirmOk = function () {
            this._modConfirmWindow.deactivate();
            this._modConfirmWindow.close();
            setTimeout(this.performActionLoad.bind(this), 200);
        };

        Scene_File.prototype.onModConfirmCancel = function () {
            let index = this._actionWindow.index();
            this._modConfirmWindow.deactivate();
            this._modConfirmWindow.close();
            this.onSavefileOk();
            this._actionWindow.select(index);
        };

        Scene_File.prototype.startModConfirmWindow = function (added, removed) {
            SoundManager.playOk();
            this._modConfirmWindow.setData(added, removed);
            this._modConfirmWindow.open();
            this._modConfirmWindow.activate();
            this._modConfirmWindow.select(0);
        };

        $.Holders.onActionLoad = Scene_File.prototype.onActionLoad;
        Scene_File.prototype.onActionLoad = function () {
            const enabled = $.loadSchema()["enabled"].sort();
            const raw = StorageManager.load(this.savefileId());
            const saveMods = (JsonEx.parse(raw).saveMods || []).sort();
            if (!$.Helpers.strEq(enabled, saveMods)) {
                const added = enabled.filter(x => !saveMods.includes(x)).map(m => "\\C[3]+ " + $.loadMetadata(m).name);
                const removed = saveMods.filter(x => !enabled.includes(x)).map(m => "\\C[10]- " + $.loadMetadata(m).name);
                this.createModConfirmWindow(added.length + removed.length);
                this.startModConfirmWindow(added, removed);
            } else {
                $.Holders.onActionLoad.call(this);
            }
        };

        if ($.Config.usePlaceholders) {
            $.Holders.drawFace = Window_SaveInfo.prototype.drawFace
            Window_SaveInfo.prototype.drawFace = function(name, index, x, y, w, h) {
                const facesPath = $.Params.root + "img/faces/";
                if ($.fs.existsSync(facesPath + name + ".png")) {
                    $.Holders.drawFace.call(this, name, index, x, y, w, h);
                } else $.Holders.drawFace.call(this, "Placeholder", index, x, y, w, h);
            };

            $.Holders.drawCharacter = Window_SaveInfo.prototype.drawCharacter;
            Window_SaveInfo.prototype.drawCharacter = function(name, index, x, y) {
                const charactersPath = $.Params.root + "img/characters/";
                if ($.fs.existsSync(charactersPath + name + ".png")) {
                    $.Holders.drawCharacter.call(this, name, index, x, y);
                } else $.Holders.drawCharacter.call(this, "!Placeholder", index, x, y);
            };

            Scene_File.prototype.create = function() {
                Scene_MenuBase.prototype.create.call(this);
                this.createHelpWindow();
                this.createListWindow();
                this.createActionWindow();
                this.createInfoWindow();
                this.createConfirmWindow();
            };
        }
    }

    await $.readMods();
    if ($.Params.reboot) {
        nw.Window.get().reload();
    }

    $.checkMods();

})(ModLoader);

/************************************************************************************/

function Scene_Mods() {
    this.initialize.apply(this, arguments);
}

Scene_Mods.prototype = Object.create(Scene_MenuBase.prototype);
Scene_Mods.prototype.constructor = Scene_Mods;

Scene_Mods.prototype.initialize = function () {
    Scene_MenuBase.prototype.initialize.call(this);
};

Scene_Mods.prototype.create = function () {
    Scene_MenuBase.prototype.create.call(this);
    this.createModsWindow();
};

Scene_Mods.prototype.terminate = function () {
    Scene_MenuBase.prototype.terminate.call(this);
};

Scene_Mods.prototype.createModsWindow = function () {
    this._modsWindow = new Window_Mods();
    this._modsWindow.setHandler("cancel", this.popScene.bind(this));
    this.addWindow(this._modsWindow);
    ModLoader.Params.reboot = false;
};

Scene_Mods.prototype.popScene = function () {
    if (ModLoader.Params.reboot) {
        this._rebootWindow = new Window_RebootConfirm();
        this._rebootWindow.setHandler("confirm", () => nw.Window.get().reload());
        this.addWindow(this._rebootWindow);

        this._rebootWindow.open();
        this._rebootWindow.activate();
        this._rebootWindow.select(0);
    } else {
        Scene_MenuBase.prototype.popScene.call(this);
    }
};

/************************************************************************************/

function Window_Mods() {
    this.initialize.apply(this, arguments);
}

Window_Mods.prototype = Object.create(Window_Command.prototype);
Window_Mods.prototype.constructor = Window_Mods;

Window_Mods.prototype.initialize = function () {
    Window_Command.prototype.initialize.call(this, 0, 0);
    this.updatePlacement();
};

Window_Mods.prototype.windowWidth = function () {
    return 400;
};

Window_Mods.prototype.windowHeight = function () {
    return this.fittingHeight(Math.min(this.numVisibleRows(), 12));
};

Window_Mods.prototype.updatePlacement = function () {
    this.x = (Graphics.boxWidth - this.width) / 2;
    this.y = (Graphics.boxHeight - this.height) / 2;
};

Window_Mods.prototype.makeCommandList = function () {
    const modsPath = ModLoader.Params.modsPath;
    const modFolders = ModLoader.Helpers.getFolders(modsPath);
    const mods = ModLoader.sortMods(modFolders);
    for (let i = 0; i < mods.length; i++) {
        const metadata = ModLoader.loadMetadata(mods[i]);
        const title = metadata.name + " [" + (metadata.version || "N/A") + "]"
        const selectable = ModLoader.getSelectable(mods[i]);
        this.addCommand(title, mods[i], selectable);
    }
};

Window_Mods.prototype.drawItem = function (index) {
    let rect = this.itemRectForText(index);
    let statusWidth = this.statusWidth();
    let titleWidth = rect.width - statusWidth;
    this.resetTextColor();
    this.changePaintOpacity(this.isCommandEnabled(index));
    this.drawText(this.commandName(index), rect.x, rect.y, titleWidth, "left");
    this.drawText(this.statusText(index), titleWidth, rect.y, statusWidth, "right");
};

Window_Mods.prototype.statusWidth = function () {
    return 120;
};

Window_Mods.prototype.statusText = function (index) {
    let symbol = this.commandSymbol(index);
    let value = ModLoader.getModEnabled(symbol);
    return this.booleanStatusText(value);
};

Window_Mods.prototype.booleanStatusText = function (value) {
    return value ? "ON" : "OFF";
};

Window_Mods.prototype.processOk = function () {
    let index = this.index();
    let symbol = this.commandSymbol(index);
    let value = ModLoader.getModEnabled(symbol);
    this.changeValue(symbol, !value);
};

Window_Mods.prototype.cursorRight = function (wrap) {
    let index = this.index();
    let symbol = this.commandSymbol(index);
    this.changeValue(symbol, true);
};

Window_Mods.prototype.cursorLeft = function (wrap) {
    let index = this.index();
    let symbol = this.commandSymbol(index);
    this.changeValue(symbol, false);
};

Window_Mods.prototype.cursorPageup = function () {
    let index = this.index();
    ModLoader.reorderMod(index, -1);
    ModLoader.Params.reboot = true;
    this.refresh();
};

Window_Mods.prototype.cursorPagedown = function () {
    let index = this.index();
    ModLoader.reorderMod(index, 1);
    ModLoader.Params.reboot = true;
    this.refresh();
};

Window_Mods.prototype.changeValue = function (symbol, value) {
    if (!ModLoader.getSelectable(symbol)) return;
    let lastValue = ModLoader.getModEnabled(symbol);
    if (lastValue !== value) {
        ModLoader.setModEnabled(symbol, value);
        this.redrawItem(this.findSymbol(symbol));
        SoundManager.playCursor();
    }
    ModLoader.Params.reboot = true;
    this.refresh();
};

/************************************************************************************/

function Window_ModConfirm() {
    this.initialize.apply(this, arguments);
}

Window_ModConfirm.prototype = Object.create(Window_Command.prototype);
Window_ModConfirm.prototype.constructor = Window_ModConfirm;

Window_ModConfirm.prototype.firstLine = "The save has mods different than enabled.\n";
Window_ModConfirm.prototype.secondLine = "This can cause issues, load anyways?\n\n";
Window_ModConfirm.prototype.lines;

Window_ModConfirm.prototype.initialize = function (count) {
    this.lines = count + 4;
    Window_Command.prototype.initialize.call(this, 0, 0);
    this.openness = 0;
};

Window_ModConfirm.prototype.makeCommandList = function () {
    this.addCommand("Yes", "confirm");
    this.addCommand("No", "cancel");
};

Window_ModConfirm.prototype.setData = function (added, removed) {
    let width = Math.max(this.textWidth(this.firstLine), this.textWidth(this.secondLine));

    for (let i = 0; i < added.length; i++) {
        const ww = this.textWidth(added[i]);
        if (width < ww) width = ww;
    }
    for (let i = 0; i < removed.length; i++) {
        const ww = this.textWidth(added[i]);
        if (width < ww) width = ww;
    }

    this.width = width + this.standardPadding() * 2 + this.textPadding() * 2;
    this.refresh();

    this.x = (Graphics.boxWidth - this.width) / 2;
    this.y = (Graphics.boxHeight - this.height) / 2;

    let text = this.firstLine + this.secondLine;

    if (added.length > 0) {
        text += added.join("\n");
        if (removed.length > 0) {
            text += "\n";
        }
    }
    if (removed.length > 0) {
        text += removed.join("\n");
    }
    text += "\n";

    this.drawTextEx(text, this.textPadding(), 0);
}

Window_ModConfirm.prototype.itemTextAlign = function () {
    return "center";
};

Window_ModConfirm.prototype.windowHeight = function () {
    return this.fittingHeight(this.lines + 2);
};

Window_ModConfirm.prototype.itemRect = function (index) {
    let rect = Window_Selectable.prototype.itemRect.call(this, index);
    rect.y += this.lineHeight() * this.lines;
    return rect;
};

/************************************************************************************/

function Window_RebootConfirm() {
    this.initialize.apply(this, arguments);
}

Window_RebootConfirm.prototype = Object.create(Window_Command.prototype);
Window_RebootConfirm.prototype.constructor = Window_RebootConfirm;

Window_RebootConfirm.prototype.firstLine = "The game will now restart to change the mods.\n";
Window_RebootConfirm.prototype.secondLine = "This can take a minute, please be patient.";

Window_RebootConfirm.prototype.initialize = function () {
    Window_Command.prototype.initialize.call(this, 0, 0);
    const width = Math.max(this.textWidth(this.firstLine), this.textWidth(this.secondLine));
    this.width = width + this.standardPadding() * 2 + this.textPadding() * 2;
    this.refresh();

    this.x = (Graphics.boxWidth - this.width) / 2;
    this.y = (Graphics.boxHeight - this.height) / 2;
    const text = this.firstLine + this.secondLine;
    this.drawTextEx(text, this.textPadding(), 0);
};

Window_RebootConfirm.prototype.makeCommandList = function () {
    this.addCommand("Ok", "confirm");
};

Window_RebootConfirm.prototype.itemTextAlign = function () {
    return "center";
};

Window_RebootConfirm.prototype.windowHeight = function () {
    return this.fittingHeight(3);
};

Window_RebootConfirm.prototype.itemRect = function (index) {
    let rect = Window_Selectable.prototype.itemRect.call(this, index);
    rect.y += this.lineHeight() * 2;
    return rect;
};
