/*:
 * @author 1d51
 * @version 2.2.1
 * @plugindesc A simple mod loader for RPG Maker MV.
 */

var ModLoader = ModLoader || {};

ModLoader.fs = require('fs');
ModLoader.xdiff = require("./js/libs/xdiff");

ModLoader.Helpers = ModLoader.Helpers || {};
ModLoader.Params = ModLoader.Params || {};
ModLoader.Config = ModLoader.Config || {};
ModLoader.Holders = ModLoader.Holders || {};

(function ($) {
    $.Config.keyCombine = [];
    $.Config.keyAssign = ["parameters"];
    $.Config.keyMerge = ["pages", "events", "terms"];
    $.Config.keySquash = ["armorTypes", "elements", "equipTypes", "skillTypes", "weaponTypes"];
    $.Config.keyXDiff = ["list", "note", "equips", "traits", "learnings", "effects"];

    $.Config.backupSkip = [/diffs/];

    $.Helpers.strEq = function (left, right) {
        return JSON.stringify(left) === JSON.stringify(right);
    };

    $.Helpers.idEq = function (left, right) {
        if (left != null && right != null) {
            if ("id" in left && "id" in right) {
                return left["id"] === right["id"];
            } else if ("name" in left && "name" in right) {
                return left["name"] === right["name"];
            }
        } else if (left != null) {
            if ("id" in left) {
                return left["id"] === right;
            } else if ("name" in left) {
                return left["name"] === right;
            }
        } else if (right != null) {
            if ("id" in right) {
                return right["id"] === left;
            } else if ("name" in right) {
                return right["name"] === left;
            }
        }

        return left === right;
    };

    $.Helpers.idIncl = function (arr, obj) {
        if (obj != null) {
            if ("id" in obj) {
                if (Array.isArray(arr)) {
                    return arr.includes(obj["id"]);
                } else {
                    return arr === obj["id"];
                }
            } else if ("name" in obj) {
                if (Array.isArray(arr)) {
                    return arr.includes(obj["name"]);
                } else {
                    return arr === obj["name"];
                }
            }
        }

        if (Array.isArray(arr)) {
            return arr.includes(obj);
        } else {
            return arr === obj;
        }
    }

    $.Helpers.hashCode = function (string) {
        let hash = 0;
        for (let i = 0; i < string.length; i++) {
            let code = string.charCodeAt(i);
            hash = ((hash << 5) - hash) + code;
            hash = hash & hash;
        }
        return hash;
    };

    $.Helpers.dedup = function (arr) {
        const a = arr.concat();
        for (let i = 0; i < a.length; ++i) {
            for (let j = i + 1; j < a.length; ++j) {
                if (this.strEq(a[i], a[j])) a.splice(j--, 1);
            }
        }
        return a;
    };

    $.Helpers.untag = function (str) {
        const matches = str.match(/<[^<>]*>[^<>]+<\/[^<>]*>|<[^<>]*>/g) || [];
        return Array.from(new Set(matches.map(x => x.trim())));
    };

    $.Helpers.move = function (array, index, delta) {
        const newIndex = index + delta;
        if (newIndex < 0 || newIndex === array.length) return;
        const indexes = [index, newIndex].sort((a, b) => a - b);
        array.splice(indexes[0], 2, array[indexes[1]], array[indexes[0]]);
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
                files.push(...this.getFilesRecursively(absolute));
            } else files.push(absolute);
        }
        return files;
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

    $.Helpers.deepWriteSync = function (path, file) {
        this.ensureDirectoryExistence(path);
        $.fs.writeFileSync(path, file);
    };

    $.Helpers.ensureDirectoryExistence = function (path) {
        const index = path.lastIndexOf('/');
        if (index === -1) return;

        const directory = path.substring(0, index);
        if ($.fs.existsSync(directory)) return;
        this.ensureDirectoryExistence(directory);
        $.fs.mkdirSync(directory);
    };

    $.Helpers.appendix = function (path) {
        const index = path.indexOf('/www');
        return path.substr(index + 5);
    };

    $.Helpers.modName = function (path) {
        const index = path.indexOf('/mods');
        return path.substr(index + 6).split('/')[0];
    };

    $.Helpers.parse = function (file, variable = false) {
        if (!variable) return JSON.parse(file);
        let str = file.toString().match(/=\n*(\[[\s\S]*)/)[1];
        str = str.replace(/;\n*$/, "");
        return JSON.parse(str);
    };

    $.Helpers.tagDiff = function (source, original, target) {
        const sa = $.Helpers.untag(source);
        const oa = $.Helpers.untag(original);
        const ta = $.Helpers.untag(target);

        const ma = $.Helpers.arrDiff(sa, oa, ta);
        return ma.join("\n");
    };

    $.Helpers.arrDiff = function (source, original, target) {
        const sh = $.Helpers.hashCode(JSON.stringify(source));
        const oh = $.Helpers.hashCode(JSON.stringify(original));
        const th = $.Helpers.hashCode(JSON.stringify(target));

        if (th === oh) return source;
        if (sh === oh) return target;

        let ss = source.map((obj) => JSON.stringify(obj));
        let os = original.map((obj) => JSON.stringify(obj));
        let ts = target.map((obj) => JSON.stringify(obj));

        const xx = sh.toString() + oh.toString() + th.toString();
        const path = $.Params.diffsPath + xx + ".json";
        let diff = null;

        if ($.fs.existsSync(path)) {
            const diffFile = $.fs.readFileSync(path);
            diff = JSON.parse(diffFile);
        } else {
            diff = $.xdiff.diff3(ss, os, ts);
            if (diff == null) return original;

            $.Helpers.deepWriteSync(path, JSON.stringify(diff));
        }

        const rs = $.xdiff.patch(os, diff);
        return rs.map((str) => JSON.parse(str));
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
            if (i >= result.length - 1) result.push(source[i]);
            else if (source[i] != null && source[i].length > 0) {
                result[i] = source[i];
            }
        }

        return result;
    };

    /************************************************************************************/

    $.Params.root = $.Helpers.createPath("");
    $.Params.modsPath = $.Params.root + "mods/";
    $.Params.backupsPath = $.Params.root + "backups/";
    $.Params.diffsPath = $.Params.root + "diffs/";

    $.Params.reboot = false;

    $.readMods = function () {
        $.Helpers.ensureDirectoryExistence($.Params.modsPath);
        $.Helpers.ensureDirectoryExistence($.Params.backupsPath);
        $.Helpers.ensureDirectoryExistence($.Params.diffsPath);

        const modFolders = $.Helpers.getFolders($.Params.modsPath);
        const mods = $.sortMods(modFolders).filter(m => $.getEnabled(m));
        if (this.checkLast(mods)) return;

        const files = $.Helpers.getFilesRecursively($.Params.backupsPath);
        for (let i = 0; i < files.length; i++) {
            const index = files[i].indexOf('/backups');
            const keyPath = files[i].substr(index + 10);
            const originPath = $.Params.root + keyPath;
            const backupFile = $.fs.readFileSync(files[i]);
            $.Helpers.deepWriteSync(originPath, backupFile);
        }

        const filePaths = {};
        for (let i = 0; i < mods.length; i++) {
            const modPath = $.Params.modsPath + mods[i] + "/www";
            const files = $.Helpers.getFilesRecursively(modPath);
            for (let j = 0; j < files.length; j++) {
                const keyPath = $.Helpers.appendix(files[j]);
                $.backup(files[j]);

                if (keyPath.match(/diffs/) || !keyPath.match(/(\.json)|(plugins[^\/]*\.js)/)) {
                    const originPath = $.Params.root + keyPath;
                    const sourceFile = $.fs.readFileSync(files[j]);
                    $.Helpers.deepWriteSync(originPath, sourceFile);
                    continue;
                }

                if (!filePaths[keyPath]) filePaths[keyPath] = [];
                filePaths[keyPath].push(files[j]);
            }
        }

        Object.keys(filePaths).forEach(function (key) {
            const isPlugin = key.match(/plugins[^\/]*\.js/);
            const backupPath = $.Params.backupsPath + key;
            const backupFile = $.fs.readFileSync(backupPath);
            const backupData = $.Helpers.parse(backupFile, isPlugin);

            let targetData = $.Helpers.parse(backupFile, isPlugin);
            for (let i = 0; i < filePaths[key].length; i++) {
                const mod = $.Helpers.modName(filePaths[key][i]);
                const metadata = $.loadMetadata(mod);

                const sourceFile = $.fs.readFileSync(filePaths[key][i]);
                const sourceData = $.Helpers.parse(sourceFile, isPlugin);

                if (key.split("/")[0].includes("data") || isPlugin) {
                    let reducedData = $.reduceData(sourceData, backupData);
                    if (!$.Helpers.strEq(sourceData, reducedData)) {
                        let reducedStr = JSON.stringify(reducedData);
                        if (isPlugin) reducedStr = "var $plugins =\n" + reducedStr;
                        $.Helpers.deepWriteSync(filePaths[key][i], reducedStr);
                    }

                    if (reducedData == null) continue;

                    const overrides = (metadata["overrides"] || {})[key];
                    targetData = $.mergeData(reducedData, backupData, targetData, overrides);
                } else targetData = JSON.parse(JSON.stringify(sourceData));
            }

            const path = $.Params.root + key;
            let targetStr = JSON.stringify(targetData);
            if (isPlugin) targetStr = "var $plugins =\n" + targetStr;
            $.Helpers.deepWriteSync(path, targetStr);
        });

        this.setLast(mods);
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
            } else {
                const backupFile = $.fs.readFileSync(path)
                $.Helpers.deepWriteSync(backupPath, backupFile);
            }
        }
    };

    $.mergeData = function (source, original, target, overrides = null) {
        if (typeof overrides == "boolean" && overrides) return source;
        const result = JSON.parse(JSON.stringify(target));
        if (Array.isArray(source) && Array.isArray(target)) {
            for (let i = 0; i < source.length; i++) {
                if (source[i] == null) continue;
                if ($.Helpers.idEq(source[i], null)) {
                    if (original.length > i && target.length > i) result[i] = $.mergeData(source[i], original[i], target[i]);
					else if (target.length > i) result[i] = $.mergeData(source[i], target[i], target[i]);
					else result.push(source[i]);
                    continue;
                }
                const oi = original ? original.findIndex(x => x && $.Helpers.idEq(x, source[i])) : -1;
                const ti = target ? target.findIndex(x => x && $.Helpers.idEq(x, source[i])) : -1;
                if ($.Helpers.idIncl(overrides, source[i])) {
                    if (ti >= 0) result[ti] = source[i]; else result.push(source[i]);
                    continue;
                }
                if (oi >= 0 && ti >= 0) result[ti] = $.mergeData(source[i], original[oi], target[ti]);
				else if (ti >= 0) result[ti] = $.mergeData(source[i], target[ti], target[ti]);
				else result.push(source[i]);
            }
        } else {
            Object.keys(source).forEach(function (key) {
                if (target && key in target) {
                    if (Array.isArray(overrides) && overrides.includes(key) || overrides === key) {
                        result[key] = source[key];
                    } else if ($.Config.keyCombine.includes(key)) {
                        const aux = result[key].concat(source[key]);
                        if (Array.isArray(source[key])) {
                            result[key] = $.Helpers.dedup(aux);
                        } else result[key] = aux;
                    } else if ($.Config.keyAssign.includes(key)) {
                        result[key] = Object.assign(original[key], target[key], source[key]);
                    } else if ($.Config.keyMerge.includes(key)) {
                        result[key] = $.mergeData(source[key], original[key], target[key]);
                    } else if ($.Config.keySquash.includes(key)) {
                        result[key] = $.Helpers.squash(source[key], original[key], target[key]);
                    } else if ($.Config.keyXDiff.includes(key)) {
                        if (typeof source[key] === "string" || source[key] instanceof String) {
                            result[key] = $.Helpers.tagDiff(source[key], original[key], target[key]);
                        } else if (Array.isArray(source[key])) {
                            result[key] = $.Helpers.arrDiff(source[key], original[key], target[key]);
                        } else {
                            const diff = $.xdiff.diff3(source[key], original[key], target[key]);
                            result[key] = $.xdiff.patch(original[key], diff);
                        }
                    } else if (!result[key] || source[key]) {
                        result[key] = source[key];
                    }
                } else result[key] = source[key];
            });
        }

        return result;
    };

    $.reduceData = function (source, original) {
        const ss = JSON.stringify(source);
        const os = JSON.stringify(original);
        if (source == null || ss === os) {
            if (Array.isArray(source)) return [];
            return null;
        }

        const result = JSON.parse(ss);
        if (Array.isArray(original) && Array.isArray(source)) {
            for (let i = 0; i < source.length; i++) {
                if (source[i] == null) continue;
                const ri = result ? result.findIndex(x => x && $.Helpers.idEq(x, source[i])) : -1;
                const oi = original ? original.findIndex(x => x && $.Helpers.idEq(x, source[i])) : -1;

                if (ri >= 0 && oi >= 0) {
                    if ($.Helpers.strEq(original[oi], source[i])) {
                        result.splice(ri, 1);
                    }
                }
            }
            result.filter(x => x)
        } else {
            Object.keys(source).forEach(function (key) {
                if (original && key in original) {
                    if ($.Helpers.strEq(original[key], source[key])) {
                        delete result[key];
                    }
                }
            });
        }

        return result;
    };

    $.loadSchema = function () {
        const schemaPath = $.Params.root + "schema.json";
        if ($.fs.existsSync(schemaPath)) {
            const schemaFile = $.fs.readFileSync(schemaPath);
            return JSON.parse(schemaFile);
        } else {
            return {
                "enabled": [],
				"order": [],
				"last": []
            };
        }
    };

    $.writeSchema = function (schema) {
        const schemaPath = $.Params.root + "schema.json";
        $.Helpers.deepWriteSync(schemaPath, JSON.stringify(schema));
    };

    $.getEnabled = function (symbol) {
        const schema = this.loadSchema();
        return schema["enabled"].includes(symbol);
    };

    $.setEnabled = function (symbol, value) {
        const schema = this.loadSchema();

        if (!value) {
            const metadata = this.loadMetadata(symbol);
            for (let i = 0; i < schema["enabled"].length; i++) {
                const aux = this.loadMetadata(schema["enabled"][i]);
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

        this.writeSchema(schema);
    };

    $.sortMods = function (mods) {
        let order = this.loadSchema()["order"];
        order = order.filter(m => mods.includes(m));
        for (let i = 0; i < mods.length; i++) {
            if (!order.includes(mods[i])) {
                let inserted = false;
                for (let j = 0; j < order.length; j++) {
                    const mm = this.loadMetadata(mods[i]);
                    const om = this.loadMetadata(order[j]);
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
            const im = this.loadMetadata(mods[index]);
            const pm = this.loadMetadata(mods[position]);

            if (move >= 0) {
                const names = pm["dependencies"].map(d => d["name"]);
                if (names.includes(im["name"])) return;
            } else {
                const names = im["dependencies"].map(d => d["name"]);
                if (names.includes(pm["name"])) return;
            }
        }

        $.Helpers.move(mods, index, move);
        const schema = this.loadSchema();
        schema["order"] = mods;
        this.writeSchema(schema);
    };

    $.checkLast = function (mods) {
        const schema = this.loadSchema();
        const titles = mods.map(mod => {
            const metadata = this.loadMetadata(mod);
            return metadata.name + " [" + metadata.version + "]"
        });
        const old = JSON.parse(JSON.stringify(schema["last"]));
        return JSON.stringify(titles) === JSON.stringify(old);
    };

    $.setLast = function (mods) {
        const schema = this.loadSchema();
        schema["last"] = mods.map(mod => {
            const metadata = this.loadMetadata(mod);
            return metadata.name + " [" + metadata.version + "]"
        });
        this.writeSchema(schema);
    };

    $.loadMetadata = function (mod) {
        const metadataPath = $.Params.modsPath + mod + "/metadata.json";
        if ($.fs.existsSync(metadataPath)) {
            const metadataFile = $.fs.readFileSync(metadataPath);
            return JSON.parse(metadataFile);
        } else {
            return {
                "name": mod,
				"version": "",
				"dependencies": [],
				"incompatible": [],
				"overrides": {}
            };
        }
    };

    $.getSelectabe = function (mod) {
        const modsPath = $.Params.modsPath
        const modFolders = $.Helpers.getFolders(modsPath);
        const mods = this.sortMods(modFolders).filter(m => this.getEnabled(m));
        const meta = mods.map(m => this.loadMetadata(m));
        const metadata = this.loadMetadata(mod);
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
        const configPath = $.Params.modsPath + mod + "/config.json";
        if ($.fs.existsSync(configPath)) {
            const configFile = $.fs.readFileSync(configPath);
            return JSON.parse(configFile);
        } else {
            return {
                "switches": [], "variables": []
            };
        }
    };

    $.configGame = function () {
        const modsPath = ModLoader.Params.modsPath;
        const modFolders = $.Helpers.getFolders(modsPath);
        const mods = ModLoader.sortMods(modFolders).filter(m => ModLoader.getEnabled(m));
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

    /************************************************************************************/

    $.Holders.commandNewGame = Scene_Title.prototype.commandNewGame;
    Scene_Title.prototype.commandNewGame = function () {
        $.Holders.commandNewGame.call(this);
        $.configGame();
    };

    $.Holders.onLoadSuccess = Scene_Load.prototype.onLoadSuccess;
    Scene_Load.prototype.onLoadSuccess = function () {
        $.Holders.onLoadSuccess.call(this);
        $.configGame();
    };

    $.Holders.makeCommandList = Window_TitleCommand.prototype.makeCommandList;
    Window_TitleCommand.prototype.makeCommandList = function () {
        $.Holders.makeCommandList.call(this);
        const modsPath = $.Params.modsPath;
        const modFolders = $.Helpers.getFolders(modsPath);
        this.addCommand("Mods", 'mods', modFolders.length > 0);
    };

    $.Holders.createCommandWindow = Scene_Title.prototype.createCommandWindow;
    Scene_Title.prototype.createCommandWindow = function () {
        $.Holders.createCommandWindow.call(this);
        this._commandWindow.setHandler('mods', this.mods.bind(this));
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

    if (Yanfly.Save != null) {
        Scene_File.prototype.createModConfirmWindow = function (lines) {
            this._modConfirmWindow = new Window_ModConfirm(lines);
            this._modConfirmWindow.setHandler('confirm', this.onModConfirmOk.bind(this));
            this._modConfirmWindow.setHandler('cancel', this.onModConfirmCancel.bind(this));
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
                const added = enabled.filter(x => !saveMods.includes(x)).map(m => '\\C[3]+ ' + $.loadMetadata(m).name);
                const removed = saveMods.filter(x => !enabled.includes(x)).map(m => '\\C[10]- ' + $.loadMetadata(m).name);
                this.createModConfirmWindow(added.length + removed.length);
                this.startModConfirmWindow(added, removed);
            } else {
                $.Holders.onActionLoad.call(this);
            }
        };
    }

    $.readMods();

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
    this._modsWindow.setHandler('cancel', this.popScene.bind(this));
    this.addWindow(this._modsWindow);
};

Scene_Mods.prototype.popScene = function () {
	Scene_MenuBase.prototype.popScene.call(this);
    if (ModLoader.Params.reboot) {
		SceneManager.exit();
		window.close();
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
        const selectable = ModLoader.getSelectabe(mods[i]);
        this.addCommand(title, mods[i], selectable);
    }
};

Window_Mods.prototype.drawItem = function (index) {
    let rect = this.itemRectForText(index);
    let statusWidth = this.statusWidth();
    let titleWidth = rect.width - statusWidth;
    this.resetTextColor();
    this.changePaintOpacity(this.isCommandEnabled(index));
    this.drawText(this.commandName(index), rect.x, rect.y, titleWidth, 'left');
    this.drawText(this.statusText(index), titleWidth, rect.y, statusWidth, 'right');
};

Window_Mods.prototype.statusWidth = function () {
    return 120;
};

Window_Mods.prototype.statusText = function (index) {
    let symbol = this.commandSymbol(index);
    let value = ModLoader.getEnabled(symbol);
    return this.booleanStatusText(value);
};

Window_Mods.prototype.booleanStatusText = function (value) {
    return value ? 'ON' : 'OFF';
};

Window_Mods.prototype.processOk = function () {
    let index = this.index();
    let symbol = this.commandSymbol(index);
    let value = ModLoader.getEnabled(symbol);
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
    if (!ModLoader.getSelectabe(symbol)) return;
    let lastValue = ModLoader.getEnabled(symbol);
    if (lastValue !== value) {
        ModLoader.setEnabled(symbol, value);
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

Window_ModConfirm.prototype.firstLine = 'The save was created with mods different than enabled.\n';
Window_ModConfirm.prototype.secondLine = 'This can cause issues with your game, load anyways?\n\n';
Window_ModConfirm.prototype.lines;

Window_ModConfirm.prototype.initialize = function (count) {
    this.lines = count + 4;
    Window_Command.prototype.initialize.call(this, 0, 0);
    this.openness = 0;
};

Window_ModConfirm.prototype.makeCommandList = function () {
    this.addCommand('Yes', 'confirm');
    this.addCommand('No', 'cancel');
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
        text += added.join('\n');
        if (removed.length > 0) {
            text += '\n';
        }
    }
    if (removed.length > 0) {
        text += removed.join('\n');
    }
    text += '\n';

    this.drawTextEx(text, this.textPadding(), 0);
}

Window_ModConfirm.prototype.itemTextAlign = function () {
    return 'center';
};

Window_ModConfirm.prototype.windowHeight = function () {
    return this.fittingHeight(2 + this.lines);
};

Window_ModConfirm.prototype.itemRect = function (index) {
    let rect = Window_Selectable.prototype.itemRect.call(this, index);
    rect.y += this.lineHeight() * this.lines;
    return rect;
};