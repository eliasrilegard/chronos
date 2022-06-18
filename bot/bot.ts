import { Client, Collection, DMChannel, GuildChannel, Message, MessageEmbed, PermissionResolvable } from 'discord.js';
import { readdir } from 'fs/promises';
import { resolve } from 'path';
import ApiClient from './api';
import Command from './command';
import ClientEvent from './event';
import MhwClient from './mhw';

interface ClientConfig {
  readonly bot: {
    readonly defaultPrefix: string;
    readonly invite: string;
  }
  readonly users: {
    readonly [key: string]: string;
  }
}

class Bot extends Client {
  public readonly root: string;
  public readonly config: ClientConfig;
  public readonly categories: Collection<string, Collection<string, Command>>;
  public readonly commands: Collection<string, Command>;

  public readonly apiClient: ApiClient;
  public readonly mhwClient: MhwClient;

  public constructor(dirname: string, config: ClientConfig) {
    super({
      intents: ['GUILDS', 'GUILD_MEMBERS', 'GUILD_BANS', 'GUILD_EMOJIS_AND_STICKERS', 'GUILD_INVITES', 'GUILD_PRESENCES', 'GUILD_MESSAGES', 'GUILD_MESSAGE_REACTIONS', 'DIRECT_MESSAGES', 'DIRECT_MESSAGE_REACTIONS'],
      partials: ['CHANNEL']
    });

    this.root = dirname.slice(0, -3);
    this.config = config;
    this.categories = new Collection();
    this.commands = new Collection();

    this.apiClient = new ApiClient(this.root.slice(0, -5).concat('database'));
    this.mhwClient = new MhwClient();

    this.loadEvents();
    this.loadCommands();
  }

  private async loadEvents(): Promise<void> {
    for await (const file of this.getFiles(this.root.concat('events'))) {
      const { default: EventClass } = await import(file);
      const event: ClientEvent = new EventClass();
      if (event.once) this.once(event.name, (...args) => event.execute(this, ...args));
      else this.on(event.name, (...args) => event.execute(this, ...args));
    }
  }

  private async loadCommands(): Promise<void> {
    for await (const file of this.getFiles(this.root.concat('commands'))) {
      const { default: CommandClass } = await import(file);
      const command: Command = new CommandClass();
      if (command.category) this.categories.set(command.name, new Collection());
      if (command.belongsTo) this.categories.get(command.belongsTo).set(command.name, command);
      else this.commands.set(command.name, command);
    }
  }

  // Generator method to recursively get all files within a directory
  public async* getFiles(rootPath: string): AsyncGenerator<string> {
    const fileNames = await readdir(rootPath, { withFileTypes: true });
    for (const fileName of fileNames) {
      const path = resolve(rootPath, fileName.name);
      if (fileName.isDirectory()) yield* this.getFiles(path);
      else yield path;
    }
  }

  public async prefix(message?: Message): Promise<string> {
    const prefix = this.config.bot.defaultPrefix ? this.config.bot.defaultPrefix : '>';
    if (!message) return prefix;
    const customPrefix = await this.apiClient.getCustomPrefix(message.guildId);
    return customPrefix ? customPrefix : prefix;
  }

  public isDev(id: string): boolean {
    const devs = [
      this.config.users.chrono_id
    ];
    return devs.includes(id);
  }

  // Return true if all checks passed
  public async preRunCheck(message: Message, args: Array<string>, command: Command): Promise<boolean> {
    // Ignore non-dev attemps at launching dev commands
    if (command.devOnly && !this.isDev(message.author.id)) return false;

    // Check if a server-only command being triggered in a DM
    if (command.guildOnly && message.channel instanceof DMChannel) {
      const embed = new MessageEmbed()
        .setColor('#cc0000')
        .setTitle('Server-only command')
        .setDescription('This command cannot be executed inside of DMs.');
      message.channel.send({ embeds: [embed] });
      return false;
    }

    // Verify user has sufficient permissions
    if (command.permissions) {
      const authorPerms = (message.channel as GuildChannel).permissionsFor(message.author);
      if ((!authorPerms || !authorPerms.has(command.permissions as PermissionResolvable)) &&
        !this.isDev(message.author.id)) {
        const embed = new MessageEmbed()
          .setColor('#cc0000')
          .setTitle('Insufficient permissions')
          .setDescription('You do not have permission to issue this command.');
        message.channel.send({ embeds: [embed] });
        return false;
      }
    }

    // Check if arguments are provided if required
    if (command.args && args.length === 0) {
      const prefix = await this.prefix(message);
      const commandUsage = command.usages.map(usage => `${prefix}${command.belongsTo ? command.belongsTo + ' ' : ''}${command.name} ${usage}`).join('\n').trim();
      const embed = new MessageEmbed()
        .setColor('#cc0000')
        .setTitle('No arguments given')
        .addField('Usage: ', commandUsage)
        .addField('Description: ', command.description);
      message.channel.send({ embeds: [embed] });
      return false;
    }

    // Manage cooldown for user on command
    const expirationTime = command.cooldowns.get(message.author.id);
    if (expirationTime && !command.category && !this.isDev(message.author.id)) {
      const timeLeft = (expirationTime - Date.now()) / 1000;
      const embed = new MessageEmbed()
        .setColor('#cc6600')
        .setTitle('Too hasty')
        .setDescription(`Please wait ${timeLeft.toFixed(1)} more second(s) before using \`${command.name}\` again`);
      const embedMessage = await message.channel.send({ embeds: [embed] });
      setTimeout(() => embedMessage.delete(), 7000);
      return false;
    }
    if (!command.category) {
      command.cooldowns.set(message.author.id, Date.now() + command.cooldown);
      setTimeout(() => command.cooldowns.delete(message.author.id), command.cooldown);
    }

    return true; // All checks passed
  }
}

export default Bot;