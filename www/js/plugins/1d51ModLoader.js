/*:
 * @author 1d51
 * @version 0.2
 * @plugindesc A simple mod loader for RPG Maker MV.
 */

const CHECK_VERSIONS = true; // If all mod folders have the expected name format, use version information to disable the plugin.
const REDUCE_MOD_DATA = true; // Set to false if all mods are already reduced, to slightly increase performance.
const FORCE_BACKUP = false; // Set to true to rebuild file backups. You probably shouldn't do that.

(function($) {
    const fs = require('fs');
    const xdiff = require("./js/libs/xdiff");

    const oldVersion = window.location.pathname !== "/index.html";
    const strEq = (left, right) => JSON.stringify(left) === JSON.stringify(right);

    const hashCode = function(string){
        let hash = 0;
        for (let i = 0; i < string.length; i++) {
            let code = string.charCodeAt(i);
            hash = ((hash<<5)-hash)+code;
            hash = hash & hash;
        }
        return hash;
    }

    const dedup = function(arr) {
        const a = arr.concat();
        for(let i = 0; i < a.length; ++i) {
            for(let j = i + 1; j < a.length; ++j) {
                if(strEq(a[i], a[j]))
                    a.splice(j--, 1);
            }
        }
        return a;
    };

    const createPath = function(wrath) {
        oldVersion && (wrath = "/" + wrath);
        wrath += (wrath === "") ? "./" : "/";
        !(Utils.isNwjs() && Utils.isOptionValid("test")) && (wrath = "www/" + wrath);
        let path = window.location.pathname.replace(/(\/www|)\/[^\/]*$/, wrath);
        if (path.match(/^\/([A-Z]\:)/)) path = path.slice(1);
        path = decodeURIComponent(path);
        return path;
    };

    const getFilesRecursively = function(path) {
        const files = [];
        const filesInPath = fs.readdirSync(path);
        for (const file of filesInPath) {
            const absolute = path + "/" + file;
            if (fs.statSync(absolute).isDirectory()) {
                files.push(...getFilesRecursively(absolute));
            } else files.push(absolute);
        }
        return files;
    };
	
	const getFolders = function(path) {
		const folders = [];
        const foldersInPath = fs.readdirSync(path);
        for (const folder of foldersInPath) {
            const absolute = path + "/" + folder;
            if (fs.statSync(absolute).isDirectory()) {
                folders.push(folder);
            }
        }
        return folders;
	};

    const deepWriteSync = function(path, file) {
        ensureDirectoryExistence(path);
        fs.writeFileSync(path, file);
    }

    const ensureDirectoryExistence = function(path) {
        const index = path.lastIndexOf('/');
        if (index === -1) return;

        const directory = path.substring(0, index);
        if (fs.existsSync(directory)) return;
        ensureDirectoryExistence(directory);
        fs.mkdirSync(directory);
    }

    const appendix = function(path) {
        const index = path.indexOf('/www');
        return path.substr(index + 5);
    }

    const root = createPath("");
    const modsPath = createPath("mods");
    const backupsPath = createPath("backups");
    const diffsPath = createPath("diffs");

    const keyCombine = ["equips", "note", "traits", "learnings", "effects"];
    const keyMerge = ["events"];
    const keyXDiff = ["list"];

    const readMods = function () {
        const overridePaths = {};
        const mods = getFolders(modsPath).sort();
		if (CHECK_VERSIONS && checkVersions(mods)) return;
		
        for (let i = 0; i < mods.length; i++) {
            const modPath = modsPath + mods[i] + "/www";
            const datas = getFolders(modPath).filter(d => d.includes("data")).sort();
            const others = getFolders(modPath).filter(d => !d.includes("data") && d !== "js").sort();

            for (let j = 0; j < datas.length; j++) {
                const dataPath = modPath + "/" + datas[j]
                const results = getFilesRecursively(dataPath);
                for (let k = 0; k < results.length; k++) {
                    const keyPath = appendix(results[k]);
                    backup(results[k]);

                    if (!overridePaths[keyPath])
                        overridePaths[keyPath] = [];
                    overridePaths[keyPath].push(results[k]);
                }
            }

            for (let j = 0; j < others.length; j++) {
                const otherPath = modPath + "/" + others[j]
                const results = getFilesRecursively(otherPath);
                for (let k = 0; k < results.length; k++) {
                    const keyPath = appendix(results[k]);
                    const file = fs.readFileSync(results[k]);
                    deepWriteSync(root + keyPath, file);
                }
            }
        }

        Object.keys(overridePaths).forEach(function(key) {
            const backupPath = backupsPath + key;
            const backupFile = fs.readFileSync(backupPath);
            const backupData = JSON.parse(backupFile);

            let targetData = JSON.parse(backupFile);
            const sourcePaths = overridePaths[key];
            for (let i = 0; i < sourcePaths.length; i++) {
                const sourceFile = fs.readFileSync(sourcePaths[i]);
                const sourceData = JSON.parse(sourceFile);

                if (REDUCE_MOD_DATA) {
                    const reducedData = reduceData(backupData, sourceData)
                    targetData = mergeData(backupData, reducedData, targetData);

                    if (!strEq(sourceData, reducedData)) {
                        const reducedStr = JSON.stringify(reducedData);
                        deepWriteSync(sourcePaths[i], reducedStr);
                    }
                } else {
                    targetData = mergeData(backupData, sourceData, targetData);
                }
            }

            const path = root + key;
            deepWriteSync(path, JSON.stringify(targetData));
        });
    };

    const backup = function(path) {
        const keyPath = appendix(path);
        const backupPath = backupsPath + keyPath;
        const originPath = root + keyPath;

        if (!fs.existsSync(backupPath) || FORCE_BACKUP) {
            if (fs.existsSync(originPath)) {
                const backupFile = fs.readFileSync(originPath);
                deepWriteSync(backupPath, backupFile);
            } else {
                const backupFile = fs.readFileSync(path)
                deepWriteSync(backupPath, backupFile);
            }
        }
    }

    const mergeData = function(original, source, target) {
        const result = JSON.parse(JSON.stringify(target));
        if (Array.isArray(source) && Array.isArray(target)) {
            for (let i = 0; i < source.length; i++) {
                if (source[i] == null) continue;
                const oi = original ? original.findIndex(x => x && x["id"] === source[i]["id"]) : -1;
                const ti = target ? target.findIndex(x => x && x["id"] === source[i]["id"]) : -1;
                if (oi >= 0 && ti >= 0) result[ti] = mergeData(original[oi], source[i], target[ti]);
                else if (ti >= 0) result[ti] = mergeData(target[ti], source[i], target[ti]);
                else result.push(source[i]);
            }
        } else {
            Object.keys(source).forEach(function(key) {
                if (target && key in target) {
                    if (keyCombine.includes(key)) {
                        const aux = result[key].concat(source[key]);
                        if (Array.isArray(source[key]))
                            result[key] = dedup(aux);
                        else result[key] = aux;
                    } else if (keyMerge.includes(key)) {
                        result[key] = mergeData(original[key], source[key], target[key]);
                    } else if (keyXDiff.includes(key)) {
                        if (Array.isArray(source[key])) {
                            const sh = hashCode(JSON.stringify(source[key]))
                            const oh = hashCode(JSON.stringify(original[key]))
                            const th = hashCode(JSON.stringify(target[key]))
                            const xx = sh.toString() + oh.toString() + th.toString();
                            const path = diffsPath + xx + ".json"
                            if (fs.existsSync(path)) {
                                const os = original[key].map((obj) => JSON.stringify(obj));
                                const diffFile = fs.readFileSync(path);

                                const diff = JSON.parse(diffFile);
                                const rs = xdiff.patch(os, diff);
                                result[key] = rs.map((str) => JSON.parse(str));
                            } else {
                                const ss = source[key].map((obj) => JSON.stringify(obj));
                                const os = original[key].map((obj) => JSON.stringify(obj));
                                const ts = target[key].map((obj) => JSON.stringify(obj));

                                const diff = xdiff.diff3(ss, os, ts);
                                const rs = xdiff.patch(os, diff);
                                result[key] = rs.map((str) => JSON.parse(str));

                                deepWriteSync(path, JSON.stringify(diff));
                            }
                        } else {
                            const diff = xdiff.diff3(source[key], original[key], target[key]);
                            result[key] = xdiff.patch(original[key], diff);
                        }
                    } else result[key] = source[key];
                } else result[key] = source[key];
            });
        }

        return result;
    }

    const reduceData = function(original, source) {
        const result = JSON.parse(JSON.stringify(source));
        if (Array.isArray(original) && Array.isArray(source)) {
            for (let i = 0; i < source.length; i++) {
                if (source[i] == null) continue;
                const ri = result ? result.findIndex(x => x && x["id"] === source[i]["id"]) : -1;
                const oi = original ? original.findIndex(x => x && x["id"] === source[i]["id"]) : -1;
                if (ri >= 0 && oi >= 0) {
                    if (strEq(original[oi], source[i])) {
                        result.splice(ri, 1);
                    }
                }
            }
			result.filter(x => x)
        } else {
            Object.keys(source).forEach(function(key) {
                if (original && key in original) {
                    if (strEq(original[key], source[key])) {
                        delete result[key];
                    }
                }
            });
        }

        return result;
    }
	
	const checkVersions = function(mods) {
		const versionsPath = root + "versions.json";
		if (!fs.existsSync(versionsPath)) {
			writeVersions(mods);
			return false;
		}
		const versionsFile = fs.readFileSync(versionsPath);
		const versions = JSON.parse(versionsFile);
		writeVersions(mods);
		
		const valid = mods.every((m) => m.match(/\[.*\]$/));
		return valid && strEq(versions, mods);
	};
	
	const writeVersions = function(mods) {
		const path = root + "versions.json";
		deepWriteSync(path, JSON.stringify(mods));
	}
    
    readMods();

})();
