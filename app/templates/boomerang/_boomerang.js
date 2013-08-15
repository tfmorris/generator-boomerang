var boomerang = angular.module('gdgBoomerang', ['ngSanitize','ui.bootstrap'])
    .config(function($routeProvider) {
         $routeProvider.
             when("/about",  {templateUrl:'views/about.html', controller:"AboutControl"}).
             when("/news", {templateUrl:'views/news.html', controller:"NewsControl"}).
             when("/events", {templateUrl:'views/events.html', controller:"EventsControl"}).
             when("/photos", {templateUrl:'views/photos.html', controller:"PhotosControl"}).
             otherwise({ redirectTo: '/about' });
    });

boomerang.factory('Config',function(){
    return {
        //modify these
        'name'          : '<%= chapterName %>',
        'id'            : '<%= chapterID %>',
        'google_api'    : '<%= googleAPIKey %>',
        'pwa_id'        : '<%= picasaWebID %>', //picasa web album id, must belong to google+ id above
	'meetup_url_name' : '<%= meetupURLName %>',
	'meetup_api_key' : '<%= meetupAPIKey %>',
        'cover' : {
            title : 'Cover Title',
            subtitle : 'Cover message. Change this in boomerang.js',
            button : {
                text : 'Call to action',
                url : 'https://developers.google.com/groups/chapter/<%=chapterID%>'
            }
        }
    }
});

boomerang.controller('MainControl', function($scope, Config) {
    $scope.chapter_name = Config.name;
    $scope.google_plus_link = 'https://plus.google.com/' + Config.id;
    $scope.isNavCollapsed = true;
});

boomerang.controller('AboutControl', function( $scope, $http, $location, Config ) {
    $scope.loading = true;
    $scope.$parent.activeTab = "about";
    $scope.cover = Config.cover;
    $http.jsonp('https://www.googleapis.com/plus/v1/people/'+Config.id+'?callback=JSON_CALLBACK&fields=aboutMe%2Ccover%2Cimage%2CplusOneCount&key='+Config.google_api).
        success(function(data){
            $scope.desc = data.aboutMe;
            if(data.cover && data.cover.coverPhoto.url){
                $scope.cover.url = data.cover.coverPhoto.url;
            }
            $scope.loading = false;
        });
});

boomerang.controller("NewsControl", function($scope, $http, $timeout, Config) {
    $scope.loading = true;
    $scope.$parent.activeTab = "news";
    $http.
        jsonp('https://www.googleapis.com/plus/v1/people/' + Config.id + '/activities/public?callback=JSON_CALLBACK&maxResults=10&key=' + Config.google_api).
        success(function(response){
            var entries = [];
            for (var i = 0; i < response.items.length; i++) {
                var item = response.items[i];
                var actor = item.actor || {};
                var object = item.object || {};
                // Normalize tweet to a FriendFeed-like entry.
                var item_title = '<b>' + item.title + '</b>';

                var html = [item_title.replace(new RegExp('\n','g'), '<br />')];
                //html.push(' <b>Read More &raquo;</a>');

                var thumbnails = [];

                var attachments = object.attachments || [];
                for (var j = 0; j < attachments.length; j++) {
                    var attachment = attachments[j];
                    switch (attachment.objectType) {
                        case 'album':
                            break;//needs more work
                            var upper = attachment.thumbnails.length > 7 ? 7 : attachment.thumbnails.length;
                            html.push('<ul class="thumbnails">');
                            for(var k=1; k<upper; k++){
                                html.push('<li class="span2"><img src="' + attachment.thumbnails[k].image.url + '" /></li>');
                            }
                            html.push('</ul>');
                            break;
                        case 'photo':
                            thumbnails.push({
                                url: attachment.image.url,
                                link: attachment.fullImage.url
                            });
                            break;

                        case 'video':
                            thumbnails.push({
                                url: attachment.image.url,
                                link: attachment.url
                            });
                            break;

                        case 'article':
                            html.push('<div class="link-attachment"><a href="' +
                                attachment.url + '">' + attachment.displayName + '</a>');
                            if (attachment.content) {
                                html.push('<br>' + attachment.content + '');
                            }
                            html.push('</div>');
                            break;
                        case 'event':
                            html.push('<b>' + attachment.displayName + '</b>');
                            html.push('<p>' + attachment.content.replace(new RegExp('\n','g'), '<br />') + '</p>');
                            break;
                    }
                }

                html = html.join('');

                var actor_image = actor.image.url;
                actor_image = actor_image.substr(0,actor_image.length-2)+'16';

                var entry = {
                    via: {
                        name: 'Google+',
                        url: item.url
                    },
                    body: html,
                    date: item.updated,
                    reshares: (object.resharers || {}).totalItems,
                    plusones: (object.plusoners || {}).totalItems,
                    comments: (object.replies || {}).totalItems,
                    thumbnails: thumbnails,
                    icon: actor_image
                };

                entries.push(entry);
            }
            $scope.news = entries;
            $timeout(function(){
                gapi.plusone.go();
            });
            $scope.loading = false;
        });

});

