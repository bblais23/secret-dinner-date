import * as Discord from 'discord.js';

if(process.env.NODE_ENV === 'development') {
	const discordConfig = require('../discordconfig.json');
	process.env.DISCORD_TOKEN = process.env.DISCORD_TOKEN ?? discordConfig.token;
}

interface DinnerDateMember {
	discordUser: string;
	dmChannel: string;
	dateInstance: DinnerDateInstance;
	address?: string;
}

interface DinnerDateInstance {
	channel: string;
	users: DinnerDateMember[];
	createdBy: string;
}

const dinnerDateStates: { [key: string]: DinnerDateInstance} = {};

const activeDms : {[key: string]: DinnerDateMember} = {};

const bot = new Discord.Client();

bot.on('ready', () => {
	console.log('Logged in as %s - %s', bot.user?.tag, bot.user?.id);
});

async function createDinnerDateUser(dinnerDate: DinnerDateInstance,user: Discord.User): Promise<DinnerDateMember> {

	const dm = await user.createDM();
	const newDateUser: DinnerDateMember = {discordUser: user.id, dateInstance: dinnerDate, dmChannel: dm.id};

	dinnerDate.users.push(newDateUser);
	activeDms[newDateUser.dmChannel] = newDateUser;

	console.log(`User ${user.username} added to the dinner date drawing`);

	return newDateUser;
}

function createDinnerDate(client: Discord.Client, dinnerDateInstances: {[key: string] : DinnerDateInstance}, createdBy: string, channel: string):DinnerDateInstance {
	return dinnerDateStates[channel] = {channel, users: [], createdBy};
}

async function deleteDinnerDate(client: Discord.Client, dinnerDateInstances: { [key: string] : DinnerDateInstance}, dinnerDateId: string): Promise<void> {
	// Remove all the dms
	const dinnerDate = dinnerDateInstances[dinnerDateId];

	dinnerDate.users.map(async ({dmChannel}) => {
		const existingChannel = await client.channels.fetch(dmChannel);

		return existingChannel.delete();
	});

	// Delete the instance
	delete dinnerDateInstances[dinnerDateId];
}

bot.on('message', async (message) => {

	if(!!message.author) {

		// Check for dm, will be in the DM channel
		if(message.channel.type === 'dm') {

			console.log(`DM recieved`);
			if(!!activeDms[message.author.id]) {

				// Update the address
				console.log(`Address updated for ${message.author.username}`);
				console.log(`Address set to: ${message.content}`);
				
				const guest = activeDms[message.channel.id];
				guest.address = message.content;

				// Send a response
				message.channel.send('Awesome! Your address is now added to the list! You will get sent your dinner date\'s address when the drawing is over!\n if you want to change your address just reply to this message with the new one!');
			}
		}

		// Cancel the dinner date
		if(message.content === '!bail') {
			// Check for existing state
			if(!!dinnerDateStates[message.channel.id]) {
				await deleteDinnerDate(bot, dinnerDateStates, message.channel.id);

				// Delete all 
				message.channel.send("Alright! I will cancel that dinner date for you type `!dinnerdate` if you want to create a new one!");
			} else {
				message.channel.send("Looks like there aren't any dinner dates active for this channel :grimacing: maybe you created one in a different channel?");
			}
		}
	
		// Create a new dinner date
		if(message.content === '!dinnerdate') {
			createDinnerDate(bot, dinnerDateStates, message.author.id, message.channel.id);

			console.log(`New state for channel ${message.channel.id} added by ${message.author.username}`);
			message.channel.send("You have set up a secret dinner date! type `!join` to enter! type `!draw` to draw all who joined! type `!bail` to cancel this dinner date.");
		}
	
		// Have a user join an existing dinner date
		if(message.content === '!join') {
			if(!!dinnerDateStates[message.channel.id]) {
				const dinnerDate = dinnerDateStates[message.channel.id];
	
				const dateUser = dinnerDate.users.find(({discordUser}) => discordUser === message.author.id) ?? await createDinnerDateUser(dinnerDate, message.author);

				// Send the message even if they have already joined, something could have gone wrong
				const openDm = await bot.channels.fetch(dateUser.dmChannel) as Discord.DMChannel;
				openDm.send('Hello! thanks for joining the secret dinner date :spaghetti:!\nPlease reply to this message with your address!');
			} else {
				message.channel.send("Looks like there aren't any dinner dates active for this channel :grimacing: maybe you created one in a different channel?");
			}
		}
	}
});

bot.login(process.env.DISCORD_TOKEN);