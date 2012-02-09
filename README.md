Requirements:

* Porthole JS - http://ternarylabs.github.com/porthole/
* jQuery (1.4 or later)
* JSON2.js - https://github.com/douglascrockford/JSON-js/blob/master/json2.js

This is a wrapper library around the Porthole js library that adds some abstraction
around the setup and handling of communication, and marshalling of objects for
method calls between the two 'frames'. 

In your "parent" application page, you must have an IFrame configured as follows

	<iframe name="FrameName" data-src="$ChildPageUrl" data-proxy="$ChildPageProxyUrl"></iframe>

where

* $ChildPageUrl is the url to the page being iframed
* $ChildPageProxyUrl is the URL to the proxy.html file that comes with porthole.js and has been configured with appropriate URL paths for porthole.js
			
Then, from your javascript code somewhere, you can call the following (assuming
here that we're sending a call TO the child frame

	// this call must be made, as it sets up the appropriate data comms 
	// to the child frame
	ProxyFrameManager.listenTo('FrameName');
	ProxyFrameManager.send('FrameName', 'methodName', 'param1', {and: 'so on'});


In the child page, you do something similar, but given there's no reference
to the frame name (there's only the 'parent'), you need to explicitly state
the URL for the parent frame's proxy url to listen on, as well as the 
possible methods to handle the method calls

	// even though we're sending data
	ProxyFrameManager.listenTo('$ParentPageProxyUrl', {
		methodName: function (param, objectParam) {
			// do something to handle the call here
		}
	});

Now, assuming you wanted to perform method calls BACK to parent from the
child page, you have a similar setup

In the parent page: 

	ProxyFrameManager.listenTo('FrameName', {
		parentMethod: function () {

		}
	});

In the child page, the main difference in the way 'send' is called is 
in how the target of the send is referenced - in this case, a 'parent' name
is automatically created for us 

	// sets up the communication 
	ProxyFrameManager.listenTo('$ParentPageProxyUrl');

	// just send directly to the 'parent' of the frame
	ProxyFrameManager.send('parent', 'parentMethod');
	
	
A demonstration of this [can be found here](http://demo.mikenovember.com/proxy-frame/parent/)
