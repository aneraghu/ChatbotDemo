var mongose = require('mongoose');
var Schema = mongose.Schema;
var McDonaldsBotUserScheme = new Schema({
    fbid: {
        type: Number
        , index: true
        , unique: true
    }
    , first_name: {
        type: String
        , "default": ""
    }
    , last_name: {
        type: String
        , "default": ""
    }
    , gender: {
        type: String
        , "default": ""
    }
    , rate: {
        type: Number
        , "default": 0
    }
    , redeem: {
        type: Number
        , "default": 0
    }
    , lastAction: {
        type: String
        , "default": ""
    }
    , couponCode: {
        type: String
        , "default": ""
    }
    , createdDate: {
        type: Date
        , default: Date.now
    }
, });
module.exports = mongose.model("McDonaldsBotUser", McDonaldsBotUserScheme);