window.PayWithMyBankAccessId = null;

//PayWithMyBank

/*jslint browser: true, regexp: true, unparam: true, white: true */

/*global Math, String, isFinite, isNaN, parseFloat, parseInt, screen, setTimeout, window*/

/*properties
    CHALLENGE, ECHECK, PWMB, PayWithMyBank, accessId, account, accountNumber,
    action, actionButtonLabel, addEventListener, addPanelListener, address,
    address1, address2, alert, allowedPaymentProviderTypes, amount, appendChild,
    apply, attachEvent, authorize, automaticCapture, body, browser, call,
    callback, cancelBubble, cancelUrl, childNodes, city, className, clientHeight,
    clientWidth, clientX, clientY, closeButton, containerId, content,
    contentWindow, country, create, createElement, createElements, currency,
    currentStyle, cursor, customer, customerId, data, description, detachEvent,
    display, doScroll, document, documentElement, dragAndDrop, driverLicense,
    eWise, email, endDate, establish, event, exec, externalId, filter,
    focus, frameElement, frequency, frequencyUnit, frequencyUnitType,
    getAttribute, getElementById, getElementsByTagName, height, indexOf,
    innerHTML, innerHeight, innerWidth, join, left, length, location, margin,
    merchantId, merchantReference, min, mozilla, msie, name, nameOnAccount,
    navigator, number, offsetHeight, offsetLeft, offsetTop, offsetWidth, opacity,
    open, opera, options, outerWidth, payWithMyBank, paymentProviderId,
    paymentType, phone, position, postMessage,
    preventDefault, profile, prototype, push, querySelector, random, readyState,
    recurrence, recurringAmount, removeAttribute, removeChild,
    removeEventListener, removePanelListener, replace, requestSignature, restore,
    returnUrl, returnValue, routingNumber, scrollLeft, scrollTop,
    scrollX, scrollY, set, setAttribute, showBenefits, showInstructions,
    slice, splice, split, src, startDate, state, status,
    stopPropagation, style, submit, substr, target, taxId, test, timeZone,
    toLowerCase, toString, top, transactionId, trim, type, userAgent, value,
    vendor, verification, verify, verifyCustomer, version, webkit, widget, width,
    x, y, zip, zoom
*/

