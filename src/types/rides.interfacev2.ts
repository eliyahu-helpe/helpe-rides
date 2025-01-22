// Interface for a single stop time
export interface StopTime {
  stop_name: string; // Name of the stop
  relative_stop_time: string; // Stop time in HH:MM:SS format
}

// Interface for the result of the query joining stop times, trips, routes, and agencies
export interface StopTimeJoinResult {
  stop_name: string; // Name of the stop
  relative_stop_time: string; // Stop time in HH:MM:SS format
  long_name: string; // Trip headsign or line name
  trip_id: string; // Trip ID
  route_id: string; // Route ID
  route_short_name: string; // Short name for the route
  agency_id: string; // ID of the agency
  agency_name: string; // Name of the agency
}

// Interface for a single day's schedule
export interface Schedule {
  sunday: string[]; // Array of trip times for Sunday
  monday: string[]; // Array of trip times for Monday
  tuesday: string[]; // Array of trip times for Tuesday
  wednesday: string[]; // Array of trip times for Wednesday
  thursday: string[]; // Array of trip times for Thursday
  friday: string[]; // Array of trip times for Friday
  saturday: string[]; // Array of trip times for Saturday
}

// Interface for the response object of the `getLineDetails` method
export interface LineDetailsResponse {
  stops: StopTime[]; // Array of stops with relative stop times
  long_name: string; // Line's full name or headsign
  duration: string; // Total duration of the trip in HH:MM:SS format
  route_id: string; // Route ID
  route_short_name: string; // Short name for the route
  first_stop_name: string; // Name of the first stop
  last_stop_name: string; // Name of the last stop
  agency_name: string; // Name of the agency
  agency_id: string; // ID of the agency
  schedule: Schedule; // Schedule for the route
}

// Interface for a route
export interface Route {
  route_id: string; // Route ID
  route_short_name: string; // Short name for the route
  route_long_name: string; // Full name for the route
  agency_id: string; // ID of the agency
}

// Interface for a trip
export interface Trip {
  trip_id: string; // Trip ID
  route_id: string; // Route ID
  service_id: string; // Service ID associated with the trip
  trip_headsign: string; // Direction or destination of the trip
}
