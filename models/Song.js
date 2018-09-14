const mongoose = require('mongoose');
const { Schema } = mongoose;

const Song = new Schema({
    song: String,
    user: String,
    loc: {
        type: { type: String },
        coordinates: []
    },
    createdAt: {
        type: Date,
        default: new Date()
    }
});
Song.index({ loc: '2dsphere' });
Song.index({ "createdAt": 1 }, { expireAfterSeconds: 259200 });
module.exports = mongoose.model('Songs', Song);