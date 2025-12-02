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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel] // needed so DMs work
});

// ====== CONFIG WITH YOUR IDS ======

// Log channel where applications are sent
const LOG_CHANNEL_ID = '1443657155587604625';

// Command / reviewer roles
const DEPUTY_CMD_ROLE_ID = '1443657150068162795';
const TEU_CMD_ROLE_ID    = '1443657149669707884';
const FTO_CMD_ROLE_ID    = '1443657150068162796';

// Roles allowed to post panel / generally be "review staff"
const REVIEWER_ROLE_IDS = [
  DEPUTY_CMD_ROLE_ID,
  TEU_CMD_ROLE_ID,
  FTO_CMD_ROLE_ID
];

// Application types shown in the dropdown
const APPLICATION_TYPES = [
  {
    id: 'bcso_deputy',
    label: 'BCSO Deputy Application',
    description: 'Apply to become a Blaine County Sheriff\'s Office Deputy.',
    roleId: '1443657149967499436' // Deputy Role
  },
  {
    id: 'fto',
    label: 'FTO Application',
    description: 'Apply to become a Field Training Officer.',
    roleId: '1443657150043000874' // FTO Role
  },
  {
    id: 'teu',
    label: 'Traffic Enforcement Unit Application',
    description: 'Apply to join the Traffic Enforcement Unit.',
    roleId: '1443657149669707881' // TEU Role
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
    '3️⃣ How long have you been a BCSO Deputy in this community (and others, if applicable)?',
    '4️⃣ Why do you want to become an FTO?',
    '5️⃣ What qualities do you think make a good trainer / mentor?',
    '6️⃣ Describe a time you had to correct or coach someone. How did you handle it?',
    '7️⃣ How would you handle a trainee who is not listening to feedback or following SOPs?',
    '8️⃣ Is there anything else we should know about you as an FTO applicant?'
  ],

  teu: [
    '1️⃣ What is your age?',
    '2️⃣ What is your time zone?',
    '3️⃣ Why do you want to join the Traffic Enforcement Unit?',
    '4️⃣ What experience do you have with traffic stops, speed enforcement, and highway patrol RP?',
    '5️⃣ How familiar are you with traffic laws / vehicle code in RP (1–10) and why?',
    '6️⃣ How would you handle a high-speed pursuit as a TEU unit?',
    '7️⃣ Is there anything else we should know about you as a TEU applicant?'
  ]
};

// Helper to get the question list for a type
function getQuestionsForType(typeId) {
  return QUESTIONS_BY_TYPE[typeId] || [];
}

// activeApplications[userId] = { answers, currentIndex, guildId, typeId }
const activeApplications = new Map();

// ====== READY ======
client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Helper: does member have any reviewer role?
function memberIsReviewer(member) {
  if (!member || !member.roles) return false;
  return REVIEWER_ROLE_IDS.some((id) => member.roles.cache.has(id));
}

// Helper: can this member review (accept/deny) this specific type?
function canReviewType(member, typeId) {
  if (!member || !member.roles) return false;

  // Deputy cmd can review ALL application types
  if (member.roles.cache.has(DEPUTY_CMD_ROLE_ID)) return true;

  // FTO cmd can only review FTO apps
  if (typeId === 'fto' && member.roles.cache.has(FTO_CMD_ROLE_ID)) return true;

  // TEU cmd can only review TEU apps
  if (typeId === 'teu' && member.roles.cache.has(TEU_CMD_ROLE_ID)) return true;

  // No one except Deputy cmd can review Deputy apps
  if (typeId === 'bcso_deputy') {
    return member.roles.cache.has(DEPUTY_CMD_ROLE_ID);
  }

  return false;
}

// ====== /post-app-panel COMMAND ======
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'post-app-panel') {
    // Only people with a reviewer role can post the panel
    if (!memberIsReviewer(interaction.member)) {
      return interaction.reply({
        content: 'You do not have permission to post the application panel.',
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('BCSO Application Center')
      .setDescription(
        [
          'Use the dropdown below to start an application.',
          '',
          '**Available Applications:**',
          '• BCSO Deputy',
          '• Field Training Officer (FTO)',
          '• Traffic Enforcement Unit (TEU)',
          '',
          'Once selected, the bot will DM you a series of questions.'
        ].join('\n')
      )
      .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('app_select')
      .setPlaceholder('Select an application type...')
      .addOptions(
        APPLICATION_TYPES.map((t) => ({
          label: t.label,
          description: t.description,
          value: t.id
        }))
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
      content: 'BCSO application panel posted.',
      ephemeral: true
    });

    await interaction.channel.send({
      embeds: [embed],
      components: [row]
    });
  }
});

// ====== DROPDOWN SELECTION HANDLER ======
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== 'app_select') return;

  const typeId = interaction.values[0];
  const type = APPLICATION_TYPES.find((t) => t.id === typeId);

  if (!type) {
    return interaction.reply({
      content: 'Invalid application type selected.',
      ephemeral: true
    });
  }

  const questions = getQuestionsForType(typeId);
  if (!questions.length) {
    return interaction.reply({
      content: 'This application type has no questions configured.',
      ephemeral: true
    });
  }

  const userId = interaction.user.id;

  if (activeApplications.has(userId)) {
    return interaction.reply({
      content:
        'You already have an application in progress in DMs. Please finish it or type `cancel` in DM to cancel.',
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

    await dm.send(
      `You selected **${type.label}**.\n\nI will ask you **${questions.length}** questions. Please answer each one in a single message.\n\nType \`cancel\` at any time to cancel.`
    );

    await askNextQuestion(userId);

    await interaction.reply({
      content: 'I sent you a DM with the application questions.',
      ephemeral: true
    });
  } catch (err) {
    console.error(err);
    return interaction.reply({
      content:
        'I could not DM you. Please enable DMs from server members and try again.',
      ephemeral: true
    });
  }
});