boomerang.controller("EventsControl", function( $scope, $http, Config ) {
    $scope.loading = true;
    $scope.$parent.activeTab = "events";

    $scope.events = {past:[] ,future:[]};
    // from https://developers.google.com/events/feed/json?group=Config.id&start=0
    // e.g. https://developers.google.com/events/feed/json?group=104210617698082698436&start=0
    // but no JSONP support, alternate format is RSS
    $http.get("http://gdgfresno.com/gdgfeed.php?id="+Config.id).
        success(function(data){
            var now = new Date();
            for(var i=data.length-1;i>=0;i--){
                var start = new Date(data[i].start);

                data[i].start = start;
                data[i].end = new Date(data[i].end);

                if (start < now){
                    $scope.events.past.push(data[i]);
                } else {
                    $scope.events.future.push(data[i]);
                }
            }
            $scope.loading = false;
        });

});

boomerang.controller("MeetupControl", function( $scope, $http, Config ) {
    $scope.loading = true;
    $scope.$parent.activeTab = "events";

    $scope.events = {past:[] ,future:[]};
    promiseA = $http.get("https://api.meetup.com/2/events?status=past&group_urlname="+Config.meetup_url_name+"key="+Config.meetup_api_key).
        success(function(data){
            for(var i=data.length-1;i>=0;i--){
                var start = new Date(data[i].start);
                data[i].start = start;
                data[i].end = new Date(data[i].end);
                $scope.events.past.push(data[i]);
            }
        });

    promiseB = $http.get("https://api.meetup.com/2/events?status=upcoming&group_urlname="+Config.meetup_url_name+"key="+Config.meetup_api_key).
        success(function(data){
            for(var i=data.length-1;i>=0;i--){
                var start = new Date(data[i].start);
                data[i].start = start;
                data[i].end = new Date(data[i].end);
                $scope.events.future.push(data[i]);
            }
        });

    $q.all([promiseA, promiseB]).then($scope.loading = false);
});

boomerang.controller("PhotosControl", function( $scope, $http, Config ) {
    $scope.loading = true;
    $scope.$parent.activeTab = "photos";
    $scope.photos = [];

    var pwa = 'https://picasaweb.google.com/data/feed/api/user/'+Config.id+'/albumid/'+Config.pwa_id+'?access=public&alt=json-in-script&kind=photo&max-results=20&fields=entry(title,link/@href,summary,content/@src)&v=2.0&callback=JSON_CALLBACK';
    $http.jsonp(pwa).
        success(function(d){
            var p = d.feed.entry;
            for(var x in p){
                var photo = {
                    link : p[x].link[1].href,
                    src : p[x].content.src,
                    alt : p[x].title.$t,
                    title : p[x].summary.$t
                };
                $scope.photos.push(photo);
            }
            $scope.loading = false;
        });
});
