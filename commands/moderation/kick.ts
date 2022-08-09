import { Message, MessageEmbed } from 'discord.js';
import Bot from '../../bot/bot';
import Command from '../../bot/command';
import UtilityFunctions from '../../utils/utilities';

export default class Kick extends Command {
  constructor(client: Bot) {
    super(
      client,
      'kick',
      'Kick a member',
      ['[@member] (reason)'],
      { guildOnly: true, permissions: 'KICK_MEMBERS' }
    );
  }

  async execute(message: Message, args: Array<string>): Promise<void> {
    const member = message.mentions.members.first();
    const reason = args.slice(1).join(' ');

    const embed = new MessageEmbed().setColor(this.client.config.colors.RED);

    if (!member) {
      embed
        .setTitle('No user targeted')
        .addField('Command usage', this.howTo(await this.client.prefix(message), true));
      message.channel.send({ embeds: [embed] });
      return;
    }
    if (member.id === message.author.id) {
      embed
        .setTitle('You can\'t kick yourself')
        .setFooter({ text: 'Just leave 4Head' });
      message.channel.send({ embeds: [embed] });
      return;
    }
    if (member.id === this.client.user.id) {
      embed.setTitle('I can\'t kick myself');
      message.channel.send({ embeds: [embed] });
      return;
    }
    if (this.client.isDev(member.id)) {
      embed
        .setTitle('Using my own weapons against me...')
        .setFooter({ text: 'No, I don\'t think that\'ll work' });
      message.channel.send({ embeds: [embed] });
      return;
    }
    if (UtilityFunctions.permHierarchy(member, message.member) && !message.member.permissions.has('ADMINISTRATOR')) {
      embed
        .setTitle('Can\'t kick member')
        .setDescription('You can\'t kick someone equal to or above you');
      message.channel.send({ embeds: [embed] });
      return;
    }
    if (UtilityFunctions.permHierarchy(member, message.guild.members.resolve(this.client.user))) {
      embed
        .setTitle('Can\'t kick member')
        .setDescription('Specified user is above my highest role.');
      message.channel.send({ embeds: [embed] });
      return;
    }
    if (!member.kickable) { // Failsafe
      embed
        .setTitle('Can\'t kick member')
        .setDescription(`<@${member.user.id}> cannot be kicked.`);
      message.channel.send({ embeds: [embed] });
      return;
    }

    member.kick(reason);

    embed
      .setColor(this.client.config.colors.GREEN)
      .setTitle('Success')
      .setDescription(`Successfully kicked <@${member.user.id}>${reason.length > 0 ? `for ${reason}` : ''}.`);
    message.channel.send({ embeds: [embed] });
  }
}