var start_date = new Date(1894,0,1); // Change these two
var end_date = new Date(1900,0,1);                           // as needed.


// how accelerated animation time is compared to real time
var speeds = [
  0,
  60,
  1800,
  3600,
  10800,
  21600,
  43200,
  86400,
  172800,
];

var current_date = new Date(start_date.getTime());
var animating = true;
var current_speed = 3;

var assumed_avg_ship_speed = 20; // guessing 20 kph
var assumed_avg_sail_ship_speed = 10;
var minimum_exp_ship_speed = 1; // assuming it is practically impossible for a ship to move slower than 1 kph
var min_exp_steam_sh_speed = 10; // assuming steam ships will travel faster

var journey_id_counter = 0;

var assumed_load_time = 86400000; // one day in milliseconds
var six_months = 15552000000; // six months in millisedonds

var assumed_dep_time = 64800000; // 18:00
var assumed_arr_time = 21600000; // 06:00

$(document).ready(function() {
  let prev_speed = 3;
  $("button#start_btn").click(function() {
    console.log("Starting animation.");
    current_speed = prev_speed;

    $("#current_time").prop('disabled', true);
  });

  $("button#stop_btn").click(function() {
    console.log("Stopping animation.");
    prev_speed = current_speed;
    current_speed = 0;

    $("#current_time").prop('disabled', false);
  });

  $("button#faster_btn").click(function() {
    if(current_speed+1 < speeds.length && current_speed != 0) {
      current_speed += 1;
      prev_speed = current_speed;

      $("#current_speed").text(current_speed.toString());
    }
  });

  $("button#slower_btn").click(function() {
    if(current_speed > 1) {
      current_speed -= 1;
      prev_speed = current_speed;

      $("#current_speed").text(current_speed.toString());
    }
  });

  $("button#halt_btn").click(function() {
    console.log("DEBUG: HALTING")
    animating = false;
  });

  $("input#current_time").change(function() {
    let ms = Date.parse($("input#current_time").val());
    if(ms > end_date.getTime()) {
      ms = end_date.getTime();
    } else if(ms < start_date.getTime()) {
      ms = start_date.getTime();
    }
    console.log("New time being set");
    console.log(ms);
    current_date.setTime(ms);
  });
});

function DataHandler(sh, ev, po, ro, gr) {
  this.ships = sh;
  this.events = ev;
  this.ports = po;
  this.routes = ro;
  this.graph = gr;
}

function date_to_str(date) {
  return date.toISOString().substr(0,10);
}

function ship_from_id(id_number, s) {
  if(id_number === 0) {
    return [{"name": "Ukjent"}]
  }
  return s.filter(function(v) {
    return v.id === id_number;
  });
}

function port_from_id(id_number, p) {
  if(id_number === 0) {
    return "Ukjent"
  }
  return p.filter(function(v) {
    return v.id === id_number;
  })
}

// TODO: Might change this and only insert values and use css of html to
//       style it the right way based on language
function event_to_html(e, s, p) {
  var html_string = "<div class=event>";
  html_string += "\n<div class=event_date>Dato: " + e.date + "</div>"; // Keep?
  html_string += "\n<div class=event_type>Type: " + e.type + "</div>";
  // var port = port_from_id(e.port, p);
  // html_string += "\n<div class=event_port>Havn: " + port[0].name + "</div>";
  html_string += "\n<div class=event_port>Havn: " + e.port.name + "</div>";
  var ship = ship_from_id(e.shipid, s);
  html_string += "\n<div class=event_ship>Skip: " + ship[0].name + "</div>";
  html_string += "\n<div class=dest_orig>";
  html_string += e.type === "Arrival" ? "Fra: " : "Til: "
  html_string += e.dest_orig.name + "</div>";
  html_string += "\n<div class=event_crew>Mannskap: " + e.crew + "</div>";
  html_string += "\n<div class=event_capt>Kaptein: " + e.captain + "</div>";
  html_string += "\n<div class=event_carg>Last: " + e.cargo + "</div>"
  html_string += "\n</div>";

  return html_string;
}

