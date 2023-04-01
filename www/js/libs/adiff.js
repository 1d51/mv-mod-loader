function last(arr) {
    return arr[arr.length - 1];
}

function hasLength(elem) {
    return elem.length;
}

function any(ary, test) {
    for (let i = 0; i < ary.length; i++) {
        if (test(ary[i])) {
            return true;
        }
    }
    return false;
}

function score(arr) {
    return arr.reduce(function (sum, elem) {
        return sum + elem.length + elem[1] + 1;
    }, 0);
}

function best(a, b) {
    return score(a) <= score(b) ? a : b;
}

function _equal(a, b) {
    if (a && !b) return false;
    if (Array.isArray(a)) if (a.length !== b.length) return false;
    if (a && 'object' == typeof a) {
        for (let i in a) if (!_equal(a[i], b[i])) return false;
        for (let i in b) if (!_equal(a[i], b[i])) return false;
        return true;
    }
    return a === b;
}

function getArgs(args) {
    return args.length === 1 ? args[0] : Array.prototype.slice.call(args);
}

function oddElement(ary, cmp) {
    let c;

    function guess(a) {
        let odd = -1;
        c = 0;
        let skip = Array(ary.length).fill(0);
        let last = {};
        for (let i = a; i < ary.length; i++) {
            if (last[ary[i]] !== undefined) {
                skip[last[ary[i]]] = i - last[ary[i]];
            }
            last[ary[i]] = i;
        }
        let j = 0;
        while (a + j < ary.length) {
            if (j === odd) {
                return -1;
            }
            if (!cmp(ary[a], ary[a + j])) {
                odd = a + j;
                j += skip[a + j] || 1;
                c++;
            } else {
                j++;
            }
        }
        return c > 1 ? -1 : odd;
    }

    let g = guess(0);
    if (g !== -1) {
        return g;
    }
    guess(1);
    return c === 0 ? 0 : -1;
}

