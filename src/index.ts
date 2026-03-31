import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Events,
  VoiceState,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Message,
  ButtonInteraction,
} from 'discord.js';
import {
  startPlaying,
  stopPlaying,
  skipCurrent,
  likeCurrent,
  getNowPlaying,
} from './player.js';
import { initDb } from './db.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Track now-playing messages per guild for updating
const npMessages = new Map<string, Message>();

async function sendNowPlaying(
  channel: import('discord.js').TextChannel,
  guildId: string,
): Promise<void> {
  const np = getNowPlaying(guildId);
  if (!np) return;

  const embed = new EmbedBuilder()
    .setColor(0x8b6f47) // warm coffee brown
    .setTitle('☕ now playing')
    .setDescription(`**${np.stream.title}**`)
    .setFooter({ text: 'lofi-kissa • leave the channel to stop' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('like')
      .setEmoji('❤️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('skip')
      .setEmoji('⏭️')
      .setStyle(ButtonStyle.Secondary),
  );

  // Delete previous message if exists
  const prev = npMessages.get(guildId);
  if (prev) await prev.delete().catch(() => {});

  const msg = await channel.send({ embeds: [embed], components: [row] });
  npMessages.set(guildId, msg);
}

// Auto-join when the bot owner joins a voice channel
client.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
  const ownerId = process.env.OWNER_ID;
  if (newState.member?.id !== ownerId) return;

  // Owner joined a voice channel
  if (!oldState.channel && newState.channel) {
    try {
      await startPlaying(newState.channel);

      // Find first text channel to post now-playing
      const textChannel = newState.guild.channels.cache
        .filter((ch) => ch.isTextBased() && ch.isSendable())
        .first();

      if (textChannel && textChannel.isTextBased() && textChannel.isSendable()) {
        await sendNowPlaying(
          textChannel as import('discord.js').TextChannel,
          newState.guild.id,
        );
      }
    } catch (e) {
      console.error('Failed to start playing:', e);
    }
  }

  // Owner left the voice channel
  if (oldState.channel && !newState.channel) {
    stopPlaying(oldState.guild.id);
    const prev = npMessages.get(oldState.guild.id);
    if (prev) {
      await prev.delete().catch(() => {});
      npMessages.delete(oldState.guild.id);
    }
  }
});

// Button interactions
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  const btn = interaction as ButtonInteraction;
  const guildId = btn.guildId;
  if (!guildId) return;

  if (btn.customId === 'like') {
    likeCurrent(guildId);
    await btn.reply({ content: '❤️', ephemeral: true });
  } else if (btn.customId === 'skip') {
    skipCurrent(guildId);
    await btn.reply({ content: '⏭️ skipping...', ephemeral: true });
    // Give player time to restart, then update now-playing message
    setTimeout(async () => {
      const np = getNowPlaying(guildId);
      if (!np) return;
      const prev = npMessages.get(guildId);
      if (!prev?.channel) return;
      await sendNowPlaying(
        prev.channel as import('discord.js').TextChannel,
        guildId,
      );
    }, 3000);
  }
});

client.once(Events.ClientReady, (c) => {
  console.log(`☕ lofi-kissa ready — logged in as ${c.user.tag}`);
});

initDb()
  .then(() => client.login(process.env.DISCORD_TOKEN))
  .catch((e) => { console.error('Failed to initialize DB:', e); process.exit(1); });
