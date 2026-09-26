/**
 * lampa-noads — плагин для Lampa, отключающий рекламу (pre-roll и баннер).
 *
 * Принцип: плагин выполняется внутри приложения РАНЬШЕ, чем стартует модуль
 * рекламы (Plugins.load -> showApp -> AdManager.init). Он перехватывает запросы
 * к рекламным точкам, поэтому не зависит ни от DNS, ни от VPN.
 *
 * Блокируется:
 *   - /api/ad/get/...        — список рекламы с сервера CUB (сам ролик)
 *   - ctv.house              — хост VAST-тега
 *   - betweendigital.com     — рекламная сеть
 *
 * Совместимость: специально написан на ES5 (var/function), чтобы работал
 * на старых движках ТВ.
 */
(function () {
    'use strict';

    var AD_MATCH = /(^|[.\/])ctv\.house|betweendigital\.com|\/api\/ad\/get\//i;

    function isAd(url) {
        try {
            return AD_MATCH.test(String(url === null || url === undefined ? '' : url));
        } catch (e) {
            return false;
        }
    }

    /* 1. XMLHttpRequest — им пользуется VastManager (список рекламы) и VAST-плеер */
    try {
        var _open = XMLHttpRequest.prototype.open;
        var _send = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (method, url) {
            if (isAd(url)) {
                this.__lampaAdBlock = true;
            }
            return _open.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function () {
            if (this.__lampaAdBlock) {
                try { this.abort(); } catch (e) {}
                return;
            }
            return _send.apply(this, arguments);
        };
    } catch (e) {
        console.warn('[lampa-noads] XHR hook failed', e);
    }

    /* 2. fetch — на случай, если реклама грузится через него */
    try {
        if (window.fetch) {
            var _fetch = window.fetch;
            window.fetch = function (input) {
                var url = (typeof input === 'string') ? input : (input && input.url) || '';
                if (isAd(url)) {
                    return Promise.reject(new TypeError('adblock'));
                }
                return _fetch.apply(this, arguments);
            };
        }
    } catch (e) {
        console.warn('[lampa-noads] fetch hook failed', e);
    }

    /* 3. Подстраховка: если плашка «Реклама» всё же появилась — убрать её */
    function cleanSplash() {
        var nodes = document.getElementsByClassName('ad-preroll');
        while (nodes.length) {
            if (nodes[0].parentNode) {
                nodes[0].parentNode.removeChild(nodes[0]);
            } else {
                break;
            }
        }
    }
    setInterval(cleanSplash, 1500);

    console.log('[lampa-noads] активен');
})();
