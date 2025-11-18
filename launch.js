import { GeoLocation } from "./geo.js";

/* Stores all date and time values that a launch is active. */
class LaunchTimeData {
    /**
     * The date on which this launch occurs. Includes starting hour.
     * @private
     * @type {Date}
     */
    #launchDate = null;

    /**
     * The date on which this launch concludes. Includes final hour.
     * @private
     * @type {Date}
     */
    #endDateWithHour = null;

    /**
     * The hour (0 - 23) when this launch ends.
     * @private
     * @type {number}
     */
    #endHour = 0;

    /**
     * The difference in hours of the launch's start time from now.
     * @private
     * @type {number}
     */
    #startHourOffset = 0;
    
    /**
     * The difference in hours of the launch's end time from now.
     * @private
     * @type {number}
     */
    #endHourOffset = 0;

    /**
     * Initializes launch Date and times based on provided strings. Also determines hour offsets from the current time.
     * @param {string} launchDateValue - String representing the date when this launch occurs (YYYY-MM-DD).
     * @param {string} startTimeValue - String representing the hour this launch begins (HH:MM).
     * @param {string} endTimeValue - String representing the hour this launch ends (HH:MM).
     * @throws {TypeError} Invalidly formated date or time string.
     */
    constructor(launchDateValue, startTimeValue, endTimeValue) {
        if (launchDateValue.length < 10) {
            window.alert(`Invalid launch date: ${launchDateValue}`);
            throw new TypeError(`Invalid launch date string: ${launchDateValue}`);
        }
        if (startTimeValue.length < 2) {
            window.alert(`Invalid launch start time: ${startTimeValue}`);
            throw new TypeError(`Invalid launch start time string: ${startTimeValue}`);
        }
        if (endTimeValue.length < 2) {
            window.alert(`Invalid launch end time: ${endTimeValue}`);
            throw new TypeError(`Invalid launch end time string: ${endTimeValue}`);
        }

        let numYear = parseInt(launchDateValue.substring(0, 4));
        let numMonth = parseInt(launchDateValue.substring(5, 7));
        let numDay = parseInt(launchDateValue.substring(8, 10));

        // Verify the date components are valid
        if (isNaN(numYear) || isNaN(numMonth) || isNaN(numDay)) {
            window.alert(`Invalid launch date string: ${launchDateValue}`);
            throw new TypeError(`Invalid launch date string: ${launchDateValue}`);
        }
    
        // Convert into just a date ignoring hours, minutes, and seconds
        let today = new Date();
        let currentHour = today.getHours();
        today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
        // Ignoring minute and second components
        let startHour = parseInt(startTimeValue.substring(0, 2));
        if (isNaN(startHour)) {
            window.alert(`Invalid launch start time: ${startTimeValue}`);
            throw new TypeError(`Invalid launch start time: ${startTimeValue}`);
        }

        this.#endHour = parseInt(endTimeValue.substring(0, 2));
        if (isNaN(this.#endHour)) {
            window.alert(`Invalid launch end time: ${endTimeValue}`);
            throw new TypeError(`Invalid launch end time: ${endTimeValue}`);
        }
        if (this.#endHour < startHour) {
            window.alert(`Launch ends before it starts`);
            throw new TypeError(`Launch ends before it starts`);
        }

        // Store the launch's date and starting hour.
        this.#launchDate = new Date(numYear, numMonth - 1, numDay, startHour);

        // Store the launch's date and ending hour.
        this.#endDateWithHour = new Date(numYear, numMonth - 1, numDay, this.#endHour);

        // Calculate the offset of this launch's start time from now in hours.
        let rightNow = new Date();

        // Now we can store offsets from now to the start and end hours.
        this.#startHourOffset = Math.ceil((this.#launchDate - rightNow) / 3600000);
        this.#endHourOffset = Math.ceil((this.#endDateWithHour - rightNow) / 3600000);
    }

    /**
     * Get the date on which this launch occurs including the starting hour.
     * @type {Date}
     */
    get launchDate() {
        return this.#launchDate;
    }

    /**
     * Get the hour (0 - 23) when this launch ends.
     * @type {number}
     */
    get endHour() {
        return this.#endHour;
    }

    /**
     * Get the difference in hours of the launch's start time from now.
     * @type {number}
     */
    get startHourOffset() {
        return this.#startHourOffset;
    }
    
    /**
     * Get the difference in hours of the launch's end time from now.
     * @type {number}
     */
    get endHourOffset() {
        return this.#endHourOffset;
    }

    /**
     * Generates a string version of the date and start time according to the ISO 8601 standard.
     * @returns {string} Date formatted according to ISO 8601 standard.
     */
    getStartTimeAsISOString() {
        const startMonth = this.#launchDate.getMonth() + 1;
        return `${this.#launchDate.getFullYear()}-${startMonth.toString().padStart(2, '0')}-${this.#launchDate.getDate().toString().padStart(2, '0')}T${this.#launchDate.getHours().toString().padStart(2, '0')}:00`;
    }

    /**
     * Generates a string version of the date and end time according to the ISO 8601 standard.
     * @returns {string} Date formatted according to ISO 8601 standard.
     */
    getEndTimeAsISOString() {
        const endMonth = this.#endDateWithHour.getMonth() + 1;
        return `${this.#endDateWithHour.getFullYear()}-${endMonth.toString().padStart(2, '0')}-${this.#endDateWithHour.getDate().toString().padStart(2, '0')}T${this.#endDateWithHour.getHours().toString().padStart(2, '0')}:00`;
    }

    /**
     * Generates a string version of the date and start time according to the ISO 8601 standard.
     * @returns {string} Date formatted according to ISO 8601 standard.
     */
    getUTCStartTimeAsISOString() {
        const startUTCMonth = this.#launchDate.getUTCMonth() + 1;
        return `${this.#launchDate.getUTCFullYear()}-${startUTCMonth.toString().padStart(2, '0')}-${this.#launchDate.getUTCDate().toString().padStart(2, '0')}T${this.#launchDate.getUTCHours().toString().padStart(2, '0')}:00`;
    }

    /**
     * Generates a string version of the date and end time according to the ISO 8601 standard.
     * @returns {string} Date formatted according to ISO 8601 standard.
     */
    getUTCEndTimeAsISOString() {
        const endUTCMonth = this.#endDateWithHour.getUTCMonth() + 1;
        return `${this.#endDateWithHour.getUTCFullYear()}-${endUTCMonth.toString().padStart(2, '0')}-${this.#endDateWithHour.getUTCDate().toString().padStart(2, '0')}T${this.#endDateWithHour.getUTCHours().toString().padStart(2, '0')}:00`;
    }
}

/* Contains the coordinates and altitude defining a single point along the rocket's launch path. */
class LaunchPathPoint {
    /**
     * The rocket's altitude (in feet).
     * @private
     * @type {number}
     */
    #altitude = 0;

