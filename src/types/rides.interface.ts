export interface Route {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  agency_id?: number;
}

export interface Trip {
  trip_id: string;
  route_id: string;
  service_id: string;
  trip_headsign: string;
  direction_id: string;
}

export interface Stop {
  stop_id: string;
  stop_name: string;
  arrival_time: string;
}

export interface StopTimeJoinResult {
  trip_id: string;
  route_long_name: string;
  arrival_time: string;
  stop_name: string;
  route_id: string;
  agency_id: number;
  agency_name: string;
  route_short_name: string;
  stop_id: string;
}

export interface LineDetailsResponse {
  [trip_id: string]: {
    stops: StopTime[];
    long_name: string;
    duration: string;
    route_id: string;
    first_stop_name: string;
    last_stop_name: string;
    agency_name: string;
    agency_id: number;
    schedule: Schedule;
    route_short_name: string;
    description: string;
  };
}

export interface StopTime {
  stop_name: string;
  relative_stop_time: string;
  stop_id: string;
}
export interface Schedule {
  sunday: string[];
  monday: string[];
  tuesday: string[];
  wednesday: string[];
  thursday: string[];
  friday: string[];
  saturday: string[];
}

export interface GroupedSchedule {
  route_id: string;
  trip_id: string;
  description: string;
  schedule: Schedule;
}
