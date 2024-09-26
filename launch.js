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

        // Calculate the offset of this launch's start time from now in hours.
        let rightNow = new Date();
        let endDateWithHour = new Date(numYear, numMonth - 1, numDay, this.#endHour);

        // Now we can store offsets from now to the start and end hours.
        this.#startHourOffset = Math.ceil((this.#launchDate - rightNow) / 3600000);
        this.#endHourOffset = Math.ceil((endDateWithHour - rightNow) / 3600000);
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
     * Initializes a location using the provided latitude and longitude coordinates.
     * @param {number} ele - The elevation (feet) of the launch site.
     * @param {number} hour - The time (hour as 0 - 23) this launch occurs.
     * @throws {TypeError} Invalid time.
     */
    constructor(ele, hour) {
        if (isNaN(ele)) throw new TypeError(`Invalid elevation: ${ele}`);
        if (isNaN(hour)) throw new TypeError(`Invalid hour: ${hour}`);
        this.#time = hour;

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

export { LaunchTimeData, LaunchPathPoint, LaunchSimulationData, DescentData };