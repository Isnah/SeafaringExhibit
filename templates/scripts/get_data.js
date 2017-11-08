var sorter = function(list, key) {
  list.sort(function(a,b) {
    return (a[key] > b[key]) ? 1 : ((a[key] < b[key]) ? -1 : 0);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

var ready = true;
var ships;
var events;
var ports;
var routes;
var graph;
$(document).ready(function() {
    $.when(
      $.ajax({
        type: "GET",
        url: "/api/ships/",
        success: function(result) {
          ships = JSON.parse(result);
          sorter(ships, "name");
          var i;
          // for(i = 0; i < ships.length; i++) {
          //   var content = "<li class=dropdown_item><a class=listlink href=" + "#todo" + ">" + ships[i].name + "</a></li>";
          //   $("#shiplist").append(content);
          // }
          console.log(ships[55]);
        }
      }),
      $.ajax({
        type: "GET",
        url: "/api/events/",
        success: function(result) {
          events = JSON.parse(result);
          sorter(events, "date");
          console.log(events[25]);
        }
      }),
      $.ajax({
        type: "GET",
        url: "/api/ports/",
        success: function(result) {
          ports = JSON.parse(result);
          sorter(ports, "id");
          console.log(ports);
        }
      }),
      $.ajax({
        type: "GET",
        url: "/api/routes/",
        success: function(result) {
          routes = JSON.parse(result);
          sorter(routes, "id");
          for(let i = 0; i < routes.length; i++) {
            routes[i].coordinates = routes[i].coordinates.replace(/'/g, '"');
            routes[i].coordinates = JSON.parse(routes[i].coordinates);
          }
          console.log(routes[0]);
        }
      }),
      $.ajax({
        type: "GET",
        url: "/api/graph",
        success: function(result) {
          graph = JSON.parse(result);
          console.log(graph[0]);
        }
      })
    ).done(function() {
      var i;
      for(i = 0; i < events.length; i++) {
        var portid = events[i].port;
        var port = ports.filter(function(v) {
          return v.id === portid;
        })[0];

        var destorigid = events[i].dest_orig;
        var deor = ports.filter(function(v) {
          return v.id === destorigid;
        })[0];

        events[i].dest_orig = deor;
        events[i].port = port;
      }
      console.log("Ready");
      console.log(ships[1]);
      console.log(events);
      console.log(events[1]);
      drawEvents([events[1]], ships);
      var data = new DataHandler(ships, events, ports, routes, graph);
      animate_events(data);
    });
});
