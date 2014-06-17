"use strict";

// Watchable object to pass data between angular and vanilla JS
// http://stackoverflow.com/a/15294997/3220865

var watchable_object = function () {
	var watchers = {};

	this.watch = function ( callback ) {
		var id;
		do { id = Math.random().toString(); } while ( watchers.hasOwnProperty(id) );
		watchers[id] = callback;

		return function () {
			watchers[id] = null;
			delete watchers[id];
		};
	};
	this.set = function ( value ) {
		for (var k in watchers) watchers[ k ]( value );
	};
};

var active_location = new watchable_object();


/* ------------------------------------------------------------------- *|
 * Google Maps Comparator (Nathan Woods: June 16, 2014)
 * docs: https://developers.google.com/maps/documentation/javascript/reference
 * ------------------------------------------------------------------- */

var Map = function ( watch_obj, g_maps ) {
	var map;
	var markers = [];
	var info_wdw = new g_maps.InfoWindow();
	var obj = {
		size: new g_maps.Size(71, 71),
		anchor: new g_maps.Point(12.5, 12.5),
		scaledSize: new g_maps.Size(25, 25),
		anchorPoint: new g_maps.Point(0, -15),
	};

	var to_obj = function (name, url, latlng) {
		return {
			name: name,
			icon: url,
			loc: {
				lat: latlng.lat(),
				lng: latlng.lng(),
			},
		};
	};

	var show_pts = function ( points ) {
		for (var i = 0, marker; marker = markers[i]; i++) marker.setMap(null);
		markers = [];

		// For each place, get the icon, place name, and location.
		var bounds = new g_maps.LatLngBounds();
		for (var i = 0, place; place = points[i]; i++) {
			var image = {
				url: place.icon,
				size: obj.size,
				anchor: obj.anchor,
				scaledSize: obj.scaledSize,
			};

			// Create a marker for each place.
			var marker = new g_maps.Marker({
				map: map,
				icon: image,
				title: place.name,
				position: place.loc,
				anchorPoint: obj.anchorPoint,
			});

			// Add info-widnow for each place
			g_maps.event.addListener(marker, 'click', function (item) {
				info_wdw.setContent(this.title);
				info_wdw.open(map, this);
				watch_obj.set(to_obj( this.title, this.icon.url, this.position ));
			});

			// Add marker to map and extent bounds
			markers.push(marker);
			bounds.extend(new g_maps.LatLng(place.loc.lat, place.loc.lng));
			watch_obj.set( points.length == 1 ? place : undefined );
		}

		if ( document.getElementById('zoom-to').checked ) map.fitBounds(bounds);
	};

	var initialize = function () {

		// Fix map for USA
		map = new g_maps.Map(document.getElementById('map-canvas'));
		var default_bounds = new g_maps.LatLngBounds(
			new g_maps.LatLng(49.38, 25.82),
			new g_maps.LatLng(-124.38999999999999, -66.94)
		);
		var geocoder = new g_maps.Geocoder();
		geocoder.geocode( { 'address': 'USA'}, function (results, status) {
			if (status == g_maps.GeocoderStatus.OK) {
				default_bounds = results[0].geometry.viewport;
				map.setCenter(results[0].geometry.location);
				map.fitBounds(default_bounds);
			}
		});

		// Create the search box
		var input = document.getElementById('pac-input');
		map.controls[g_maps.ControlPosition.TOP_LEFT].push(input);
		var searchBox = new g_maps.places.SearchBox( input );

		// Listen for the event fired when the user selects an item from the pick list. Retrieve the matching places for that item.
		g_maps.event.addListener(searchBox, 'places_changed', function() {
			var places = searchBox.getPlaces(), cleaned = [];
			for (var i = 0, place; place = places[i]; i++) 
				cleaned.push(to_obj( place.name, place.icon, place.geometry.location ));
			show_pts( cleaned );
		});

		// Bias the SearchBox results towards places that are within the bounds of the current map's viewport.
		g_maps.event.addListener(map, 'bounds_changed', function() {
			searchBox.setBounds( map.getBounds() );
		});

		// Create USA Button
		var home = document.getElementById('home');
		map.controls[g_maps.ControlPosition.TOP_RIGHT].push(home);
		g_maps.event.addDomListener(home, 'click', function () {
			map.fitBounds(default_bounds);
		});

		// Add zoom options to map
		var options = document.getElementById('options');
		map.controls[g_maps.ControlPosition.TOP_LEFT].push(options);

		// close dialog on reset of active_location
		watch_obj.watch(function (value) {
			if (!value) info_wdw.close();
		});
	};

	g_maps.event.addDomListener(window, 'load', initialize);

	return {
		show_pts: show_pts,
	};
}( active_location, google.maps );


/* ------------------------------------------------------------------- *|
 * angular page accents
 * docs:  https://docs.angularjs.org/api/
 * ------------------------------------------------------------------- */

angular.module('app', ['ngRoute']).

config(['$routeProvider', function ( $routeProvider ) {
	$routeProvider.
	when('/', {
		templateUrl: '/view.html',
		controller: 'view',
	}).
	when('/edit', {
		templateUrl: '',
		controller: '',
	}).
	when('/edit/:name', {
		templateUrl: '',
		controller: '',
	}).
	otherwise({
		redirectTo: '/',
	});
}]).

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

controller('view', ['$scope', 'storage', function ($scope, storage) {
	$scope.lists = storage.get();

	// Modify functions
	$scope.add = function (list) {
		list.list.push($scope.map_obj);
		active_location.set(undefined);
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
		Map.show_pts( list );
	};
	$scope.view_self = function (list) {
		Map.show_pts( list.list );
	};

	// Watch window object
	var destroy = active_location.watch(function (value) {
		$scope.map_obj = value;
		if (!$scope.$$phase) $scope.$digest();
	});
	$scope.$on('$destroy', destroy);
}]);
