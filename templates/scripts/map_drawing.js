var stay_time = 10000; // Time in milliseconds features will stay on the map

var event_icon = L.icon({
  iconUrl: 'templates/icons/marker-icon.png',

  iconSize: [24,24],
  shadowSize: [0,0],
  iconAnchor: [12,23],
  shadowAnchor: [0,0],
  popupAnchor: [0,-24]
});

var shipIcon = L.icon({
  iconUrl: 'templates/icons/ship-icon.png',

  iconSize: [12,12],
  shadowSize: [0,0],
  iconAnchor: [6,6],
  shadowAnchor: [0,0],
  popupAnchor: [0,-7]
});

var routeStyle = {
  "color": "#2F4BA0",
  "weight": 2,
  "opacity": 0.75,
  "dashArray": "5,5"
};

var lineStyle = {
  "color": "#ff7800",
  "weight": 5,
  "opacity": 0.65
}

var southWest = L.latLng(-20.0, 70.0);
var northEast = L.latLng(47.0 ,157.0);
var bounds = L.latLngBounds(southWest, northEast);

var map = L.map('map', {
  center: bounds.getCenter(),
  zoom: 4.5,
  maxBounds: bounds,
  maxBoundsViscosity: 0
});
var eventLayer = L.featureGroup().addTo(map);
var lineLayer = L.featureGroup().addTo(map);
var shipLayer = L.featureGroup().addTo(map);

var ship_markers = [];

var navGraph = [];
var routes = {};

var active_line;

function setNavGraph(gr) {
  navGraph = gr;
}

L.tileLayer.mbTiles('templates/graphics/MarineAsia.mbtiles', {
  minZoom: 5,
  maxZoom: 8
}).addTo(map);

map.on('popupopen', function(e) {
  if(active_line != undefined) {
    lineLayer.removeLayer(active_line);
    active_line = undefined;
  }
  var marker = e.popup._source;
  let ship_marker = ship_markers.filter(function(v) {
    return v.marker === marker;
  })[0];

  if(ship_marker === undefined) {
    return;
  }

  active_line = {
    "type": "Feature",
    "geometry": {
      "type": "LineString",
      "coordinates": ship_marker.rt
    }
  }

  console.log(active_line);

  active_line = L.geoJSON(active_line, {
    "style": routeStyle
  }).addTo(lineLayer);
});

map.on('popupclose', function(e) {
  if(active_line != undefined) {
    lineLayer.removeLayer(active_line);
    active_line = undefined;
  }
})

function onEachFeature(feature, layer) {
  if(feature.properties && feature.properties.popupContent) {
    layer.bindPopup(feature.properties.popupContent);
  }
}

function zoomToMarker(marker) {
  var latLngs = [ marker.getLatLng() ];
  var markerBounds = L.latLngBounds(latLngs);
  map.fitBounds(markerBounds);
  marker.openPopup();
}

function addShipToList(ship_marker, ships) {
  var listItem = '<li class="dropdown_item"><a id="' + ship_marker.id + '">';
  let ship = ships.filter(function(v) {
    return v.id === ship_marker.id;
  })[0];

  console.log(ship);

  if(ship === undefined) {
    return;
  }

  listItem += ship.name + '</a></li>';

  console.log("trying to append to ship list");
  console.log(listItem);

  $("#shiplist").append(listItem);
  $("a#" + ship_marker.id).click(function() {
    zoomToMarker(ship_marker.marker);
  });
}

function removeShipFromList(id) {
  $("a#" + id).parent().remove();
}

function checkShipMarkers() {
  var rem_ships = ship_markers.filter(function(v) {
    return v.last_modified + stay_time <= Date.now();
  });

  for(let i = 0; i < rem_ships.length; i++) {
    let index = ship_markers.indexOf(rem_ships[i]);
    ship_markers.splice(index, 1);
    shipLayer.removeLayer(rem_ships[i].marker);
    removeShipFromList(rem_ships[i].id);
  }
}

function checkFeatures(type) {
  let current_time = Date.now();
  let rem_array = []

  let layer;
  type === "events" ? layer = eventLayer :
  type === "lines"  ? layer = lineLayer  :
                      layer = null;

  if(layer) {
    layer.eachLayer(function(layer) {
      let data = layer._layers[layer._leaflet_id-1];
      if(data.feature.properties.removalTime < current_time) {
        rem_array.push(layer);
      }
    });

    let i;
    for(i = 0; i < rem_array.length; i++) {
      layer.removeLayer(rem_array[i]);
    }
  }
}

function degToRad(deg) {
  return deg * (Math.PI/180);
}

function radToDeg(rad) {
  return 180*rad / Math.PI;
}

function route_to_tuple_list(rt) {
  var list = [];
  for(let i = 0; i < rt.coordinates.length; i++) {
    list.push([rt.coordinates[i].long, rt.coordinates[i].lat]);
  }
  return list;
}

