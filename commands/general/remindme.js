const Command = require('../../bot/command.js');
const { MessageEmbed } = require('discord.js');

class RemindMe extends Command {
  constructor() {
    super('remindme', 'Remind you of a message after a given time!', '[time before reminder]');
  }

  async execute(message, args, client) {
    let timeData = [0, 0, 0]; // Days, Hours, Minutes
    const acceptedWords = ['day', 'hour', 'min'];

    args.forEach((arg, i) => {
      if (arg.match(/^\d+[dhm]$/i)) {
        const index = arg.slice(-1).toLowerCase() == 'h' | (arg.slice(-1).toLowerCase() == 'm') * 2; // If it looks stupid but it works, it ain't stupid
        timeData[index] = Math.abs(parseInt(arg.slice(0, -1)));
      }
      else if (acceptedWords.some(word => arg.toLowerCase().startsWith(word)) && args[i - 1].match(/^\d+$/)) {
        const index = arg.slice(0, 1).toLowerCase() == 'h' | (arg.slice(0, 1).toLowerCase() == 'm') * 2;
        timeData[index] = Math.abs(parseInt(args[i - 1]));
      }
    });
    
    const time = (timeData[0] * 24 * 60 + timeData[1] * 60 + timeData[2]) * 60000;
    if (!time > 0) return message.channel.send({ embeds: [ this.helpMessage(client) ] });
    
    const UIWords = ['days', 'hours', 'minutes'];
    let UIArray = new Array();
    timeData.forEach((data, i) => {
      if (data) UIArray.push(`${data} ${data == 1 ? UIWords[i].slice(0, -1) : UIWords[i]}`);
    });
    const UIString = UIArray.join(', ').replace(/,([^,]*)$/, ' and$1'); // Replace last ', ' with ' and '
    
    const embed = new MessageEmbed()
      .setColor('00cc00')
      .setTitle('Reminder created')
      .setDescription(`Okay! I will remind you in ${UIString}.`)
      .setTimestamp();
    message.channel.send({ embeds: [embed] });

    embed
      .setColor('0066cc')
      .setTitle('Ding!')
      .setDescription('Here\'s your reminder!')
    
    setTimeout(() => message.reply({ embeds: [embed] }), time);
  }
  
  helpMessage(client) {
    return new MessageEmbed()
      .setColor('cc0000')
      .setTitle('Invalid time')
      .setDescription('Maybe check your arguments?')
      .addField('Arguments', '**Days:\nHours:\nMinutes:**', true)
      .addField('\u200b', 'd, day, days\nh, hour, hours\nm, min, mins, minute, minutes', true)
      .addField('Command usage', this.howTo(client.prefix(), true));
  }
}

module.exports = RemindMe;