var exports = module.exports = function (deps, exports) {
    let equal = (deps && deps.equal) || _equal;
    exports = exports || {};

    exports.lcs = function () {
        let args = getArgs(arguments);
        while (args.length > 2) {
            let pairs = [];
            for (let i = 0; i < args.length; i += 2) {
                let a = args[i];
                let b = i + 1 < args.length ? args[i + 1] : [];
                pairs.push(exports.lcs(a, b));
            }
            args = pairs;
        }
        let a = args[0], b = args[1];
        let m = a.length, n = b.length;
        let dp = Array.from(Array(m + 1), () => Array(n + 1).fill(0));

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (a[i - 1] === b[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                }
            }
        }

        let seq = [];
        let i = m, j = n;
        while (i > 0 && j > 0) {
            if (a[i - 1] === b[j - 1]) {
                seq.unshift(a[i - 1]);
                i--;
                j--;
            } else if (dp[i - 1][j] > dp[i][j - 1]) {
                i--;
            } else {
                j--;
            }
        }

        return seq;
    }

    exports.chunk = function (q, build) {
        var q = q.map(function (elem) {
            return elem.slice();
        });
        let lcs = exports.lcs.apply(null, q);
        let all = [lcs].concat(q);

        function matchLcs(elem) {
            if ((elem.length && !lcs.length) || (!elem.length && lcs.length)) {
                return false;
            }
            return equal(last(elem), last(lcs)) || elem.length + lcs.length === 0;
        }

        while (any(q, hasLength)) {
            while (q.every(matchLcs) && q.every(hasLength)) {
                all.forEach(function (elem) {
                    elem.pop();
                });
            }
            let changes = false;
            let unstable = q.map(function (elem) {
                let change = [];
                while (!matchLcs(elem)) {
                    change.unshift(elem.pop());
                    changes = true;
                }
                return change;
            });
            if (changes) build(q[0].length, unstable);
        }
    };

    exports.optimisticDiff = function (a, b) {
        let M = Math.max(a.length, b.length);
        let m = Math.min(a.length, b.length);
        let patch = [];
        for (let i = 0; i < M; i++) {
            if (a[i] !== b[i]) {
                let cur = [i, 0], deletes = 0;
                while (a[i] !== b[i] && i < m) {
                    cur[1] = ++deletes;
                    cur.push(b[i++]);
                }
                if (i >= m) {
                    if (a.length > b.length) cur[1] += a.length - b.length; else if (a.length < b.length) cur.push(...b.slice(a.length));
                }
                patch.push(cur);
            }
        }
        return patch;
    };

    exports.diff = function (a, b) {
        let optimistic = exports.optimisticDiff(a, b);
        let changes = [];
        exports.chunk([a, b], function (index, unstable) {
            let del = unstable.shift().length;
            let insert = unstable.shift();
            changes.push([index, del, ...insert]);
        });
        return best(optimistic, changes);
    };

    exports.patch = function (a, changes, mutate) {
        if (!mutate) a = a.slice();
        changes.forEach(function (change) {
            a.splice(change[0], change[1], ...change.slice(2));
        });
        return a;
    };

    exports.merge = function () {
        let args = getArgs(arguments);
        let patch = exports.diff3(args);
        return exports.patch(args[0], patch);
    };

    exports.diff3 = function () {
        const args = getArgs(arguments);
        const r = [];
        exports.chunk(args, function (index, unstable) {
            const mine = unstable[0];
            const insert = resolve(unstable);
            if (equal(mine, insert)) return;
            r.push([index, mine.length].concat(insert));
        })
        return r;
    }

    exports.oddOneOut = function (changes) {
        if (allDifferent(changes)) {
            return null;
        }
        changes = changes.slice();
        changes.unshift(changes.splice(1, 1)[0]);
        let i = oddElement(changes, equal);
        if (i === 0) return changes[1]
        if (~i) return changes[i];
    };

    exports.insertMergeOverDelete = function (changes) {
        changes = changes.slice();
        changes.splice(1, 1);

        const nonemptyChanges = changes.filter((change) => change.length > 0);
        if (nonemptyChanges.length === 1) {
            return nonemptyChanges[0];
        }
    };

    exports.threeWayMerge = function (changes, resolve) {
        const mine = changes[0];
        const original = changes[1];
        const yours = changes[2];

        if (resolve == null || typeof resolve !== 'function') {
            resolve = (a, o, b) => a;
        }

        const lcsMine = exports.lcs(original, mine);
        const lcsYours = exports.lcs(original, yours);

        let result = [];
        let mineIndex = 0;
        let yoursIndex = 0;
        let lcsMineIndex = 0;
        let lcsYoursIndex = 0;
        let lastCommonItem = null;

        for (const item of original) {
            let mineDeleted = lcsMineIndex < lcsMine.length && lcsMine[lcsMineIndex] !== item;
            let yoursDeleted = lcsYoursIndex < lcsYours.length && lcsYours[lcsYoursIndex] !== item;

            if (!mineDeleted && !yoursDeleted) {
                while (mineIndex < mine.length && mine[mineIndex] !== item) {
                    result.push(mine[mineIndex++]);
                }
                while (yoursIndex < yours.length && yours[yoursIndex] !== item) {
                    if (!result.includes(yours[yoursIndex]) && (lastCommonItem === null || yours[yoursIndex] > lastCommonItem)) {
                        result.push(yours[yoursIndex]);
                    }
                    yoursIndex++;
                }

                if (mine[mineIndex] !== yours[yoursIndex]) {
                    const conflictResult = resolve(mine[mineIndex], item, yours[yoursIndex]);
                    if (conflictResult !== undefined) {
                        result.push(conflictResult);
                    }
                } else {
                    result.push(item);
                }

                lastCommonItem = item;
                mineIndex++;
                yoursIndex++;
                lcsMineIndex++;
                lcsYoursIndex++;
            } else if (mineDeleted && !yoursDeleted) {
                while (yoursIndex < yours.length && yours[yoursIndex] !== item) {
                    result.push(yours[yoursIndex++]);
                }
                yoursIndex++;
                lcsYoursIndex++;
            } else if (!mineDeleted && yoursDeleted) {
                while (mineIndex < mine.length && mine[mineIndex] !== item) {
                    result.push(mine[mineIndex++]);
                }
                mineIndex++;
                lcsMineIndex++;
            }
        }

        while (mineIndex < mine.length) {
            result.push(mine[mineIndex++]);
        }
        while (yoursIndex < yours.length) {
            if (!result.includes(yours[yoursIndex]) && (lastCommonItem === null || yours[yoursIndex] > lastCommonItem)) {
                result.push(yours[yoursIndex]);
            }
            yoursIndex++;
        }

        return result;
    }

    exports.takeSmallest = function (changes) {
        let smallest = null;
        for (let i = 0; i < changes.length; i++) {
            let curChange = changes[i];
            if (!smallest || curChange[1] < smallest[1]) {
                smallest = curChange;
            }
        }
        return smallest;
    }

    exports.takeLargest = function (changes) {
        let largest = null;
        for (let i = 0; i < changes.length; i++) {
            let curChange = changes[i];
            if (!largest || curChange[1] > largest[1]) {
                largest = curChange;
            }
        }
        return largest;
    }

    let rules = (deps && deps.rules) || [
        exports.oddOneOut,
        exports.threeWayMerge,
        exports.insertMergeOverDelete,
        exports.takeSmallest,
        exports.takeLargest
    ];

    function resolve(changes) {
        for (let i in rules) {
            const c = rules[i](changes);
            if (c) return c;
        }
        changes.splice(1, 1);
        return {'?': changes};
    }

    function allDifferent(arr) {
        for (let i = 0; i < arr.length; i++) {
            for (let j = i + 1; j < arr.length; j++) {
                if (equal(arr[i], arr[j])) return false;
            }
        }

        return true;
    }

    return exports;
}

exports(null, exports);