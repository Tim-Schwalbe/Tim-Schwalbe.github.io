/**
 * UI Formatting Utilities
 */

window.Formatters = {
    parseFormattedValue(val) {
        if (typeof val !== 'string') return val;
        return parseFloat(val.replace(/\./g, '')) || 0;
    },

    formatNumberWithDots(val) {
        let num = val.toString().replace(/\D/g, '');
        if (num === "") return "";
        return parseInt(num).toLocaleString('de-DE');
    },

    formatCurrency(val, decimals = 0) {
        return val.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + " $";
    },

    formatPercent(val, decimals = 1) {
        return (val * 100).toFixed(decimals) + "%";
    }
};
