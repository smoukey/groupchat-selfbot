const { Client } = require('discord.js-selfbot-v13');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

const token = config.token;
const ownerIds = config.ownerIds;
const groupId = config.groupId;
const commandCooldown = new Set();
const votekickTime = config.votekickTime;
const votesRequired = config.votesRequired;

const client = new Client();

function addCooldown(message) {
    commandCooldown.add(message.author.id);
    setTimeout(() => {
        commandCooldown.delete(message.author.id);
    }, config.commandCooldown);
}

client.on('messageCreate', async (message) => {
    if (commandCooldown.has(message.author.id)) return;

    if (message.channelId) {
        if (message.content.startsWith(',kick') && ownerIds.includes(message.author.id)) {
            addCooldown(message);
            const args = message.content.split(' ');
            if (args.length === 2) {
                let userId;
                if (args[1].startsWith('<@') && args[1].endsWith('>')) {
                    userId = args[1].replace(/[<@!>]/g, '');
                } else {
                    userId = args[1];
                }
                try {
                    const user = await client.users.fetch(userId);
                    if (!user) {
                        console.error(`Unknown user: ${userId}`);
                        return;
                    }
                    if (ownerIds.includes(user.id)) {
                        await message.channel.send("You can't remove an owner.");
                        return;
                    }
                    await message.channel.removeUser(user);
                } catch (error) {
                    console.error(`Error removing user: ${error.message}`);
                }
            } else {
                await message.channel.send("Incorrect usage. Correct syntax: `,kick <userID>` or `,kick @mention`");
            }
        }

        else if (message.content.startsWith(',votekick')) {
            addCooldown(message);
            const now = Date.now();
            if (now - lastVoteKickTime < 60000) {
                if (!delayMessageSent) {
                    delayMessageSent = true;
                    await message.channel.send("Please wait a moment before initiating another vote.");
                    setTimeout(() => {
                        delayMessageSent = false;
                    }, 5000);
                }
                return;
            }
            lastVoteKickTime = now;
            await handleVoteKick(message);
        }
    }
});

async function handleVoteKick(message) {
    try {
        const channel = message.channel;
        const userId = message.mentions.users.first()?.id;
        if (!userId) {
            await channel.send("Please mention a user to kick.");
            return;
        }
        const filter = (reaction, user) => reaction.emoji.name === '✅';
        const collector = message.createReactionCollector({ filter, time: votekickTime });
        collector.on('collect', async (reaction, user) => {
            const voteCount = reaction.count - 1;
            if (voteCount >= votesRequired) {
                collector.stop();
                const userToKick = await client.users.fetch(userId);
                if (ownerIds.includes(userToKick.id)) {
                    await channel.send("You cannot kick an owner.");
                    return;
                }
                await channel.removeUser(userToKick);
            }
        });
        collector.on('end', async (collected) => {
            const voteCount = collected.reduce((acc, reaction) => acc + reaction.count, 0) - 1;
            if (voteCount < votesRequired) {
                await channel.send(`Votekick failed. Required ${votesRequired} votes, got ${voteCount}.`);
            }
        });
        await message.react('✅');
    } catch (error) {
        console.error(`Error in handleVoteKick: ${error.message}`);
    }
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.login(token);
