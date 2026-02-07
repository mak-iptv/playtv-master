$(function() {
    // Parametrat tuaj për ndërtimin e URL-ve
    var u = "00:1B:79:3F:21:AC"; // username/MAC
    var p = "123456";            // password/key

    // Skedari me listën e kanaleve
    var playlistFile = "play.m3u"; // ose JSON me stream_id + title

    // Parsimi i M3U në objekt tracks
    function parseM3U(data) {
        var playlist = { tracks: [] };
        var lines = data.split("\n");
        for (var i = 0; i < lines.length; i++) {
            if (lines[i].startsWith("#EXTINF")) {
                var title = lines[i].split(",")[1] || "Channel " + i;
                var file = lines[i + 1] || "";
                // Marrim stream_id nga file ose nga ndonjë metadata
                var stream_id = file.replace(/\D/g, "") || (1000 + i); 
                playlist.tracks.push({ title: title, stream_id: stream_id });
            }
        }
        return playlist;
    }

    // Luaj kanal me HLS.js
    function playChannel(url, playerSelector) {
        var video = document.querySelector(playerSelector);
        if (Hls.isSupported()) {
            var hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, function() { video.play(); });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
            video.addEventListener('loadedmetadata', function() { video.play(); });
        }
    }

    // Marrim skedarin e playlist
    $.get(playlistFile, function(data) {
        var parsed = parseM3U(data);
        var output = "";
        $("#channelList").html(output);

        // Kur klikojmë kanal, e luajmë
        $("#channelList a").click(function(e) {
            e.preventDefault();
            var url = $(this).data("url");
            playChannel(url, "#player");

        parsed.tracks.forEach(function(c, index) {
            // Ndërto URL dinamik për çdo kanal
            var streamURL = "/live/" + u + "/" + p + "/" + c.stream_id + ".m3u8";
            output += "<li><a href='#' data-url='" + streamURL + "'>" + c.title + "</a></li>";
        });

        });

        // Luaj automatikisht kanalin e parë
        $("#channelList a").first().click();
    }).fail(function() {
        console.error("Nuk mund të merret playlist.m3u");
    });
});
