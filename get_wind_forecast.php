<?php
    const WINDS_ALOFT_REFERRER_NAME = 'YOUR_REFERRER_CODE';

    if (isset($_POST)){
        $data = file_get_contents('php://input');

        // Second parameter indicates if the function should return an array (true) or a PHP object (false)
        $time_and_place = json_decode($data, true);
        $site_latitude = $time_and_place['latitude'];
        $site_longitude = $time_and_place['longitude'];
        $hour_offset = $time_and_place['hour_offset'];

        $winds_aloft_uri = sprintf('https://windsaloft.us/winds.php?lat=%f&lon=%f&hourOffset=%f&referrer=%s', $site_latitude, $site_longitude, $hour_offset, WINDS_ALOFT_REFERRER_NAME);

        // Return the JSON object provided by WindsAloft
        echo file_get_contents($winds_aloft_uri);
    }
?>