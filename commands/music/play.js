const ytdl = require("ytdl-core");
const model = require("../../model/model.js");
const dude = require("yt-dude");
const getVideoId = require("get-video-id");
let musicDB = require("../../model/musicData");
let Discord = require("discord.js");
module.exports = {
  config: {
    name: "Play",
    usage: "play [song name]",
    description: "Play a song from youtube",
    ownerOnly: false,
    enabled: true
  },
  async run(client, message, args) {
    client.queue = new Discord.Collection();
    const guildQueue = client.queue.get(message.guild.id);
    if (!guildQueue) {
      let construct = {
        guildID: message.guild.id,
        queue: [],
        isPlaying: false,
        voiceChannel: null,
        connection: null,
        dispatcher: null
      };
      await client.queue.set(message.guild.id, construct);
    }

    if (!message.member.voice.channel) {
      return message.channel.send({
        embed: {
          color: 15158332,
          description: "You have to be in a voiceChannel to use the command."
        }
      });
    }
    if (ytdl.validateURL(args[0])) {
      addQueue(args[0]);
    }
    if (!ytdl.validateURL(args[0])) {
      let query = await dude.search(args);
      let videoUrl = "https://www.youtube.com/watch?v=" + query[0].videoId;
      addQueue(videoUrl);
    }

    //functions
    async function addQueue(url) {
      let songInfo = await ytdl.getInfo(url);
      let songQueue = client.queue.get(message.guild.id);
      let song = {
        title: songInfo.title,
        url: songInfo.video_url,
        thumbnail: getThumbnail(url),
        duration: secondsCoverter(songInfo.length_seconds),
        requester: message.author.tag
      };
      if (songQueue.isPlaying == false) {
        songQueue.queue.push(song);
        if (!songQueue.voiceChannel) {
          songQueue.voiceChannel = message.member.voice.channel;
        }
        songQueue.connection = await songQueue.voiceChannel.join();
        play();
      }
      if (songQueue.isPlaying == true) {
        songQueue.queue.push(song);
        songQueue.sendQueueMessage(message.channel);
      }
    }
    async function play() {
      let songQueue = client.queue.get(message.guild.id);
      songQueue.dispatcher = songQueue.connection
        .play(
          ytdl(songQueue.queue[0].url, {
            filter: "audioonly",
            quality: "highestaudio",
            highWaterMark: 1 << 25,
            encoderArgs: ["-af", `equalizer=f=40:width_type=h:width=50:g=50`]
          })
        )
        .on("start", () => {
          console.log(songQueue.queue);
          songQueue.isPlaying = true;
          model.sendPlayMessage(songQueue, message);
          addTopSong(songQueue.queue[0].title);
        })
        .on("finish", () => {
          songQueue.queue.shift();
          if (songQueue.queue[0]) {
            console.log("next song url " + songQueue.queue[0].url);
            play();
          }
          if (!songQueue.queue[0]) {
            songQueue.voiceChannel.leave();
            songQueue.isPlaying = false;
            message.channel.send({
              embed: {
                color: 15158332,
                title: "Leaving voiceChannel",
                description: "No songs left in the queue"
              }
            });
            client.queue.delete(message.guild.id);
          }
        })
        .on("volumeChange", (oldVolume, newVolume) => {
          message.channel.send({
            embed: {
              title: `Volume changed from ${oldVolume} to ${newVolume}.`,
              author: {
                name: message.client.user.username,
                icon_url: message.client.user.avatarURL({
                  format: "png",
                  dynamic: true,
                  size: 1024
                })
              }
            }
          });
        })
        .on("end", () => {
          songQueue.isPlaying = false;
          updatePresence();
        })
        .on("error", error => {
          console.log(error);
        });
    }
    function getThumbnail(url) {
      let ids = getVideoId(url);
      return `http://img.youtube.com/vi/${ids.id}/maxresdefault.jpg`;
    }
    function addTopSong(title) {
      musicDB.updateCount(title);
    }
    function secondsCoverter(second) {
      second = Number(second);
      var m = Math.floor((second % 3600) / 60);
      var s = Math.floor((second % 3600) % 60);

      return m + ":" + s;
    }
    function updatePresence() {
      let songQueue = client.queue.get(message.guild.id);
      let textChannelId = client.guildSettings.get(message.member.guild.id)
        .musicTextChannel;
      if (textChannelId) {
        if (songQueue.isPlaying === true) {
          message.member.guild.channels.cache
            .find(x => x.id === textChannelId)
            .setTopic("Playing " + songQueue.queue[0].title);
        }
        if (songQueue.isPlaying === false) {
          message.member.guild.channels.cache
            .find(x => x.id === textChannelId)
            .setTopic("Not playing");
        }
      }
    }
  }
};