function createJourneysAlt(data) {
  let evs = data.events;
  let r = data.routes;
  let s = data.ships;

  let ship_sightings = [];
  let journeys = [];

  let id_ctr = 0;

  for(let i = 0; i < s.length; i++) {
    ship_sightings.append([]);
  }

  for(let i = 0; i < evs.length; i++) {
    let ship = evs[i].shipid;
    ship_sightings[ship].append(evs[i]);
  }

  for(let i = 0; i < ship_sightings.length; i++) {
    ship_evs = ship_sightings[i];
    ship_evs.sort(function(a,b) {
      return  a.date < b.date ? -1
            : b.date < a.date ?  1
            : 0;
    });

    if(ship_evs[0].type === "Arrival") {
      let arr = new Date(ship_evs[0].date).getTime() + 21600000
      let rt = get_route(ship_evs[0].dest_orig.id, ship_evs[0].port.id, r);
      if(rt === undefined) {
        get_route_reversed(ship_evs[0].port.id, ship[0].dest_orig.id, r);
      }
      let dep = arr - rt.length*3600000/assumed_avg_ship_speed;
      var jo = {
        "id": id_ctr,
        "from": ship_evs[0].dest_orig,
        "from_name": ship_evs[0].dest_orig_name,
        "to": ship_evs[0].port,
        "to_name": ship_evs[0].port.name,
        "arrival": arr,
        "departure": dep,
        "route": rt,
        "time_security": "Arrival",
        "ship": i
      };
      id_ctr++;
      journeys.append(jo);
    }
    for(let j = 1; j < ship_evs.length; j++) {
      if(ship_evs[j].type === "Arrival") {
        if(ship_evs[j-1].type === "Departure") {
          if(ship_evs[j].dest_orig.id === ship_evs[j-1].port.id && ship_evs[j].port.id === ship_evs[j-1].dest_orig.id) {
            var jo = {
              "id": id_ctr,
              "from": ship_evs[j-1].port,
              "from_name": ship_evs[j-1].port.name,
              "to": ship_evs[j].port,
              "to_name": ship_evs[j].port.name,
              "departure": new Date(ship_evs[j-1].date).getTime() + assumed_dep_time,
              "arrival": new Date(ship_evs[j].date).getTime() + assumed_arr_time,
              "route": get_route(from.id, to.id, r),
              "time_security": "Both",
              "ship": i
            };
            id_ctr++;
            journeys.append(jo);
          } else if(ship_evs[j].dest_orig.id !== ship_evs[j-1].port.id && ship_evs[j].port.id !== ship_evs[j-1].dest_orig.id) {
            // TODO
            console.warn("More than one in between. Not implemented.");
          } else {
            let rt_1, rt_2, total_length, via_point, arr_via, dep_via;
            let dep = new Date(ship_evs[j-1].date).getTime() + assumed_dep_time;
            let arr = new Date(ship_evs[j].date).getTime() + assumed_arr_time;
            if(ship_evs[j].dest_orig.id !== ship_evs[j-1].port.id) {
              rt_1 = get_route(ship_evs[j-1].port.id, ship_evs[j].dest_orig.id, r);
              rt_2 = get_route_reversed(ship_evs[j].dest_orig.id, ship_evs[j].port.id, r);
              total_length = rt_1.length + rt_2.length;
              via_point = rt_1.length / total_length;
            } else if(ship_evs[j].port.id !== ship_evs[j-1].dest_orig.id) {
              rt_1 = get_route(ship_evs[j-1].port.id, ship_evs[j-1].dest_orig.id, r);
              rt_2 = get_route_reversed(ship_evs[j].port_id, ship_evs[j-1].dest_orig.id, r);
              total_length = rt_1.length + rt_2.length;
              via_point = rt_1.length / total_length;
            }
            arr_via = dep + (arr-dep)*via_point - assumed_load_time/2;
            dep_via = arr_via + assumed_load_time;
            var jo_1 = {
              "id": id_ctr,
              "from": ship_evs[j-1].port,
              "from_name": ship_evs[j-1].port.name,
              "to": ship_evs[j].dest_orig,
              "to_name": ship_evs[j].dest_orig_name,
              "departure": dep,
              "arrival": arr_via,
              "route": rt_1,
              "time_security": "Departure",
              "ship": i
            };
            id_ctr++;
            jo_2 = {
              "id": id_ctr,
              "from": ship_evs[j].dest_orig,
              "from_name": ship_evs[j].dest_orig_name,
              "to": ship_evs[j].port,
              "to_name": ship_evs[j].port.name,
              "departure": dep_via,
              "arrival": arr,
              "route": rt_2,
              "time_security": "Arrival",
              "ship": i
            };
            id_ctr++;
          }
        } else {
          // TODO Preceding event is Arrival
        }
      } else {
        // TODO Event is Departure. Should ignore.
      }
    }
  }

  return journeys;
}

