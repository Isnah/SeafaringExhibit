$(document).ready(function() {
  $("#ship_dropdown").click(function() {
    $("#shiplist-cont").toggle();
  });

  $("#shipsearch").keyup(function() {
    var filter = $("#shipsearch").val().toUpperCase();
    $("#shiplist").find(".dropdown_item").each(function() {
      var text = $(this).text().toUpperCase();
      text.indexOf(filter) === -1 ? $(this).hide() : $(this).show();
    });
  });
});
