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

var assumed_load_time = 43200000; // half a day in milliseconds
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

  let new_coords = rt.coordinates.slice();
  new_coords = new_coords.reverse();

  return {"coordinates": new_coords,
          "length": rt.length};
}

function createJourneysAlt(data) {
  let evs = data.events;
  let r = data.routes;
  let s = data.ships;

  let ship_sightings = [];
  let journeys = [];

  let id_ctr = 0;

  for(let i = 0; i < s.length+1; i++) {
    ship_sightings.push([]);
  }

  for(let i = 0; i < evs.length; i++) {
    let ship = evs[i].shipid;
    ship_sightings[ship].push(evs[i]);
  }

  var total_entries = 0;
  for(let i = 0; i < ship_sightings.length; i++) {
    ship_evs = ship_sightings[i];
    ship_evs.sort(function(a,b) {
      return  a.date < b.date ? -1
            : b.date < a.date ?  1
            : a.type === "Arrival" && b.type === "Departure" ? -1
            : a.type === "Departure" && b.type === "Arrival" ?  1
            : a.dest_orig.id === b.port.id && a.type === "Arrival"   ? -1
            : a.dest_orig.id === b.port.id && a.type === "Departure" ?  1
            : b.dest_orig.id === a.port.id && b.type === "Arrival"   ?  1
            : b.dest_orig.id === a.port.id && b.type === "Departure" ? -1
            : 0;
    });

    let ship = ships.filter(function(v) {
      return v.id === i;
    })[0];

    var speed = ship === undefined ? assumed_avg_ship_speed
              : ship.type === "Damp" ? assumed_avg_ship_speed
              : assumed_avg_sail_ship_speed;

    if(ship_evs.length < 1) {
      continue;
    }

    if(ship_evs[0].type === "Arrival") {
      let arr = new Date(ship_evs[0].date).getTime() + 21600000
      let rt = get_route(ship_evs[0].dest_orig.id, ship_evs[0].port.id, r);
      if(rt === undefined) {
        rt = get_route_reversed(ship_evs[0].port.id, ship_evs[0].dest_orig.id, r);
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
        "ship": i,
        "cargo": ship_evs[0].cargo,
        "crew": ship_evs[0].crew,
        "captain": ship_evs[0].captain
      };
      id_ctr++;
      journeys.push(jo);
    }
    for(let j = 1; j < ship_evs.length; j++) {
      if(ship_evs[j].type === "Arrival") {
        if(ship_evs[j-1].type === "Departure") {
          let dep = new Date(ship_evs[j-1].date).getTime() + assumed_dep_time;
          let arr = new Date(ship_evs[j].date).getTime() + assumed_arr_time;

          if(ship_evs[j].port.id === ship_evs[j-1].port.id &&
            (ship_evs[j].dest_orig.id === ship_evs[j-1].dest_orig.id ||
             ship_evs[j-1].dest_orig.id === 0 ? ship_evs[j].dest_orig.id !== 0 : ship_evs[j].dest_orig.id === 0)) {
            // Assuming return journey
            dest_orig = ship_evs[j].dest_orig;
            if(ship_evs[j-1].dest_orig.id !== 0) {
              dest_orig = ship_evs[j-1].dest_orig;
            }
            if(dest_orig.id !== 0) {
              // East Asian return journey
              let rt_1 = get_route(ship_evs[j-1].port.id, dest_orig.id, r);
              let rt_2 = get_route_reversed(ship_evs[j].port.id, dest_orig.id, r);
              if(rt_2 === undefined || rt_1 === undefined) {
                console.error("Error in east asian return journey");
                console.log(ship_evs[j-1]);
                console.log(ship_evs[j])
              }
              let total_length = rt_1.length + rt_2.length;
              let arr_via = dep + (arr - dep - assumed_load_time)/2;
              let dep_via = arr_via + assumed_load_time;

              let calculated_arr = dep + rt_1.length * 3600000 / speed;
              let calculated_dep = arr - rt_2.length * 3600000 / speed;
              arr_via = calculated_arr < arr_via ? calculated_arr : arr_via;
              dep_via = calculated_dep > dep_via ? calculated_dep : dep_via;

              var jo_1 = {
                "id": id_ctr,
                "from": ship_evs[j-1].port,
                "from_name": ship_evs[j-1].port.name,
                "to": dest_orig,
                "to_name": ship_evs[j-1].dest_orig_name,
                "departure": dep,
                "arrival": arr_via,
                "route": rt_1,
                "time_security": "Departure",
                "ship": i,
                "cargo": "NONE",
                "crew": 0,
                "captain": "NONE"
              };
              id_ctr++;
              journeys.push(jo_1);
              var jo_2 = {
                "id": id_ctr,
                "from": dest_orig,
                "from_name": ship_evs[j].dest_orig_name,
                "to": ship_evs[j].port,
                "to_name": ship_evs[j].port.name,
                "departure": dep_via,
                "arrival": arr,
                "route": rt_2,
                "time_security": "Arrival",
                "ship": i,
                "cargo": ship_evs[j].cargo,
                "crew": ship_evs[j].crew,
                "captain": ship_evs[j].captain
              };
              id_ctr++;
              journeys.push(jo_2);
            } else {
              // Westward return
              let rt_1, rt_2, arr_west, dep_west;
              rt_1 = get_route(ship_evs[j-1].port.id, ship_evs[j-1].dest_orig.id, r);
              rt_2 = get_route_reversed(ship_evs[j].port.id, ship_evs[j].dest_orig.id, r);

              arr_west = dep + rt_1.length * 3600000 / speed;
              dep_west = arr - rt_2.length * 3600000 / speed;

              if(arr_west < dep_west) {
                dep_west = dep + (arr - dep + assumed_load_time)/2;
                arr_west = dep_west - assumed_load_time;
              }

              var jo_1 = {
                "id": id_ctr,
                "from": ship_evs[j-1].port,
                "from_name": ship_evs[j-1].port.name,
                "to": ship_evs[j-1].dest_orig,
                "to_name": ship_evs[j-1].dest_orig_name,
                "departure": dep,
                "arrival": arr_west,
                "route": rt_1,
                "time_security": "Departure",
                "ship": i,
                "cargo": "NONE",
                "crew": 0,
                "captain": "NONE"
              };
              id_ctr++;
              journeys.push(jo_1);
              jo_2 = {
                "id": id_ctr,
                "from": ship_evs[j].dest_orig,
                "from_name": ship_evs[j].dest_orig_name,
                "to": ship_evs[j].port,
                "to_name": ship_evs[j].port.id,
                "departure": dep_west,
                "arrival": arr,
                "route": rt_2,
                "time_security": "Arrival",
                "ship": i,
                "cargo": ship_evs[j].cargo,
                "crew": ship_evs[j].crew,
                "captain": ship_evs[j].captain
              };
              id_ctr++;
              journeys.push(jo_2);
            }
          } else if((ship_evs[j].dest_orig.id === ship_evs[j-1].port.id && ship_evs[j].port.id === ship_evs[j-1].dest_orig.id) ||
             ((ship_evs[j-1].dest_orig.id === 0 ? ship_evs[j].dest_orig.id !== 0 : ship_evs[j].dest_orig.id === 0) &&
              (ship_evs[j].dest_orig.id === ship_evs[j-1].port.id || ship_evs[j].port.id === ship_evs[j-1].dest_orig.id))) {
            // Direct route between events
            var jo = {
              "id": id_ctr,
              "from": ship_evs[j-1].port,
              "from_name": ship_evs[j-1].port.name,
              "to": ship_evs[j].port,
              "to_name": ship_evs[j].port.name,
              "departure": dep,
              "arrival": arr,
              "route": get_route(ship_evs[j-1].port.id, ship_evs[j].port.id, r),
              "time_security": "Both",
              "ship": i,
              "cargo": ship_evs[j].cargo,
              "crew": ship_evs[j].crew,
              "captain": ship_evs[j].captain
            };
            id_ctr++;
            journeys.push(jo);
          } else if(ship_evs[j].dest_orig.id !== ship_evs[j-1].port.id && ship_evs[j].port.id !== ship_evs[j-1].dest_orig.id && ship_evs[j].dest_orig.id !== ship_evs[j-1].dest_orig.id) {
            // Possibly more than one in between.

            if(ship_evs[j].dest_orig.id === 0 ? ship_evs[j-1].dest_orig.id !== 0 : ship_evs[j-1].dest_orig.id === 0) {
              // One of the two is unknown, assuming single stop.
              var from = ship_evs[j-1].port;
              var to = ship_evs[j].port;
              var via = ship_evs[j].dest_orig.id === 0 ? ship_evs[j-1].dest_orig : ship_evs[j].dest_orig;

              var rt_1 = get_route(from.id, via.id, r);
              var rt_2 = get_route_reversed(to.id, via.id, r);

              if(dep + (rt_1.length+rt_2.length)*3600000/speed > arr) {
                // The previous sighting must have been an in between location instead.
                rt_1 = get_route(from.id, to.id, r);
                var jo = {
                  "id": id_ctr,
                  "from": from,
                  "from_name": ship_evs[j].dest_orig.id === 0 ? ship_evs[j-1].dest_orig_name : ship_evs[j].dest_orig_name,
                  "to": to,
                  "to_name": to.name,
                  "departure": dep,
                  "arrival": arr,
                  "route": rt_1,
                  "time_security": "Arrival",
                  "ship": i,
                  "cargo": ship_evs[j].cargo,
                  "crew": ship_evs[j].crew,
                  "captain": ship_evs[j].captain
                };
                id_ctr++;
                journeys.push(jo);
                if(jo.route === undefined) {
                  console.error("Indirect route not working correctly");
                  console.log(ship_evs[j-1]);
                  console.log(ship_evs[j]);
                }
              } else {
                var arr_via = dep + rt_1.length * 3600000 / speed;
                var dep_via = arr - rt_2.length * 3600000 / speed;

                if(arr_via > dep_via) {
                  let total_length = rt_1.length + rt_2.length;
                  let via_point = rt_1.length/total_length;
                  arr_via = dep + (arr - dep)*via_point - assumed_load_time/2;
                  dep_via = arr_via + assumed_load_time;
                }

                var jo_1 = {
                  "id": id_ctr,
                  "from": from,
                  "from_name": from.name,
                  "to": via,
                  "to_name": ship_evs[j].dest_orig.id === 0 ? ship_evs[j-1].dest_orig_name : ship_evs[j].dest_orig_name,
                  "departure": dep,
                  "arrival": arr_via,
                  "route": rt_1,
                  "time_security": "Departure",
                  "ship": i,
                  "cargo": "NONE",
                  "crew": 0,
                  "captain": "NONE"
                };
                id_ctr++;
                journeys.push(jo_1);
                var jo_2 = {
                  "id": id_ctr,
                  "from": via,
                  "from_name": ship_evs[j].dest_orig.id === 0 ? ship_evs[j-1].dest_orig_name : ship_evs[j].dest_orig_name,
                  "to": to,
                  "to_name": to.name,
                  "departure": dep_via,
                  "arr": arr,
                  "route": rt_2,
                  "time_security": "Arrival",
                  "ship": i,
                  "cargo": ship_evs[j].cargo,
                  "crew": ship_evs[j].crew,
                  "captain": ship_evs[j].captain
                };
                id_ctr++;
                journeys.push(jo_2);
              }
            } else {
              // More than one in between. Making no assumption, and no route between the two dest_origs
              var rt_1 = get_route(ship_evs[j-1].port.id, ship_evs[j-1].dest_orig.id, r);
              var rt_2 = get_route_reversed(ship_evs[j].port.id, ship_evs[j].dest_orig.id, r);

              var arr_1 = dep + rt_1.length * 3600000 / speed;
              var dep_2 = arr - rt_2.length * 3600000 / speed;
              if (dep_2 < arr_1) {
                let via_point = rt_1.length / (rt_1.length+rt_2.length);
                arr_1 = dep + (arr - dep)*via_point - assumed_load_time/2;
                dep_2 = arr_1 + assumed_load_time;
              }
              var jo_1 = {
                "id": id_ctr,
                "from": ship_evs[j-1].port,
                "from_name": ship_evs[j-1].port.name,
                "to": ship_evs[j-1].dest_orig,
                "to_name": ship_evs[j-1].dest_orig_name,
                "departure": dep,
                "arr": arr_1,
                "route": rt_1,
                "time_security": "Departure",
                "ship": i,
                "cargo": "NONE",
                "crew": 0,
                "captain": "NONE"
              };
              id_ctr++;
              journeys.push(jo_1);
              var jo_2 = {
                "id": id_ctr,
                "from": ship_evs[j].dest_orig,
                "from_name": ship_evs[j].dest_orig_name,
                "to": ship_evs[j].port,
                "to_name": ship_evs[j].port.name,
                "departure": dep_2,
                "arrival": arr,
                "route": rt_2,
                "time_security": "Arrival",
                "ship": i,
                "cargo": ship_evs[j].cargo,
                "crew": ship_evs[j].crew,
                "captain": ship_evs[j].captain
              };
              id_ctr++;
              journeys.push(jo_2);
            }
          } else {
            let rt_1, rt_2, total_length, via_point, arr_via, dep_via;
            if(ship_evs[j].dest_orig.id !== ship_evs[j-1].port.id) {
              rt_1 = get_route(ship_evs[j-1].port.id, ship_evs[j].dest_orig.id, r);
              rt_2 = get_route_reversed(ship_evs[j].port.id, ship_evs[j].dest_orig.id, r);
              total_length = rt_1.length + rt_2.length;
              via_point = rt_1.length / total_length;
            } else if(ship_evs[j].port.id !== ship_evs[j-1].dest_orig.id) {
              rt_1 = get_route(ship_evs[j-1].port.id, ship_evs[j-1].dest_orig.id, r);
              rt_2 = get_route_reversed(ship_evs[j].port.id, ship_evs[j-1].dest_orig.id, r);
              total_length = rt_1.length + rt_2.length;
              via_point = rt_1.length / total_length;
            }
            arr_via = dep + rt_1.length * 3600000 / speed;
            dep_via = arr + rt_1.length * 3600000 / speed;

            if(arr_via > dep_via) {
              arr_via = dep + (arr-dep)*via_point - assumed_load_time/2;
              dep_via = arr_via + assumed_load_time;
            }
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
              "ship": i,
              "cargo": "NONE",
              "crew": 0,
              "captain": "NONE"
            };
            id_ctr++;
            var jo_2 = {
              "id": id_ctr,
              "from": ship_evs[j].dest_orig,
              "from_name": ship_evs[j].dest_orig_name,
              "to": ship_evs[j].port,
              "to_name": ship_evs[j].port.name,
              "departure": dep_via,
              "arrival": arr,
              "route": rt_2,
              "time_security": "Arrival",
              "ship": i,
              "cargo": ship_evs[j].cargo,
              "crew": ship_evs[j].crew,
              "captain": ship_evs[j].captain
            };
            id_ctr++;
            journeys.push(jo_1);
            journeys.push(jo_2);
          }
        } else {
          // Preceding event is Arrival
          var dep = new Date(ship_evs[j-1].date).getTime() + assumed_arr_time + assumed_load_time;
          var arr = new Date(ship_evs[j].date).getTime() + assumed_arr_time;
          var from = ship_evs[j-1].port;
          var to = ship_evs[j].port;
          var via = ship_evs[j].dest_orig.id === 0 ? ship_evs[j-1].dest_orig : ship_evs[j].dest_orig;

          if(ship_evs[j].port.id === ship_evs[j-1].port.id) {
            // Return journey, but the preceding departure was not registered. Ignoring previous event
            // and making no assumptions regarding how and when the ship left.
            rt = get_route_reversed(ship_evs[j].port.id, ship_evs[j].dest_orig.id, r);
            let time = rt.length * 3600000 / assumed_avg_ship_speed;
            if(arr - time > dep) {
              dep = arr - time;
            }

            var jo = {
              "id": id_ctr,
              "from": ship_evs[j].dest_orig,
              "from_name": ship_evs[j].dest_orig_name,
              "to": ship_evs[j].port,
              "to_name": ship_evs[j].port.name,
              "departure": dep,
              "arrival": arr,
              "route": rt,
              "time_security": "Arrival",
              "ship": i,
              "cargo": ship_evs[j].cargo,
              "crew": ship_evs[j].crew,
              "captain": ship_evs[j].captain
            };
            id_ctr++;
            journeys.push(jo);
          } else if(ship_evs[j].dest_orig.id === ship_evs[j-1].port.id ||
             ship_evs[j].dest_orig.id === 0 ||
             ship_evs[j].dest_orig.id === ship_evs[j-1].dest_orig.id) {
            // direct journey, or previous entry was intermediate stop
            var rt = get_route(ship_evs[j-1].port.id, ship_evs[j].port.id, r);
            let time = rt.length * 3600000 / assumed_avg_ship_speed;
            if(arr - time > dep) {
              dep = arr - time;
            }
            var jo = {
              "id": id_ctr,
              "from": ship_evs[j-1].port,
              "from_name": ship_evs[j].dest_orig_name,
              "to": ship_evs[j].port,
              "to_name": ship_evs[j].port.name,
              "departure": dep,
              "arrival": arr,
              "route": rt,
              "time_security": "Arrival",
              "ship": i,
              "cargo": ship_evs[j].cargo,
              "crew": ship_evs[j].crew,
              "captain": ship_evs[j].captain
            };
            id_ctr++;
            journeys.push(jo);
          } else if((rt_1.length+rt_2.length)*3600000/(arr-dep) > speed) {
            console.error("FISHY BUSINESS. Double arrival, and Distances and times don't add up");
            console.log(ship_evs[j-1]);
            console.log(ship_evs[j]);
          } else {
            var rt_1 = get_route(from.id, via.id, r);
            var rt_2 = get_route_reversed(to.id, via.id, r);
            // Single stop in between
            let total_length = rt_1.length+rt_2.length;
            let via_point = rt_1.length/total_length;
            var arr_via = dep + (arr-dep)*via_point - assumed_load_time/2;
            var dep_via = arr_via + assumed_load_time;
            var jo_1 = {
              "id": id_ctr,
              "from": from,
              "from_name": from.name,
              "to": via,
              "to_name": ship_evs[j].dest_orig_name,
              "departure": dep,
              "arrival": arr_via,
              "route": rt_1,
              "time_security": "None",
              "ship": i,
              "cargo": "NONE",
              "crew": 0,
              "captain": "NONE"
            };
            id_ctr++;
            journeys.push(jo_1);
            var jo_2 = {
              "id": id_ctr,
              "from": via,
              "from_name":ship_evs[j].dest_orig.name,
              "to": to,
              "to_name": to.name,
              "departure": dep_via,
              "arrival": arr,
              "route": rt_2,
              "time_security": "Arrival",
              "ship": i,
              "cargo": ship_evs[j].cargo,
              "crew": ship_evs[j].crew,
              "captain": ship_evs[j].captain
            };
            id_ctr++;
            journeys.push(jo_2);
          }
        }
      } else {
        // Event is Departure. Ignore unless preceding event was also a departure
        if(ship_evs[j-1].type === "Departure") {
          var dep_1 = new Date(ship_evs[j-1].date).getTime() + assumed_dep_time;
          var dep_2 = new Date(ship_evs[j].date).getTime() + assumed_dep_time;

          var rt = get_route(ship_evs[j-1].port.id, ship_evs[j-1].dest_orig.id, r);

          var arr = dep_1 + rt.length*3600000/speed;
          if(arr > dep_2) {
            arr = dep_2 - assumed_load_time;
          }

          var jo = {
            "id": id_ctr,
            "from": ship_evs[j-1].port,
            "from_name": ship_evs[j-1].port.name,
            "to": ship_evs[j-1].dest_orig,
            "to_name": ship_evs[j-1].dest_orig_name,
            "departure": dep_1,
            "arrival": arr,
            "route": rt,
            "time_security": "Departure",
            "ship": i,
            "cargo": "NONE",
            "crew": 0,
            "captain": "NONE"
          };
          id_ctr++;
          journeys.push(jo);
        }
      }
    }
    let last_ev = ship_evs[ship_evs.length - 1];
    if(last_ev.type === "Departure") {
      var dep = new Date(last_ev.date).getTime() + assumed_dep_time;
      var rt = get_route(last_ev.port.id, last_ev.dest_orig.id, r);
      var jo = {
        "id": id_ctr,
        "from": last_ev.port,
        "from_name": last_ev.port.name,
        "to": last_ev.dest_orig,
        "to_name": last_ev.dest_orig_name,
        "departure": dep,
        "arrival": dep + rt.length * 3600000 / assumed_avg_ship_speed,
        "route": rt,
        "time_security": "Departure",
        "ship": i,
        "cargo": "NONE",
        "crew": 0,
        "captain": "NONE"
      };
      id_ctr++;
      journeys.push(jo);
    }
  }

  for(let i = 0; i < journeys.length; i++) {
    if(journeys[i].route === undefined) {
      console.error(journeys[i]);
    }
  }

  return journeys;
}

