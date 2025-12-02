import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const commands = [
  // Post Application Panel
  new SlashCommandBuilder()
    .setName('post-app-panel')
    .setDescription('Post the BCSO application selection panel in this channel.')
    .setDefaultMemberPermissions(0) // permission checked in index.js
    .toJSON(),

  // Purge Command
  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete a number of recent messages from this channel.')
    .addIntegerOption((option) =>
      option
        .setName('amount')
        .setDescription('Number of messages to delete (1–100)')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(0) // we check perms in index.js
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function main() {
  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('Slash commands registered.');
  } catch (error) {
    console.error(error);
  }
}

main();