    /**
     * Coordinates of the rocket's location.
     * @private
     * @type {GeoLocation}
     */
    #location;

    /**
     * Initializes a launch path point using the provided altitude and coordinates.
     * @param {number} alt - The altitude at this launch path point.
     * @param {GeoLocation} loc - The cooridinates of this launch path point.
     * @throws {TypeError} Invalid altitude or coordinates.
     */
    constructor(alt, loc) {
        if (isNaN(alt)) throw new TypeError(`Invalid launch path altitude: ${alt}`);
        if (null == loc) throw new TypeError(`Invalid launch path coordinates: ${loc}`);

        this.#altitude = alt;
        this.#location = new GeoLocation(loc.latitude, loc.longitude);
    }

    /**
     * Get the altitude this launch path point.
     * @type {number}
     */
    get altitude() {
        return this.#altitude;
    }

    /**
     * Get the coordinates of this launch path point.
     * @type {GeoLocation}
     */
    get location() {
        return this.#location;
    }
}

/* Contains the results from a launch simulation. */
class LaunchSimulationData {
    /**
     * The hour (0 - 23) when this simulation occurs.
     * @private
     * @type {number}
     */
    #time;

    /**
     * A list of points along this simulation's launch path.
     * @private
     * @type {Array.<LaunchPathPoint>}
     */
    #launchPath = [];

    /**
     * Elevation (feet) at the launch site's location.
     * @private
     * @type {number}
     */
    #elevation;

    /**
     * Average wind speed (MPH) at ground level.
     * @private
     * @type {number}
     */
    #groundWindSpeed;

    /**
     * Average wind direction (0 degrees from North) at ground level.
     * @private
     * @type {number}
     */
    #groundWindDirection;

    /**
     * Indicates if the wind forecast was generated with the RAP or Open-Meteo model.
     * @private
     * @type {string}
     */
    #modelName;