// Update this to change based on journeys, rather than events.
function update_ship_info(journeys, ships) {
  for(var i = 0; i < journeys.length; i++) {
    let jo = journeys[i]
    var sh = ships.filter(function(v) {
      return jo.ship === v.id;
    })[0];

    if(sh) {
      if(sh.captain !== jo.captain && jo.captain !== "NONE") {
        sh.captain = jo.captain;
        sh.captain_obs = jo.arrival;
      }
      if(sh.crew !== jo.crew && jo.crew !== 0) {
        sh.crew = jo.crew;
        sh.crew_obs = jo.arrival;
      }
      if(sh.cargo !== jo.cargo && jo.cargo !== "NONE") {
        sh.cargo = jo.cargo;
        sh.cargo_obs = jo.arrival;
      }
    }
  }
}

// Used to avoid constantly using up system resources
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function animate_events(data) {
  var previous_frame_time = Date.now();
  var previous_date = current_date.getDate();
  var journeys = [];
  journeys = createJourneysAlt(data);
  console.log(journeys);

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
    drawEvents(this_day_events, data.ships);
    update_ship_info(ongoing_journeys, data.ships);

    journeys_previous_frame = ongoing_journeys;
    await sleep(40); // Sleep to avoid wasting the cpu for no reason.

    if(current_date.getTime() >= end_date.getTime()) {
      current_date.setTime(start_date.getTime());
      last_checked_journeys = start_date.getTime()-six_months;
    }
  }
}
