const bodyParser = require('body-parser')
    , config = require('config')
    , express = require('express')
    , https = require('https')
    , request = require('request')
    , lowerCase = require('lower-case')
    , randomstring = require("randomstring");
var app = express();
app.set('port', process.env.PORT || 5000);
app.use(bodyParser.json());
var mongoose = require('mongoose');
var McDonaldsBotUser = require('./McDonaldsBotUser.model');
mongoose.Promise = global.Promise;
mongoose.connect("", {
    useMongoClient: true
}, function (ignore, connection) {
    connection.onOpen();
});
app.use(bodyParser.urlencoded({
    extended: true
}));
var access_token = "";
app.use(express.static("files"));
app.get('/menu', function (req, res) {
    res.status(200).send("menu");
    var messageData = {
        "persistent_menu": [
            {
                "locale": "default"
                , "composer_input_disabled": false
                , "call_to_actions": [
                    {
                        "title": "About this bot"
                        , "type": "nested"
                        , "call_to_actions": [
                            {
                                "type": "postback"
                                , "title": "Restart bot"
                                , "payload": "restart"
                            }
                            , {
                                "type": "web_url"
                                , "title": "Built by AliveNow"
                                , "url": "http://www.alivenow.in/ChatBots.php"
                                , "webview_height_ratio": "tall"
                            }
                        ]
                    }
                ]
            }
        ]
    };
    request({
        uri: 'https://graph.facebook.com/v2.6/me/messenger_profile'
        , qs: {
            access_token: access_token
        }
        , method: 'POST'
        , json: messageData
    }, function (error, response, body) {
        console.log(error);
        console.log(response);
        console.log(body);
    });
});
app.get('/getStarted', function (req, res) {
    res.status(200).send("getStarted");
    request({
        uri: 'https://graph.facebook.com/v2.6/me/thread_settings'
        , qs: {
            access_token: access_token
        }
        , method: 'POST'
        , json: {
            "setting_type": "call_to_actions"
            , "thread_state": "new_thread"
            , "call_to_actions": [
                {
                    "payload": "get started"
                }
            ]
        }
    });
});
app.get('/McDonaldsCoupon', function (req, res) {
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === "98765") {
        console.log("Validating webhook");
        res.status(200).send(req.query['hub.challenge']);
    }
    else {
        //console.error("Failed validation. Make sure the validation tokens match.");
        res.sendStatus(403);
    }
});
app.post('/McDonaldsCoupon', function (req, res) {
    var data = req.body;
    res.sendStatus(200);
    console.log("1");
    if (data.object === 'page') {
        data.entry.forEach(function (entry) {
            console.log("2");
            entry.messaging.forEach(function (event) {
                console.log("3");
                var senderID = event.sender.id;
                if (event.delivery != undefined) {
                    console.log("4");
                    McDonaldsBotUser.findOne({
                        fbid: senderID
                    }).exec(function (err, user) {
                        if (!err) {
                            if (user.lastAction == "welcome") {
                                welcomeMenu(senderID);
                            }
                            else if (user.lastAction == "shareSent") {
                                ThankYouMsg(senderID);
                            }
                        }
                    });
                    return;
                }
                var message = event.message;
                McDonaldsBotUser.findOne({
                    fbid: senderID
                }).exec(function (err, user) {
                    if (!err) {
                        console.log("5");
                        if (user == null) {
                            console.log("6");
                            var newUser = McDonaldsBotUser();
                            newUser.fbid = senderID;
                            newUser.lastAction = "get started";
                            newUser.first_name = "";
                            newUser.last_name = "";
                            newUser.gender = "";
                            newUser.save(function (err, user) {
                                if (!err) {
                                    getstarted(senderID, user.first_name);
                                    getData(senderID);
                                }
                            });
                        }
                        else {
                            console.log("7");
                            if (user.first_name == "" || user.first_name == null) {
                                getData(senderID);
                            }
                            var eventAction = "";
                            if (event.message != undefined && event.message.quick_reply != undefined) {
                                eventAction = event.message.quick_reply.payload;
                                console.log("QR - " + eventAction);
                                if (eventAction.indexOf("rateBot") > -1) {
                                    console.log(eventAction);
                                    var rated = eventAction.substr(7);
                                    McDonaldsBotUser.findOneAndUpdate({
                                        fbid: senderID
                                    }, {
                                        $set: {
                                            "rate": rated
                                        }
                                    }, {
                                        upsert: false
                                    }, function (err, user) {});
                                    sendTextMessage(senderID, "Thanks for chating. We hope you enjoyed chatting with this bot!");
                                }
                                else {
                                    sendTextMessage(senderID, "Sorry! I didn't get you.");
                                }
                            }
                            else if (event.message) {
                                console.log("msg");
                                event.message.text = event.message.text.toLowerCase();
                                console.log(event.message.text);
                                if (event.message.text == "get started" || event.message.text == "restart" || event.message.text == "restart bot") {
                                    getstarted(senderID, user.first_name);
                                }
                                else {
                                    sendTextMessage(senderID, "Sorry! I didn't get you.");
                                }
                            }
                            else {
                                console.log("else");
                                if (event.postback != undefined && event.postback.payload != undefined) {
                                    eventAction = event.postback.payload;
                                    console.log("payload - " + eventAction);
                                    if (eventAction == "restart" || eventAction == "get started") {
                                        getstarted(senderID, user.first_name);
                                    }
                                    else if (eventAction == "readyYes") {
                                        shareCoupon(senderID, user.couponCode);
                                    }
                                    else if (eventAction == "readyNo") {
                                        tryAgain(senderID);
                                    }
                                    else {
                                        sendTextMessage(senderID, "Sorry! I didn't get you.");
                                    }
                                }
                            }
                            if (eventAction == "") eventAction = "Get Started";
                            if (event.message != undefined && event.message.attachments != undefined) {}
                        }
                    }
                });
            });
        });
    }
});
app.post('/redeem', function (req, res) {
    console.log(req.body);
    coupon = JSON.parse(JSON.stringify(req.body.coupon));
    McDonaldsBotUser.findOne({
        couponCode: coupon
    }).exec(function (err, user) {
        if (!err) {
            console.log(user);
            console.log();
            if (user.redeem == 0) {
                res.status(200).send(JSON.stringify("{code:'avail'}"));
            }
            else {
                res.status(200).send(JSON.stringify("{code:'redeemed'}"));
            }
        }
        else {
            res.status(200).send(JSON.stringify("{code:'notfound'}"));
        }
    });
});
app.post('/updateredeem', function (req, res) {
    var coupon = JSON.parse(JSON.stringify(req.body.coupon));
    console.log(coupon);
    McDonaldsBotUser.findOneAndUpdate({
        couponCode: coupon
    }, {
        $set: {
            "redeem": 1
        }
    }, {
        upsert: false
    }, function (err, user) {
        res.status(200).send("{code:'done'}");
        sendTextMessage(user.fbid, "Hey " + user.first_name + "!Your voucher code has been validated. Enjoy your food!");
    });
});

