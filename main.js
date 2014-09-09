var express = require('express')
    , request = require('request')
    , http = require('http'),
    POOL = new http.Agent();
POOL.maxSockets = 2;
var MailParser = require("mailparser").MailParser;

var app = express();
var CODE;
var COUNTER = 0;
var resultList = [];

function addGetParams(url, params) {
    var first = true;
    for (var key in params) {
        if (first) {
            url += '?';
            first = false;
        } else url += '&';
        url += key+ '=' + params[key];
    }
    console.log(url);
    return url;
}

function callGoogleAPI(url, params, callback) {
    url = addGetParams(url, params);
    request.get({
        url: url,
        pool: POOL,
        headers: {
            'Authorization': 'Bearer ' + CODE,
            'Host': 'www.googleapis.com'
        },
        json: true
    }, callback);
}


function getMsgList(pageNumber, prev_messages, callback) {
    console.log('getting page', pageNumber);
    var url = 'https://www.googleapis.com/gmail/v1/users/me/messages';
    var params = {
        includeSpamTrash: true,
        q: 'in:spam',
        fields: 'messages/id,nextPageToken'
    };
    if (pageNumber) params.pageToken = pageNumber;
    callGoogleAPI(url, params, function(error, response, body) {
        var messages = body.messages;
        if (prev_messages) messages = messages.concat(prev_messages);
        if (body.nextPageToken) {
            setTimeout(function() {
                getMsgList(response.body.nextPageToken, messages, callback);
            }, 100);
            return;
        } else {
            callback(messages);
        }
    });
}

function parseEmailAddresses(text) {
    var re = /[0-9a-zA-Z-._+]*?@[0-9a-zA-Z-._+]{2,}/g;
    var emails = text.match(re);
    if (emails) return emails;
    else return [];
}

function getEmailsContent(list) {
    for (var k in list) {
        var id = list[k].id;
        var url = 'https://www.googleapis.com/gmail/v1/users/me/messages/' + id;
        callGoogleAPI(url, {format:'raw'}, function(error, response, body) {
            var email = new Buffer(body.raw, 'base64');
            var mailparser = new MailParser();
            mailparser.on("end", function(mail_object){
                COUNTER++;
                console.log('::',COUNTER);
                var text = JSON.stringify(mail_object.from) + "\n" + mail_object.subject + "\n" + mail_object.text;
                var emails = parseEmailAddresses(text);
                for (var i in emails) {
                    if (resultList.indexOf(emails[i]) == -1) {
                        resultList.push(emails[i]);
                        console.log(emails[i]);
                    }
                }
            });
            mailparser.write(email.toString());
            mailparser.end();
        });
    }


}

app.get('/', function(req, res){
    var OAuth2 = require('oauth').OAuth2;
    var clientID = 'SPECIFY_CLIENT_ID';
    var clientSecret = 'SPECIFY_CLIENT_SECRET';
    var oauth2 = new OAuth2(clientID,
        clientSecret,
        'https://accounts.google.com/',
        'o/oauth2/auth',
        'o/oauth2/token',
        null);
    var authURL = oauth2.getAuthorizeUrl({
        redirect_uri: 'http://SPECIFY_CLIENT_URL:8000/?method=oauth2callback',
        scope: ['https://www.googleapis.com/auth/gmail.readonly'],
        response_type: 'code',
        state: 'some random string to protect against cross-site request forgery attacks'
    });

    if (req.query.method && req.query.method == 'oauth2callback') {
        oauth2.getOAuthAccessToken(
            req.query.code,
            {
                client_id: clientID,
                client_secret: clientSecret,
                redirect_uri: 'http://SPECIFY_CLIENT_URL:8000/?method=oauth2callback',
                grant_type: 'authorization_code'
            },
            function (e, access_token, refresh_token, results){
                console.log(results);
                if (e) {
                    console.log(e);
                    res.send(e);
                } else if (results.error) {
                    console.log(results);
                    res.send(JSON.stringify(results));
                }
                else {
                    CODE = access_token;
                    res.send('ok');
                    getMsgList(null, [], function(list) {
                        getEmailsContent(list);
                    });
                }
            });
        return;
    }

    res.redirect(authURL);
});

app.listen(8000);