    /**
     * Initializes a location using the provided latitude and longitude coordinates.
     * @param {number} ele - The elevation (feet) of the launch site.
     * @param {number} hour - The time (hour as 0 - 23) this launch occurs.
     * @param {number} gndWindSpeed - The average wind speed (MPH) at ground level.
     * @param {number} gndWindDir - The average wind direction (0 degrees from North) at ground level.
     * @param {string} windModelName - Name of the forecast model used to generate wind data.
     * @throws {TypeError} Invalid time.
     */
    constructor(ele, hour, gndWindSpeed, gndWindDir, windModelName) {
        if (isNaN(ele)) throw new TypeError(`Invalid elevation: ${ele}`);
        if (isNaN(hour)) throw new TypeError(`Invalid hour: ${hour}`);
        if (isNaN(gndWindSpeed)) throw new TypeError(`Invalid ground wind speed: ${gndWindSpeed}`);
        if (isNaN(gndWindDir)) throw new TypeError(`Invalid ground wind direction: ${gndWindDir}`);
        this.#time = hour;
        this.#groundWindSpeed = gndWindSpeed;
        this.#groundWindDirection = gndWindDir;
        this.#modelName = windModelName;

        if (ele >= 0) {
            this.#elevation = ele;
        } else {
            this.#elevation = 0;
        }
    }

