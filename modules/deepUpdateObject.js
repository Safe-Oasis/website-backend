/**
 * deep update an object
 */
const deepUpdateObject = (target, update, keepExisting) => {
    for (const [key, value] of Object.entries(update)) {
        if (target.hasOwnProperty(key) && typeof value === typeof target[key]) {
            if (['string', 'number', 'boolean'].includes(typeof value) || Array.isArray(value)) {
                if (!keepExisting) target[key] = value;
            } else {
                if (typeof value === 'object') {
                    updateObject(target[key], value);
                }
            }
        }
    }
};

/**
 * deep update an object returning a copy
 */
const deepUpdateObjectCopy = (target, update, keepExisting) => {
    let targetCopy = { ...target };
    deepUpdateObject(targetCopy, update, keepExisting);
    return targetCopy;
};

module.exports.deepUpdateObject = deepUpdateObject;
module.exports.deepUpdateObjectCopy = deepUpdateObjectCopy;