/*
createJourneys
creates all the journeys required
parameters:
data - dataHandler
am - list of ids of already matched events
returns:
a list of journeys and an updated list of matched events

TODO add crew numbers, cargo, and captain when that is registered on arrival
     consider moving this to the server if this is too slow
*/
function createJourneys(data, date_from, date_to, existing_journeys, event_skips) {
  let evs = data.events.filter(function(v) {
    return v.date > date_from && v.date < date_to;
  });
  let r = data.routes;
  let s = data.ships;

  var journeys = existing_journeys;
  let event_skip_id = event_skips;
  for(let i = 0; i < evs.length; i++) {
    ev = evs[i];
    if(event_skip_id.indexOf(ev.id) !== -1) {
      // This event has already been matched
      continue;
    }
    let match_type = ev.type === "Arrival" ? "Departure" : "Arrival";
    let route = r.filter(function(v) {
      return ev.port.id + "_" + ev.dest_orig.id === v.name;
    })[0];
    let curr_ship = s.filter(function(v) {
      return ev.shipid === v.id;
    })[0];
    if(curr_ship === undefined) {
      curr_ship = {"type": "Unknown"};
    }
    let ev_date = new Date(ev.date).getTime();
    let matching = evs.filter(function(v) {
      let correct_type = v.type === match_type;
      let date_match = match_type === "Arrival" ? v.date >= ev.date : v.date <= ev.date;

      let v_date = new Date(v.date).getTime();
      let speed = curr_ship.type === "Damp" ? min_exp_steam_sh_speed
                : minimum_exp_ship_speed;
      let close_time_match = match_type === "Arrival" ? v_date <= ev_date + (route.length * 3600000 / speed)
                                                      : v_date >= ev_date - (route.length * 3600000 / speed);
      let port_match = (v.port.id === ev.dest_orig.id && v.dest_orig.id === ev.port.id) ||
                       (v.port.id === ev.dest_orig.id && v.dest_orig.id === 0) ||
                       (ev.dest_orig === 0);
      let ship_match = v.shipid === ev.shipid;
      let not_matched = event_skip_id.indexOf(v.id) === -1;
      return correct_type && date_match && port_match && ship_match && not_matched && close_time_match;
    });
    let ev_match = undefined;
    if(ev.shipid === 31) {
      console.log("ev");
      console.log(ev);
    }
    // console.log("ev");
    // console.log(ev);
    if(matching.length > 0) {
      matching.sort(function(a,b) {
        return  a.date < b.date ? -1
              : a.date > b.date ?  1
              : 0;
      });

      if(ev.shipid ===31) {
        console.log("matching");
        console.log(matching);
      }

      // console.log("matching");
      // console.log(matching);

      ev_match = matching[0];
    } else if(ev.shipid === 31){
      console.error("no matching");
    }

    let event_date = new Date(ev.date).getTime();

    let from = ev.type === "Arrival" ? ev.dest_orig : ev.port;
    let to = ev.type === "Arrival" ? ev.port : ev.dest_orig;
    let dep_date = ev.type === "Arrival" ? undefined : event_date+assumed_dep_time; // departure at 18:00
    let arr_date = ev.type === "Arrival" ? event_date+assumed_arr_time : undefined; // arrival at 06:00
    let ship = ev.shipid;
    let rt = route;
    if(dep_date === "NONE" || arr_date === "NONE") {
      continue;
    }
    let new_rt = {
      "length": rt.length,
      "coordinates": []
    };
    if(ev_match) {
      if(from === ev.dest_orig) {
        new_rt.coordinates = rt.coordinates.slice();
        new_rt.coordinates.reverse();
        dep_date = new Date(ev_match.date).getTime()+assumed_dep_time;
      } else {
        new_rt = rt;
        arr_date = new Date(ev_match.date).getTime()+assumed_arr_time;
      }
    } else {
      // console.log(ev.port.id + "_" + ev.dest_orig.id);
      let time = rt.length / assumed_avg_ship_speed;
      time = time * 3600000; // convert to time in ms;
      if(from === ev.dest_orig) {
        new_rt.coordinates = rt.coordinates.slice();
        new_rt.coordinates.reverse();
        dep_date = arr_date - time;
      } else {
        new_rt = rt;
        arr_date = dep_date + time;
      }
    }

    let to_name = ev.type === "Arrival" ? ev.port.name : ev.dest_orig_name;
    let from_name = ev.type === "Arrival" ? ev.dest_orig_name : ev.port.name;

    let sec = ev_match ? "Both" : ev.type;
    var journey = {
      "id": journey_id_counter,
      "from": from,
      "to": to,
      "departure": dep_date,
      "arrival": arr_date,
      "ship": ship,
      "route": new_rt,
      "time_security": sec,
      "from_name": from_name,
      "to_name": to_name
    };

    // console.log(journey);

    journey_id_counter += 1;

    event_skip_id.push(ev.id);
    if(ev_match) {
      event_skip_id.push(ev_match.id);
    }
    journeys.push(journey);
  }

  // Merge or, worst case remove, simultaneous journeys by the same ship
  let successful_merges = 0;
  for(let i = 1 ; i < s.length; i++) {
    let ship_journeys = journeys.filter(function(v) {
      return v.ship === i;
    });

    var ship = s.filter(function(v) {
      return v.id === i;
    })[0];

    if(ship === undefined) {
      console.warn("Ship undefined, id: " + i);
    }

    // let mismatches = true;
    let failed_merges = 0;
    // TODO Takes up a lot of resources in some circumstances... redo?
    // while(mismatches) {
    for(let l = 0; l < 10; l++) {
      // mismatches = false;

      failed_merges = 0;
      successful_merges_this_pass = 0;

      for(let j = 0; j < ship_journeys.length-1; j++) {
        let j_journey = ship_journeys[j];
        for(let k = j+1; k < ship_journeys.length; k++) {
          let k_journey = ship_journeys[k];

          // Check to see if the two journeys are simultaneous
          let arr_inside = k_journey.arrival > j_journey.departure && k_journey.arrival < j_journey.arrival;
          let dep_inside = k_journey.departure < j_journey.arrival && k_journey.departure > j_journey.departure;

          if(dep_inside && !arr_inside) {
            let success = merge_journeys(j_journey, k_journey, r, ship);
            if(success) {
              // mismatches = true;
              successful_merges_this_pass++;
            }
            else {
              console.warn("dep_inside: not able to merge journeys");
              console.log(j_journey);
              console.log(k_journey);
              failed_merges++;
            }
          } else if(arr_inside && !dep_inside) {
            let success = merge_journeys(k_journey, j_journey, r, ship);
            if(success) {
              // mismatches = true;
              successful_merges_this_pass++;
            } else {
              console.warn("arr_inside: not able to merge journeys");
              console.log(j_journey);
              console.log(k_journey);
              failed_merges++;
            }
          } else if(dep_inside && arr_inside) {
            console.log("One journey inside the other. Will not merge for now");
            console.log(j_journey);
            console.log(k_journey);
            failed_merges++;
          }
        }
      }
      console.log("failed merges this pass: " + failed_merges);
      console.log("successful merges this pass: " + successful_merges_this_pass);
      successful_merges += successful_merges_this_pass;
    }
  }

  console.log("successful_merges: " + successful_merges);

  // Get rid of the journeys that are no longer required (they've been merged with another journey
  // and set to go from 0 to 0)
  journeys = journeys.filter(function(v) {
    return v.from.id !== v.to.id;
  });

  let weird_j = journeys.filter(function(v) {
    return v.route === undefined;
  });

  console.error(weird_j);

  return [journeys, event_skip_id];
}