(function (window, undefined) {
    "use strict";

    if (window.PayWithMyBank) {
        return;
    }

    var HISTORY_ENTRIES_ADDED_BY_LIGHTBOX = 2;
    var initialHistoryLength = window.history.length;
    var widgetToken;

    var trustlyOptsObj = window.TrustlyOptions || window.PayWithMyBankOptions || {};

    var userEventTracking = [];

    var config = {
        "ENV_PAYMENT_PANEL_URL" : "https://paywithmybank.com/start",
        "ENV_FRONTEND_PANEL_URL" : "https://paywithmybank.com/frontend",
        "ENV_REACT_WIDGET_URL": "https://paywithmybank.com/widget",
        "accessId": window.PayWithMyBankAccessId,
        "project" : {
            "version" : "1.285.1"
        },
        "ENV_FORCE_BACK_HISTORY" : "false",
        "legacyDomain": "paywithmybank.com",
        "trustlyDomain": "trustly.one"
    };

    try {
        var origin = new URL(document.currentScript.src).origin;
        var requestFromTrustlyDomain = (origin.indexOf(config.trustlyDomain) !== -1);
        if (Boolean(trustlyOptsObj.useTrustlyDomain) && requestFromTrustlyDomain) {
            config.ENV_PAYMENT_PANEL_URL = config.ENV_PAYMENT_PANEL_URL.replace(config.legacyDomain, config.trustlyDomain);
        }
    } catch (ignored) {
    }

    var isTrue = function (value) {
        return !!(value && typeof value.toString === 'function' && value.toString().toLowerCase() === 'true');
    };

    var shouldForceBackHistory = isTrue(config.ENV_FORCE_BACK_HISTORY);

    var iframeUid;
    try {
        iframeUid = trustlyOptsObj && trustlyOptsObj.iframeUid;
        iframeUid = iframeUid.replace(/[^A-Za-z0-9\-\_]+/g,"");
    } catch (ignored) {
    }
    var lightboxFrameId = 'paywithmybank-iframe';
    if (iframeUid) {
      lightboxFrameId += "-" + iframeUid;
    }
    var getLightboxFrame = function () {
        return document.getElementById(lightboxFrameId);
    };

    var timeoutReport = {};

    var widgetFrame = null;

    var attachedEvents = [],
        addEvent = function (elem, type, handler) {
            if (!elem) return;

            if (typeof elem.addEventListener === "function") {
                elem.addEventListener(type, handler, false);
            } else {
                elem.attachEvent("on" + type, handler);
            }

            attachedEvents.push(elem, type, handler);
        },

        removeEvent = function (elem, type, handler) {
            if (!elem) return;

            if (typeof elem.removeEventListener === "function") {
                elem.removeEventListener(type, handler, false);
            } else {
                elem.detachEvent("on" + type, handler);
            }
        },

        appendedElements = [],
        appendChild = function (root, child) {
            if (!root || !child) return;

            var elem = root.appendChild(child);
            appendedElements.push([root, child]);

            return elem;
        };

    var isObject = function (vArg) {
      return Object.prototype.toString.call(vArg) === "[object Object]";
    };

    var isArray = Array.isArray ||
        function (vArg) {
            return Object.prototype.toString.call(vArg) === "[object Array]";
        };

    var StorageUtil = (function() {
        var supported = false;
        var key = 'PayWithMyBank.localStorage';
        try {
            localStorage.setItem(key, key);
            var value = localStorage.getItem(key);
            if (value !== key) {
                return false;
            }
            localStorage.removeItem(key);
            supported = true;
        } catch(ignored) { }

        return {
            isSupported: function () {
                return supported;
            },

            get: function (name, defaultValue) {
                try {
                    var value = localStorage.getItem(name);
                    return (typeof value === "undefined" || value === null) ? defaultValue : value;
                } catch (ignored) {
                    return defaultValue;
                }
            },

            set: function (name, value) {
                try {
                    localStorage.setItem(name, value);
                } catch (ignored) {
                }
                return value;
            },

            remove: function (name) {
                try {
                    localStorage.removeItem(name);
                } catch (ignored) {
                }
            }
        }
    }());

    var FPD = (function () {
        var FPD_KEY = "PayWithMyBank.fpd";
        var NOT_SUPPORTED = "NS";
        var NOT_AVAILABLE = "NA";

        return {
            get: function () {
                if (StorageUtil.isSupported()) {
                    return StorageUtil.get(FPD_KEY, NOT_AVAILABLE);
                } else {
                    return NOT_SUPPORTED;
                }
            },

            set: function (value) {
                var currentValue = FPD.get();
                if (value === currentValue) return;

                StorageUtil.set(FPD_KEY, value);
            }
        }
    })();

    var MetadataUtil = (function() {
        var getFromArray = function (data, name) {
            if (!isArray(data)) return null;
            for (var i = 0; i < data.length; i++) {
                if (data[i].key && data[i].value && data[i].key === name) {
                    return data[i].value;
                }
            }
        };

        var putToArray = function (data, name, value) {
            if (isArray(data)) data.push({'key': name, 'value': value});
        };

        var getFromObject = function (data, name) {
            if (isObject(data)) return data[name];
        };

        var putToObject = function (data, name, value) {
            if (isObject(data)) data[name] = value;
        };

        return {
            put: function (data, name, value) {
                return isArray(data) ? putToArray(data, name, value) : putToObject(data, name, value)
            },

            get: function (data, name) {
                if (data) return isArray(data) ? getFromArray(data, name) : getFromObject(data, name);
            }
        };
    })();

    var isLoggerEnabled = function () {
        return StorageUtil.get("PayWithMyBank.logger", false);
    };

    var logEnabledAlert = false;

    var logMessage = function () {
        try {
            if (!console || typeof console.log !== "function" || !isLoggerEnabled()) return;
            var params = [];
            if (!logEnabledAlert) {
                logEnabledAlert = true;
                params = ["Trustly Logger", "color: #0BE16D; font-weight: bold; font-size: 18px;"];
                if (window.PayWithMyBankWindowName) {
                    params[0] = params[0] + ' [' + window.PayWithMyBankWindowName + ']';
                }
                params[0] = '%c' + params[0] + " - " + config.project.version;
                console.log.apply(this, params);
            }
            params = [].slice.call(arguments);
            if (window.PayWithMyBankWindowName) {
                params.splice(0, 0, '[' + window.PayWithMyBankWindowName + ']');
            }
            params.splice(0, 0, '[Trustly]');
            console.log.apply(this, params);
        } catch (ignored) { }
    };

    var CidManager = (function () {
        var SESSION_CID_KEY = "PayWithMyBank.sessionCid";
        var cached = null;

        var persistAndReturn = function (value) {
            StorageUtil.set(SESSION_CID_KEY, value);
            return value;
        };

        return {
            list: function () {
                return {
                    cid: CidManager.get(),
                    sessionCid: CidManager.getSession()
                }
            },

            get: function () {
              if (cached) {
                return cached;
              }
              var blockSize = 4,
                base = 36,
                discreteValues = Math.pow(base, blockSize),
                pad = function pad(num, size) {
                  var s = "000000000" + num;
                  return s.substr(s.length - size);
                },
                randomBlock = function randomBlock() {
                  return pad(
                    ((Math.random() * discreteValues) << 0).toString(base),
                    blockSize
                  );
                },
                uid = {};

              uid.fingerprint = function browserPrint() {
                var propsLength = function (array) {
                  if (!isArray(array)) return 1;
                  var accumulator = 1;
                  for (var i = 0; i < array.length; i += 1) {
                    try {
                      accumulator += accumulator * (array[i].length || 1);
                    } catch (error) {}
                  }
                  return accumulator;
                };
                var v1 = 0,
                  v2 = 0;
                try {
                  v1 = propsLength([navigator.userAgent, navigator.mimeTypes]);
                  v2 = propsLength([
                    navigator.appVersion,
                    navigator.plugins,
                    navigator.platform,
                    navigator.languages,
                  ]);
                } catch (error) {
                  logMessage("[uid.fingerprint#error]", error, v1, v2);
                }
                return pad(v1.toString(36), 2) + pad(v2.toString(36), 2);
              };

              var fingerprint = uid.fingerprint();
              var random = randomBlock().slice(-4);
              var timestamp = new Date().getTime().toString(36);
              cached = (fingerprint + "-" + random + "-" + timestamp).toUpperCase();

              return cached;
            },

            getSession: function () {
                var currentCid = CidManager.get();
                var sessionCid = StorageUtil.get(SESSION_CID_KEY, null);
                if (!sessionCid) {
                    return persistAndReturn(currentCid);
                }
                try {
                    var now = new Date().getTime();
                    var sessionTs = parseInt(sessionCid.split('-').pop(), 36);
                    var minutes = (now - sessionTs) / 60000;
                    if (minutes < 60) {
                        return sessionCid;
                    } else {
                        return persistAndReturn(currentCid);
                    }
                } catch (error) {
                    logMessage('[CidManager#getSession] error', error);
                    return currentCid;
                }
            }
        }
    })();

    var AccessibilityManager = (function() {
        var changesHistory = {
            additions: [],
            changes: []
        };

        var initialize = function () {
            changesHistory.additions = [];
            changesHistory.changes = [];
        };

        var set = function (element, value) {
            if (!element || typeof element.setAttribute !== 'function') return;
            try {
                element.setAttribute("aria-hidden", value);
            } catch (error) {
                logMessage('[AccessibilityManager#set]', error);
            }
        };

        var remove = function (element) {
            if (!element || typeof element.removeAttribute !== 'function') return;
            try {
                element.removeAttribute("aria-hidden");
            } catch (error) {
                logMessage('[AccessibilityManager#remove]', error);
            }
        };

        var setAriaHidden = function (element, array) {
            array.push(element);
            set(element, "true");
        };

        return {
            apply: function (options) {
                if (!options || typeof options.ariaControl !== "boolean" || !options.ariaControl) return;

                initialize()

                var iframeId = "paywithmybank-lightbox";
                var element = document.body.childNodes[0];

                while (element) {
                    var isNotTrustlyFrame = element.id !== iframeId;
                    var isValidTagName = element.tagName && element.tagName !== "STYLE" && element.tagName !== "SCRIPT";
                    if (isNotTrustlyFrame && isValidTagName) {
                        if (element.ariaHidden === null) {
                            setAriaHidden(element, changesHistory.additions);
                        } else if (element.ariaHidden !== "true") {
                            setAriaHidden(element, changesHistory.changes);
                        }
                    }
                    element = element.nextElementSibling;
                }
            },

            restore: function () {
                while (changesHistory.additions.length) {
                    remove(changesHistory.additions.pop());
                };

                while (changesHistory.changes.length) {
                    set(changesHistory.changes.pop(), "false");
                };
            }
        }
    })();

    var PasswordHintHandler = (function() {
        var postToPanelFn = function() {};

        var viewportExists = Boolean(window.visualViewport);
        var viewport = viewportExists ? window.visualViewport : { height: 0 };

        var visualViewportResizeListener = function() {
            postToPanelFn('PayWithMyBank.pwMngHint.resize|' + viewport.height);
        };

        var mount = function(postFn) {
            postToPanelFn = postFn;
            window.visualViewport.addEventListener("resize", visualViewportResizeListener);
        };

        var unmount = function() {
            window.visualViewport.removeEventListener("resize", visualViewportResizeListener);
        };

        return {
            mount: mount,
            unmount: unmount
        };
    })();

    var userAgent = navigator.userAgent || "";

    var getMinValue = function (array, minAcceptableValue) {
        var certifiedArray = [],
            number,
            i;

        for (i = 0; i < array.length; i += 1) {
            number = parseInt("0" + array[i], 10);
            if ((minAcceptableValue === undefined) || (number >= minAcceptableValue)) {
                certifiedArray.push(number);
            }
        }

        return Math.min.apply(null, certifiedArray);
    };

    var browser = (function () {
        var ua = userAgent.toLowerCase(),
            match = /(chrome)[\/]([\w.]+)/.exec(ua) ||
                    /(webkit)[\/]([\w.]+)/.exec(ua) ||
                    /(opera)(?:.*version)?[\/]([\w.]+)/.exec(ua) ||
                    /(msie) ([\w.]+)/.exec(ua) ||
                    (ua.indexOf("compatible") < 0 && /(mozilla)(?:.*? rv:([\w.]+))?/.exec(ua)) || [],
            mobileUserAgent = ((/android|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(ad|hone|od)|iris|kindle|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm(os)?|phone|p(ixi|re)\/|plucker|pocket|psp|symbian|tablet|treo|up\.(browser|link)|vodafone|wap|webos|windows (ce|phone)|xda|xiino/i.test(userAgent)) ||
                               (/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s)|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp(i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac(|\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt(|\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg(g|\/(k|l|u)|50|54|e\-|e\/|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(di|rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v)|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v)|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-|)|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|xda(\-|2|g)|yas\-|your|zeto|zte\-/i.test(userAgent.substr(0, 4)))),
            deviceWidth = getMinValue([screen.width, window.innerWidth, window.outerWidth], 1), // Take the smallest width greater than 1 to ensure better compatibility
            smallScreenDevice = (deviceWidth < 640),  // Tablets have width >= 640
            iPhone = /i(Phone|Pod)/i.test(userAgent),
            iPad = /iPad/i.test(userAgent),
            iOSChrome = /CriOS/i.test(userAgent), // Chrome for iOS
            iOS8 = /(os 8).*(applewebkit)/i.test(userAgent),
            iOS = /(os ).*(applewebkit)/i.test(userAgent),
            bws = {};

        bws[match[1] || "unknown"] = true;
        bws.version = parseFloat(match[2]) || 0;
        bws.mobileUserAgent = mobileUserAgent;
        bws.iOS = iOS;
        bws.iOSChrome = iOSChrome;
        bws.iOS8Webkit = (iOS8 && bws.webkit);
        bws.iOS8Safari = (bws.iOS8Webkit && !iOSChrome);
        bws.supported = (!bws.msie && !bws.mozilla && !bws.webkit && !bws.chrome) ||
                        (bws.msie    && bws.version >= 8) ||
                        (bws.mozilla && bws.version >= 1.9) ||
                        (bws.webkit  && bws.version >= 534) || //safari
                        (bws.chrome  && bws.version >= 4) ||
                        (iPhone      && bws.version >= 533.17) ||
                        (iPad        && bws.version >= 531.21);
        bws.mobile = (iPhone && !iPad) || (mobileUserAgent && smallScreenDevice);
        bws.platform = (navigator.platform || "").split(" ")[0].replace(/\W+/g, "").toLowerCase();
        var isAndroid = ua.indexOf("android") > -1;
        if (isAndroid) {
            bws.platform = "android";
        }
        bws.desktop = !bws.mobile;
        return bws;
    }());

    var StylesManager = (function () {
        var getComputed = function (el) {
            if (window.getComputedStyle) {
                return window.getComputedStyle(el);
            } else {
                return el.currentStyle;
            }
        };

        var set = function (el, value) {
            if (!el) return;
            el.setAttribute("data-p11k-style",el.style.cssText);
            el.style.cssText += " " + value;
        };

        var restore = function (el) {
            if (!el) return;

            if (el.hasAttribute("data-p11k-style")){
                el.style.cssText = el.getAttribute("data-p11k-style");
                el.removeAttribute("data-p11k-style");
            }
        };

        var clear = function (el) {
            if (!el) return;
            try {
             el.style = "";
             return;
            } catch (ignored) {}

            if (typeof el.setAttribute === "function") {
                el.setAttribute("style", "");
            }
        };

        return {
            getComputed: getComputed,
            restore: restore,
            clear: clear,
            set: set
        };
    })();

    var CssManager = (function () {
        /* create style tag */
        var styleTag = document.createElement("style");
        styleTag.setAttribute("type", "text/css");
        styleTag.setAttribute("id", "paywithmybank-styles");

        var addStyleRule = function(rule) {
            if (styleTag.sheet && styleTag.sheet.insertRule) {
                styleTag.sheet.insertRule(rule, 0);
                return;
            }

            // Old browsers
            var sheet = (styleTag.styleSheet || styleTag.sheet);
            if(!(sheet||{}).addRule || rule.indexOf("@media") > -1) return;

            var parts = rule.split("{"),
                selectors = parts.shift(),
                rules = parts.join(""),
                lastChar = rules.lastIndexOf("}"),
                selector;

            if (lastChar > 0) {
                rules = rules.substring(1, lastChar);
            }

            selectors = selectors.split(",");
            for (var i = 0; i < selectors.length; i++) {
                selector = selectors[i];
                sheet.addRule(selector, rules);
            }
        };

        var addClass = function (el, className) {
            if (hasClass(el, className)) {
                return;
            }

            if (el.classList) {
                el.classList.add(className);
            } else {
                el.className += " " + className;
            }
        };

        var removeClass = function (el, className) {
            if (hasClass(el, className)) {
                return;
            }

            if (el.classList) {
                el.classList.remove(className);
            } else {
                el.className.replace(className, "");
            }
        };

        var hasClass = function (element, className) {
            var el = typeof element === "object" ? element : $(element);
            var wrappedClassName = " " + className + " ";
            if (el && el.className && (" " + el.className + " ").replace(/[\n\t]/g, " ").indexOf(wrappedClassName) > -1) {
                return true;
            }
            return false;
        };

        var initialize = function () {
            var styles = document.getElementById("paywithmybank-styles");
            if (styles) return;

            var head = document.getElementsByTagName("head")[0];
            appendChild(head, styleTag);

            var RULES = [];

            if (browser.iOS) {
                RULES.push(
                    ".paywithmybank-mobile #paywithmybank-outer-panel { box-sizing: border-box!important; min-height: 100%!important; height:100%!important;}",
                    ".paywithmybank-mobile #paywithmybank-panel { border: 0 solid blue!important; box-sizing: border-box!important; min-height: 100%!important; height:100%!important;}",
                    ".paywithmybank-mobile iframe { border: 0 solid yellow; box-sizing: border-box!important; min-height: 100%; height:100%;}",
                    ".paywithmybank-mobile { border: 0 solid red; box-sizing: border-box; min-height: 100%!important; height:100%!important;}"
                );
            }

            RULES.push(
                    //Removing border
                    ".paywithmybank-panel { border: 0px solid white!important; overflow: hidden}",

                    //Common
                    "#paywithmybank-panel { position: relative; }",
                    "#paywithmybank-loading-spinner { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 2147483648; }",
                    ".loading-container{display:flex;-ms-flex-align:center;align-items:center;-ms-flex-pack:center;justify-content:center;-ms-flex-direction:column;flex-direction:column;height:100%;width:100%;}",
                    ".loading-dots { color: #fff; width: 60px; height: 10px; margin: 0 auto; }",
                    "#paywithmybank-loading-spinner.paywithmybank-widget-spinner .loading-dots { color: #6b6b6b; }",
                    "#paywithmybank-lightbox.paywithmybank-mobile .loading-dots { color: rgb(119, 119, 119) }",
                    ".loading-dots * { -webkit-box-sizing: border-box; -moz-box-sizing: border-box; box-sizing: border-box; }",
                    ".loading-dot{width:10px;height:10px;border-width:5px;border-style:solid;border-color:inherit;border-radius:50%;float:left;margin:0 5px;transform:scale(1); -webkit-transform:scale(0);transform:scale(0);-webkit-animation:dot-fx 1000ms ease infinite 0ms;animation:dot-fx 1000ms ease infinite 0ms;}",
                    ".loading-dot:nth-child(2){transform:scale(0.618);-webkit-animation:dot-fx 1000ms ease infinite 300ms;animation:dot-fx 1000ms ease infinite 300ms;}",
                    ".loading-dot:nth-child(3){transform:scale(0.382);-webkit-animation:dot-fx 1000ms ease infinite 600ms;animation:dot-fx 1000ms ease infinite 600ms;}",
                    "@keyframes paywithmybank-zoom-in { from { opacity: 0; transform: scale3d(0.3, 0.3, 0.3); -webkit-transform: scale3d(0.3, 0.3, 0.3); } 50% { opacity: 1; } }",
                    "@keyframes dot-fx{50%{-webkit-transform:scale(1);transform:scale(1);opacity:1;}100%{opacity:0;}}",
                    ".paywithmybank-lightbox { -webkit-box-sizing: border-box; -moz-box-sizing: border-box; box-sizing: border-box; }",
                    ".paywithmybank-lightbox { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 2147483647;}",
                    ".pwmb-loading-connection-message { text-align: center; width: 100%; left: 0; top: 100px; opacity: 0; position:absolute; transition: 0.4s all; } ",
                    ".pwmb-loading-connection-message.show { opacity: 1; top: 170px; } ",
                    ".pwmb-loading-connection-message p { margin: 10px 0; font-size: 14px; color: #fff; display: block; } ",
                    ".pwmb-loading-connection-message button { border: 1px solid #fff; color: #fff; font-size: 13px; border-radius: 4px; padding: 12px 32px;background: transparent; margin: 25px auto 0; cursor: pointer; transition: .3s all; display: none; } ",
                    ".pwmb-loading-connection-message button:hover { color: #fff; background: #9e9e9e; } ",
                    "#paywithmybank-lightbox.paywithmybank-mobile .pwmb-loading-connection-message { top: 40%; }",
                    "#paywithmybank-lightbox.paywithmybank-mobile .pwmb-loading-connection-message.show { top: 55%; }",
                    "#paywithmybank-lightbox.paywithmybank-mobile .pwmb-loading-connection-message p { color: rgb(119, 119, 119) }",
                    "#paywithmybank-lightbox.paywithmybank-mobile .pwmb-loading-connection-message button  { border-color: rgb(119, 119, 119); color: rgb(119, 119, 119) }",

                    //LightBox
                    ".paywithmybank-mask { position: fixed; top: 0; left: 0; width: 100%; height: 10000px; background-color: rgba(0,0,0,0.7); filter: alpha(opacity=70); z-index: 9001; display: block; }",
                    "#paywithmybank-lightbox.paywithmybank-mobile { right: 0; bottom: 0; left: 0; top: 0; -webkit-overflow-scrolling: touch; overflow-y: hidden; width: 100%; height: 100%; }",
                    "#paywithmybank-lightbox.paywithmybank-mobile iframe { height: 100%; }",
                    ".paywithmybank-desktop .paywithmybank-outer-panel { position: relative; top: 50%; left: 50%; width: 1px; height: 1px; }",
                    ".paywithmybank-mobile #paywithmybank-outer-panel { height: 100%; }",
                    "#paywithmybank-lightbox.paywithmybank-assetsLoaded.paywithmybank-mobile .paywithmybank-mask { display: none; }",
                    "#paywithmybank-lightbox.paywithmybank-assetsLoaded iframe { display: block; background-color: #fff }",
                    ".paywithmybank-desktop .paywithmybank-panel { box-sizing: content-box!important; position: relative; top: -150px; left: -150px; background-color: transparent; border: transparent 6px solid; border-color: transparent !important; -moz-border-radius: 6px; -webkit-border-radius: 6px; border-radius: 6px; display: block; height: 300px; z-index: 9002; width: 300px; }",
                    ".paywithmybank-desktop .paywithmybank-panel.paywithmybank-animated { -webkit-animation-name: paywithmybank-zoom-in; animation-name: paywithmybank-zoom-in; -webkit-animation-duration: 0.225s; animation-duration: 0.225s; -webkit-animation-fill-mode: both; animation-fill-mode: both; -webkit-animation-iteration-count: 1; animation-iteration-count: 1; transition-timing-function: ease; }",
                    ".paywithmybank-mobile #paywithmybank-panel { height: 100%; }",

                    ".paywithmybank-desktop .paywithmybank-panel.paywithmybank-paymenttype-retrieval { display: block; background-color: transparent; border: none; -moz-border-radius: 6px; -webkit-border-radius: 6px; border-radius: 6px; z-index: 9002; overflow: hidden; }",
                    ".paywithmybank-panel.paywithmybank-paymenttype-retrieval .paywithmybank-panel-header { height: 50px; }",

                    ".paywithmybank-desktop .paywithmybank-panel iframe { display: none; width: 100%; height: 0; }",
                    ".paywithmybank-desktop.paywithmybank-theme-facebook .paywithmybank-panel iframe { width: 100%; height: 100%; }",
                    ".paywithmybank-mobile .paywithmybank-panel iframe { width: 100% !important; height: 100% !important; }",
                    ".paywithmybank-panel .paywithmybank-panel-header { display: block; background-color: #fff; opacity: 0.00; filter: alpha(opacity=0); width: 100%; max-width: 600px; height: 72px; position: absolute; top: 0; z-index: 9003; left: 0; }",
                    ".paywithmybank-panel .paywithmybank-close { display: none; width: 15px; height: 15px; background: transparent url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAPCAQAAACR313BAAAAy0lEQVQY06WOMWoCYRSE3xE8gkfYCwj/LWy3SOUhlkmjImwiNikUsTHBRrQRtjZVYOPeQLGNglgoFpsvhbgbzaZyunnfvGHM7pbKcvKuLk5OpYvxHveiH2RwIMJ3HJdAVG18i0VgZiZfPG+PMPlV1w9Eg6gqX7TWR0iy37OmPfGUivqmAJqZdT6FWMKqAMrTTog3cP/A+PCCGK5vYUmJiA+wqYUnEX38gdMvwDfrVuqpmL3mOBGjLdA++/GDEPNmFiABBnkfDiiaeK0fmzGE1FUEzpYAAAAASUVORK5CYII=) no-repeat center center; position: absolute; top: 0px; right: 0px; padding: 10px; z-index: 9004; cursor: pointer; -webkit-opacity: 0.65; -moz-opacity: 0.65; filter: alpha(opacity=65); opacity: 0.65; }",
                    ".paywithmybank-panel .paywithmybank-close:hover { -webkit-opacity: 1; -moz-opacity: 1; filter: alpha(opacity=100); opacity: 1; }",

                    // Embedded panel
                    ".paywithmybank-embedded iframe { background-color: #ffffff; }",

                    "#paywithmybank-lightbox.paywithmybank-embedded { position: relative; }",
                    "#paywithmybank-lightbox.paywithmybank-embedded iframe { display: block; }",
                    "#paywithmybank-lightbox.paywithmybank-embedded.paywithmybank-mobile { position: relative; }",
                    "#paywithmybank-lightbox.paywithmybank-embedded.paywithmybank-mobile .paywithmybank-mask { display: none; }",
                    ".paywithmybank-embedded.paywithmybank-lightbox .paywithmybank-panel.paywithmybank-paymenttype-retrieval { border-radius: 0; }",
                    ".paywithmybank-embedded.paywithmybank-lightbox .paywithmybank-outer-panel { top: 0 !important; left: 0 !important; }",
                    ".paywithmybank-embedded.paywithmybank-lightbox #paywithmybank-panel.paywithmybank-panel { top: 0; left: 0; }",
                    ".paywithmybank-embedded.paywithmybank-lightbox .paywithmybank-mask { display: none; }",
                    ".paywithmybank-embedded.paywithmybank-lightbox #paywithmybank-panel { position: relative; width: 100% !important; top: auto !important; left: auto !important; box-shadow: none; }",
                    ".paywithmybank-embedded.paywithmybank-lightbox #paywithmybank-panel-header { display: none; }",

                    ".paywithmybank-embedded .paywithmybank-outer-panel { top: 0 !important; left: 0 !important; }",
                    ".paywithmybank-embedded #paywithmybank-panel.paywithmybank-panel { top: 0; left: 0; }",
                    ".paywithmybank-embedded .paywithmybank-mask { display: none; }",
                    ".paywithmybank-embedded #paywithmybank-panel.paywithmybank-panel { position: relative; width: 100% !important; top: auto !important; left: auto !important; box-shadow: none; }",
                    ".paywithmybank-embedded #paywithmybank-panel-header { display: none; }",

                    //Widget
                    ".paywithmybank-widget { overflow: hidden; font-size: 12px; font-family: Arial; position: relative; width: 270px; height: 150px; }",
                    ".paywithmybank-widget * { padding: 0; margin: 0; font-family: Arial; color: #222222; font-size: 12px; }",
                    ".paywithmybank-widget img { float: left; margin-right: 0.5%; width: 220px; box-shadow: none !important; margin: 0 !important; background: none !important; border: none !important; }",
                    ".paywithmybank-widget.paywithmybank-small-logo img { width: 180px; }",
                    ".paywithmybank-widget.paywithmybank-medium-logo img { width: 200px; }",
                    ".paywithmybank-widget.paywithmybank-stacked, .paywithmybank-widget.pwmb-stacked { width: 270px; height: 150px; }",
                    ".paywithmybank-widget.paywithmybank-wide, .paywithmybank-widget.pwmb-wide { width: 500px; height: 100px; }",
                    ".paywithmybank-widget.paywithmybank-wide.paywithmybank-stacked, .paywithmybank-widget.pwmb-wide.pwmb-stacked { width: 440px; height: auto; }",
                    ".paywithmybank-widget.paywithmybank-compact, .paywithmybank-widget.pwmb-compact { height: auto !important; }",
                    ".paywithmybank-widget .paywithmybank-widget-area { position: absolute; cursor: pointer; background-color: white; opacity: 0.00; filter: alpha(opacity=0); }",
                    ".paywithmybank-widget ul.paywithmybank-widget-list-items { float: left; font-size: 100%; list-style-position: outside !important; list-style-type: none !important; margin: 3px 0 10px 5px !important; padding-left: 0 !important; }",
                    ".paywithmybank-widget ul.paywithmybank-widget-list-items li span { position: relative; left: 0; }",
                    ".paywithmybank-widget ul.paywithmybank-widget-list-items li:before { content: '\\2022 ' !important; vertical-align: middle !important; font-size: 100% !important; margin: 0 2px 0 0 !important; }",
                    ".paywithmybank-widget ul.paywithmybank-widget-list-items li { line-height: 130% !important; list-style-position: outside !important; list-style-type: none !important; margin: 0 !important; padding: 0 !important; text-indent:0 !important; }",
                    ".paywithmybank-widget .lock { padding: 5px 8px 0; margin-right: 5px; background: url(" + config.ENV_PAYMENT_PANEL_URL + "/images/lock.png) no-repeat; }",
                    ".paywithmybank-widget .paywithmybank-widget-clear { clear: both; }",
                    ".paywithmybank-widget p.paywithmybank-widget-desc-main { color: #222222 !important; font-size: 100%; text-align: justify; line-height: 130% !important; float: left !important; clear: both; }",
                    ".paywithmybank-widget p.paywithmybank-widget-desc-main span { white-space: nowrap; }",
                    "iframe.pwmb-dynamic-widget { width: 100%; min-width: 210px; min-height: 250px }",

                    ".paywithmybank-learnMoreIframe { display: none; width: 100%; height: 100%; position: fixed; top: 0; left: 0; background: rgba(0, 0, 0, 0.5); overflow: hidden; z-index: -1; }"
            );

            // add rules to the merchant page
            for (var i = 0; i < RULES.length; i++) {
                try {
                    addStyleRule(RULES[i]);
                } catch (exception) {
                    logMessage('[addStyleRule#error]', exception);
                }
            }
        };

        return {
            "initialize": initialize,
            "hasClass": hasClass,
            "addClass": addClass,
            "removeClass": removeClass,
            "addStyleRule": addStyleRule
        };
    }());

    var removeElement = function (element) {
        if (typeof element !== "object" || typeof element.remove !== "function") return;

        try {
            element.remove();
        } catch (ignored) {
            logMessage("[removeElement] Ignored exception:", ignored);
        }
    };

    var getViewportInfo = function() {
        var width, height;

        if (typeof window.innerWidth != 'undefined') {
            width = window.innerWidth,
            height = window.innerHeight
        } else if (typeof document.documentElement != 'undefined' && typeof document.documentElement.clientWidth != 'undefined' && document.documentElement.clientWidth != 0) {
            width = document.documentElement.clientWidth,
            height = document.documentElement.clientHeight
        } else {
            width = document.getElementsByTagName('body')[0].clientWidth,
            height = document.getElementsByTagName('body')[0].clientHeight
        }

        return {
            'width': width,
            'height': height
        }
    };

    var payWithMyBankObj = (function () {
        var document = window.document,
            navigator = window.navigator,
            embedded = false,
            eventWidgetLoaded = false,
            eventBankSelected = false,
            lastPaymentType = "",
            panelSizeProperties,
            selectBankWidgetCallback = null,
            layoutId = 'v4',
            grp = (function () {
                var grpStr = StorageUtil.get("PayWithMyBank.grp", null);
                var grpInt = null;
                try {
                    grpInt = parseInt(grpStr, 10);
                } catch (error) {
                    logMessage("Unable to parse grp", grp, error);
                }
                if (isNaN(grpInt) || typeof grpInt !== "number" || grpInt > 99 || grpInt < 0) {
                    grpInt = Math.floor(Math.random() * 100); // 0-99
                    StorageUtil.set("PayWithMyBank.grp", grpInt);
                }
                return grpInt;
            })(),
            getLastUsed = function (country) {
                var lastUsedData;
                try {
                    lastUsedData = JSON.parse(StorageUtil.get("PayWithMyBank.lastUsed")) || {};
                    lastUsedData = isObject(lastUsedData) ? lastUsedData : {};
                } catch (ignored) {
                    lastUsedData = {}
                }
                return lastUsedData[(country || "").toUpperCase()] || "";
            },
            getIk = function () {
                return StorageUtil.get("PayWithMyBank.ik") || "";
            },
            getCustomOption = function (prop, def) {
                var op = trustlyOptsObj;
                return (op && op[prop] !== undefined) ? op[prop] : def;
            },
            detectDeviceType = function(){
                if (navigator.product === "ReactNative") {
                    return "hybrid";
                } else if (!!window.cordova) {
                    return "cordova";
                }
                return "web";
            },
            options = {
                embedded: getCustomOption("embedded", false),
                closeButton: getCustomOption("closeButton", true),
                hideCloseButton: getCustomOption("hideCloseButton", false),
                ariaControl: getCustomOption("ariaControl", false),
                hideBack: getCustomOption("hideBack", false),
                hideSelectBankBack: getCustomOption("hideSelectBankBack", false),
                deviceType: getCustomOption("deviceType", detectDeviceType()),
                dragAndDrop: getCustomOption("dragAndDrop", true),
                containerId: getCustomOption("containerId", null),
                widgetContainerId: getCustomOption("widgetContainerId", null),
                theme: getCustomOption("theme", null),
                integrationContext: getCustomOption("integrationContext", null),
                customSelectAnotherBankURL: getCustomOption("customSelectAnotherBankURL", null),
                customSelectAnotherBankText: getCustomOption("customSelectAnotherBankText", null),
                customMerchantName: getCustomOption("customMerchantName", null),
                customShortName: getCustomOption("customShortName", null),
                customMerchantLogoUrl: getCustomOption("customMerchantLogoUrl", null),
                customMerchantLogoSize: getCustomOption("customMerchantLogoSize", null),
                URLSchemeRedirect: getCustomOption("URLSchemeRedirect", false),

            },
            isReady = false,
            deviceHeight,
            callOnReady = [],

            unusedParam = function () {
                return undefined;
            },

            isEmbedded = function () {
                return embedded || options.embedded;
            },

            isNumeric = function (obj) {
                var type = typeof obj;

                if (type === "number") {
                    return true;
                }

                if (type !== "string") {
                    return false;
                }

                return (obj - parseFloat(obj) + 1) >= 0;
            },

            ready = function () {
                var i;
                if (!isReady) {
                    isReady = true;
                    if (callOnReady !== null) {
                        for (i = 0; i < callOnReady.length; i += 1) {
                            callOnReady[i].call();
                        }
                        callOnReady = [];
                    }
                }
            },

            $ = function (id) {
                if (typeof id === "function") {
                    if (isReady) {
                        id.call();
                    } else {
                        callOnReady.push(id);
                    }
                    return id;
                }
                return document.getElementById(id);
            },

            CancelUrl = (function() {
                var cancelUrl;

                return {
                    get: function() {
                        return cancelUrl;
                    },

                    set: function(value) {
                        cancelUrl = value;
                    }
                }
            })(),

            B64 = (function () {
                var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

                return {
                    encode: function (input) {
                        var output = "";
                        var chr1, chr2, chr3 = "";
                        var enc1, enc2, enc3, enc4 = "";
                        var i = 0;
                        do {
                            chr1 = input.charCodeAt(i++);
                            chr2 = input.charCodeAt(i++);
                            chr3 = input.charCodeAt(i++);
                            enc1 = chr1 >> 2;
                            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
                            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
                            enc4 = chr3 & 63;
                            if (isNaN(chr2)) {
                                enc3 = enc4 = 64;
                            } else if (isNaN(chr3)) {
                                enc4 = 64;
                            }
                            output = output +
                            keyStr.charAt(enc1) +
                            keyStr.charAt(enc2) +
                            keyStr.charAt(enc3) +
                            keyStr.charAt(enc4);
                            chr1 = chr2 = chr3 = "";
                            enc1 = enc2 = enc3 = enc4 = "";
                        } while (i < input.length);
                        return output;
                    }
                }
            })(),

            B64 = (function () {
                var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

                return {
                    encode: function (input) {
                        var output = "";
                        var chr1, chr2, chr3 = "";
                        var enc1, enc2, enc3, enc4 = "";
                        var i = 0;
                        do {
                            chr1 = input.charCodeAt(i++);
                            chr2 = input.charCodeAt(i++);
                            chr3 = input.charCodeAt(i++);
                            enc1 = chr1 >> 2;
                            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
                            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
                            enc4 = chr3 & 63;
                            if (isNaN(chr2)) {
                                enc3 = enc4 = 64;
                            } else if (isNaN(chr3)) {
                                enc4 = 64;
                            }
                            output = output +
                            keyStr.charAt(enc1) +
                            keyStr.charAt(enc2) +
                            keyStr.charAt(enc3) +
                            keyStr.charAt(enc4);
                            chr1 = chr2 = chr3 = "";
                            enc1 = enc2 = enc3 = enc4 = "";
                        } while (i < input.length);
                        return output;
                    }
                }
            })(),

            LoadingTimeout = (function() {
                var LOADING_TIMEOUT = 20000;
                var initialized;
                var timer;

                var getEl = function() {
                    return document.getElementById("pwmb-connection-message");
                };

                var notifyLoadingTimeout = function(name) {
                    try {
                        var img = $("pwmb-connection-report-" + name);
                        timeoutReport.version = config.project.version;
                        var token = JSON.stringify(timeoutReport);
                        var src = config.ENV_PAYMENT_PANEL_URL + "/timeout/" + encodeURIComponent(cid || "0") + "/" + name + ".png?token=" + B64.encode(token);
                        img.setAttribute("src", src);
                        show(img);
                    } catch (ignored) {}
                };

                var addEventListeners = function() {
                    if (initialized) {
                        return;
                    }
                    initialized = true;

                    var loadingCloseButton = document.getElementById("pwmb-loading-close-button");
                    addEvent(loadingCloseButton, "click", function() {
                        notifyLoadingTimeout("finished");
                        setTimeout(LoadingTimeout.close, 100);
                    });
                };

                var notifyCloseNow = function () {
                    notify("event", {"type": "close", "data" : "cancel", "page": "init"});
                };

                return {
                    start: function() {
                        addEventListeners();

                        timer = setTimeout(function() {
                            var spinner = $("paywithmybank-loading-spinner");
                            var lightbox = $("paywithmybank-lightbox");

                            notifyLoadingTimeout("initiated");

                            if (lightbox.classList.contains("paywithmybank-mobile")) {
                                spinner.style.background = '#fff';
                            }

                            CssManager.addClass(getEl(), "show");
                            
                            $("pwmb-loading-close-button").style.display = 'block';
                        }, LOADING_TIMEOUT);
                    },

                    clear: function() {
                        clearTimeout(timer);
                    },

                    close: function() {
                        getEl().classList.remove("show");
                        LoadingTimeout.clear();
                        notifyCloseNow();
                        closePanel(CancelUrl.get());
                    }
                }
            })(),

            ScrollManager = (function () {
                var scrollRemoved = false;
                var scrollPosition;

                var remove = function () {
                    if (isEmbedded() || scrollRemoved) {
                        return;
                    }

                    scrollPosition = window.scrollY

                    var bodyStyle = "";
                    if(!browser.iOS){
                        bodyStyle += " overflow: hidden !important; overflow-x: hidden !important; overflow-y: hidden !important";

                        if (browser.mobile) {
                            bodyStyle += " width: 100% !important;";
                        }
                    }

                    var documentHeight = Math.max(
                        document.body.scrollHeight, document.documentElement.scrollHeight,
                        document.body.offsetHeight, document.documentElement.offsetHeight,
                        document.body.clientHeight, document.documentElement.clientHeight
                    );

                    if (!browser.mobile && documentHeight > window.innerHeight) {
                        bodyStyle += " width: 100% !important;";
                    }

                    if (browser.mobile) {
                        bodyStyle += " padding: 0 !important; margin: 0 !important;";
                    }

                    StylesManager.set(document.body, bodyStyle);

                    StylesManager.set(document.getElementsByTagName("html")[0], "height: 100% !important;");

                    scrollRemoved = true;
                };

                var restore = function () {
                    if (scrollRemoved) {
                        scrollRemoved = false;
                        StylesManager.restore(document.getElementsByTagName("html")[0]);
                        StylesManager.restore(document.body);

                        if(browser.mobile){
                            window.scrollTo(0, scrollPosition)
                        }
                    }
                };

                return {
                    remove: remove,
                    restore: restore
                };
            })(),

            viewportManager = (function () {
                var originalViewport,
                    originalValues = {},
                    viewportChanged = false,
                    originalViewportContent,
                    head,
                    getViewportMetatag = function () {
                        var viewportMetas = document.querySelectorAll("meta[name=\"viewport\"]");
                        if (viewportMetas && viewportMetas.length > 0) {
                            return viewportMetas[0];
                        }
                        return null;
                    };

                return {
                    exists: function() {
                        var viewport = getViewportMetatag();
                        return (viewport != null);
                    },

                    getContent: function () {
                        var content = "width=device-width, height=device-height, initial-scale=1.0, minimum-scale=1.0, user-scalable=yes";

                        if (browser.mobile) {
                            content = "width="+window.screen.width+", height="+window.screen.width+", initial-scale=1.0, minimum-scale=1.0, user-scalable=yes";
                        }

                        return content;
                    },

                    update: function () {
                        if (!viewportChanged) return;

                        var meta = getViewportMetatag();
                        var content = viewportManager.getContent();
                        meta.setAttribute("content", content);
                    },

                    set: function () {
                        if (isEmbedded() || viewportChanged) {
                            return;
                        }

                        var meta = getViewportMetatag();

                        var content = viewportManager.getContent();

                        if (meta){
                            originalViewportContent = meta.getAttribute("content");
                            meta.setAttribute("content", content);
                        } else {
                            var head = document.getElementsByTagName("head")[0];
                            meta = document.createElement("meta");
                            meta.setAttribute("name", "viewport");
                            meta.setAttribute("id", "paywithmybank-viewport");
                            meta.setAttribute("content", content);
                            appendChild(head, meta);
                        }

                        viewportChanged = true;
                    },

                    restore: function () {
                        if (!viewportChanged) {
                            return;
                        }

                        var meta = getViewportMetatag();

                        if (!meta) {
                            return;
                        }

                        if (originalViewportContent) {
                            meta.setAttribute("content", originalViewportContent);
                        } else {
                            meta.parentNode.removeChild(meta);
                        }

                        viewportChanged = false;
                    }
                };
            }()),

            arr = [],

            coreIndexOf = arr.indexOf || function (elem) {
                var i,
                    len = this.length;
                for (i = 0; i < len; i += 1) {
                    if (this[i] === elem) {
                        return i;
                    }
                }
                return -1;
            },

            arrayIndexOf = function (arr, elem, i) {
                return coreIndexOf.call(arr, elem, i);
            },

            preventDefault = function (e) {
                if (!e) return;
                if (typeof e.preventDefault === "function") {
                    e.preventDefault();
                } else {
                    e.returnValue = false;
                }

                return false;
            },

            setFrameAttr = function (name, value) {
                var frame = getLightboxFrame();
                if (!frame || typeof frame.setAttribute !== "function") return;

                frame.setAttribute(name, value);
            },

            stopPropagation = function (e) {
                if (!e) return;
                if (typeof e.stopPropagation === "function") {
                    e.stopPropagation();
                }
                e.cancelBubble = true;
                return false;
            },

            cursorPosition = function (e) {
                e = e || window.event;
                if (!window.scrollX) {
                    return { "x" : e.clientX + document.documentElement.scrollLeft + document.body.scrollLeft,
                             "y" : e.clientY + document.documentElement.scrollTop    + document.body.scrollTop };
                }

                return { "x" : e.clientX + window.scrollX,
                         "y" : e.clientY + window.scrollY };
            },

            ralpha = /alpha\([^)]*\)/i,
            rnotwhite = /\S/,
            trimLeft = rnotwhite.test("\xA0") ? /^[\s\xA0]+/  : /^\s+/,
            trimRight = rnotwhite.test("\xA0") ? /[\s\xA0]+$/ : /\s+$/,

            trim = String.prototype.trim ?
                    function (text) {
                        return text === null ? "" : String.prototype.trim.call(text);
                    } :
                    function (text) {
                        return text === null ? "" : text.toString().replace(trimLeft, "").replace(trimRight, "");
                    },

            setOpacity = function (elem, value) {
                if (!elem.attachEvent) {
                    elem.style.opacity = value;
                    return elem.style.opacity;
                }

                var style = elem.style,
                    currentStyle = elem.currentStyle,
                    opacity = isNumeric(value) ? "alpha(opacity=" + value * 100 + ")" : "",
                    filter = (currentStyle && currentStyle.filter) || style.filter || "";

                style.zoom = 1;

                if (value >= 1 && trim(filter.replace(ralpha, "")) === "") {

                    if (style.removeAttribute) {
                        style.removeAttribute("filter");
                    }

                    if (currentStyle && !currentStyle.filter) {
                        return;
                    }
                }

                style.filter = ralpha.test(filter) ?
                        filter.replace(ralpha, opacity) :
                        filter + " " + opacity;
            },

            getWindowSize = function () {
                var size = {};
                size.width = size.height = 0;
                if (typeof (window.innerWidth) === "number") {
                    size.width = window.innerWidth;
                    size.height = window.innerHeight;
                } else if (document.documentElement && (document.documentElement.clientWidth || document.documentElement.clientHeight)) {
                    size.width = document.documentElement.clientWidth;
                    size.height = document.documentElement.clientHeight;
                } else if (document.body && (document.body.clientWidth || document.body.clientHeight)) {
                    size.width = document.body.clientWidth;
                    size.height = document.body.clientHeight;
                }
                size.width -= 17;
                return size;
            },

            divLightBox = null,
            iFrameLoaded = false,
            callOnIFrameLoaded = null,

            listeners = [],

            notify = function (command, obj, cb) {
                var list = listeners.slice(0),
                    stopPropagation = false,
                    preventDefault = false,
                    i;

                logMessage("notify", arguments);

                if(obj != null && typeof obj == "object"){
                	obj.preventDefault = function() {
                		preventDefault = true;
                	};
                	obj.stopPropagation = function() {
                		stopPropagation = true;
                	}
                }
                setTimeout(function () {
                    for (i = 0; i < list.length; i += 1) {
                        list[i].apply(null, [command,obj]);
                        if(stopPropagation) {
                        	break;
                        }
                    }

                    if (obj && obj.type === 'new_location' && shouldForceBackHistory && preventDefault) {
                        resetHistoryOnClose();
                    }

                    if(!preventDefault) {
                    	if(cb != null) {
                    		cb();
                    	}
                    }
                }, 0);
            },

            panelWindow = null,

            panelFocus = function () {
                if (panelWindow && typeof(panelWindow.focus) === "function") {
                    panelWindow.focus();
                    return true;
                }

                var iframe = getLightboxFrame();
                if (iframe && iframe.contentWindow && typeof(iframe.contentWindow.focus) === "function") {
                    iframe.contentWindow.focus();
                    return true;
                }

                return false;
            },

            postToPanel = function (msg) {
                if (panelWindow && msg !== "establish") {
                    panelWindow.postMessage(msg, "*");
                } else {
                    getLightboxFrame().contentWindow.postMessage(msg, "*");
                }
            },

            postToWidget = function (msg) {
                var widgetFrameId = "paywithmybank-iframe-" + options.widgetContainerId;
                var widgetIframe = document.getElementById(widgetFrameId);
                if (widgetIframe) {
                    widgetIframe.contentWindow.postMessage(msg, "*");
                }
            },

            postToLearnMore = function (msg) {
                var learnMoreIframe = document.getElementById("paywithmybank-learnMoreIframe");
                if (learnMoreIframe) {
                    learnMoreIframe.contentWindow.postMessage(msg, "*");
                }
            },

            wheel = function (e) {
                preventDefault(e);
                return false;
            },

            show = function (elem) {
                if (!elem) return;
                elem.style.display = "block";
            },

            hide = function (elem) {
                if (!elem) return;
                elem.style.display = "none";
            },

            preventClose = false,

            closed = true,

            hidePanel = function () {
                closed = true;
                viewportManager.restore();
                hide(divLightBox);

                if (!isEmbedded()) {
                    ScrollManager.restore();
                }

                PayWithMyBank.reset();
            },

            getStartUrl = function() {
                // DO NOT REMOVE THE LAST SLASH "/" AFTER THE ENV_PAYMENT_PANEL_URL
                return config.ENV_PAYMENT_PANEL_URL + "/?grp="+grp+"&widgetId=" + widget.getWidgetId() + "&v=" + config.project.version + "&accessId=" + data.accessId;
            },

            paymentProviderId = null,

            safeURL = function(url){
            	return url !== undefined && url != null &&
		                (url.indexOf("https://") == 0 ||
                		url.indexOf("http://") == 0 ||
                		url.indexOf("/") == 0 ||
                		url.indexOf("#") == 0 ||
                		url.indexOf("review") == 0 ||
                		url.indexOf("cancel") == 0 ||
                		url.indexOf("return") == 0 ||
                		url.indexOf("pw") == 0);
            },

            openWindow = function(url){
            	if(safeURL){
            		window.open(url,"_system");
            	}
            },

            closePanel = function (newLocation, fpd, handleHistory) {
                postToWidget("PayWithMyBank.closePanel");
                logMessage("[closePanel]", newLocation);
                if (fpd) {
                    FPD.set(fpd);
                }

                var target = options.redirectTarget;
                if(typeof target == "string" && $(target)) target = $(target);
                if(typeof target == "string") target = window[target];
                if(!target) target = window;
                window.focus();
                if (safeURL(newLocation) || isURLSchemeRedirect()) {

                    notify("event", {"type": "new_location", "data" : newLocation} , function() {
                    	if (target.location) {
                          var isHashCallback = newLocation.charAt(0) === "#";
                          if (isHashCallback && (isTrue(handleHistory) || shouldForceBackHistory)) {
                            resetHistoryOnClose();
                            target.location.replace(newLocation);
                          } else {
                            target.location = newLocation;
                          }
	                    } else {
	                        target.src = newLocation;
	                    }
                    });
                } else {
                    newLocation = null;
                }

                if (!closed) {
                    if (paymentProviderId !== null) {
                        paymentProviderId = null;
                        getLightboxFrame().src = getStartUrl();
                    }
                    if (panelWindow && panelWindow.close) {
                        panelWindow.close();
                    }
                    panelWindow = null;
                    hidePanel();
                    AccessibilityManager.restore();
                    notify("close", newLocation);
                }
            },

            closeTimeout = function () {
                if (!preventClose) {
                    closePanel();
                }
            },

            close = function (e) {
                stopPropagation(e);
                if (browser.supported) {
                    setTimeout(function () { closeTimeout(); }, 1000);
                    postToPanel("closePanel");
                } else {
                    setTimeout(function () { closeTimeout(); }, 0);
                }
            },

            dragStartPos = {},

            drag = function (e) {
                var size = getWindowSize(),
                    node = $("paywithmybank-outer-panel"),
                    curPos = cursorPosition(e),
                    x = curPos.x - dragStartPos.x,
                    y = curPos.y - dragStartPos.y,
                    el, styles, limit;

                if (x < -(3 * node.offsetWidth / 4)) {
                    x = -(3 * node.offsetWidth / 4);
                }
                if (y < 0) {
                    y = 0;
                }
                if (x > (size.width - (node.offsetWidth / 4))) {
                    x = size.width - (node.offsetWidth / 4);
                }
                if (y > (size.height - (node.offsetHeight / 4))) {
                    y = size.height - (node.offsetHeight / 4);
                }

                if (x < dragStartPos.left) { x = dragStartPos.left }
                if (y < dragStartPos.top)  { y = dragStartPos.top }
                if(node) {
                    node.style.position = "absolute";
                    node.style.left = x + "px";
                    node.style.top = y + "px";
                }
            },

            disableDragAndDrop = function () {
                hide($("paywithmybank-panel-header"));
                options.dragAndDrop = false;
            },

            dragend = function () {
                $("paywithmybank-panel-header").style.cursor = "default";
                setOpacity($("paywithmybank-panel"), 1);
                removeEvent(document, "mousemove", drag);
                removeEvent(document, "mouseup", dragend);
            },

            dragstart = function (e) {
                var curPos = cursorPosition(e),
                    styles,
                    panel = $("paywithmybank-panel");

                if (options.dragAndDrop === false) {
                    return false;
                }
                setOpacity(panel, 0.5);
                $("paywithmybank-panel-header").style.cursor = "move";
                addEvent(document, "mousemove", drag);
                addEvent(document, "mouseup", dragend);
                dragStartPos.x = curPos.x - $("paywithmybank-outer-panel").offsetLeft;
                dragStartPos.y = curPos.y - $("paywithmybank-outer-panel").offsetTop;

                try {
                    styles = StylesManager.getComputed(panel);
                    dragStartPos.top  = Math.abs(parseInt(styles.top || 0));
                    dragStartPos.left = Math.abs(parseInt(styles.left || 0));
                } catch (e) {
                    dragStartPos.top  = 0;
                    dragStartPos.left = 0;
                }

                preventDefault(e);
                stopPropagation(e);
            },

            pad = function (num, len) {
                num = String(num).split("");
                while(num.length < len) num.unshift(0);
                return num.join("");
            },

            formatPaymentProviderId = function (id) {
                return pad(parseInt(id, 10), 9);
            },

            changePanelProperty = function (propertyName, value) {
                if (!isNumeric(value)) return;

                var panel = $("paywithmybank-panel");
                if (!panel) return;

                panel.style[propertyName] = value + "px";

                if (propertyName === "height") {
                    var iframe = getLightboxFrame();
                    if (!iframe) return;

                    iframe.style["min-height"] = value + "px";
                }
            },

            changeWidgetProperty = function (propertyName, value) {
                if (!isNumeric(value)) return;

                var widgetRoot = $("paywithmybank-widget-root");
                if (!widgetRoot) return;

                var iframe = widgetRoot.childNodes[0];
                if (!iframe) return;

                iframe.style[propertyName] = value + "px";

                if (propertyName === "height") {
                    iframe.style["min-height"] = value + "px";
                }
            },

            processOnIframeLoadedEvent = function() {
                if (!iFrameLoaded) {
                    iFrameLoaded = true;
                    if (callOnIFrameLoaded !== null) {
                        callOnIFrameLoaded.call();
                    }
                }
            },

            setFocusOnFrame = function() {
                setTimeout(function() {
                    getLightboxFrame().focus();
                }, 1);
            },

            applyPanelSizeProperties = function (argsArray) {
                var properties = argsArray || panelSizeProperties;
                if (!isArray(properties)) {
                    return;
                }

                for (var i=0; i < properties.length; i++) {
                    changePanelProperty.apply(this, properties[i]);
                }

                var outerPanel =  $("paywithmybank-outer-panel");
                if (outerPanel) outerPanel.style.top = "50%";


                if (argsArray) {
                    panelSizeProperties = argsArray;
                }
            },

            showSpinner = function (isVisible) {
                var spinner = $("paywithmybank-loading-spinner");

                isVisible = isVisible === undefined ? true : false;

                if (isVisible) {
                    show(spinner);
                } else {
                    hide(spinner);
                }
            },

            isInvalidOrigin = function(origin) {
                if (!origin) return true;
                var allowedOrigins = [];
                allowedOrigins.push("https://paywithmybank.com");
                allowedOrigins.push("https://cdn1.paywithmybank.com");
                allowedOrigins.push("https://trustly.one");
                allowedOrigins.push("https://cdn1.trustly.one");
                var isTrustedDomain = /https:\/\/(?:(?:\w+\.)+)?(paywithmybank.com|trustly.one)$/;
                return allowedOrigins.indexOf(origin) === -1 && !isTrustedDomain.test(origin);
            },

            isBlockedCommand = function (command) {
              return (command !== "PayWithMyBank.ExternalBrowserIntegration");
            },

            inIframe = function () {
                try {
                    return window.self !== window.top;
                } catch (e) {
                    return true;
                }
            },

            onMessage = function (e) {
                if (!e) return;

                if (typeof e.data !== "string") {
                    return;
                }

                if (window.cordova && typeof window.openOAuth === 'function' && e.data.match(/^oauth::/)) {
                    var oauthMessage = e.data.split("::");
                    if (oauthMessage[1]) {
                        var urlParams = JSON.parse(oauthMessage[1])
                        if(urlParams && urlParams.integrationContext === "InAppBrowser"){
                            postToPanel("PayWithMyBank.externalCallback|InAppBrowser|close");
                        }
                    }
                    return;
                }

                var params = e.data.split("|"),
                    command;

                command = params[0] || "";

                if (isInvalidOrigin(e.origin) && isBlockedCommand(command)) {
                    logMessage('Invalid origin.', e.origin, 'Message:', e);
                    return;
                }

                logMessage('onMessage', params);

                if (command === "PayWithMyBank.closePanel") {
                    var newLocation = params.length > 1 ? params[1] : null;
                    var fpd = params.length > 2 ? params[2] : null;
                    var handleHistory = params.length > 3 ? params[3] : false;

                    closePanel(newLocation, fpd, handleHistory);
                    showSpinner();
                } else if (command === "PayWithMyBank.createTransaction") {
                    var paymentProviderId;
                    var widgetElementId;

                    try {
                        paymentProviderId = params[1];
                    } catch (ignored) {
                        paymentProviderId = null;
                    }

                    try {
                        widgetElementId = params[2];
                    } catch (ignored) {
                        widgetElementId = null;
                    }

                    establishWidgetToPanel(paymentProviderId, widgetElementId);
                } else if (command === "PayWithMyBank.openWindow") {
                	openWindow(params[1]);
                } else if (command === "PayWithMyBank.preventClose") {
                    preventClose = true;
                } else if (command === "PayWithMyBank.resetPaymentProviderId") {
                    paymentProviderId = null;
                } else if (command === "PayWithMyBank.setPaymentProviderId") {
                    paymentProviderId = formatPaymentProviderId(params[1]);
                } else if ((command === "PayWithMyBank.loaded") || (command === "PayWithMyBank.selectBankLoaded")) {
                    processOnIframeLoadedEvent();
                } else if (command === "PayWithMyBank.widgetLoaded") {
                    var fpd = params.length > 1 ? params[1] : null;
                    widgetToken = params.length > 2 ? params[2] : null;

                    if (fpd) {
                        FPD.set(fpd);
                    }

                    eventWidgetLoaded = true;
                    eventBankSelected = false;
                } else if (command === "PayWithMyBank.assetsLoaded") {
                    LoadingTimeout.clear();
                    CssManager.addClass($("paywithmybank-lightbox"), "paywithmybank-assetsLoaded");
                    showSpinner(false);
                    setFocusOnFrame();
                    processOnIframeLoadedEvent();
                } else if (command === "PayWithMyBank.event") {
                    var eventName = params[1];
                    var eventPage = params[2];
                    var eventTransactionId = params[3];
                    var eventMerchantReference = params[4];
                    var eventType = params[5];
                    var eventData = params[6];
                    var eventTransfer = params[7];

                    if (eventType && eventType === "bank_selected") {
                        eventBankSelected = true;
                    }

                    var eventDetails = {};
                    if (eventType) { eventDetails.type = eventType; }
                    if (eventPage) { eventDetails.page = eventPage; }
                    if (eventTransactionId) { eventDetails.transactionId = eventTransactionId; }
                    if (eventMerchantReference) { eventDetails.merchantReference = eventMerchantReference; }
                    if (eventData) { eventDetails.data = eventData; }
                    if (eventTransfer) {
                        try {
                            eventDetails.transfer = JSON.parse(eventTransfer);
                        } catch (error) {
                            logMessage('[event.transfer]', eventTransfer, error);
                            eventDetails.transfer = {};
                        }
                    }

                    notify(eventName, eventDetails);
                } else if (command === "PayWithMyBank.dragAndDrop") {
                    var action = params[1];
                    if (action === "disable") {
                        disableDragAndDrop();
                    }
                } else if (command === "PayWithMyBank.changePanelSize") {
                    var availableHeight, availableWidth, left, newHeight, newWidth, top;

                    try {
                        availableHeight = window.innerHeight - 20;
                        availableWidth = window.innerWidth - 20;
                        left = parseInt(params[4], 10);
                        newHeight = parseInt(params[2], 10);
                        newWidth = parseInt(params[1], 10);
                        top = parseInt(params[3], 10);
                        layoutId = params[5];
                    } catch (error) {
                        logMessage("Invalid changePanelSize params", params, error);
                    }

                    if (newHeight > availableHeight) {
                        newHeight = availableHeight;
                        top = -1 * newHeight / 2;
                    }

                    if (newWidth > availableWidth) {
                        newWidth = availableWidth;
                        left = -1 * newWidth / 2;
                    }

                    if (browser.mobile || !newHeight) {
                        return true;
                    }

                    panelSizeProperties = [
                        ["height", newHeight],
                        ["left", left],
                        ["top", top],
                        ["width", newWidth],
                    ];

                    CssManager.addClass($("paywithmybank-panel"), "paywithmybank-animated");

                    applyPanelSizeProperties(panelSizeProperties);
                    center();

                    setFocusOnFrame();
                } else if (command === "PayWithMyBank.changePanelHeight") {
                    changePanelProperty("height", params[1]);
                    center();
                } else if (command === "PayWithMyBank.changeWidgetHeight") {
                    changeWidgetProperty("height", params[1]);
                } else if (command === "PayWithMyBank.setCloseButtonState") {
                    var state = params[1];
                    switch (state) {
                        case "visible":
                            $("paywithmybank-close").style.display = "block";
                        break;
                        case "hidden":
                            $("paywithmybank-close").style.display = "none";
                        break;
                    }
                } else if (command === "PayWithMyBank.setPanelBorderRadius") {
                    var radius = params[1];
                    try {
                        $("paywithmybank-panel").style.setProperty("border-radius", radius, "important");
                    } catch (ignored) {
                    }
                } else if (command === "PayWithMyBank.setLastUsed") {
                    if (params.length !== 3) return;
                    try {
                        var lastUsedData;
                        try {
                            lastUsedData = JSON.parse(StorageUtil.get("PayWithMyBank.lastUsed"));
                            lastUsedData = isObject(lastUsedData) ? lastUsedData : {};
                        } catch (ignored) {
                            lastUsedData = {}
                        }
                        lastUsedData[params[2]] = params[1];
                        StorageUtil.set("PayWithMyBank.lastUsed", JSON.stringify(lastUsedData));
                    } catch (ignored) {}
                } else if (command === "PayWithMyBank.ik") {
                    if (params.length !== 4) return;
                    StorageUtil.set("PayWithMyBank.ik", params[1] + "|" + params[2] + "|" + params[3]);
                } else if (command === "PayWithMyBank.rik") {
                    StorageUtil.remove("PayWithMyBank.ik");
                }  else if (command === "PayWithMyBank.checkLightboxClosed") {
                    if (shouldForceBackHistory && window.history.length - initialHistoryLength === 1) {
                        window.history.pushState(null, document.title, window.location.href);
                    }
                    postToPanel("PayWithMyBank.checkLightboxClosed|" + closed);
                } else if (command === "PayWithMyBank.setFrameTitle") {
                    setFrameAttr("title", params[1]);
                } else if (command === "PayWithMyBank.closeTimeout") {
                    logMessage("[closeTimeout]");
                    LoadingTimeout.close();
                } else if (command === "PayWithMyBank.boot") {
                    if (params.length < 2) return;
                    var fpd = params[1];
                    if (!fpd) return;
                    FPD.set(fpd);
                } else if (command === "PayWithMyBank.eventTracking") {
                    userEventTracking.push(params[1])
                } else if (command === "PayWithMyBank.showLearnMore") {
                    showLearnMore();
                } else if (command === "PayWithMyBank.createLearnMoreIframe") {
                    if (params.length < 10) return;
                    createLearnMoreIframe(params[1], params[2], params[3], params[4], params[5], params[6], params[7], params[8], params[9], params[10]);
                } else if (command === "PayWithMyBank.hideLearnMore"){
                    hideLearnMore();
                } else if (command === "PayWithMyBank.openApp") {
                    if (params.length < 2) return;

                    var appUrl = params[1];
                    window.open(appUrl, "_blank");
                }
                else if (command === "PayWithMyBank.InAppBrowser") {
                    if (params.length < 4) return;

                    var action = params[1];
                    var url = params[2];
                    var name = params[3];

                    if(window.cordova && typeof window.openOAuth === 'function') {
                        window.openOAuth(url, name);
                        return;
                    }

                    if(window.cordova && window.cordova.InAppBrowser) {
                        var inAppBrowserRef = window.cordova.InAppBrowser.open(url, name);
                        inAppBrowserRef.addEventListener('message', function(event){
                            if (!event.data.message) return;
                            var params = event.data.message.split("|");
                            var command = params[0];
                            var action = params[1];

                            if (command !== "PayWithMyBank.InAppBrowser") {
                                logMessage('Invalid command', action, 'Message:', event);
                                return;
                            }

                            if (action === "close") {
                                postToPanel("PayWithMyBank.externalCallback|InAppBrowser|close");
                                inAppBrowserRef.close();
                            }
                        });
                    }
                }
                else if (command === "PayWithMyBank.ExternalBrowserIntegration") {
                    if (params.length < 2) return;

                    var action = params[1];
                    var url = params[2];
                    var name = params[3];

                    if (action === "open") {
                        if (inIframe()) {
                            window.parent.postMessage("PayWithMyBank.ExternalBrowserIntegration|open|" + url + "|" + name, "*");
                        } else {
                            notify("message", {"type": "PayWithMyBank.OpenExternalBrowser", "url": url, "name": name});
                        }
                    }

                    if (action === "close") {
                        postToPanel("PayWithMyBank.externalCallback|InAppBrowser|close");
                    }
                }
                else if (command === "PayWithMyBank.useVisualViewport") {
                    var action = params[1]

                    if(action === "mount") {
                        PasswordHintHandler.mount(postToPanel);
                    }
                    if(action === "unmount") {
                        PasswordHintHandler.unmount();
                    }
                }
                else if (command === "PayWithMyBank.redirect") {
                    if (params.length < 2) return;

                    var url = params[1];

                    if (safeURL(url)) {

                        if(!!payWithMyBankObj) {
                            payWithMyBankObj.destroy();
                        }
                        window.location.href = url;
                    } else {
                        logMessage("[onMessage] Invalid redirect URL.");
                    }
                }
            },

            createLearnMoreIframe = function(paymentFlowId, isDataProduct, deviceType, deviceCategory, deviceOs, country, lang,merchantId, paymentFlowMerchantId ) {
                var learnMoreIframeElement = document.getElementById("paywithmybank-learnMoreIframe");
                if (!learnMoreIframeElement) {
                    learnMoreIframeElement = document.createElement("iframe");
                    learnMoreIframeElement.setAttribute("id", "paywithmybank-learnMoreIframe");
                    var learnMoreURL = getLearnMoreURL({ paymentFlowId, isDataProduct, deviceType, deviceCategory, deviceOs, country, lang, merchantId, paymentFlowMerchantId });
                    learnMoreIframeElement.setAttribute("src", learnMoreURL);
                    learnMoreIframeElement.setAttribute("class", "paywithmybank-learnMoreIframe");
                    appendChild(document.body, learnMoreIframeElement);
                }
            },
            showLearnMore = function() {
                var learnMoreIframe = document.getElementById("paywithmybank-learnMoreIframe");

                if (learnMoreIframe) {
                    learnMoreIframe.style.zIndex = "3000";
                    show(learnMoreIframe);
                    postToLearnMore('PayWithMyBank.showLearnMore');
                }
            },
            hideLearnMore = function() {
                var learnMoreIframe = document.getElementById("paywithmybank-learnMoreIframe");

                if (learnMoreIframe) {
                    learnMoreIframe.style.zIndex = "-1";
                    hide(learnMoreIframe);
                    var widgetFrameId = "paywithmybank-iframe-" + options.widgetContainerId;
                    var widgetIframe = document.getElementById(widgetFrameId);

                    if (widgetIframe) {
                        widgetIframe.contentWindow.postMessage("PayWithMyBank.focusLearnMore", "*");
                    }
                }
            },
            changeDesktopLightboxSizeOnResize = function() {
                var defaultWidth = 355,
                defaultHeight = 620,
                
                // window.outerHeight gives inconsistent values when resizing to fullscreen using Option key + green button
                // or by double-clicking the title bar on macOS. Using only screen.height and window.innerHeight is more reliable.
                deviceHeight = getMinValue([screen.height, window.innerHeight], 1),
                deviceWidth = getMinValue([screen.width, window.innerWidth, window.outerWidth], 1),
                
                panel = $("paywithmybank-panel"),
                lightbox = $("paywithmybank-lightbox");

                if (!lightbox || !panel) {
                    return;
                }

                var panelHeight = panel.offsetHeight;
                lightbox.style.height = parseInt(deviceHeight) + "px";

                var newDeviceHeight = deviceHeight - 40;

                if (newDeviceHeight !== panelHeight) {
                    var availableWidth = deviceWidth - 20;
                    var newHeight = Math.min(newDeviceHeight, defaultHeight);
                    var newWidth = Math.min(availableWidth, defaultWidth);

                    panelSizeProperties = [
                        ["height", newHeight],
                        ["left", -1 * newWidth / 2],
                        ["top", -1 * newHeight / 2],
                        ["width", newWidth],
                    ];

                    applyPanelSizeProperties(panelSizeProperties);
                }
            },

            setMobileFrameHeight = function() {
                if (isEmbedded()) {
                    return false;
                }

                if (!browser.mobile) {
                    var deviceHeightStr,
                        newDeviceHeight = getMinValue([screen.height, window.innerHeight, window.outerHeight], 1);

                    if (!deviceHeight || newDeviceHeight !== deviceHeight) {
                        deviceHeight = newDeviceHeight;

                        deviceHeightStr = parseInt(deviceHeight) + "px";
                        $("paywithmybank-lightbox").style.height = deviceHeightStr;
                        $("paywithmybank-panel").style.height = deviceHeightStr;
                        getLightboxFrame().style.height = deviceHeightStr;
                    }
                } else {
                    $("paywithmybank-lightbox").style.height = "100%";
                    $("paywithmybank-panel").style.height = "100%";
                    getLightboxFrame().style.height = "100%";
                    getLightboxFrame().style.width = "100%";
                    $("paywithmybank-outer-panel").style.height = "100%";
                }
            },

            windowOnResize = function() {
                if (browser.mobile) {
                    setMobileFrameHeight();
                } else {
                    changeDesktopLightboxSizeOnResize();
                    center();
                }

                return true;
            },

            isHeightEnough = function () {
                var availableHeight = getViewportInfo().height;
                var panelHeight = getLightboxFrame().clientHeight;

                return (availableHeight-50 > panelHeight);
            },

            center = function () {
                var outer = $("paywithmybank-outer-panel"),
                    panel = $("paywithmybank-panel"),
                    lightbox = $("paywithmybank-lightbox");

                if (isEmbedded() && options.containerId) {
                    outer.removeAttribute("style");
                    return;
                }

                if (CssManager.hasClass(lightbox, "paywithmybank-mobile") ||
                    CssManager.hasClass(lightbox, "paywithmybank-embedded") ||
                    CssManager.hasClass(lightbox, "paywithmybank-lightbox-widget")) {
                    return;
                }

                if (!outer || !panel || !lightbox) {
                    return;
                }

                if (browser.supported) {
                    outer.style.position = "relative";
                    outer.style.left = "50%";
                    if (isHeightEnough()) {
                        outer.style.top = "50%";
                        applyPanelSizeProperties();
                    } else {
                        outer.style.top = "10px";
                        panel.style.top = "10px";
                    }
                } else {
                    panel.style.top = "50px";

                    outer.style.position = "absolute";
                    outer.style.top = "0px";
                    outer.style.margin = "0 auto";

                    document.body.scrollTop = document.documentElement.scrollTop = 0;
                }
            },

            createWidgetFrame = function (widgetFrameId, src) {
                var frame = $(widgetFrameId);
                if (frame) {
                    frame.src = src;
                    return frame;
                }

                frame = document.createElement("iframe");
                frame.setAttribute("id", widgetFrameId);
                frame.setAttribute("frameborder", "0");
                frame.setAttribute("class", "pwmb-dynamic-widget");
                frame.setAttribute("src", src);
                frame.setAttribute("scrolling", browser.mobile ? "yes" : "no");
                frame.setAttribute("title", "Trustly Widget Iframe");
                frame.setAttribute("aria-label", "Trustly Widget Iframe");
                frame.setAttribute("name", widgetFrameId);
                frame.setAttribute("sandbox", "allow-modals allow-forms allow-scripts allow-same-origin allow-popups");

                return frame;
            },
            getLearnMoreURL = function ({paymentFlowId, isDataProduct, deviceType, deviceCategory, deviceOs, country, lang, merchantId, paymentFlowMerchantId}) {
                var learnMoreUrl = config.ENV_REACT_WIDGET_URL + "/learnMore?paymentFlowId=" + paymentFlowId +
                    "&isDataProduct=" + isDataProduct +
                    "&deviceType=" + deviceType +
                    "&deviceCategory=" + deviceCategory +
                    "&deviceOs=" + deviceOs +
                    "&country=" + country +
                    "&lang=" + lang +
                    "&merchantId=" + merchantId +
                    "&paymentFlowMerchantId=" + paymentFlowMerchantId;

                return learnMoreUrl;
            },
            getSelectBankWidgetURL = function (params) {
                var country = params.country ? params.country.replace(/[^A-Za-z]+/g,"").toLowerCase() : 'us';
                var lang = params.lang ? params.lang : "en";
                var lastUsedId = getLastUsed(country);
                var accountNumber = null;

                if (!lastUsedId) {
                  lastUsedId = "";
                }

                if (params.account && params.account.accountNumber && params.account.accountNumber.startsWith("crypt2:")) {
                   accountNumber = params.account.accountNumber;
                }

                var widgetUrl = config.ENV_PAYMENT_PANEL_URL + "/selectBank/selectBankWidget" +
                       "?v=" + config.project.version +
                       "&accessId=" + params.accessId +
                       "&merchantId=" + params.merchantId +
                       "&paymentType=" + (params.paymentType || "Instant") +
                       "&deviceType=" + params.deviceType +
                       "&lang=" + lang +
                       (!!params.state && country == "us" ? "&customer.address.state="+encodeURIComponent(params.state) : "") +
                       (!!country ? "&customer.address.country="+encodeURIComponent(country) : "") +
                       (!!params.dynamicWidget?"&dynamicWidget=true":"") +
                       "&grp=" + (params.grp || grp) +
                       "&lastUsed=" + lastUsedId +
                       (params.allowedPaymentProviderTypes ? "&allowedPaymentProviderTypes=" + encodeURIComponent(params.allowedPaymentProviderTypes.join(",")) : "") +
                       (params.onlinePPSubtype ? "&onlinePPSubtype=" + encodeURIComponent(params.onlinePPSubtype) : "") +
                       (params.account && params.account.routingNumber ? "&account.routingNumber=" + encodeURIComponent(params.account.routingNumber) : "") +
                       (accountNumber ? "&account.accountNumber=" + encodeURIComponent(accountNumber) : "") +
                       (params.metadata && params.metadata.customSelectAnotherBankURL ? "&customSelectAnotherBankURL=" + encodeURIComponent(params.metadata.customSelectAnotherBankURL) : "") +
                       (params.metadata && params.metadata.customSelectAnotherBankText ? "&customSelectAnotherBankText=" + encodeURIComponent(params.metadata.customSelectAnotherBankText) : "") +
                       (params.metadata && params.metadata.customMerchantName ? "&customMerchantName=" + encodeURIComponent(params.metadata.customMerchantName) : "") +
                       (params.metadata && params.metadata.customShortName ? "&customShortName=" + encodeURIComponent(params.metadata.customShortName) : "") +
                       (params.metadata && params.metadata.customMerchantLogoUrl ? "&customMerchantLogoUrl=" + encodeURIComponent(params.metadata.customMerchantLogoUrl) : "") +
                       (params.metadata && params.metadata.customMerchantLogoSize ? "&customMerchantLogoSize=" + encodeURIComponent(params.metadata.customMerchantLogoSize) : "") +
                       (params.metadata && params.metadata.theme ? "&theme=" + encodeURIComponent(params.metadata.theme) : "")
                   ;
                ;

                var ik = getIk();
                if (ik) {
                    widgetUrl += "&ik=" + ik;
                }

                var flowType = MetadataUtil.get(params.metadata, "flowType");
                if (flowType && flowType !== "undefined") {
                    widgetUrl += "&flowType=" + encodeURIComponent(flowType);
                }

                var details = {
                    lang: lang,
                    cid: CidManager.get(),
                    sessionCid: CidManager.getSession(),
                    storage: (StorageUtil.isSupported() ? "supported" : "notSupported")
                };
                if (params.currency) details.currency = params.currency;
                if (params.customer) details.customer = params.customer;
                if (params.merchantReference) details.merchantReference = params.merchantReference;
                if (params.kycType) details.kycType = params.kycType;

                var fragment = btoa(JSON.stringify(details));
                widgetUrl += "#" + fragment;

                return widgetUrl;
            },

            createLightBox = function (container,isWidget) {
                var pwmbClose;

                container = container || document.body;
				isWidget = isWidget || false;
                divLightBox = $("paywithmybank-lightbox");
                if (divLightBox) return;

                CssManager.initialize();

                divLightBox = document.createElement("div");
                divLightBox.setAttribute("id", "paywithmybank-lightbox");

                hidePanel();

                iFrameLoaded = false;
                setTimeout(function(){
                    if (!iFrameLoaded) {
                        showSpinner(false);
                        setFocusOnFrame();
                        processOnIframeLoadedEvent();
                    }
                },5000);

                var iframeWrapperStyles = "";
                if (browser.mobile && browser.iOS8Webkit) {
                    iframeWrapperStyles += "-webkit-overflow-scrolling: touch; overflow-y: scroll; ";
                }

                var startUrl = isWidget ? "about:blank" : getStartUrl();
                var src = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

                var widgetSpinner = container && isEmbedded ? 'paywithmybank-widget-spinner' : '';

                divLightBox.innerHTML = "<div id='paywithmybank-outer-panel'>" +
                    "<div id='paywithmybank-panel' class='paywithmybank-panel' style='" + iframeWrapperStyles + "'>" +
                    "<iframe id='" + lightboxFrameId + "' title='Trustly Transaction' name='" + lightboxFrameId + "' src='" + startUrl + "' sandbox='allow-modals allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation allow-popups-to-escape-sandbox' frameborder='0' scrolling='" + (browser.mobile ? "yes" : "no") + "' aria-hidden='true' allow='publickey-credentials-get *; publickey-credentials-create *'></iframe>" +
                    "<div id='paywithmybank-panel-header' class='paywithmybank-panel-header'></div>" +
                    "<div id='paywithmybank-close' class='paywithmybank-close' title='Close this window' style='opacity: 0 !important'></div>" +
                    "<div id='paywithmybank-loading-spinner' class='"+ widgetSpinner +"'>" +
                    "<div class='loading-container'>" +
                    "<div class='loading-dots'>" +
                    "<div class='loading-dot'></div>" +
                    "<div class='loading-dot'></div>" +
                    "<div class='loading-dot'></div>" +
                    "</div>" +
                    "<div id='pwmb-connection-message' class='pwmb-loading-connection-message'>" +
                    "<p>This is taking longer than usual.</p>" +
                    "<p>Please check your internet connection.</p>" +
                    "<button id='pwmb-loading-close-button'>Close</button>" +
                    "<img id='pwmb-connection-report-initiated' src='" + src + "' alt='initiated' onerror='this.style.display=\"none\"' width='1' height='1' style='display: none;' />" +
                    "<img id='pwmb-connection-report-finished'  src='" + src + "' alt='finished' onerror='this.style.display=\"none\"' width='1' height='1' style='display: none;' />" +
                    "</div>"+
                    "</div>" +
                    "</div>" +
                    "</div></div>" +
                    "<div id='paywithmybank-mask' class='paywithmybank-mask' ></div>";

                addEvent(window, "message", onMessage);
                divLightBox = appendChild(container, divLightBox);

                if (isEmbedded()) {
                    return;
                }

                addEvent(window, "resize", windowOnResize);
                addEvent(window, "orientationchange", windowOnResize);

                pwmbClose = $("paywithmybank-close");
                addEvent(pwmbClose, "mousedown", stopPropagation);
                addEvent(pwmbClose, "click", close);

                if (browser.desktop) {
                    addEvent($("paywithmybank-panel-header"), "mousedown", dragstart);
                    addEvent(divLightBox, "mousewheel", wheel);
                    addEvent(divLightBox, "DOMMouseScroll", wheel);
                }

                logMessage("[createLightBox]", lightboxFrameId + " created");
            },

            createPayWithMyBankForm = function() {
                var divForm = document.createElement("div");
                divForm.setAttribute("id", "paywithmybank-form-container");
                hide(divForm);
                divForm.innerHTML = "<form id='PayWithMyBankForm' method='post' action='"+ config.ENV_PAYMENT_PANEL_URL + "/selectBank/index?v=" + config.project.version + "' class='paywithmybank-form' target='" + lightboxFrameId + "'></form>";
                appendChild(document.body, divForm);
            },

            createForwardIframe = function() {
                var widgetRoot = $("paywithmybank-widget-root");
                var forwardIframe = document.createElement("iframe");
                forwardIframe.setAttribute("id", "paywithmybank-forward-iframe");
                forwardIframe.setAttribute("src", getStartUrl());
                forwardIframe.setAttribute("name", "paywithmybank-forward-iframe");
                hide(forwardIframe);
                appendChild(widgetRoot, forwardIframe);
            },

            createForwardForm = function (merchantId) {
                var widgetRoot = $("paywithmybank-widget-root");
                var forwardForm = document.createElement("form");
                forwardForm.setAttribute("id", "paywithmybank-forward-form");
                forwardForm.setAttribute("method", "post");
                forwardForm.setAttribute("action",  config.ENV_PAYMENT_PANEL_URL + "/eventTracker/forward?v=" + config.project.version + "&merchantId=" + merchantId);
                forwardForm.setAttribute("target", "paywithmybank-forward-iframe");
                hide(forwardForm);
                appendChild(widgetRoot, forwardForm);
            },
            resetHistoryOnClose = function () {
                window.history.go(-HISTORY_ENTRIES_ADDED_BY_LIGHTBOX);

                var forwardForm = document.getElementById("paywithmybank-forward-form");
                var forwardIframe = document.getElementById("paywithmybank-forward-iframe");

                if (forwardIframe !== null) {
                    forwardIframe.onload = function (event) {
                        setTimeout(function () {
                            removeElement(forwardForm);
                            removeElement(forwardIframe);
                            window.history.go(-1);
                        }, 100);
                    };
                }

                setTimeout(function () {
                    var timestampInput = document.createElement("input");
                    timestampInput.id = "timestamp";
                    timestampInput.type = "hidden";
                    timestampInput.value = Date.now();
                    timestampInput.name = "timestamp";

                    if (forwardForm !== null) {
                        forwardForm.appendChild(timestampInput);
                        forwardForm.submit();
                    }
                }, 100);
            },

            removePayWithMyBankForm = function() {
                var formContainer = $('paywithmybank-form-container');
                removeElement(formContainer);
            },

            getForm = function () {
                return $("PayWithMyBankForm");
            },

            submitForm = function () {
                var f = function () {
                    getForm().submit();
                    panelFocus();
                    removePayWithMyBankForm();
                    payWithMyBankObj.dynamicStrings.removeIds();
                    userEventTracking = [];
                };

                setTimeout(f, 10);
            },

            showPanel = function () {
                var wndName;

                if (!isEmbedded() && !browser.supported && browser.mobile) {
                    alert("Sorry, but you are using a browser version we do not support for this type of transaction.");
                    return;
                }

                closed = false;

                if (!isEmbedded() && browser.supported) {
                	if(browser.mobile){
                        var outerPanel = $("paywithmybank-outer-panel");
                        if (outerPanel) {
                            outerPanel.className = "";
                        }

                        viewportManager.set();
                        setMobileFrameHeight();
                    }
                	ScrollManager.remove();
                }

                LoadingTimeout.start();

                show(divLightBox);

                notify("open");

                setFrameAttr("aria-hidden", false);
            },

            widget = (function () {
                return {
                    getWidgetId: function() {
                        return "1";
                    },

                    create: function (str, params) {
                        var widgetEl = $(str),
                            ul,
                            s,
                            p,
                            actionButtonLabel,
                            deviceTypeClass = "paywithmybank-widget-" + (browser.mobile ? "mobile" : "desktop");

                        unusedParam(actionButtonLabel);

                        params = (params === undefined) ? {} : params;

                        widgetEl.setAttribute("class", widgetEl.getAttribute("class") ? widgetEl.getAttribute("class") + " paywithmybank-widget" : "paywithmybank-widget");

                        if (params.showBenefits === undefined || params.showBenefits === null || params.showBenefits) {
                            ul = document.createElement("ul");
                            ul.setAttribute("class", "paywithmybank-widget-list-items");
                            appendChild(widgetEl, ul);
                            ul.innerHTML = "<td><span style='display:block; margin-bottom:5px;'><strong>The convenient way to pay with your bank:<span></span></strong></span><li><span>Select your bank and sign in.<span></li><li><span>Choose an account to pay with.<span></li><li><span>Done&mdash;no credit card or bank account numbers needed.<span></li></td>";
                        }

                        s = document.createElement("div");
                        s.setAttribute("class", "paywithmybank-widget-clear " + deviceTypeClass);
                        appendChild(widgetEl, s);

                        if (params.showInstructions === undefined || params.showInstructions === null || params.showInstructions) {
                            p = document.createElement("p");
                            p.setAttribute("class", "paywithmybank-widget-desc-main");
                            appendChild(widgetEl, p);
                            actionButtonLabel = params.actionButtonLabel || "Continue Payment";
                            p.innerHTML = "<td><span class='lock'></span>Connects securely to your bank.</td>";
                        }
                    }
                };
            }());

        $(createLightBox);

        (function (ready) {
            var toplevel,

                contentLoaded = document.addEventListener ?
                        function () {
                            document.removeEventListener("DOMContentLoaded", contentLoaded, false);
                            ready();
                        } :
                        function () {
                            if (document.readyState === "complete") {
                                document.detachEvent("onreadystatechange", contentLoaded);
                                ready();
                            }
                        },

                doScrollCheck = function () {
                    try {
                        document.documentElement.doScroll("left");
                    } catch (e) {
                        setTimeout(doScrollCheck, 1);
                        return;
                    }

                    ready();
                };

            if (document.readyState === "complete") {
                return setTimeout(ready, 1);
            }

            if (document.addEventListener) {
                document.addEventListener("DOMContentLoaded", contentLoaded, false);

                window.addEventListener("load", ready, false);
            } else if (document.attachEvent) {
                document.attachEvent("onreadystatechange", contentLoaded);

                window.attachEvent("onload", ready);

                toplevel = false;

                try {
                    toplevel = window.frameElement === null;
                } catch (ignore) {}

                if (document.documentElement.doScroll && toplevel) {
                    doScrollCheck();
                }
            }
        }(ready));

        var mergeToOptions = function(customOptions) {
            if (!customOptions) return;

            for(var attr in customOptions) {
                try {
                    options[attr] = customOptions[attr];
                } catch(ignored) {}
            }
        };

        var normalizeData = function(data) {
            data.deviceType = (browser.mobile ? "mobile" : "desktop") + ":" + browser.platform + ":" + detectDeviceType();

            var lang = MetadataUtil.get(data.metadata, "lang");

            if (lang) {
                data["lang"] = lang;
            }
        };

        var hashCode = function(s) {
            var h = 0, c, i;
            for (i = 0; i < s.length; i++) {
                c = s.charCodeAt(i); h = ((h<<5)-h)+c; h = h & h;
            }
            return h;
        };

        var setFormInput = function(name,value,formId) {
            if (typeof value !== "boolean" && !value) return;
            if (!formId) {
                formId = "PayWithMyBankForm";
            }

            if (isArray(value)) {
                if(hashCode(name) == -1307559318){
                    setFormInput(name, value.join(","), formId);
                }
                else {
                    for (var i = 0; i < value.length; i++) {
                        setFormInput(name, value[i], formId);
                    }
                }
            } else if (isObject(value)) {
                if ((value.name || value.key) && (value.value || typeof value.value === "boolean")) {
                    if (name) setFormInput(name + "." + (value.name || value.key), value.value, formId);
                    else setFormInput((value.name || value.key), value.value, formId);
                }
                else {
                    for (var attr in value) {
                        if (name) setFormInput(name + "." + attr, value[attr], formId);
                        else setFormInput(attr,value[attr], formId);
                    }
                }
            } else {
                var input;
                var inputId = formId + "__" + name;
                input = $(inputId);
                if (input) {
                    input.value = value;
                } else {
                    input = document.createElement("input");
                    input.id = inputId;
                    input.type = "hidden";
                    input.name = name;
                    input.value = value;

                    if (formId) {
                        var form = $(formId);
                        appendChild(form, input);
                    } else {
                        var form = getForm();
                        appendChild(form, input);
                    }
                }

            }
        };

        var establishWidgetToPanel = function (paymentProviderId, widgetElementId) {
            establishWidgetData.paymentProviderId = paymentProviderId;

            if (widgetElementId) {
                establishWidgetData.widgetElementId = widgetElementId;
            }

            if (typeof selectBankWidgetCallback === "function") {

                establishWidgetData.widgetLoaded = true;
                establishWidgetData.fpd = FPD.get();
                if (!selectBankWidgetCallback(establishWidgetData)) {
                    return;
                }
            }

            payWithMyBankObj.establish(establishWidgetData);
        };

		var establishWidgetData = {};

        var establishWidget = function (data, customOptions) {
            mergeToOptions(customOptions);

            if (!options.widgetContainerId) {
                window.alert("There is no container to anchor the widget.");
                return;
            }

            if (!data) {
                window.alert("No payment data!\nPlease review PayWithMyBank integration code.");
                return;
            }

            CssManager.initialize();

            normalizeData(data);
            data.dynamicWidget = true;
            establishWidgetData = data;

            var widgetParams = {
                "accessId"    : data.accessId,
                "merchantId"  : data.merchantId,
                "paymentType" : data.paymentType,
                "deviceType"  : data.deviceType,
                "lang"        : data.lang,
                "grp"         : data.grp,
                "dynamicWidget" : true,
                "merchantReference" : data.merchantReference,
                "currency": data.currency,
                "customer": data.customer,
                "metadata": data.metadata,
                "allowedPaymentProviderTypes": data.allowedPaymentProviderTypes,
                "onlinePPSubtype": data.onlinePPSubtype,
                "kycType": data.kycType
            };
            if(data.customer && data.customer.address) {
                if(data.customer.address.state) {
                    widgetParams.state = data.customer.address.state;
                }
                if(data.customer.address.country) {
                    widgetParams.country = data.customer.address.country;
                }
            }
            if (data.account) {
                widgetParams.account = data.account;
            }

            var widgetFrameId = "paywithmybank-iframe-" + options.widgetContainerId;
            var frame = $(widgetFrameId);
            if (!!frame) {
                var newSrc = getSelectBankWidgetURL(widgetParams);
                if(frame.src != newSrc) {
                    frame.src = newSrc;
                }
                return;
            }

            eventWidgetLoaded = false;

            var widgetRoot = document.createElement("div");
            widgetRoot.setAttribute("id", "paywithmybank-widget-root");
            widgetRoot.setAttribute("style", "position: relative");
            widgetFrame = createWidgetFrame(widgetFrameId, getSelectBankWidgetURL(widgetParams));
            appendChild(widgetRoot, widgetFrame);

            var widgetContainer = $(options.widgetContainerId);
            while (widgetContainer.firstChild) {
                widgetContainer.removeChild(widgetContainer.firstChild);
            }
            appendChild(widgetContainer, widgetRoot);

            logMessage("[establishWidget]", widgetFrameId + " created", data, customOptions);
        };

        var addOptionsToData = function (options, data) {
            data.option = [];
            var optionKeys = Object.keys(options);
            for (var i = 0; i < optionKeys.length; i++) {
                var key = optionKeys[i];
                if (options[key] !== null) {
                    MetadataUtil.put(data.option, key, options[key]);
                }
            }
        };

        var isAppIntegration = function (data) {
            return data.metadata && data.metadata.integrationContext === "App";
        };

        var isURLSchemeRedirect = function () {
            return typeof options.URLSchemeRedirect === "boolean" && options.URLSchemeRedirect;
        };

        var createAppEstablishURL = function (data) {
            var token = btoa(JSON.stringify(data));
            var inAppBrowserURL = config.ENV_FRONTEND_PANEL_URL + "/mobile/establish?token=" + token;
            notify("InAppBrowserUrl", inAppBrowserURL);
        };  

        logMessage({'cid': CidManager.get(), 'sessionCid': CidManager.getSession(), 'storage': StorageUtil.isSupported(), 'grp': grp});

        return {

            establish: function (data, customOptions) {
                logMessage("[PayWithMyBank.establish]", data, customOptions);

                var divPanel,
                  paymentTypeClass,
                  divLightBoxClass,
                  container = document.body,
                  hasCustomContainer = false,
                  createTransaction = (typeof data.createTransaction === "undefined" || !!data.createTransaction);

                if (!data) {
                    var errorMessageNoPaymentData = "No payment data!\nPlease revise PayWithMyBank integration code.";
                    logMessage("[establish]", errorMessageNoPaymentData);
                    window.alert(errorMessageNoPaymentData);
                    return;
                }

                if(isAppIntegration(data)){
                    createAppEstablishURL(data);
                    return;
                }

                if(data.paymentType == lastPaymentType) {
                    if (!closed || (!!eventWidgetLoaded && !eventBankSelected)) {
                        panelFocus();
                        return;
                    }
                } else {
                	lastPaymentType = data.paymentType; //WU hack
                }


                if (!isReady) {
                    var pos = callOnReady.indexOf(createLightBox);
                    if(pos>=0)  callOnReady.splice( pos, 1 );
                    $(function () {
                        payWithMyBankObj.establish(data, customOptions);
                    });
                    logMessage("[establish]", "!isReady");
                    return;
                }

                mergeToOptions(customOptions);

                normalizeData(data);

                data.dynamicStrings = payWithMyBankObj.dynamicStrings.getIds;

                data.integrationScriptLocation = (location || {}).href || "";

                embedded = (!createTransaction || !!data.embedded || !!options.embedded);

                if (options.containerId && $(options.containerId) && (!browser.mobile || isEmbedded())) {
                    container = $(options.containerId);
                    hasCustomContainer = true;
                }

                createLightBox(container,!createTransaction);

                if (!browser.supported && !createTransaction) {
                    var url = config.ENV_PAYMENT_PANEL_URL + "/message/invalid_browser?&grp=" + grp + "&v=" + config.project.version;
                    getLightboxFrame().src = url;
                    showPanel();
                    logMessage("[establish]", "browser not supported");
                    return;
                }

                if (!iFrameLoaded && createTransaction) {
                    callOnIFrameLoaded = function () {
                        logMessage("[establish]", "callOnIFrameLoaded()");
                        payWithMyBankObj.establish(data, customOptions);
                        callOnIFrameLoaded = null;
                    };
                    logMessage("[establish]", "iframe not loaded. callOnIFrameLoaded prepared...");
                    return;
                }

                data.widgetId = widget.getWidgetId();
                data.grp = data.grp || grp;

                if (typeof data.fpd !== "string" || data.fpd.length < 3) {
                    data.fpd = FPD.get();
                } else {
                    data.fpd = data.fpd || FPD.get();
                }
                data.widgetLoaded = data.widgetLoaded || eventWidgetLoaded;

                if (data.transactionId == null || data.transactionId == "null" || data.transactionId == undefined) {
                    var transactionIdEl = document.getElementById("PayWithMyBankForm.transactionId");
                    if (transactionIdEl) {
                        transactionIdEl.parentNode.removeChild(transactionIdEl);
                    }
                }

                divLightBoxClass = "paywithmybank-lightbox" + (createTransaction ? "" : "-widget");
                divLightBoxClass += " paywithmybank-" + (browser.mobile ? "mobile" : "desktop");

                if (hasCustomContainer) {
                    divLightBoxClass += " paywithmybank-embedded"
                }
                divLightBox.setAttribute("class", divLightBoxClass);

                paymentTypeClass = (data.paymentType && data.paymentType.toLowerCase ? data.paymentType.toLowerCase() : data.paymentType);
                divPanel = $("paywithmybank-panel");
                divPanel.setAttribute("class", "paywithmybank-panel paywithmybank-paymenttype-" + paymentTypeClass);

                if ((browser.mobile) || (options && options.closeButton === false)) {
                    $("paywithmybank-close").style.display = "none";
                } else {
                    $("paywithmybank-close").style.display = "block";
                }

                if ((browser.mobile) || (options && (options.dragAndDrop === false || hasCustomContainer))) {
                    $("paywithmybank-panel-header").style.display = "none";
                } else {
                    $("paywithmybank-panel-header").style.display = "block";
                }

                if (divLightBox.parentNode !== container) {
                    getLightboxFrame().src="about:blank";
                    divLightBox.parentNode.removeChild(divLightBox);
                    appendChild(container, divLightBox);
                    if (container === document.body) {
                         divLightBox.removeAttribute("style");
                         $("paywithmybank-mask").removeAttribute("style");
                    }
                }

                createPayWithMyBankForm();
                if (shouldForceBackHistory) {
                    createForwardIframe();
                    createForwardForm(data.merchantId);
                    showSpinner();
                }

                var payWithMyBankForm = getForm();

                //remove any previous input
                var node = payWithMyBankForm.firstChild;
                while (node) {
                    var input = node;
                    node = node.nextSibling;
                    input.parentNode.removeChild(input);
                }

                // Verify existence of data.metadata before adding data
                if (typeof data.metadata === "undefined") {
                    data.metadata = {};
                }

                if (typeof options.theme === "string" && options.theme) {
                    MetadataUtil.put(data.metadata, "theme", options.theme);
                }

                if (typeof options.hideCloseButton === "boolean" && options.hideCloseButton) {
                    MetadataUtil.put(data.metadata, "hideCloseButton", true);
                }

                if (typeof options.hideBack === "boolean" && options.hideBack) {
                    MetadataUtil.put(data.metadata, "hideBack", true);
                }

                if (typeof options.hideSelectBankBack === "boolean" && options.hideSelectBankBack) {
                    MetadataUtil.put(data.metadata, "hideSelectBankBack", true);
                }

                var country = 'us';
                if(data.customer && data.customer.address && data.customer.address.country) {
                    country = data.customer.address.country;
                }

                var lastUsed = getLastUsed(country);
                if (lastUsed) {
                    MetadataUtil.put(data.metadata, "lastUsed", lastUsed);
                }

                var eventLength = userEventTracking.length
                if (Boolean(eventLength)) {
                    for (var i = 0, len = eventLength; i < len; i++) {
                        MetadataUtil.put(data.metadata, userEventTracking[i], true);
                    }
                }

                var ik = getIk();
                if (ik) {
                    MetadataUtil.put(data.metadata, "ik", ik);
                }

                if (data.widgetElementId) {
                    MetadataUtil.put(data.metadata, "widgetElementId", data.widgetElementId);
                    try {
                      delete data.widgetElementId;
                    } catch (ignored) {}
                }

                data.sessionCid = CidManager.getSession();
                data.cid = CidManager.get();;
                MetadataUtil.put(data.metadata, "cid", data.cid);

                if (window.cordova && window.cordova.InAppBrowser) {
                    MetadataUtil.put(data.metadata, "plugin", "InAppBrowser");
                }

                if (window.cordova && typeof window.openOAuth === 'function') {
                    MetadataUtil.put(data.metadata, "plugin", "openOAuth");
                }

                if (typeof options.integrationContext === "string" && options.integrationContext) {
                    MetadataUtil.put(data.metadata, "integrationContext", options.integrationContext);
                }

                if (options.customSelectAnotherBankURL && typeof options.customSelectAnotherBankURL === "string" && safeURL(options.customSelectAnotherBankURL)) {
                    MetadataUtil.put(data.metadata, "customSelectAnotherBankURL", options.customSelectAnotherBankURL);
                }

                if (options.customSelectAnotherBankText && typeof options.customSelectAnotherBankText === "string") {
                    MetadataUtil.put(data.metadata, "customSelectAnotherBankText", options.customSelectAnotherBankText);
                }

                if (options.customMerchantName && typeof options.customMerchantName === "string" && safeURL(options.customMerchantName)) {
                    MetadataUtil.put(data.metadata, "customMerchantName", options.customMerchantName);
                }
                if (options.customShortName && typeof options.customShortName === "string" && safeURL(options.customShortName)) {
                    MetadataUtil.put(data.metadata, "customShortName", options.customShortName);
                }
                if (options.customMerchantLogoUrl && typeof options.customMerchantLogoUrl === "string" && safeURL(options.customMerchantLogoUrl)) {
                    MetadataUtil.put(data.metadata, "customMerchantLogoUrl", options.customMerchantLogoUrl);
                }
                if (options.customMerchantLogoSize && typeof options.customMerchantLogoSize === "string" && safeURL(options.customMerchantLogoSize)) {
                    MetadataUtil.put(data.metadata, "customMerchantLogoSize", options.customMerchantLogoSize);
                }

                timeoutReport = {
                    "merchantId": data.merchantId,
                    "externalId": data.customer && data.customer.externalId,
                    "merchantReference": data.merchantReference
                };

                data.storage = StorageUtil.isSupported() ? "supported" : "notSupported";

                timeoutReport = {
                    "merchantId": data.merchantId,
                    "externalId": data.customer && data.customer.externalId,
                    "merchantReference": data.merchantReference
                };

                data.timestamp = new Date().getTime();
                options.widgetToken = widgetToken;

                try {
                    addOptionsToData(options, data);
                } catch (error) {
                    logMessage("[establish] addOptionsToData error", error);
                }

                if (!createTransaction) {
                    var formParams = {
                        "accessId"    : data.accessId,
                        "merchantId"  : data.merchantId,
                        "paymentType" : data.paymentType,
                        "widgetId"    : data.widgetId,
                        "deviceType"  : data.deviceType,
                        "lang"        : data.lang,
                        "grp"         : data.grp,
                        "customer"    : data.customer,
                        "currency"    : data.currency,
                        "kycType"     : data.kycType
                    };
                    if(data.customer && data.customer.address) {
                        if(data.customer.address.state) {
                            formParams.state = data.customer.address.state ;
                        }
                        if(data.customer.address.country) {
                            formParams.country = data.customer.address.country ;
                        }
                    }
                    var iframe = getLightboxFrame();
                    var newSrc = getSelectBankWidgetURL(formParams);
                    if(iframe.src != newSrc) {
                        iframe.src = newSrc;
                    }
                    center();
                    showPanel();

                    logMessage("[establish] widget", data, options);

                    return;
                } else {
                    payWithMyBankForm.method = "post";

                    var action;
                    if ((paymentProviderId) && (!options.verify) && (!data.account) && (!data.paymentProviderId)) {
                        data.paymentProviderId = paymentProviderId;
                        action = config.ENV_PAYMENT_PANEL_URL + "/selectBank/selectBank?v=" + config.project.version;
                    } else {
                        action = config.ENV_PAYMENT_PANEL_URL + "/selectBank/index?v=" + config.project.version;
                    }
                    payWithMyBankForm.action = action;

                    //set form inputs
                    setFormInput(null,data);

                    logMessage("[establish] data", data, options);
                }
                CancelUrl.set(data.cancelUrl);

                center();

                AccessibilityManager.apply(options);

                showPanel();
                submitForm();
            },

            verify: function (data, customOptions) {
                customOptions = customOptions || {};
                customOptions.verify = true;

                if (data.paymentType && data.paymentType !== 5 && data.paymentType !== "5" && data.paymentType !== "Verification") {
                    window.alert("Invalid paymentType!\nPlease revise PayWithMyBank integration code.");
                    return;
                }

                data.paymentType = "Verification";
                payWithMyBankObj.establish(data, customOptions);
            },

            authorize: function (data) {
                if (!data) {
                    window.alert("No authorization data!\nPlease revise PayWithMyBank integration code.");
                    return;
                }
                if (!data.accessId) {
                    window.alert("No accessId value on authorization data!\nPlease revise PayWithMyBank integration code.");
                    return;
                }
                if (!data.transactionId) {
                    window.alert("No transactionId value on authorization data!\nPlease revise PayWithMyBank integration code.");
                    return;
                }
                if (!data.accessId) {
                    window.alert("No accessId value on authorization data!\nPlease revise PayWithMyBank integration code.");
                    return;
                }
                if (data.callback && typeof (data.callback) === "function") {
                    setTimeout(function () { data.callback(true); }, 0);
                } else {
                    window.alert("No callback function on authorization data!\nPlease revise PayWithMyBank integration code.");
                    return;
                }
            },

            payWithMyBank: function (data) {
                $(function () {
                    payWithMyBankObj.establish(data);
                });
            },

            widget: function (str, params) {
                $(function () {
                    widget.create(str, params);
                });

                return {
                    "widgetId" : widget.getWidgetId()
                };
            },

            selectBankWidget: function(data, customOptions, callback) {
                logMessage("[selectBankWidget]", data, customOptions);
                selectBankWidgetCallback = callback;
                return establishWidget(data, customOptions);
            },

            selectBankLightBox: function(data, customOptions) {
                logMessage("[selectBankLightBox]", data, customOptions);

                var options = {};
                data = data || {};

                options.embedded = true;
                options.createTransaction = false;
                options.merchantId = data.merchantId;
                options.accessId = data.accessId;
                options.paymentType = data.paymentType || "Retrieval";
                options.metadata = data.metadata;

                return payWithMyBankObj.establish(options, customOptions);
            },

            isPanelOpen: function() {
                return !closed;
            },

            group: function() {
                return grp;
            },

            removeListeners: function () {
                listeners = [];
            },

            addPanelListener: function (fn) {
                if (arrayIndexOf(listeners, fn) < 0) {
                    listeners.push(fn);
                }
            },

            removePanelListener: function (fn) {
                var p = arrayIndexOf(listeners, fn);
                if (p >= 0) {
                    listeners.splice(p, 1);
                }
            },

            browserSupported: function () {
                return browser.supported;
            },

            reset: function () {
                closed = true;
                eventWidgetLoaded = false;
                eventBankSelected = false;
                lastPaymentType = "";
                panelSizeProperties = null;

                var lightbox = $("paywithmybank-lightbox");
                var panel = $("paywithmybank-panel");
                var iframe = getLightboxFrame();

                if (lightbox) {
                    CssManager.removeClass(lightbox, "paywithmybank-assetsLoaded");
                }
                if (!isEmbedded()) {
                    StylesManager.clear(panel);
                }
                if (iframe && !isEmbedded()) {
                    iframe.style.minHeight = "0";
                }

                if (!browser.mobile && !isEmbedded()) {
                    var panelSizeProperties = [
                        ["width", "300"],
                        ["height", "300"],
                        ["top", "-150"],
                        ["left", "-150"]
                    ];
                    applyPanelSizeProperties(panelSizeProperties);
                }

                ScrollManager.restore();
            },

            destroy: function () {
                logMessage("[destroy]");

                // remove attached events
                if (typeof attachedEvents === "object" && isArray(attachedEvents)) {
                    while (attachedEvents.length) {
                        var args = attachedEvents.shift();
                        try {
                            removeEvent.apply(null, args);
                        } catch (ignored) {}
                    }
                }

                // remove appended elements
                if (typeof appendedElements === "object" && isArray(appendedElements)) {
                    while (appendedElements.length) {
                        var args  = appendedElements.pop();
                        try {
                            args[0].removeChild(args[1]);
                        } catch (ignored) {}
                    }
                }

                PayWithMyBank.reset();
                PayWithMyBank.removeListeners();

                return true;
            },

            getBrowser: function () {
                return browser;
            },

            proceedToChooseAccount: function () {
                postToPanel("PayWithMyBank.externalCallback|Webview|close");
            }
        };
    }());

    payWithMyBankObj.dynamicStrings = (function () {
        var base = {"default":{"productTagline":{"en":[{"id":"4919335051","percent":100,"value":"Easy & secure connection to your bank account"}]},"tooltips.learnMoreData":{"en":[{"id":"4919335732","percent":100,"value":"Most of your financial information lives online-Trustly Online Banking allows you to take control of your bank verified data. Make ordinary tasks like account validation more convenient. No app downloads required. It\u2019s simple and safe\u2014your information is always kept private and never stored."}]},"tooltips.learnMorePayment":{"en":[{"id":"4919335966","percent":100,"value":"Online Banking is the modern way to pay.  Instead of paying with a card, pay directly from your bank account. No app downloads required. It\u2019s simple and safe. Find your bank and choose an account you\u2019d like to pay with\u2014your account information is always kept private and never stored."}]},"bankSuffix":{"en":[{"id":"4919335489","percent":100,"value":"(via Trustly)"}]},"productSubtitle":{"en":[{"id":"16179448183","percent":100,"value":"Choose from over 8k banks"}]},"productName":{"en":[{"id":"4919334709","percent":100,"value":"Online Banking"}]}},"keys":["productTagline","tooltips.learnMoreData","tooltips.learnMorePayment","bankSuffix","productSubtitle","productName"],"content":{}};
        var API = {};
        var content = {};
        var STORAGE_KEY = "Trustly.content";

        var trustlyOptsObj = window.TrustlyOptions || window.PayWithMyBankOptions || {};
        var lang = trustlyOptsObj.language || (window.navigator.language || "").substr(0, 2);
        var dynamicStrings = base || {};

        var contentValues = dynamicStrings.content || {};
        var defaultValues = dynamicStrings.default || {};
        var contentKeys = dynamicStrings.keys || [];

        for (var i = 0, len = contentKeys.length; i < len; i++) {
            var key = contentKeys[i];
            createContent(contentValues[key], key);
        }

        function createGetter(data, key, callback) {
            var prop = data[key];

            if (!prop) {
                Object.defineProperty(data, key, {
                    enumerable: true,
                    get: callback
                });
            } else {
                var newProp = callback();
                var newKeys = Object.keys(newProp);

                for (var i = 0, len = newKeys.length; i < len; i++) {
                    var newKey = newKeys[i];
                    createGetter(data[key], newKey, function () {
                        return newProp[newKey];
                    });
                }
            }
        }

        function createPropTree(list, prop, getter) {
            var key;

            if (list.length) {
                key = list.pop();
            }

            var isLast = !list.length;
            var data = isLast ? content : prop;
            createGetter(data, key, getter);

            if (isLast) return;

            return createPropTree(list, {}, function () {
                return prop;
            });
        }

        function createContent(contentData, key) {
            createPropTree(key.split("."), {}, function finalGetter() {
                try {
                    contentData = contentData || {};
                    var chosen;
                    var probability = 0;
                    var grp = Trustly.group();

                    var contentList = contentData[lang] || [];
                    if (!contentList.length) {
                        var data = defaultValues[key] || {};
                        contentList = data[lang] || [];
                    }

                    for (var i = 0, len = contentList.length; i < len; i++) {
                        var content = contentList[i];
                        probability += parseInt(content.percent);

                        if (grp <= probability) {
                            chosen = content;
                            break;
                        }
                    }

                    if (!(chosen || {}).id) return "";

                    var list = JSON.parse(StorageUtil.get(STORAGE_KEY, "[]"));
                    list.push(chosen.id);
                    StorageUtil.set(STORAGE_KEY, JSON.stringify(list));

                    logMessage("DynamicStrings: " + key + " used (" +  chosen.id + ")");

                    return chosen.value;
                } catch (err) {
                    logMessage('DynamicStrings#error]', err);
                    return "";
                }
            });
        }

        createGetter(payWithMyBankObj, "content", function () {
            return content;
        });

        createGetter(API, "getIds", function () {
            try {
                var list = JSON.parse(StorageUtil.get(STORAGE_KEY, "[]"));
                var filteredList = [];

                for (var i = 0, len = list.length; i < len; i++) {
                    var id = list[i];
                    if (filteredList.indexOf(id) < 0) {
                        filteredList.push(id);
                    }
                }

                return filteredList.join(",");
            } catch (ignored) {
                return "";
            }
        });

        API.removeIds = function () {
            StorageUtil.remove(STORAGE_KEY, "[]");
        };

        return API;
    })();

    window.eWise = payWithMyBankObj; //DEPRECATED
    window.PayWithMyBank = payWithMyBankObj;
    window.Trustly = payWithMyBankObj;

    Object.defineProperty(payWithMyBankObj, "version", {
        value: "1.285.1"
    });
}(window));
