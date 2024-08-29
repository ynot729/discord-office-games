import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import { generateSlug } from 'random-word-slugs';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildModeration, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages] });

const token = process.env.DISCORD_TOKEN;
const channelId = process.env.CHANNEL_ID;
const privateChannelId = process.env.PRIVATE_CHANNEL_ID;
const intervalMinutes = process.env.INTERVAL_MINUTES ? parseInt(process.env.INTERVAL_MINUTES) : 5;
const intervalVariance = process.env.INTERVAL_VARIANCE ? parseInt(process.env.INTERVAL_VARIANCE) : 0;
let persistentStoragePath = './standings.json';

if (!token) throw new Error('ENV needs to have DISCORD_TOKEN');
if (!channelId) throw new Error('ENV needs to have CHANNEL_ID');

let channel: TextChannel;
client.once('ready', async () => {
	console.log('Bot is online!');
	channel = (await client.channels.fetch(channelId)) as TextChannel;
	if (privateChannelId) {
		console.warn('⚠️ Doing DEV mode because ENV has PRIVATE_CHANNEL_ID');
		channel = (await client.channels.fetch(privateChannelId)) as TextChannel;
		persistentStoragePath = './standings-dev.json';
	}
	if (!channel) {
		console.error('Channel not found!');
		throw new Error('Channel not found!');
	}
	await loadStanding();
	// await channel.send("Hello, world!");
	// sendRandomMessage();
	askQuestion();
	// setInterval(askQuestion, intervalMinutes * 60 * 1000);
	initSleepLoop();
});

interface Question {
	q: string;
	a: string;
	caseInsensitive?: true;
}
let currentQuestion: Question | null = null;
const questions: (() => Question | Promise<Question>)[] = [
	() => {
		const a = Math.floor(Math.random() * 100);
		const b = Math.floor(Math.random() * 100);
		return { q: `What is \`${a} + ${b}\`?`, a: `${a + b}` };
	},
	() => {
		const thingToSay = generateSlug(3, { format: 'sentence' });
		return {
			q: `Say: \`${thingToSay.toLowerCase()}\` in uppercase`,
			a: thingToSay.toUpperCase(),
		};
	},
	() => {
		const thingToSay = generateSlug(3, { format: 'sentence' });
		return {
			q: `Say: \`${thingToSay.toUpperCase()}\` in lowercase`,
			a: thingToSay.toLowerCase(),
		};
	},
	async () => {
		interface TriviaResponse {
			response_code: number;
			results: {
				category: string;
				type: string;
				difficulty: string;
				question: string;
				correct_answer: string;
				incorrect_answers: string[];
			}[];
		}
		const resp = await fetch('https://opentdb.com/api.php?amount=1&difficulty=easy&type=multiple').then((res) => res.json() as Promise<TriviaResponse>);
		if (!resp.results || !Array.isArray(resp.results) || resp.results.length == 0) throw new Error('Invalid response when getting trivia');
		const question = resp.results[0];
		let q = question.question.replace(/&quot;/g, '"').replace(/&#039;/g, "'");
		const answers = [question.correct_answer, ...question.incorrect_answers];
		answers.sort(() => Math.random() - 0.5);

		return {
			q: `${q}\n` + answers.map((a, i) => `- ${a}`).join('\n'),
			a: question.correct_answer,
			caseInsensitive: true,
		};
	},
];
const standings: Record<string, number> = {};

async function loadStanding() {
	try {
		//@ts-ignore the file might not be there on first run
		const loadedStandings = await import(persistentStoragePath);
		Object.assign(standings, loadedStandings.default);
		console.log('Standings loaded!');
		console.log(standings);
	} catch (error) {
		console.error('No standings found');
	}
}

client.on('messageCreate', async (message) => {
	if (message.channel.id === channel.id) {
		const msgDtls = await message.fetch();
		const providedAnswer = msgDtls.content;

		const name = msgDtls.member?.displayName ?? msgDtls.author.displayName;
		// console.log(`Message from: ${name} - ${providedAnswer}`);

		if (name == 'office games') return; // no need to respond when we sent the message

		if (currentQuestion) {
			let isCorrect = currentQuestion.caseInsensitive ? currentQuestion.a.toLowerCase() === providedAnswer.toLowerCase() : currentQuestion.a === providedAnswer;
			if (isCorrect) {
				console.log(`Correct answer '${providedAnswer}' from: ${name}`);

				if (!standings[name]) standings[name] = 0;
				standings[name]++;

				currentQuestion = null;

				msgDtls.react('✅');
				saveStandings();
			} else {
				msgDtls.react('❌');
				console.log(`Inorrect answer '${providedAnswer}' != '${currentQuestion.a}' from: ${name}`);
			}
		}

		if (providedAnswer == 'standings') {
			const standingsMsg = Object.entries(standings)
				// .sort((a, b) => b[1] - a[1])
				.map(([name, score]) => `${name}: ${score}`)
				.join('\n');
			channel.send('```\n' + standingsMsg + '\n```');
		}
	}
});

async function askQuestion() {
	console.log('Asking question ...');
	try {
		const questionN = Math.floor(Math.random() * questions.length);
		const processingQuestion = questions[questionN];
		const question_parts = await processingQuestion();
		let { q, a } = question_parts;
		currentQuestion = { q, a, caseInsensitive: question_parts.caseInsensitive };
		console.log(`  > ${currentQuestion.q}`);
		channel.send(q);
	} catch (error) {
		console.error('Unable to ask questions', error);
	}
}

async function saveStandings() {
	console.log('Saving standings ...');
	const fs = await import('fs');
	fs.writeFileSync(persistentStoragePath, JSON.stringify(standings));
}

let readyToAskOn;
function initSleepLoop() {
	setInterval(() => {
		if (!readyToAskOn) {
			//ask the question between 25-35 minutes randomly
			let randomTime = Math.floor(Math.random() * intervalVariance) + intervalMinutes;
			readyToAskOn = new Date().getTime() + randomTime * 60 * 1000;
			console.log(`Next question in ${randomTime} minutes: ${readyToAskOn}`);
		}
		const now = new Date().getTime();
		if (now >= readyToAskOn) {
			askQuestion();
			readyToAskOn = null;
		}
	}, 5000); // every 5 seconds
}

client.login(token);