// Finds the route between two id's
function get_route(a, b, rts) {
  return rts.filter(function(v) {
    return v.name === a + "_" + b;
  })[0];
}

function get_route_reversed(a, b, rts) {
  var rt = rts.filter(function(v)  {
    return v.name === a + "_" + b;
  })[0];

  if(rt === undefined) {
    return undefined;
  }

  let new_coords = rt.coordinates.slice();
  new_coords = new_coords.reverse();

  return {"coordinates": new_coords,
          "length": rt.length};
}

// Assumes journey b starts later than journey a
function merge_journeys(j_a, j_b, rts, ship) {
  if(ship === undefined) {
    console.error("Ship undefined");
  }
  // Check to see if the journeys have simply not been matched correctly. If so, merge into single journey.
  if(j_a.to.id === j_b.to.id && j_a.from.id === j_b.from.id) {
    console.log("Simultaneous journeys with same locations")

    let dep_time;
    let arr_time;

    if(j_a.time_security === "Both" || j_b.time_security === "Both") {
      console.warn("Simultaneous journeys where at least one of them has solid time security.");
      return false;
    }

    if(j_a.time_security === "Departure") {
      dep_time = j_a.departure;
    } else {
      dep_time = j_b.departure;
      if(j_b.time_security !== "Departure") {
        console.log("Neither journey has departure security, assuming shortest possible.");
      }
    }

    if(j_a.time_security === "Arrival") {
      arr_time = j_a.arrival;
    } else {
      arr_time = j_b.arrival;
      if(j_b.time_security !== "Arrival") {
        console.log("Neither journey has arrival security, assuming shortest possible");
      }
    }

    j_a.departure = dep_time;
    j_a.arrival = arr_time;
    j_a.time_security = "Both";

    j_b.from = 0;
    j_b.to = 0;
    j_b.departure = 0;
    j_b.arrival = 0;

    return true;
  }

  // Check to see if they have unknowns at opposing ends of the journey, and assume that they refer to each other
  // TODO Could consider this to unsafe to merge.
  if((j_a.to === 0 && j_b.to !== 0 && j_b.from === 0 && j_a.from !== 0) || (j_a.to !== 0 && j_b.to === 0 && j_b.from !== 0 && j_a.from === 0)) {
    let from = j_a.from === 0 ? j_b.from : j_a.from;
    let from_name = j_a.from === 0 ? f_b.from_name : j_a.from_name;
    let to = j_a.to === 0 ? j_b.to : j_a.to;
    let to_name = j_a.to === 0 ? j_b.to_name : j_a.to_name;

    let dep_time = j_a.time_security === "Departure" ? j_a.departure : j_b.departure;
    let arr_time = j_a.time_security === "Arrival" ? j_a.arrival : j_b.arrival;

    let rt = get_route(from, to, rts);
    if(rt === undefined) {
      console.warn("Could not find route " + from + "_" + to);
      return false;
    }

    j_a.from = from;
    j_a.from_name = from_name;
    j_a.to = to;
    j_a.to_name = to_name;
    j_a.departure = dep_time;
    j_a.arrival = arr_time;
    j_a.route = rt;

    j_b.from = 0;
    j_b.to = 0;
    j_b.arrival = 0;
    j_b.departure = 0;

    return true;
  }

  // Check to see if the second journey is the return journey from a port
  if(j_a.to.id === j_b.from.id && j_b.to.id === j_a.from.id) {
    if(j_a.time_security === "Departure" && j_b.time_security === "Arrival") {
      j_a.arrival = j_b.arrival - (j_a.departure - j_b.arrival)/2 - assumed_load_time/2;
      j_a.departure = j_b.arrival - (j_a.departure - j_b.arrival)/2 + assumed_load_time/2;
      return true;
    } else if(j_a.time_security === "Arrival" && j_b.time_security === "Departure") {
      console.warn("Unable to connect time secure entries");
      return false;
    } else if(j_a.time_security === "Departure" && (j_b.time_security === "Departure" || j_b.time_security === "Both")) {
      j_a.arrival = j_b.departure - assumed_load_time;
    } else if((j_a.time_security === "Arrival" || j_a.time_security === "Both") && j_b.time_security === "Arrival") {
      j_b.departure = j_a.arrival + assumed_load_time;
    }
  }

  // Check to see the journeys have the same end point, or if one has an unknown
  if(j_a.to.id === j_b.to.id || j_b.to.id === 0 ? j_a.to.id !== 0 : j_a.to.id === 0) {
    let b_to = j_b.to;
    let b_to_name = j_b.to_name;
    var b_rt;
    let a_ts = j_a.time_security;
    let b_ts = j_b.time_security;
    if(j_b.to.id === 0) {
      b_to = j_a.to;
      b_to_name = j_a.to_name;

      b_rt = get_route(j_b.from.id, b_to.id, rts);
      if(b_rt === undefined) {
        b_rt = get_route_reversed(b_to.id, j_b.from.id, rts);

        if(b_rt === undefined) {
          console.warn("Unable to find route between " + j_b.from.id + " and " + j_b.to.id);
          return false;
        }
      }
    }

    let b_arr_time = j_b.arrival;

    if(j_a.time_security === "Arrival" || j_a.time_security === "Both") {
      b_arr_time = j_a.arrival;
    }

    var a_rt = get_route(j_a.from.id, j_b.from.id, rts);
    if(a_rt === undefined) {
      a_rt = get_route_reversed(j_b.from.id, j_a.from.id, rts);

      if(a_rt === undefined) {
        console.warn("Unable to find route between " + j_a.from.id + " and " + j_b.to.id);
        return false;
      }
    }

    let a_to = j_b.from;
    let a_to_name = j_b.from_name;

    let a_arr_time = j_a.arrival;
    let b_dep_time = j_b.departure;
    let spd = ship.type === "Damp" ? assumed_avg_ship_speed : assumed_avg_sail_ship_speed;
    if(b_ts === "Departure" || b_ts === "Both") {
      a_arr_time = j_b.departure - assumed_load_time;
      if(a_ts === "Arrival" || a_ts === "Both") {
        console.warn("Would change time secure arrival. Aborting merge.");
        return false;
      }
    } else {
      let time = a_rt.length / spd;
      time *= 3600000;

      a_arr_time = j_a.departure + time;
    }

    if(a_arr_time < j_a.departure) {
      console.warn("Trouble finding a correct arrival time for the first journey, time for journey might be low.");
      a_arr_time = j_a.departure + (j_b.departure - j_a.departure)/2;
    }

    if(b_ts !== "Departure") {
      b_dep_time = j_a.arrival + assumed_load_time;
      if(b_ts === "Both") {
        console.warn("Would change time secure departure. Aborting merge.");
        return false;
      }
    }

    if(b_dep_time > j_b.arrival) {
      console.warn("Trouble finding a correct departure time for second journey, time for journey might be low.")
      b_dep_time = j_b.arrival - (j_b.arrival - j_a.arrival)/2;
    }

    j_a.to = a_to;
    j_a.to_name = a_to_name;
    j_a.route = a_rt !== undefined ? a_rt : j_a.route;
    j_a.arrival = a_arr_time;

    j_b.to = b_to;
    j_b.to_name = b_to_name;
    j_b.route = b_rt !== undefined ? b_rt : j_b.route;
    j_b.departure = b_dep_time;
    j_b.arrival = b_arr_time;

    return true;
  }

  if(j_a.from.id === j_b.from.id || j_a.from.id === 0 ? j_b.from.id !== 0 : j_b.from.id === 0) {
    let b_from = j_b.from;
    let a_from = j_a.from;
    let b_from_name = j_b.from_name;
    let a_from_name = j_a.from_name;
    let b_to = j_b.to;
    let a_to = j_a.to;
    let b_to_name = j_b.to_name;
    let a_to_name = j_b.to_name;
    let b_rt;
    let a_rt;
    let b_arr_time = j_b.arrival;
    let a_arr_time = j_a.arrival;
    let b_dep_time = j_b.departure;
    let a_dep_time = j_a.departure;
    let b_ts = j_b.time_security;
    let a_ts = j_a.time_security;

    if(a_from.id === 0) {
      a_from = b_from;
      a_from_name = b_from_name;

      a_rt = get_route(a_from.id, a_to.id, rts);
      if(a_rt === undefined) {
        a_rt = get_route_reversed(a_to.id, a_from.id, rts);
        if(a_rt === undefined) {
          console.warn("Unable to find route between " + a_from.id + " and " + a_to.rt);
          return false;
        }
      }
    }

    b_from = a_to;
    b_from_name = a_to_name;
    b_rt = get_route(b_from.id, b_to.id, rts);
    if(b_rt === undefined) {
      b_rt = get_route_reversed(b_to.id, b_from.id, rts);
      if(b_rt === undefined) {
        console.warn("Unable to find route between " + b_from.id + " and " + b_to.id);
        return false;
      }
    }

    if(a_ts === "Arrival" || a_ts === "Both") {
      b_dep_time = a_arr_time + assumed_load_time;
      if(b_ts === "Departure") {
        console.warn("Would change time secure departure. Aborting merge.");
        return false;
      }
    } else if(b_ts === "Departure" || b_ts === "Both") {
      a_arr_time = b_dep_time - assumed_load_time;
    }

    if(b_dep_time > b_arr_time) {
      console.warn("Departure time after arrival time, creating very short journey time.");
      b_dep_time = b_arr_time - (b_arr_time - a_arr_time);
    }

    if(a_arr_time < a_dep_time) {
      console.warn("Arrival time before departure time, creating very short journey time.");
      a_arr_time = a_dep_time + (b_dep_time - a_dep_time);
    }

    j_a.to = a_to;
    j_a.to_name = a_to_name;
    j_a.from = a_from;
    j_a.from_name = a_from_name;
    j_a.route = a_rt !== undefined ? a_rt : j_a.route;
    j_a.arrival = a_arr_time;
    j_a.departure = a_dep_time;

    j_b.to = b_to;
    j_b.to_name = b_to_name;
    j_b.from = b_from;
    j_b.from_name = b_from_name;
    j_b.route = b_rt !== undefined ? b_rt : j_b.route;
    j_b.arrival = b_arr_time;
    j_b.departure = b_dep_time;

    return true;
  }

  // Check to see if one is a return to a different port
  if(j_a.to.id === j_b.from.id || j_a.to.id === 0 ? j_b.from.id !== 0 : j_a.from.id === 0) {
    let a_to = j_a.to;
    let a_to_name = j_a.to_name;
    let b_from = j_b.from;
    let b_from_name = j_b.from_name;
    let a_rt;
    let b_rt;
    let a_ts = j_a.time_security;
    let b_ts = j_b.time_security;
    let a_arr_time;
    let b_arr_time;

    if(j_a.to.id === 0) {
      a_to = b_from;
      a_to_name = b_from_name;
      a_rt = get_route(j_a.from.id, a_to.id, rts);
      if(a_rt === undefined) {
        a_rt = get_route_reversed(a_to.id, j_a.from.id, rts);
        if(a_rt === undefined) {
          console.warn("Unable to find route between " + j_a.from.id + " and " + a_to.id);
          return false;
        }
      }
    } else if(j_b.from.id === 0) {
      b_from = a_to;
      b_from_name = a_to_name;
      b_rt = get_route(b_from.id, j_b.to.id, rts);
      if(b_rt === undefined) {
        b_rt = get_route_reversed(j_b.to.id, b_from.id, rts);
        if(b_rt === undefined) {
          console.warn("Unable to find route between " + b_from.id + " and " + j_b.to.id);
        }
      }
    }

    if((a_ts === "Both" && b_ts === "Both") || (a_ts === "Arrival" && b_ts === "Departure")) {
      console.warn("Trying to merge time secure journeys. Aborting.");
      return false;
    }

    if(a_ts === "Departure" && b_ts === "Arrival") {
      let total_length = a_rt !== undefined ? a_rt.length : j_a.route.length;
      let a_part = total_length;
      total_length += b_rt !== undefined ? b_rt.length : j_b.route.length;
      a_part /= total_length;

      a_arr_time = j_a.departure + a_part*(j_b.arrival - j_a.departure) - assumed_load_time/2;
      b_dep_time = a_arr_time + assumed_load_time;
    } else {
      console.log("Time security not clear, see if this can be fixed if it pops up a lot");
      return false;
    }

    j_a.to = a_to;
    j_a.to_name = a_to_name;
    j_b.from = b_from;
    j_b.from_name = b_from_name;

    j_a.route = a_rt !== undefined ? a_rt : j_a.route;
    j_b.route = b_rt !== undefined ? b_rt : j_b.route;

    j_a.arrival = a_arr_time !== undefined ? a_arr_time : j_a.arrival;
    j_b.arrival = b_arr_time !== undefined ? b_arr_time : j_b.arrival;

    return true;
  }

  console.warn("Missing clause, could not find correct merge type");
  return false;
}

