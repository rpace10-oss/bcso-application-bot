import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  Events
} from 'discord.js';

/* ============================================================
   UPTIME ROBOT / RENDER KEEPALIVE HTTP SERVER
   ============================================================ */
import express from 'express';

const keepAlive = express();
keepAlive.get('/', (req, res) => {
  res.status(200).send('BCSO Application Bot is alive!');
});

const port = process.env.PORT || 3000;
keepAlive.listen(port, () => {
  console.log(`Keepalive server is running on port ${port}`);
});

/* ============================================================
   DISCORD BOT SETUP
   ============================================================ */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// ====== CONFIG WITH YOUR IDS ======

const LOG_CHANNEL_ID = '1443657155587604625';

// Command / reviewer roles
const DEPUTY_CMD_ROLE_ID = '1443657150068162795';
const TEU_CMD_ROLE_ID = '1443657149669707884';
const FTO_CMD_ROLE_ID = '1443657150068162796';

const REVIEWER_ROLE_IDS = [
  DEPUTY_CMD_ROLE_ID,
  TEU_CMD_ROLE_ID,
  FTO_CMD_ROLE_ID
];

// Application types
const APPLICATION_TYPES = [
  {
    id: 'bcso_deputy',
    label: 'BCSO Deputy Application',
    description: 'Apply to become a Blaine County Sheriff\'s Office Deputy.',
    roleId: '1443657149967499436'
  },
  {
    id: 'fto',
    label: 'FTO Application',
    description: 'Apply to become a Field Training Officer.',
    roleId: '1443657150043000874'
  },
  {
    id: 'teu',
    label: 'Traffic Enforcement Unit Application',
    description: 'Apply to join the Traffic Enforcement Unit.',
    roleId: '1443657149669707881'
  }
];

// ====== QUESTIONS PER APPLICATION TYPE ======
const QUESTIONS_BY_TYPE = {
  bcso_deputy: [
    '1️⃣ What is your age?',
    '2️⃣ What is your time zone?',
    '3️⃣ Why do you want to become a BCSO Deputy?',
    '4️⃣ What prior law enforcement / RP experience do you have?',
    '5️⃣ On average, how many hours per week can you dedicate to BCSO?',
    '6️⃣ Do you have a working microphone and are you comfortable speaking in voice channels?',
    '7️⃣ Is there anything else we should know about you as a Deputy applicant?'
  ],
  fto: [
    '1️⃣ What is your age?',
    '2️⃣ What is your time zone?',
    '3️⃣ How long have you been a BCSO Deputy?',
    '4️⃣ Why do you want to become an FTO?',
    '5️⃣ What qualities make a good trainer?',
    '6️⃣ Describe a time you had to coach someone.',
    '7️⃣ How do you handle a trainee not following SOPs?',
    '8️⃣ Anything else we should know?'
  ],
  teu: [
    '1️⃣ What is your age?',
    '2️⃣ What is your time zone?',
    '3️⃣ Why do you want to join TEU?',
    '4️⃣ Experience with traffic enforcement?',
    '5️⃣ Rate your traffic law knowledge (1–10)',
    '6️⃣ How do you handle high-speed pursuits?',
    '7️⃣ Anything else we should know?'
  ]
};

function getQuestionsForType(typeId) {
  return QUESTIONS_BY_TYPE[typeId] || [];
}

// Active apps
const activeApplications = new Map();

// ====== READY ======
client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Role helpers
function memberIsReviewer(member) {
  return member && member.roles && REVIEWER_ROLE_IDS.some(id => member.roles.cache.has(id));
}

function canReviewType(member, typeId) {
  if (!member) return false;
  if (member.roles.cache.has(DEPUTY_CMD_ROLE_ID)) return true;
  if (typeId === 'fto' && member.roles.cache.has(FTO_CMD_ROLE_ID)) return true;
  if (typeId === 'teu' && member.roles.cache.has(TEU_CMD_ROLE_ID)) return true;
  if (typeId === 'bcso_deputy') return member.roles.cache.has(DEPUTHY_CMD_ROLE_ID);
  return false;
}

/* ============================================================
   /post-app-panel COMMAND
   ============================================================ */
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'post-app-panel') {
    if (!memberIsReviewer(interaction.member)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('BCSO Application Center')
      .setDescription(
        [
          'Use the dropdown below to start an application.',
          '',
          '**Available Applications:**',
          '• BCSO Deputy',
          '• FTO',
          '• TEU',
          '',
          'You will receive DMs with the questions.'
        ].join('\n')
      )
      .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('app_select')
      .setPlaceholder('Select an application type...')
      .addOptions(APPLICATION_TYPES.map(t => ({
        label: t.label,
        description: t.description,
        value: t.id
      })));

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({ content: 'Posted panel.', ephemeral: true });
    await interaction.channel.send({ embeds: [embed], components: [row] });
  }
});

/* ============================================================
   DROPDOWN HANDLER
   ============================================================ */
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== 'app_select') return;

  const typeId = interaction.values[0];
  const type = APPLICATION_TYPES.find(t => t.id === typeId);
  if (!type) return interaction.reply({ content: 'Invalid type.', ephemeral: true });

  const questions = getQuestionsForType(typeId);
  const userId = interaction.user.id;

  if (activeApplications.has(userId)) {
    return interaction.reply({
      content: 'You already have an application in progress.',
      ephemeral: true
    });
  }

  try {
    const dm = await interaction.user.createDM();

    activeApplications.set(userId, {
      answers: [],
      currentIndex: 0,
      guildId: interaction.guildId,
      typeId
    });

    const intro = new EmbedBuilder()
      .setTitle(`${type.label}`)
      .setDescription(
        [
          `I will ask **${questions.length}** questions.`,
          'Answer each in one message.',
          'Type `cancel` to stop.'
        ].join('\n')
      )
      .setColor(0x5865F2);

    await dm.send({ embeds: [intro] });
    await askNextQuestion(userId);

    await interaction.reply({ content: 'Check your DMs.', ephemeral: true });
  } catch {
    return interaction.reply({
      content: 'Could not DM you. Enable DMs.',
      ephemeral: true
    });
  }
});