function getData(senderID) {
    request({
        uri: 'https://graph.facebook.com/v2.6/' + senderID
        , qs: {
            access_token: access_token
            , fields: 'first_name,last_name,gender'
        }
        , method: 'GET'
    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var data = JSON.parse(body);
            McDonaldsBotUser.findOneAndUpdate({
                fbid: senderID
            }, {
                $set: {
                    "first_name": data.first_name
                    , "last_name": data.last_name
                    , "gender": data.gender
                }
            }, {
                upsert: false
            }, function (err, usser) {});
        }
    });
}

function getstarted(recipientId, name) {
    McDonaldsBotUser.findOneAndUpdate({
        fbid: recipientId
    }, {
        $set: {
            "lastAction": "welcome"
        }
    }, {
        upsert: false
    }, function (err, user) {
        sendTextMessage(recipientId, "Hey " + name + "!  welcome to the McDonald's coupon chatbot.");
    });
}

function ThankYouMsg(recipientId) {
    McDonaldsBotUser.findOneAndUpdate({
        fbid: recipientId
    }, {
        $set: {
            "lastAction": "ThankYou"
        }
    }, {
        upsert: false
    }, function (err, user) {
        Thanks(recipientId);
    });
}

function welcomeMenu(recipientId) {
    McDonaldsBotUser.findOneAndUpdate({
        fbid: recipientId
    }, {
        $set: {
            "lastAction": "welcomeMenu"
        }
    }, {
        upsert: false
    }, function (err, user) {
        var messageObj = {
            "attachment": {
                "type": "template"
                , "payload": {
                    "template_type": "button"
                    , "text": "Would you like a coupon for your next McDonald's meal?"
                    , "buttons": [
                        {
                            "type": "postback"
                            , "title": "Yes"
                            , "payload": "readyYes"
																}
                        , {
                            "type": "postback"
                            , "title": "No"
                            , "payload": "readyNo"
																}
															]
                }
            }
        }
        sendGenericMessage(recipientId, messageObj);
    });
}

