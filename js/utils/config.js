/**
 * Config Utilities
 */

window.Config = {
    getConfig: (configs, key, defaultVal) =>
        Object.prototype.hasOwnProperty.call(configs, key) ? configs[key] : defaultVal
};
