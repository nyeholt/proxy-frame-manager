/**
 * 
 * A wrapper library around the Porthole js library that adds some abstraction
 * around the setup and handling of communication. 
 * 
 * In your "parent" application page, you must have an IFrame configured as follows
 * 
 * <iframe name="FrameName" src="$ChildPageUrl" data-proxy="$ChildPageProxyUrl"></iframe>
 * 
 * where
 * 
 *	$ChildPageUrl is the url to the page being iframed
 *	$ChildPageProxyUrl is the URL to the proxy.html file that comes with porthole.js
 *			and has been configured with appropriate URL paths for porthole.js
 *			
 * Then, from your javascript code somewhere, you can call the following (assuming
 * here that we're sending a call TO the child frame
 * 
 * // this call must be made, as it sets up the appropriate data comms 
 * // to the child frame
 * ProxyFrameManager.listenTo('FrameName');
 * 
 * ProxyFrameManager.send('FrameName', 'methodName', 'param1', {and: 'so on'});
 * 
 * 
 * In the child page, you do something similar, but given there's no reference
 * to the frame name (there's only the 'parent'), you need to explicitly state
 * the URL for the parent frame's proxy url to listen on, as well as the 
 * possible methods to handle the method calls
 * 
 * // even though we're sending data
 * ProxyFrameManager.listenTo('$ParentPageProxyUrl', {
 *		methodName: function (param, objectParam) {
 *			// do something to handle the call here
 *		}
 * });
 * 
 * Now, assuming you wanted to perform method calls BACK to parent from the
 * child page, you have a similar setup
 *
 * In the parent page: 
 * 
 * ProxyFrameManager.listenTo('FrameName', {
 *		parentMethod: function () {
 *		
 *		}
 * });
 * 
 * In the child page, the main difference in the way 'send' is called is 
 * in how the target of the send is referenced - in this case, a 'parent' name
 * is automatically created for us 
 * 
 * // sets up the communication 
 * ProxyFrameManager.listenTo('$ParentPageProxyUrl');
 * 
 * // just send directly to the 'parent' of the frame
 * ProxyFrameManager.send('parent', 'parentMethod');
 * 
 * 
 */


(function ($) {
	
	/**
	 * A class for managing the sending and receiving of method calls down
	 * to a child frame. 
	 */
	window.ProxyFrameManager = (function () {
		var frames = {};
		var loadedFrames = {'parent': true};
		var deferred = {};
		
		/** 
		 * capture the load of all iframes
		 */
		$('iframe').load(function () {
			log("Frame " + $(this).attr('name') + ' loaded');
			if ($(this).attr('name')) {
				deferredSend($(this).attr('name'));
			}
		})
		
		$(function () {
			$('iframe.proxyFrame').each (function () {
				var src = $(this).attr('data-src');
				$(this).attr('src', src);
			})
		})
		
		/**
		 * Receives inbound messages and routes them to appropriate handlers
		 * 
		 * Uses an inner function so that we can close over the frame name 
		 * and route the message to the appropriate listeners
		 */
		var messageHandler = function (frameName) {
			return function (messageEvent) {

				if (messageEvent.data) {
					var details = JSON.parse(messageEvent.data);
					if (details && details.method) {
						var frame = getFrame(frameName);
						
						// first check the origin domain to make sure the
						// caller was who we expected
						if (frame.url.indexOf(messageEvent.origin) != 0) {
							log("Invalid source domain " + messageEvent.origin + ': expected ' + frame.url);
						}

						// now go through all listeners and send the message
						// if they have a method defined to handle it
						for (var i in frame.listeners) {
							var l = frame.listeners[i]
							if (l && l[details.method]) {
								var method = l[details.method];
								method.apply(l, details.args);
							}
						}
					}
				}
			}
		}

		/**
		 * Enables a named frame for communication. This is used for all
		 * communication to this named item
		 * 
		 * @param String name
		 *				The name can be either an iframe element name, or the 
		 *				string 'parent' to indicate that it's the parent 
		 *				of this frame that we're interested in
		 */
		var getFrame = function (name, proxyUrl) {
			if (!frames[name]) {
				var elem = $('iframe[name=' + name + ']');
				
				// we'll also just force through any deferred calls after a 
				// couple of seconds in case the frame has loaded, but the
				// load event hasn't triggered
				setTimeout(function () {
					deferredSend(name);
				}, 10000);
				
				// see whether or not the frame exists. If so, we need
				// to use its data-proxy attribute for getting the proxy
				// location
				if ((elem && elem.length) || (name == 'parent' && proxyUrl)) {
					var windowProxy = null;
					if (proxyUrl) {
						windowProxy = new Porthole.WindowProxy(proxyUrl);
					} else {
						proxyUrl = elem.attr('data-proxy');
						windowProxy = new Porthole.WindowProxy(proxyUrl, name);
					}

					windowProxy.addEventListener(messageHandler(name));
					frames[name] = {
						url: proxyUrl,
						channel: windowProxy,
						listeners: []
					};
				}
			}
			return frames[name];
		}

		/**
		 * Register to listen to a particular frame. Any messages sent will be
		 * forwarded to the listener
		 * 
		 * @param String frameName
		 *				The name of the frame we're passing communication to. 
		 *				If we're the CHILD framed page, pass through the URL to
		 *				the PARENT page's proxy.html page. From that point
		 *				onwards, you can refer to the 'parent' frame in calls
		 *				to 'send' 
		 */
		var listenTo = function (frameName, object) {
			var frame = null;
			if (frameName.indexOf('://') > 0) {
				frame = getFrame('parent', frameName);
			} else {
				frame = getFrame(frameName);
			}

			if (frame) {
				frame.listeners.push(object);
			}
		}

		/**
		 * Some 'send' requests are done before the framed page loads completely. This will
		 * send those messages
		 */
		var deferredSend = function (frameName) {
			if (!loadedFrames[frameName]) {
				loadedFrames[frameName] = true;
				if (deferred[frameName]) {
					for (var i in deferred[frameName]) {
						var method = deferred[frameName][i].method;
						var args = deferred[frameName][i].args;
						args.unshift(method); args.unshift(frameName);
						log("Deferred send of " + method + " to " + frameName);
						send.apply(this, args);
					}
				}
			}
		}

		/**
		 * Send a method call down to a particular named frame
		 */
		var send = function (frameName, method) {
			var args = Array.prototype.slice.call(arguments, 2);
			if (!loadedFrames[frameName]) {
				var list = deferred[frameName] != null ? deferred[frameName] : [];
				list.push({
					method: method,
					args: args
				});
				deferred[frameName] = list;
				return;
			}

			var frame = getFrame(frameName);
			if (frame) {
				// send data through the proxy, after first packaging things up
				var data = {
					method: method,
					args: args
				}

				data = JSON.stringify(data);
				frame.channel.postMessage(data);
			}
		}
		
		var log = function (message) {
			if (typeof console != 'undefined' && console && console.log) {
				console.log("ProxyFrameManager: " + message);
			}
		}
		return {
			listenTo: listenTo,
			send: send
		}
	})();
})(jQuery);