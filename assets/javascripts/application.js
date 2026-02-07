$(function() {
    console.log('[PlayTV] Initializing player...');

    // 1. PATHS & CONFIGURATION
    // ========================
    // Specifiko saktë rrugën e skedarit M3U. Ky është shembulli më i zakonshëm.
    const M3U_FILE_PATH = 'play.m3u'; // Ose 'playtv.m3u' / 'assets/playlist.m3u'
    const USE_DIRECT_URLS = true; // Ndrysho në 'false' nëse duhet të transformosh URL-të
    const currentHlsPlayer = null; // Për të mbajtur instancën aktuale

    // 2. LOAD AND DISPLAY THE CHANNEL LIST
    // ====================================
    function loadAndDisplayChannels() {
        console.log('[PlayTV] Fetching M3U playlist from:', M3U_FILE_PATH);

        $.get(M3U_FILE_PATH)
            .done(function(m3uContent) {
                console.log('[PlayTV] M3U file loaded successfully.');
                try {
                    // Parse the M3U content. This requires a 'parseM3U' function to exist.
                    const parsedList = parseM3U(m3uContent);
                    if (!parsedList || !parsedList.tracks || parsedList.tracks.length === 0) {
                        throw new Error('Parsed list is empty or invalid.');
                    }
                    console.log(`[PlayTV] Found ${parsedList.tracks.length} channels.`);

                    displayChannels(parsedList.tracks);
                } catch (parseError) {
                    console.error('[PlayTV] Failed to parse M3U file:', parseError);
                    showErrorMessage('Format i pavlefshëm i listës M3U. Kontrollo skedarin.');
                }
            })
            .fail(function(jqXHR) {
                console.error('[PlayTV] Failed to load M3U file:', jqXHR.status, jqXHR.statusText);
                showErrorMessage(`Nuk mund të ngarkohet lista. Gabim: ${jqXHR.status}`);
            });
    }

    // 3. DISPLAY CHANNELS IN THE HTML
    // ================================
    function displayChannels(tracks) {
        let channelsHTML = '';

        tracks.forEach(function(channel, index) {
            // Marr URL-në e transmetimit nga skedari M3U
            let streamUrl = channel.file;

            // Nëse 'USE_DIRECT_URLS' është false, mund të transformosh URL-në këtu
            // shembull: streamUrl = streamUrl.replace('{placeholder}', 'value');

            // Krijo HTML për këtë kanal
            channelsHTML += `
                <div class="channel-card" data-channel-index="${index}">
                    <div class="channel-card__image">
                        ${getChannelEmoji(channel.title)}
                    </div>
                    <div class="channel-card__content">
                        <h3 class="channel-card__title">${channel.title || 'Unknown Channel'}</h3>
                        <span class="channel-card__category">${channel.groupTitle || 'General'}</span>
                        <p class="channel-card__description">${getChannelDescription(channel)}</p>
                        <button class="play-button" onclick="window.playStream('${encodeURIComponent(streamUrl)}', '${channel.title}')">
                            ▶ Shiko Live
                        </button>
                    </div>
                </div>
            `;
        });

        // Vendos kanalet në faqe
        const container = document.querySelector('.channels__list');
        if (container) {
            container.innerHTML = channelsHTML;
            console.log('[PlayTV] Channels displayed.');
        } else {
            console.error('[PlayTV] Could not find .channels__list container in HTML.');
        }
    }

    // 4. PLAY STREAM FUNCTION (Attached to global window object)
    // ==========================================================
    window.playStream = function(streamUrlEncoded, channelName) {
        const streamUrl = decodeURIComponent(streamUrlEncoded);
        console.log(`[PlayTV] Attempting to play: ${channelName}`, streamUrl);

        // Pastro player-in e mëparshëm
        if (window.currentHlsPlayer) {
            window.currentHlsPlayer.destroy();
            window.currentHlsPlayer = null;
        }

        const videoElement = document.getElementById('main-video-player');
        if (!videoElement) {
            console.error('[PlayTV] Video element #main-video-player not found in HTML.');
            alert('Elementi video nuk u gjet. Kontrollo HTML.');
            return;
        }

        // Kontrollo nëse HLS mbështetet nga shfletuesi
        if (Hls.isSupported()) {
            console.log('[PlayTV] HLS.js is supported, initializing...');
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90
            });

            window.currentHlsPlayer = hls;

            // Lidh stream-in me elementin video
            hls.loadSource(streamUrl);
            hls.attachMedia(videoElement);

            // Ngarko dhe luaj
            hls.on(Hls.Events.MANIFEST_PARSED, function() {
                console.log('[PlayTV] Manifest parsed, starting playback.');
                videoElement.play().catch(e => console.warn('Auto-play prevented:', e));
                // Hap dritaren modale (nëse ke një)
                if (typeof $ !== 'undefined' && $('[data-remodal-id=modal]').length) {
                    $('[data-remodal-id=modal]').remodal().open();
                }
            });

            // Menaxho gabimet me shumë detaje
            hls.on(Hls.Events.ERROR, function(event, data) {
                console.error('[PlayTV] HLS Error:', data.type, data.details, data);

                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.error('[PlayTV] Network Error. Attempting to recover...');
                            hls.startLoad(); // Riprovon të ngarkojë
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.error('[PlayTV] Media Error. Attempting to recover...');
                            hls.recoverMediaError();
                            break;
                        default:
                            console.error('[PlayTV] Fatal Error. Cannot recover.');
                            hls.destroy();
                            showStreamError(`Transmetimi i ${channelName} nuk është në dispozicion.`);
                            break;
                    }
                }
            });

        } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
            // Fallback për Safari dhe shfletues të tjerë
            console.log('[PlayTV] Using native HLS support.');
            videoElement.src = streamUrl;
            videoElement.addEventListener('loadedmetadata', function() {
                videoElement.play();
                if (typeof $ !== 'undefined' && $('[data-remodal-id=modal]').length) {
                    $('[data-remodal-id=modal]').remodal().open();
                }
            });
        } else {
            alert('Shfletuesi juaj nuk mbështet këtë lloj transmetimi.');
        }
    };

    // 5. HELPER FUNCTIONS
    // ===================
    function getChannelEmoji(channelName) {
        const name = channelName.toLowerCase();
        if (name.includes('news') || name.includes('lajme')) return '📰';
        if (name.includes('sport')) return '⚽';
        if (name.includes('film') || name.includes('movie')) return '🎬';
        if (name.includes('muzik') || name.includes('music')) return '🎵';
        if (name.includes('kids') || name.includes('femij')) return '🧸';
        return '📺';
    }

    function getChannelDescription(channel) {
        // Mund të përdorësh metadata të tjera nga objekti 'channel' këtu
        return `Shiko ${channel.title} live.`;
    }

    function showErrorMessage(msg) {
        const container = document.querySelector('.channels__list');
        if (container) {
            container.innerHTML = `<div class="error-message"><p>❌ ${msg}</p></div>`;
        }
        alert(msg); // Fallback
    }

    function showStreamError(msg) {
        const modalContent = document.querySelector('.modal__content');
        if (modalContent) {
            modalContent.innerHTML = `<div style="padding: 20px; text-align: center;"><h3>❌ Gabim</h3><p>${msg}</p></div>`;
        }
    }

    // 6. INITIALIZE EVERYTHING WHEN PAGE LOADS
    // ========================================
    loadAndDisplayChannels();

    // (Opsionale) Lidh filtrat dhe kërkimin nëse ekzistojnë
    $('.header__menu-item').on('click', function() {
        const filter = $(this).data('filter');
        $('.header__menu-item').removeClass('active');
        $(this).addClass('active');
        // Logjikë e thjeshtë filtrimi - mund ta ndryshosh
        if (filter === '*') {
            $('.channel-card').show();
        } else {
            $('.channel-card').hide();
            $(`.channel-card__category:contains("${filter}")`).closest('.channel-card').show();
        }
    });

    $('.header__search-input').on('input', function() {
        const query = $(this).val().toLowerCase();
        $('.channel-card').each(function() {
            const title = $(this).find('.channel-card__title').text().toLowerCase();
            $(this).toggle(title.includes(query));
        });
    });
});