// ====== DM QUESTION FLOW ======
async function askNextQuestion(userId) {
  const app = activeApplications.get(userId);
  if (!app) return;

  const questions = getQuestionsForType(app.typeId);
  const user = await client.users.fetch(userId);

  if (app.currentIndex >= questions.length) {
    await finalizeApplication(userId);
    return;
  }

  const question = questions[app.currentIndex];
  const dm = await user.createDM();
  await dm.send(question);
}

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (message.guild) return; // only DMs

  const userId = message.author.id;
  if (!activeApplications.has(userId)) return;

  const app = activeApplications.get(userId);
  const content = message.content.trim();

  if (content.toLowerCase() === 'cancel') {
    activeApplications.delete(userId);
    return message.channel.send('Your application has been cancelled.');
  }

  app.answers.push(content);
  app.currentIndex++;
  activeApplications.set(userId, app);

  const questions = getQuestionsForType(app.typeId);

  if (app.currentIndex >= questions.length) {
    await message.channel.send(
      'Thank you! Your application has been submitted for review.'
    );
    await finalizeApplication(userId);
  } else {
    await askNextQuestion(userId);
  }
});

// ====== FINALIZE & SEND TO LOG CHANNEL ======
async function finalizeApplication(userId) {
  const app = activeApplications.get(userId);
  if (!app) return;

  const type = APPLICATION_TYPES.find((t) => t.id === app.typeId);
  const typeLabel = type ? type.label : 'Unknown Application Type';

  const questions = getQuestionsForType(app.typeId);

  const user = await client.users.fetch(userId);
  const guild = await client.guilds.fetch(app.guildId);
  const member = await guild.members.fetch(userId).catch(() => null);
  const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);

  const fields = questions.map((q, index) => ({
    name: q,
    value: app.answers[index] || '*No answer*'
  }));

  const embed = new EmbedBuilder()
    .setTitle('New BCSO Application')
    .setDescription(
      `Type: **${typeLabel}**\nApplicant: ${
        member ? member.toString() : user.tag
      }\nID: ${user.id}`
    )
    .addFields(fields)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`review|accept|${app.typeId}|${user.id}`)
      .setLabel('Accept')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`review|deny|${app.typeId}|${user.id}`)
      .setLabel('Deny')
      .setStyle(ButtonStyle.Danger)
  );

  await logChannel.send({ embeds: [embed], components: [row] });

  activeApplications.delete(userId);
}

// ====== REVIEW BUTTONS: ACCEPT / DENY ======
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  // Buttons now have format: review|accept|typeId|userId
  if (!interaction.customId.startsWith('review|')) {
    return;
  }

  const reviewer = interaction.member;

  // Must at least be one of the reviewer roles to touch the buttons at all
  if (!memberIsReviewer(reviewer)) {
    return interaction.reply({
      content: 'You do not have permission to review applications.',
      ephemeral: true
    });
  }

  const parts = interaction.customId.split('|'); // ['review','accept', typeId, userId]
  const action = parts[1];        // 'accept' or 'deny'
  const typeId = parts[2];        // e.g. 'bcso_deputy'
  const targetUserId = parts[3];  // actual Discord user ID

  const guild = interaction.guild;
  const targetMember = await guild.members.fetch(targetUserId).catch(() => null);

  if (!targetMember) {
    return interaction.reply({
      content: 'User is no longer in the server.',
      ephemeral: true
    });
  }

  const type = APPLICATION_TYPES.find((t) => t.id === typeId);

  // Per-type review restriction: applies to both accept & deny
  if (!canReviewType(reviewer, typeId)) {
    return interaction.reply({
      content: 'You do not have permission to review this type of application.',
      ephemeral: true
    });
  }

  if (action === 'accept') {
    // Give the appropriate role
    if (type && type.roleId) {
      await targetMember.roles.add(type.roleId).catch(console.error);
    }

    const oldEmbed = interaction.message.embeds[0];
    const updatedEmbed = EmbedBuilder.from(oldEmbed).setFooter({
      text: `Accepted by ${reviewer.user.tag}`
    });

    await interaction.update({
      embeds: [updatedEmbed],
      components: []
    });

    // DM user
    try {
      await targetMember.send(
        `✅ Your **${type ? type.label : 'application'}** in **${guild.name}** has been accepted!`
      );
    } catch (e) {
      console.error('Could not DM user about acceptance:', e);
    }
  } else if (action === 'deny') {
    const oldEmbed = interaction.message.embeds[0];
    const updatedEmbed = EmbedBuilder.from(oldEmbed).setFooter({
      text: `Denied by ${reviewer.user.tag}`
    });

    await interaction.update({
      embeds: [updatedEmbed],
      components: []
    });

    // DM user
    try {
      await targetMember.send(
        `❌ Your **${type ? type.label : 'application'}** in **${guild.name}** has been denied.`
      );
    } catch (e) {
      console.error('Could not DM user about denial:', e);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
