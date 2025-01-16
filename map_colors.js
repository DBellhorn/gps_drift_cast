/* Contains details for applying a color to various types of map objects. */
class MapColorInfo {
    /**
     * The text name used by Google Static Map API. Ex: red
     * @private
     * @type {string}
     */
    #name = '';

    /**
     * String defining a hexadecimal number used by Google Earth. Ex: 0xff2118f2
     * @private
     * @type {string}
     */
    #earthHexadecimal = '';

    /**
     * String defining a hexadecimal number used by web browsers. Ex: #f21821
     * @private
     * @type {string}
     */
    #webHexadecimal = '';

    /**
     * Initializes a location using the provided latitude and longitude coordinates.
     * @param {string} name - The name used by Google Static Map API. Ex 'red'
     * @param {string} earth - The hex color code used by Google Earth. Ex '0xff0000ff'
     * @param {string} web - The hex color code used by web browsers. Ex: '#ff0000'
     */
    constructor(name, earth, web) {
        this.#name = name;
        this.#earthHexadecimal = earth;
        this.#webHexadecimal = web;
    }

    /**
     * The text name used by Google Static Map API. Ex: red
     * @type {string}
     */
    get name() { return this.#name; }

    /**
     * Hexadecimal number used by Google Earth. Ex: 0xff2118f2
     * @type {string}
     */
    get earthHexadecimal() { return this.#earthHexadecimal; }

    /**
     * Hexadecimal number used by web browsers. Ex: f21821
     * @type {string}
     */
    get webHexadecimal() { return this.#webHexadecimal; }
}

/** @type {Array.<MapColorInfo>} Stores colors for each hour (1 - 12) with RED as a default. */ 
const mapColors = [
    new MapColorInfo('red', 'ff0000ff', 'ff0000'),
    new MapColorInfo('pink', 'ffff00ff', 'ff00ff'),
    new MapColorInfo('sky', 'fffa931a', '1a93fa'),
    new MapColorInfo('yellow', 'ff00ffff', 'ffff00'),
    new MapColorInfo('blue', 'ffff0000', '0000ff'),
    new MapColorInfo('purple', 'ff800080', '800080'),
    new MapColorInfo('brown', 'ff13458b', '8b4513'),
    new MapColorInfo('black', 'ff000000', '000000'),
    new MapColorInfo('green', 'ff008000', '008000'),
    new MapColorInfo('orange', 'ff1a93fa', 'fa931a'),
    new MapColorInfo('navy', 'ff800000', '000080'),
    new MapColorInfo('lime', 'ff00ff00', '00ff00'),
    new MapColorInfo('aqua', 'ffffff00', '00ffff')
];

/**
 * Obtain the color associated with an hour.
 * @param {number} hour - The hour (0-23) for which a color is being seeked.
 * @returns {MapColorInfo} - The color information associated with the supplied color.
 */
function getHourColor(hour) {
    if (typeof hour !== 'number') {
        return mapColors[0];
    }
    if (hour < 0 || hour > 23) {
        return mapColors[0];
    }

    // AM and PM use the same colors
    if (hour > 12) {
        hour = hour - 12;
    }

    // Map 0 to 12
    if (0 == hour) {
        return mapColors[12];
    }

    if (hour >= mapColors.length) {
        return mapColors[0];
    }

    return mapColors[hour];
}

export { getHourColor };