function Thanks(recipientId) {
    var messageObj = {
        "attachment": {
            "type": "template"
            , "payload": {
                "template_type": "button"
                , "text": "Thanks for chatting. Please redeem your coupon at the nearest McDonald's store.Tap on store locator below to view stores"
                , "buttons": [
                    {
                        "type": "web_url"
                        , "url": "http://www.mcdonaldsarabia.com/uae/en/locations.html"
                        , "title": "Stores"
					}
				]
            }
        }
    }
    sendGenericMessage(recipientId, messageObj);
}

function tryAgain(recipientId) {
    var messageObj = {
        "attachment": {
            "type": "template"
            , "payload": {
                "template_type": "button"
                , "text": "That's alright, come back and ask for your code when you're ready!"
                , "buttons": [
                    {
                        "type": "postback"
                        , "title": "Ready"
                        , "payload": "readyYes"
					}
				]
            }
        }
    }
    sendGenericMessage(recipientId, messageObj);
}

function shareCoupon(recipientId, coupon) {
    console.log(coupon);
    if (coupon == '' || coupon == undefined) {
        coupon = randomstring.generate({
            length: 10
            , charset: 'ABCDEFGHIGKLMNPQRSTUVWXYZ123456789'
        });
    }
    McDonaldsBotUser.findOneAndUpdate({
        fbid: recipientId
    }, {
        $set: {
            "lastAction": "shareSent"
            , "couponCode": coupon
        }
    }, {
        upsert: false
    }, function (err, user) {
        var msg = "Ok great! Here's your coupon code: " + coupon;
        sendTextMessage(recipientId, msg);
    });
}

function sendTextMessage(recipientId, messageText) {
    var messageData = {
        recipient: {
            id: recipientId
        }
        , message: {
            text: messageText
        }
    };
    callSendAPI(messageData);
}

function sendGenericMessage(recipientId, messageObj) {
    var messageData = {
        recipient: {
            id: recipientId
        }
        , message: messageObj
    };
    callSendAPI(messageData);
}

function callSendAPI(messageData) {
    //console.log("messageData")
    request({
        uri: 'https://graph.facebook.com/v2.6/me/messages'
        , qs: {
            access_token: access_token
        }
        , method: 'POST'
        , json: messageData
    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var recipientId = body.recipient_id;
            var messageId = body.message_id;
        }
        else {
            console.log("XXXXXXXXXXXXXXXXXXX error XXXXXXXXXXXXXXX");
            console.log(error);
            console.log(response);
            console.log(body);
            console.log("XXXXXXXXXXXXXXXXXXX error XXXXXXXXXXXXXXX");
        }
    });
}
app.listen(app.get('port'), function () {
    console.log('Node app is running on port', app.get('port'));
});