// TODO Update this to change based on journeys, rather than events.
function update_ship_info(evs, ships) {
  for(var i = 0; i < evs.length; i++) {
    let ev = evs[i]
    var sh = ships.filter(function(v) {
      return ev.shipid === v.id;
    })[0];

    if(sh) {
      if(sh.captain !== ev.captain && ev.captain !== "NONE") {
        console.log("New captain on " + sh.name);
        console.log(ev.captain);
        sh.captain = ev.captain;
      }
      if(sh.crew !== ev.crew && ev.crew !== 0) {
        console.log("New crew count on " + sh.name);
        console.log(ev.crew);
        sh.crew = ev.crew;
      }
      if(sh.cargo !== ev.cargo && ev.cargo !== "NONE") {
        console.log("New cargo on " + sh.name);
        console.log(ev.cargo);
        sh.cargo = ev.cargo;
      }
    }
  }
}

// Used to avoid constantly using up system resources
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function animate_events(data) {
  var eventlist = document.getElementById("eventlist");
  var previous_frame_time = Date.now();
  var previous_date = current_date.getDate();
  var journeys = [];
  var matched_events = [];
  var result = createJourneys(data, date_to_str(new Date(start_date.getTime())),
                              date_to_str(new Date(start_date.getTime() + six_months)),
                              journeys, matched_events);
  journeys = result[0];
  matched_events = result[1];
  console.log(journeys);
  console.log(matched_events);

  var journeys_previous_frame = [];
  var last_checked_journeys = start_date.getTime();
  while(animating) {
    let current_frame_time = Date.now();
    let time_passed = current_frame_time - previous_frame_time;
    previous_frame_time = current_frame_time;

    let sim_time = time_passed * speeds[current_speed];
    current_date.setTime(current_date.getTime() + sim_time);
    $("#current_time").val(current_date.toISOString().substr(0,16));
    console.log("frame");

    if(current_date.getTime() > last_checked_journeys + six_months/2 && matched_events.length < data.events.length) {
      result = createJourneys(data, date_to_str(current_date), date_to_str(new Date(current_date.getTime() + six_months)),
                              journeys, matched_events);
      journeys = result[0];
      matched_events = result[1];
      last_checked_journeys = current_date.getTime();
    }

    var date_string = date_to_str(current_date);

    let this_day_events = [];
    if(current_date.getUTCDate() != previous_date) {
      previous_date = current_date.getUTCDate();

      console.log("date change");
      console.log(date_string);
      eventlist.innerHTML = "";
      this_day_events = data.events.filter(function(v) {
        return v.date === date_string;
      });
    }

    var ongoing_journeys = journeys.filter(function(v) {
      return v.departure <= current_date.getTime() && v.arrival >= current_date.getTime();
    });

    journeys_previous_frame = journeys_previous_frame.filter(function(v) {
      return ongoing_journeys.filter(function(u) {
        return u.id === v.id;
      })[0] === undefined;
    });

    drawJourneys(ongoing_journeys, data.ships, data.routes, current_date);
    drawJourneys(journeys_previous_frame, data.ships, data.routes, current_date);
    checkFeatures("events");
    checkShipMarkers();
    // checkFeatures("lines");
    drawEvents(this_day_events, data.ships);
    update_ship_info(this_day_events, data.ships);
    // drawEventsLine(this_day_events, data.ships, data.routes, data.graph);

    journeys_previous_frame = ongoing_journeys;

    var i;
    for(i = 0; i < this_day_events.length; i++) {
      console.log("Event: " + JSON.stringify(this_day_events[i]));
      eventlist.innerHTML += event_to_html(this_day_events[i], data.ships, data.ports);
    }
    await sleep(50); // Sleep to avoid wasting the cpu for no reason.

    if(current_date.getTime() >= end_date.getTime()) {
      current_date.setTime(start_date.getTime());
      last_checked_journeys = start_date.getTime()-six_months;
    }
  }
}