    /**
     * Time this launch occurs.
     * @type {number}
     */
    get time() { return this.#time; }

    /**
     * Location of this launch.
     * @type {Array.<LaunchPathPoint>}
     */
    get launchPath() { return this.#launchPath; }

    /**
     * Elevation at the launch site.
     * @type {number}
     */
    get elevation() { return this.#elevation; }

    /**
     * Average wind speed (MPH) at ground level.
     * @type {number}
     */
    get groundWindSpeed() { return this.#groundWindSpeed; }

    /**
     * Average wind direction (0 degrees from North) at ground level.
     * @type {number}
     */
    get groundWindDirection() { return this.#groundWindDirection; }

    /**
     * Append a new launch path point to this simulation's list.
     * @param {number} alt - The altitude (feet) of a point along the rocket's path.
     * @param {GeoLocation} launchPathPoint - The coordinates of a point along the rocket's path.
     */
    addLaunchPathPoint(alt, launchPathPoint) {
        if (null != launchPathPoint && !isNaN(alt)) {
            this.#launchPath.push(new LaunchPathPoint(alt, launchPathPoint));
        }
    }

    /**
     * Get just the coordinates from where the rocket launched.
     * @returns {GeoLocation} Coordinates of the launch location if available. Otherwise null.
     */
    getLaunchLocation() {
        if (0 == this.#launchPath.length) {
            return null;
        }
        return this.#launchPath[0].location;
    }

    /**
     * Get just the coordinates at the rocket's maximum altitude.
     * @returns {GeoLocation} Coordinates of the rocket's apogee if available. Otherwise null.
     */
    getApogeeLocation() {
        for (let i = 1; i < this.#launchPath.length; ++i) {
            // Find the launch path point where the rocket first starts moving downward.
            if (this.#launchPath[i].altitude < this.#launchPath[i - 1].altitude) {
                return this.#launchPath[i - 1].location;
            }
        }
        return null;
    }

    /**
     * Get just the coordinates where the rocket will land.
     * @returns {GeoLocation} Coordinates of the landing location if available. Otherwise null.
     */
    getLandingLocation() {
        if (0 == this.#launchPath.length) {
            return null;
        }
        return this.#launchPath[this.#launchPath.length - 1].location;
    }

    /**
     * Provides a text version of this launch's time including AM or PM.
     * @returns {GeoLocation} Coordinates of the landing location if available. Otherwise null.
     */
    getLaunchTime() {
        if (0 == this.#time) {
            return '12AM';
        } else if (12 == this.#time) {
            return '12PM';
        } else if (this.#time > 12) {
            return `${this.time - 12}PM`;
        }
        return `${this.#time}AM`;
    }

    /**
     * Provides the rocket's apogee (feet) if available. Zero if not.
     * @returns {number} Integer representation of the rocket's apogee (feet).
     */
    getApogee() {
        let apogee = 0;

        for (let i = 0; i < this.#launchPath.length; ++i) {
            if (this.#launchPath[i].altitude > apogee) {
                apogee = this.#launchPath[i].altitude;
            }
        }
        return Math.round(apogee);
    }

    /**
     * Provides the name of which wind forecast model produced the data used.
     * @returns {string} Name of the wind forecast model.
     */
    getWindModelName() {
        return this.#modelName;
    }
}

/* Contains data defining descent conditions at a particular altitude. */
class DescentData {
    /**
     * The altitude (in feet) where this wind is located.
     * @private
     * @type {number}
     */
    #altitude = 0;

    /**
     * Direction of the wind (degrees from 0 North).
     * @private
     * @type {number}
     */
    #descentRate = 0;

    /**
     * The speed of the wind (in MPH).
     * @private
     * @type {number}
     */
    #windSpeed = 0;

    /**
     * Direction of the wind (degrees from 0 North).
     * @private
     * @type {number}
     */
    #windDirection = 0;

    /**
     * Initializes all the descent data values to those provided.
     * @param {number} alt - Altitude (feet) where this descent occurs.
     * @param {number} rate - Speed at which the rocket will descend (ft/s).
     * @param {number} speed - Wind speed (knots).
     * @param {number} dir - Wind direction (degrees from 0 north).
     * @throws {TypeError} Invalid alt/speed/dir.
     */
    constructor(alt, rate, speed, dir) {
        // Verify the provided values are all valid numbers
        if (isNaN(alt)) throw new TypeError(`Invalid wind altitude: ${alt}`);
        if (isNaN(rate)) throw new TypeError(`Invalid descent rate: ${rate}`);
        if (isNaN(speed)) throw new TypeError(`Invalid wind speed: ${speed}`);
        if (isNaN(dir)) throw new TypeError(`Invalid wind direction: ${dir}`);

        this.#altitude = alt;
        this.#descentRate = rate;
        this.#windSpeed = speed;
        this.#windDirection = dir;
    }

    /**
     * Get the altitude (feet) where this descent occurs.
     * @type {number}
     */
    get altitude() {
        return this.#altitude;
    }

    /**
     * Get the descent rate (ft/s) at this altitude.
     * @type {number}
     */
    get descentRate() {
        return this.#descentRate;
    }

    /**
     * Get the wind speed (knots) at this altitude.
     * @type {number}
     */
    get windSpeed() {
        return this.#windSpeed;
    }

    /**
     * Get the wind direction (degrees from 0 north) at this altitude.
     * @type {number}
     */
    get windDirection() {
        return this.#windDirection;
    }
}







/* Stores all data related to the launch site location. */
class LaunchLocationData {
    /**
     * Coordinates of the launch location.
     * @private
     * @type {GeoLocation}
     */
    #location;

    /**
     * Altitude Mean Sea Level (in feet) of the launch location.
     * @private
     * @type {number}
     */
    #altitude = 0;

    /**
     * Name identification of this launch site.
     * @private
     * @type {string}
     */
    #name = '';

    /**
     * Coordinates of the launch waiver if available.
     * @private
     * @type {GeoLocation}
     */
    #waiverLocation;

    /**
     * Radius (in nautical miles) of the launch waiver if available.
     * @private
     * @type {number}
     */
    #waiverRadius = -1;

    /**
     * Initializes details about the overall launch required for our simulations.
     * @param {GeoLocation} launchLocation - Coordinates of the launch location.
     * @param {number} locationAltitude - Altitide above Mean Sea Level (in feet) of the launch location.
     */
    constructor(launchLocation, locationAltitude, launchName = '') {
        this.#location = launchLocation;
        this.#altitude = locationAltitude;
        this.#name = launchName;
    }

    /**
     * Set the data fields defining this launch's waiver.
     * @param {GeoLocation} location - Coordinates of the launch waiver's center.
     * @param {number} radius - Distance (in nautical miles) the launch waiver extends from the center.
     */
    setWaiver(location, radius) {
        this.#waiverLocation = location;
        this.#waiverRadius = radius;
    }

    /**
     * Get the location where this launch occurs.
     * @type {GeoLocation}
     */
    get location() {
        return this.#location;
    }

    /**
     * Get the altitude above Mean Sea Level (in feet) where this launch occurs.
     * @type {number}
     */
    get altitude() {
        return this.#altitude;
    }

    /**
     * Get the name associated with this launch location.
     * @type {string}
     */
    get name() {
        return this.#name;
    }
}

export { LaunchTimeData, LaunchPathPoint, LaunchSimulationData, DescentData, LaunchLocationData };