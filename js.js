"use strict";

// Watchable object to pass data between angular and vanilla JS
// http://stackoverflow.com/a/15294997/3220865

var map_object = function () {
	var obj = undefined;
	var watchers = {};

	return {
		watch: function (callback) {
			var id;
			do { id = Math.random().toString(); } while ( watchers.hasOwnProperty(id) );
			watchers[id] = callback;

			return function() {
				watches[id] = null;
				delete watches[id];
			};
		},
		set: function (value) {
			var obj = value;
			for (var k in watchers) watchers[ k ]( value );
		}
	};
}();


/* ------------------------------------------------------------------- *|
 * Google Maps Comparator (Nathan Woods: June 16, 2014)
 * docs: https://developers.google.com/maps/documentation/javascript/reference
 * ------------------------------------------------------------------- */

var map;
var markers = [];
var info_wdw = new google.maps.InfoWindow();

function view_points( points ) {
	for (var i = 0, marker; marker = markers[i]; i++) marker.setMap(null);
	markers = [];

	// For each place, get the icon, place name, and location.
	var bounds = new google.maps.LatLngBounds();
	for (var i = 0, place; place = points[i]; i++) {
		var image = {
			url: place.icon,
			size: new google.maps.Size(71, 71),
			anchor: new google.maps.Point(12.5, 12.5),
			scaledSize: new google.maps.Size(25, 25)
		};

		// Create a marker for each place.
		var marker = new google.maps.Marker({
			map: map,
			icon: image,
			title: place.name,
			position: place.loc,
			anchorPoint: new google.maps.Point(0, -15)
		});

		// Add info-widnow for each place
		google.maps.event.addListener(marker, 'click', function (item) {
			info_wdw.setContent(this.title);
			info_wdw.open(map, this);
			map_object.set({
				icon: this.icon.url,
				name: this.title,
				loc: {
					lat: this.position.lat(),
					lng: this.position.lng()
				}//this.position.toString(),
				// loc: this.position,
			});
		});

		// Add marker to map and extent bounds
		markers.push(marker);
		bounds.extend(new google.maps.LatLng(place.loc.lat, place.loc.lng));
		if (points.length == 1) map_object.set({
			icon: place.icon,
			name: place.name,
			loc: place.loc,
		});
	}

	if (document.getElementById('zoom-to').checked) map.fitBounds(bounds);
}

function initialize() {
	// Preliminary map
	map = new google.maps.Map(document.getElementById('map-canvas'));

	// Fix map for USA
	var default_bounds = new google.maps.LatLngBounds(
		new google.maps.LatLng(49.38, 25.82),
		new google.maps.LatLng(-124.38999999999999, -66.94)
	);
	var geocoder = new google.maps.Geocoder();
	geocoder.geocode( { 'address': 'USA'}, function (results, status) {
		if (status == google.maps.GeocoderStatus.OK) {
			default_bounds = results[0].geometry.viewport;
			map.setCenter(results[0].geometry.location);
			map.fitBounds(default_bounds);
		}
	});

	// Create the search box
	var input = document.getElementById('pac-input');
	map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);
	var searchBox = new google.maps.places.SearchBox( input );

	// Listen for the event fired when the user selects an item from the pick list. Retrieve the matching places for that item.
	google.maps.event.addListener(searchBox, 'places_changed', function() {
		var places = searchBox.getPlaces(), cleaned = [];
		for (var i = 0, place; place = places[i]; i++) {
			cleaned.push({
				icon: place.icon,
				name: place.name,
				loc: {
					lat: place.geometry.location.lat(),
					lng: place.geometry.location.lng()
				},
			});
		}
		view_points( cleaned );
	});

	// Bias the SearchBox results towards places that are within the bounds of the current map's viewport.
	google.maps.event.addListener(map, 'bounds_changed', function() {
		searchBox.setBounds( map.getBounds() );
	});

	// Create USA Button
	var home = document.getElementById('home');
	map.controls[google.maps.ControlPosition.TOP_RIGHT].push(home);
	google.maps.event.addDomListener(home, 'click', function () {
		map.fitBounds(default_bounds);
	});

	// Add zoom options to map
	var options = document.getElementById('options');
	map.controls[google.maps.ControlPosition.TOP_LEFT].push(options);

	// close dialog on reset of map_object
	map_object.watch(function (value) {
		if (!value) info_wdw.close();
	});
}

google.maps.event.addDomListener(window, 'load', initialize);



/* ------------------------------------------------------------------- *|
 * angular page accents
 * docs:  https://docs.angularjs.org/api/
 * ------------------------------------------------------------------- */

angular.module('compare', []).

factory('storage', function () {
	var storage_key = 'compare-map', default_val = '[{"name":"Nathan","list":[],"open":true},{"name":"Paige","list":[],"open":true}]';
	return {
		get: function () {
			var value = localStorage.getItem( storage_key );
			return angular.fromJson( value ? value : default_val );
		},
		set: function (value) {
			localStorage.setItem( storage_key, value ? angular.toJson(value) : default_val );
		}
	}
}).

controller('compare', ['$scope', 'storage', function ($scope, storage) {
	$scope.lists = storage.get();

	// Modify functions
	$scope.add = function (list) {
		list.list.push($scope.map_obj);
		map_object.set(undefined);
		storage.set( $scope.lists );
	};
	$scope.rem = function (list, item) {
		var idx = list.list.indexOf(item);
		list.list.splice(idx, 1);
		storage.set( $scope.lists );
	};

	// View functions
	$scope.view = function () {
		var list = [];
		for (var i = 0; i < $scope.lists.length; i++) {
			list = list.concat($scope.lists[i].list);
		};
		view_points( list );
	};
	$scope.view_self = function (list) {
		view_points( list.list );
	};

	// Watch window object
	var destroy = map_object.watch(function (value) {
		$scope.map_obj = value;
		if (!$scope.$$phase) $scope.$digest();
	});
	$scope.$on('$destroy', destroy);
}]);
