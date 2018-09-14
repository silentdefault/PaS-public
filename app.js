const express = require('express'),
    cookieSession = require('cookie-session'),
    https = require('https'),
    fs = require('fs'),
    app = express(),
    SpotifyWebApi = require('spotify-web-api-node'),
    mongoose = require('mongoose'),
    bodyParser = require('body-parser');
mongoose.connect('mongodb://localhost/pas');

const options = {
    cert: fs.readFileSync('certificate.crt'),
    key: fs.readFileSync('private.key'),
    ca: fs.readFileSync('ca_bundle.crt')
};

var scopes = 'user-read-private user-read-email user-read-currently-playing user-read-playback-state user-modify-playback-state',
    redirectUri = 'https://pin-a-song.tk/callback',//'https://192.168.1.185:8443/callback',
    clientId = 'SpotifyClientID';

// credentials are optional
var spotifyApi = new SpotifyWebApi({
    clientId: clientId,
    clientSecret: 'SpotifyClientSecret',
    redirectUri: redirectUri
});
app.set('port', process.env.PORT || 3000);
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieSession({
    name: 'session',
    keys: ['key1', 'key2'],

    // Cookie Options
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
}))


const Song = require('./models/Song')

app.get('/', async (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.get('/app', requireLogin, async (req, res) => {
    res.sendFile(__dirname + '/app.html');
});

app.get('/login', function (req, res) {
    res.redirect('https://accounts.spotify.com/authorize' +
        '?response_type=code' +
        '&client_id=' + clientId +
        (scopes ? '&scope=' + encodeURIComponent(scopes) : '') +
        '&redirect_uri=' + encodeURIComponent(redirectUri));
});

app.get('/callback', async (req, res) => {
    spotifyApi.authorizationCodeGrant(req.query.code).then(
        function (data) {
            req.session = {
                access_token: data.body['access_token'],
                refresh_token: data.body['refresh_token']
            };
            spotifyApi.setAccessToken(req.session.access_token);
            spotifyApi.setRefreshToken(req.session.refresh_token);
            spotifyApi.getMe()
                .then(function (data) {
                    req.session.user = data.body.id;
                    res.redirect('/app');
                }, function (err) {
                    console.log('Something went wrong!', err);
                });
        },
        function (err) {
            console.log('Something went wrong!', err);
        }
    );
});

async function requireLogin(req, res, next) {
    if (!req.session.access_token) {
        res.redirect('/login');
    } else {
        await spotifyApi.setAccessToken(req.session.access_token);
        spotifyApi.setRefreshToken(req.session.refresh_token);
        next();
    }
};

app.get('/player', requireLogin, (req, res) => {
    spotifyApi.getMyCurrentPlaybackState({
    })
        .then(function (data) {
            var curr = data.body.item;
            res.json({ player: { name: curr.name, id: curr.id, artist: curr.artists[0].name, image: curr.album.images[0].url, data: data.body.device.id } });
        }, function (err) {
            res.json({ player: { name: '--none--' } })
        });
});

app.post('/play', requireLogin, (req, res) => {
    spotifyApi.play({ "uris": [`spotify:track:${req.body.track}`] })
        .then(function (data) {
            res.json({ player: 'oks' });
        }, function (err) {
            res.json({ err })
        });
});

app.post('/post', async (req, res) => {
    Song.create({ createdAt: new Date(), song: req.body.song, user: req.session.user, loc: { type: "Point", coordinates: [Number(req.body.gps.lon), Number(req.body.gps.lat)] } }, function (err) {
        res.json({ user: req.session.user, gps: { lat: req.body.gps.lat, lon: req.body.gps.lon }, song: req.body.song });
    });
});

app.post('/nearby', async (req, res) => {
    Song.find({ loc: { $near: { type: 'Point', coordinates: [req.body.lon, req.body.lat] }, $maxDistance: 100 } }, null, { sort: { createdAt: -1 } }, function (err, docs) {
        if (err) res.json([]);
        spotifyApi.getTracks(docs.map(x => x.song))
            .then(function (data) {
                a = data.body.tracks;
                res.json(a.map(x => {
                    z = {};
                    z.id = x.id;
                    z.name = x.name;
                    z.artist = x.artists[0].name;
                    return z;
                }))
            }, function (err) {
                res.json([]);
            });
    });
});

var server = https.createServer(options, app).listen(8443);

var http = require('http');
http.createServer(function (req, res) {
    res.writeHead(301, { "Location": "https://" + req.headers.host + req.url });
    res.end();
}).listen(3000);