/* ============================================================
   DM QUESTION FLOW
   ============================================================ */
async function askNextQuestion(userId) {
  const app = activeApplications.get(userId);
  if (!app) return;

  const questions = getQuestionsForType(app.typeId);
  const user = await client.users.fetch(userId);

  if (app.currentIndex >= questions.length) return finalizeApplication(userId);

  const question = questions[app.currentIndex];

  const embed = new EmbedBuilder()
    .setTitle(`Question ${app.currentIndex + 1}`)
    .setDescription(question)
    .setColor(0x2B2D31);

  await user.send({ embeds: [embed] });
}

client.on(Events.MessageCreate, async message => {
  if (message.author.bot || message.guild) return;

  const userId = message.author.id;
  if (!activeApplications.has(userId)) return;

  const app = activeApplications.get(userId);
  const questionSet = getQuestionsForType(app.typeId);

  if (message.content.toLowerCase() === 'cancel') {
    activeApplications.delete(userId);
    return message.channel.send('Application cancelled.');
  }

  app.answers.push(message.content.trim());
  app.currentIndex++;

  if (app.currentIndex >= questionSet.length) {
    await message.channel.send('Your application has been submitted.');
    return finalizeApplication(userId);
  }

  await askNextQuestion(userId);
});

/* ============================================================
   SEND APPLICATION TO LOGS
   ============================================================ */
async function finalizeApplication(userId) {
  const app = activeApplications.get(userId);
  activeApplications.delete(userId);

  const type = APPLICATION_TYPES.find(t => t.id === app.typeId);
  const questions = getQuestionsForType(app.typeId);

  const guild = await client.guilds.fetch(app.guildId);
  const member = await guild.members.fetch(userId).catch(() => null);
  const user = await client.users.fetch(userId);
  const channel = await client.channels.fetch(LOG_CHANNEL_ID);

  const fields = questions.map((q, i) => ({
    name: q,
    value: app.answers[i] || '*No answer*'
  }));

  const embed = new EmbedBuilder()
    .setTitle('New BCSO Application')
    .setDescription(
      `Type: **${type.label}**\nApplicant: ${
        member ? member.toString() : user.tag
      }`
    )
    .addFields(fields)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`review|accept|${type.id}|${userId}`)
      .setLabel('Accept')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`review|deny|${type.id}|${userId}`)
      .setLabel('Deny')
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

/* ============================================================
   ACCEPT / DENY HANDLER
   ============================================================ */
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith('review|')) return;

  const [_, action, typeId, targetUserId] = interaction.customId.split('|');
  const reviewer = interaction.member;

  if (!memberIsReviewer(reviewer)) {
    return interaction.reply({ content: 'No permission.', ephemeral: true });
  }
  if (!canReviewType(reviewer, typeId)) {
    return interaction.reply({
      content: 'You cannot review this application type.',
      ephemeral: true
    });
  }

  const guild = interaction.guild;
  const type = APPLICATION_TYPES.find(t => t.id === typeId);
  const targetMember = await guild.members
    .fetch(targetUserId)
    .catch(() => null);

  if (!targetMember)
    return interaction.reply({
      content: 'User no longer in server.',
      ephemeral: true
    });

  if (action === 'accept') {
    if (type.roleId) await targetMember.roles.add(type.roleId).catch(console.error);

    const embed = new EmbedBuilder()
      .setTitle('Application Approved')
      .setColor(0x2ECC71)
      .setDescription(
        [
          `User: ${targetMember.user.tag} (${targetMember.id})`,
          `Application: ${type.label}`,
          `Approved By: ${reviewer.user.tag} (${reviewer.user.id})`
        ].join('\n')
      )
      .setFooter({ text: `Accepted by ${reviewer.user.tag}` })
      .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });

    try {
      await targetMember.send(
        `✅ Your **${type.label}** application was approved!`
      );
    } catch {}
  } else if (action === 'deny') {
    const embed = new EmbedBuilder()
      .setTitle('Application Denied')
      .setColor(0xED4245)
      .setDescription(
        [
          `User: ${targetMember.user.tag} (${targetMember.id})`,
          `Application: ${type.label}`,
          `Denied By: ${reviewer.user.tag} (${reviewer.user.id})`
        ].join('\n')
      )
      .setFooter({ text: `Denied by ${reviewer.user.tag}` })
      .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });

    try {
      await targetMember.send(
        `❌ Your **${type.label}** application was denied.`
      );
    } catch {}
  }
});

/* ============================================================
   /purge COMMAND HANDLER
   ============================================================ */
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'purge') return;

  const amount = interaction.options.getInteger('amount');

  if (!interaction.member.permissions.has('ManageMessages')) {
    return interaction.reply({
      content: '❌ You do not have permission to use /purge.',
      ephemeral: true
    });
  }

  if (amount < 1 || amount > 100) {
    return interaction.reply({
      content: '❌ Enter a number between 1 and 100.',
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const deleted = await interaction.channel.bulkDelete(amount, true);

    await interaction.editReply(
      `🧹 Deleted **${deleted.size}** messages.`
    );
  } catch (e) {
    console.error(e);
    await interaction.editReply('❌ Unable to delete messages here.');
  }
});

/* ============================================================
   LOGIN
   ============================================================ */
client.login(process.env.DISCORD_TOKEN);