function calc_distance(a,b) {
  let dlon = b.long - a.long;
  let dlat = b.lat - a.lat;
  let rlon = degToRad(dlon);
  let rlat = degToRad(dlat);
  var a = Math.sin(rlat / 2)**2 + Math.cos(degToRad(a.lat))*Math.cos(degToRad(b.lat)) * (Math.sin(rlon / 2)**2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  var km = 6367.0 * c;
  return km;
}

function calcJourneyLoc(journey, time) {
  let dep_time = new Date(journey.departure);
  let arr_time = new Date(journey.arrival);
  let part_of_journey = (time.getTime() - dep_time.getTime()) / (arr_time.getTime() - dep_time.getTime());
  if(part_of_journey > 1.0) {
    part_of_journey = 1.0;
  }
  let dist_traveled = journey.route.length * part_of_journey;

  let loc_1, loc_2;
  let length_calc = 0;

  coords = journey.route.coordinates;
  for(let i = 0; i < coords.length - 1; i++) {
    loc_1 = coords[i];
    loc_2 = coords[i+1];
    let current_dist = calc_distance(loc_1, loc_2);
    if(length_calc + current_dist > dist_traveled) {
      let part_of_segment = (dist_traveled - length_calc) / current_dist;
      let y = loc_2["lat"] - loc_1["lat"];
      let x = loc_2["long"] - loc_1["long"];
      let rads = Math.atan2(y, x);
      var degs = 90 - radToDeg(rads);
      var new_location = {
        "long": loc_1["long"] + (loc_2["long"] - loc_1["long"])*part_of_segment,
        "lat": loc_1["lat"] + (loc_2["lat"] - loc_1["lat"])*part_of_segment,
        "deg": degs
      };
      return new_location;
    }
    length_calc += current_dist;
  }
  console.error("ERROR: Unable to calculate location");
  console.error("Journey: ");
  console.error(journey);
  console.error("Part of journey: ");
  console.error(part_of_journey);
  return {
    "long": 0.0,
    "lat": 0.0,
    "deg": 0.0
  };
}

function drawJourneys(journeys, ships, routes, time) {
  for(let i = 0; i < journeys.length; i++) {
    let jo = journeys[i];
    let ship_filter = function(v) {
      return v.id === jo.ship;
    };

    let marker = ship_markers.filter(ship_filter)[0];
    let new_location = calcJourneyLoc(jo, time);

    if(marker) {
      marker.marker.setLatLng([new_location.lat, new_location.long]);
      marker.marker.setRotationAngle(new_location.deg);
      marker.last_modified = Date.now();
      if(marker.journey_id !== jo.id) {
        console.log("switch");
        console.log(jo);
        console.log("------");
        marker.journey_id = jo.id;
        marker.rt = route_to_tuple_list(jo.route);
        marker.marker.closePopup();
        let popupContent = '<div class="shippopup"><img src="/api/ships/photo/';
        let ship = ships.filter(ship_filter)[0];
        popupContent += ship.name + '" class="shipimg"/><h2>Skip: ';
        var ship_name = ship === undefined ? "Ukjent" : ship.name;
        popupContent += ship_name + "</h2><p>På vei fra " + jo.from_name + " til " + jo.to_name + "</p></div>";
        marker.marker.bindPopup(popupContent);
      }
    } else {
      new_marker = L.marker([new_location.lat, new_location.long], {icon: shipIcon, rotationAngle: new_location.deg, rotationOrigin: "center center"});
      sh_mrk = {
        "id": jo.ship,
        "marker": new_marker,
        "journey_id": jo.id,
        "rt": route_to_tuple_list(jo.route),
        "last_modified": Date.now()
      };
      ship_markers.push(sh_mrk);

      let popupContent = '<div class="shippopup"><img src="/api/ships/photo/';
      let ship = ships.filter(function(v) {
        return v.id === jo.ship;
      })[0];
      popupContent += ship.name + '" class="shipimg"/><h2>Skip: ';
      var ship_name = ship === undefined ? "Ukjent" : ship.name;
      popupContent += ship_name + "</h2><p>På vei fra " + jo.from_name + " til " + jo.to_name + "</p></div>";
      new_marker.bindPopup(popupContent);

      new_marker.addTo(shipLayer);
      addShipToList(sh_mrk, ships);
    }
  }
}

function drawEvents(evs, ships) {
  let i;
  for(i = 0; i < evs.length; i++) {
    let ship = ships.filter(function(v) {
      return v.id === evs[i].shipid;
    })[0];

    let s_name;
    if(ship != undefined) {
      s_name = ship.name;
    } else {
      s_name = "Ukjent";
    }

    let popupstring = evs[i].type + ", dato: " + evs[i].date;
    popupstring += "\nHavn: " + evs[i].port.name;
    popupstring += "\nSkip: " + s_name;
    popupstring += "\n" + (evs[i].type === "Arrival" ? "Fra " : "Til ");
    popupstring += evs[i].dest_orig.name;
    popupstring += "\nKaptein: " + evs[i].captain;

    var feature = {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [evs[i].port.lat, evs[i].port.long]
      },
      "properties": {
        "removalTime": Date.now() + stay_time, // Stay for x milliseconds
        "popupContent": popupstring
      }
    }

    L.geoJSON(feature, {
      pointToLayer: function(feature, latlng) {
        return L.marker(latlng, {icon: event_icon});
      },
      onEachFeature: onEachFeature
    }).addTo(eventLayer);
  }
}

// Used for testing purposes. Draws the lines between the locations related to
// the events in a given list.
function drawEventsLine(evs, ships, routes, graph) {
  let i;
  for(i = 0; i < evs.length; i++) {
    let coordinates = []
    if(evs[i].dest_orig.id !== 1) {
      let portcoord = [evs[i].port.lat, evs[i].port.long];
      let deorcoord = [evs[i].dest_orig.lat, evs[i].dest_orig.long];
      coordinates = [deorcoord, portcoord];
    }

    let path = routes.filter(function(v) {
      return evs[i].port.id + "_" + evs[i].dest_orig.id === v.name;
    });

    if(path.length > 0) {
      path = path[0].coordinates;

      coordinates = [];
      for(let i = 0; i < path.length; i++) {
        coordinates.push([path[i].long, path[i].lat])
      }
    }

    if(evs[i].type === "Arrival") {
      coordinates.reverse();
    }

    console.log(coordinates);

    var feature = {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": coordinates
      },
      "properties": {
        "removalTime": Date.now() + stay_time
      }
    }

    L.geoJSON(feature, {
      "style": lineStyle
    }).addTo(lineLayer);
  }
}
