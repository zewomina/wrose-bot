const fs = require("fs");
const ytdl = require("ytdl-core");
const {
  YouTube
} = require("better-youtube-api");
const musicModel = require('../../model/model.js');
const db = require('../../model/db.js');

module.exports = {
  name: 'play',
  async run(message, args) {
    var voiceChannel = message.member.voiceChannel;
    if (!voiceChannel) return message.channel.send('vao channel truoc da~.')
    if (ytdl.validateURL(args[0])) {
      if (musicModel.isPlaying == true) {
        return musicModel.queue.push(args[0])
      }
      musicModel.queue.push(args[0]);
      musicModel.connection = await voiceChannel.join();
      play();
    }
    musicModel.songInfo = await ytdl.getInfo(musicModel.queue[0]);

    function play() {
      var queue = musicModel.queue;
      const dispatcher = musicModel.connection.playStream(ytdl(queue[0], {
          filter: "audioonly",
          quality: "highestaudio",
          highWaterMark: 1 << 25
        }))
        .on("start", () => {
          console.log("playing");
          musicModel.isPlaying = true;
          message.channel.send({
            embed: {
              title: musicModel.songInfo.title,
              description: 'tests',
            }
          });
        })
        .on("end", () => {
          if (!queue[0]) voiceChannel.leave();
          musicModel.isPlaying = false;
          play();
        })
    }
  }
}